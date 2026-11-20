package com.pocketprint.bridge.driver

import android.graphics.Bitmap
import android.graphics.Color
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.usb.UsbDiagnosticInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

class PclBackend : PrinterBackend {
    override val backendId: String = "HP_PCL3_PCL5"
    override val displayName: String = "HP PCL Compatible Driver (PCL3/PCL5/PCL6)"
    override val isSimulated: Boolean = false

    override fun isCompatible(device: UsbDevice?, diag: UsbDiagnosticInfo?): Boolean {
        val ieee = diag?.ieee1284DeviceId?.uppercase() ?: ""
        return ieee.contains("PCL") || (device?.vendorId == 0x03F0) // HP Vendor ID
    }

    override suspend fun processJob(
        job: PrintJob,
        pageBitmaps: List<Bitmap>,
        connection: UsbDeviceConnection?,
        bulkOut: UsbEndpoint?,
        bulkIn: UsbEndpoint?,
        onProgress: (stage: String, percent: Int, message: String) -> Unit
    ): PrintResult = withContext(Dispatchers.IO) {
        if (connection == null || bulkOut == null) {
            return@withContext PrintResult.Error("USB_DISCONNECTED", "USB connection or Bulk OUT is null")
        }

        try {
            onProgress("INITIALIZING", 5, "Sending PCL reset & initialization...")
            val stream = ByteArrayOutputStream()
            // Reset printer (ESC E)
            stream.write(byteArrayOf(0x1B, 0x45))
            // Enter PCL mode
            val initCmd = "\u001b&l0E\u001b&l2A\u001b*r0A"
            stream.write(initCmd.toByteArray(Charsets.US_ASCII))

            val initBytes = stream.toByteArray()
            connection.bulkTransfer(bulkOut, initBytes, initBytes.size, 5000)
            var totalBytes = initBytes.size.toLong()

            for (i in pageBitmaps.indices) {
                val bmp = pageBitmaps[i]
                onProgress("PRINTING", 20 + (i * 70 / pageBitmaps.size), "Sending PCL raster data for Page ${i + 1}...")

                val pageStream = ByteArrayOutputStream()
                val width = bmp.width
                val height = bmp.height
                val rowBytes = (width + 7) / 8
                val rowBuf = ByteArray(rowBytes)

                for (y in 0 until height) {
                    java.util.Arrays.fill(rowBuf, 0.toByte())
                    for (x in 0 until width) {
                        val p = bmp.getPixel(x, y)
                        val lum = (Color.red(p) * 299 + Color.green(p) * 587 + Color.blue(p) * 114) / 1000
                        if (lum < 128) {
                            rowBuf[x / 8] = (rowBuf[x / 8].toInt() or (1 shl (7 - (x % 8)))).toByte()
                        }
                    }
                    val rowHeader = "\u001b*b${rowBytes}W"
                    pageStream.write(rowHeader.toByteArray(Charsets.US_ASCII))
                    pageStream.write(rowBuf)
                }

                // Page end: Form Feed
                pageStream.write(byteArrayOf(0x1B, 0x2A, 0x72, 0x42, 0x0C)) // ESC * r B (End raster) + FF
                val pageData = pageStream.toByteArray()
                connection.bulkTransfer(bulkOut, pageData, pageData.size, 15000)
                totalBytes += pageData.size
            }

            // Printer Reset
            val endStream = byteArrayOf(0x1B, 0x45)
            connection.bulkTransfer(bulkOut, endStream, endStream.size, 5000)
            totalBytes += endStream.size

            onProgress("DATA_ACCEPTED", 100, "PCL printer accepted $totalBytes bytes.")
            PrintResult.Success(true, "PCL printing complete", totalBytes)
        } catch (e: Exception) {
            PrintResult.Error("PCL_EXCEPTION", "PCL error: ${e.message}")
        }
    }
}
