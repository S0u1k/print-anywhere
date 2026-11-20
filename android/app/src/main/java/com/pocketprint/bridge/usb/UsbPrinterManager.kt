package com.pocketprint.bridge.usb

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.*
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class UsbPrinterManager(private val context: Context) {

    companion object {
        const val ACTION_USB_PERMISSION = "com.pocketprint.bridge.USB_PERMISSION"
        private const val TAG = "UsbPrinterManager"
        const val CANON_VID = 0x04A9
        const val CANON_MG2570S_PID = 0x176D
    }

    private val usbManager: UsbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager

    private val _connectedDevice = MutableStateFlow<UsbDevice?>(null)
    val connectedDevice: StateFlow<UsbDevice?> = _connectedDevice.asStateFlow()

    private val _hasPermission = MutableStateFlow(false)
    val hasPermission: StateFlow<Boolean> = _hasPermission.asStateFlow()

    private val _diagnosticInfo = MutableStateFlow<UsbDiagnosticInfo?>(null)
    val diagnosticInfo: StateFlow<UsbDiagnosticInfo?> = _diagnosticInfo.asStateFlow()

    private var activeConnection: UsbDeviceConnection? = null
    private var claimedInterface: UsbInterface? = null
    private var bulkOutEndpoint: UsbEndpoint? = null
    private var bulkInEndpoint: UsbEndpoint? = null

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                ACTION_USB_PERMISSION -> {
                    synchronized(this) {
                        val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                        }

                        if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                            device?.let {
                                Log.i(TAG, "USB Permission granted for: ${it.deviceName}")
                                _hasPermission.value = true
                                inspectAndConnectDevice(it)
                            }
                        } else {
                            Log.w(TAG, "USB Permission denied for device: ${device?.deviceName}")
                            _hasPermission.value = false
                        }
                    }
                }
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    Log.i(TAG, "USB Device Attached")
                    scanDevices()
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    Log.i(TAG, "USB Device Detached")
                    disconnect()
                    _connectedDevice.value = null
                    _diagnosticInfo.value = null
                    _hasPermission.value = false
                }
            }
        }
    }

    fun initialize() {
        val filter = IntentFilter().apply {
            addAction(ACTION_USB_PERMISSION)
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(usbReceiver, filter)
        }
        scanDevices()
    }

    fun unregister() {
        try {
            context.unregisterReceiver(usbReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering USB receiver", e)
        }
        disconnect()
    }

    fun scanDevices(): List<UsbDevice> {
        val deviceList = usbManager.deviceList
        Log.d(TAG, "Found ${deviceList.size} USB devices attached")

        var candidate: UsbDevice? = null
        for ((_, device) in deviceList) {
            val isCanon = device.vendorId == CANON_VID && device.productId == CANON_MG2570S_PID
            val isPrinterClass = isUsbPrinterClass(device)
            if (isCanon || isPrinterClass) {
                candidate = device
                break
            }
        }

        if (candidate != null) {
            _connectedDevice.value = candidate
            if (usbManager.hasPermission(candidate)) {
                _hasPermission.value = true
                inspectAndConnectDevice(candidate)
            } else {
                _hasPermission.value = false
                requestPermission(candidate)
            }
        } else if (deviceList.isNotEmpty()) {
            val first = deviceList.values.first()
            _connectedDevice.value = first
            if (usbManager.hasPermission(first)) {
                _hasPermission.value = true
                inspectAndConnectDevice(first)
            }
        }
        return deviceList.values.toList()
    }

    fun requestPermission(device: UsbDevice) {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val permissionIntent = PendingIntent.getBroadcast(
            context, 0, Intent(ACTION_USB_PERMISSION), flags
        )
        usbManager.requestPermission(device, permissionIntent)
    }

    private fun isUsbPrinterClass(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            if (intf.interfaceClass == UsbConstants.USB_CLASS_PRINTER) {
                return true
            }
        }
        return false
    }

    fun inspectAndConnectDevice(device: UsbDevice) {
        val connection = usbManager.openDevice(device)
        if (connection == null) {
            Log.e(TAG, "Failed to open USB device connection")
            return
        }

        activeConnection = connection

        val interfacesList = mutableListOf<UsbInterfaceInfo>()
        var foundBulkOut: UsbEndpoint? = null
        var foundBulkIn: UsbEndpoint? = null
        var printerIntf: UsbInterface? = null
        var printerIntfIndex = 0

        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            val isPrinter = intf.interfaceClass == UsbConstants.USB_CLASS_PRINTER
            val endpointList = mutableListOf<UsbEndpointInfo>()

            for (j in 0 until intf.endpointCount) {
                val ep = intf.getEndpoint(j)
                val isOut = ep.direction == UsbConstants.USB_DIR_OUT
                val isBulk = ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK

                endpointList.add(
                    UsbEndpointInfo(
                        address = ep.address,
                        direction = if (isOut) "OUT" else "IN",
                        type = when (ep.type) {
                            UsbConstants.USB_ENDPOINT_XFER_BULK -> "BULK"
                            UsbConstants.USB_ENDPOINT_XFER_CONTROL -> "CONTROL"
                            UsbConstants.USB_ENDPOINT_XFER_INT -> "INTERRUPT"
                            else -> "ISOCHRONOUS"
                        },
                        maxPacketSize = ep.maxPacketSize
                    )
                )

                if (isBulk && isOut && foundBulkOut == null) {
                    foundBulkOut = ep
                    printerIntf = intf
                    printerIntfIndex = i
                } else if (isBulk && !isOut && foundBulkIn == null) {
                    foundBulkIn = ep
                }
            }

            interfacesList.add(
                UsbInterfaceInfo(
                    id = intf.id,
                    interfaceClass = intf.interfaceClass,
                    interfaceSubclass = intf.interfaceSubclass,
                    interfaceProtocol = intf.interfaceProtocol,
                    isPrinterClass = isPrinter,
                    endpoints = endpointList
                )
            )
        }

        // Claim interface
        printerIntf?.let {
            val claimed = connection.claimInterface(it, true)
            if (claimed) {
                claimedInterface = it
                bulkOutEndpoint = foundBulkOut
                bulkInEndpoint = foundBulkIn
                Log.i(TAG, "Claimed USB Interface ${it.id}. Bulk OUT: ${foundBulkOut?.address}, Bulk IN: ${foundBulkIn?.address}")
            } else {
                Log.w(TAG, "Failed to claim USB Interface ${it.id}")
            }
        }

        // Read IEEE 1284 Device ID String via USB Control Transfer
        val ieee1284String = readIeee1284String(connection, printerIntfIndex)

        val isCanon = device.vendorId == CANON_VID && device.productId == CANON_MG2570S_PID

        val diagnostic = UsbDiagnosticInfo(
            deviceName = device.deviceName,
            vendorIdHex = String.format("0x%04X", device.vendorId),
            productIdHex = String.format("0x%04X", device.productId),
            vendorIdInt = device.vendorId,
            productIdInt = device.productId,
            manufacturerName = device.manufacturerName,
            productName = device.productName,
            serialNumber = try { device.serialNumber } catch (e: Exception) { null },
            deviceClass = device.deviceClass,
            deviceSubclass = device.deviceSubclass,
            deviceProtocol = device.deviceProtocol,
            interfaces = interfacesList,
            ieee1284DeviceId = ieee1284String,
            isCanonPixmaMg2500Series = isCanon,
            hasBulkOutEndpoint = foundBulkOut != null,
            hasBulkInEndpoint = foundBulkIn != null,
            bulkOutEndpointAddress = foundBulkOut?.address,
            bulkInEndpointAddress = foundBulkIn?.address,
            rawDescriptorSummary = "VID: ${device.vendorId}, PID: ${device.productId}, IntfCount: ${device.interfaceCount}"
        )

        _diagnosticInfo.value = diagnostic
    }

    private fun readIeee1284String(connection: UsbDeviceConnection, interfaceIndex: Int): String? {
        return try {
            val buffer = ByteArray(1024)
            // RequestType: 0xA1 (Class, Interface, Device-to-Host)
            // Request: 0x00 (GET_DEVICE_ID)
            // Value: 0 (Config index)
            // Index: interfaceIndex
            val length = connection.controlTransfer(0xA1, 0x00, 0, interfaceIndex, buffer, buffer.size, 2000)
            if (length > 2) {
                // IEEE-1284 string starts with 2-byte big endian length
                val actualLength = ((buffer[0].toInt() and 0xFF) shl 8) or (buffer[1].toInt() and 0xFF)
                val len = minOf(actualLength - 2, length - 2)
                if (len > 0) {
                    String(buffer, 2, len, Charsets.US_ASCII)
                } else null
            } else null
        } catch (e: Exception) {
            Log.w(TAG, "Could not read IEEE 1284 string", e)
            null
        }
    }

    fun getActiveConnection(): UsbDeviceConnection? = activeConnection
    fun getBulkOutEndpoint(): UsbEndpoint? = bulkOutEndpoint
    fun getBulkInEndpoint(): UsbEndpoint? = bulkInEndpoint

    fun disconnect() {
        try {
            claimedInterface?.let {
                activeConnection?.releaseInterface(it)
                claimedInterface = null
            }
            activeConnection?.close()
            activeConnection = null
            bulkOutEndpoint = null
            bulkInEndpoint = null
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting USB connection", e)
        }
    }
}
