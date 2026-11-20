package com.pocketprint.bridge.usb

data class UsbEndpointInfo(
    val address: Int,
    val direction: String, // "IN" or "OUT"
    val type: String,      // "BULK", "CONTROL", "INTERRUPT"
    val maxPacketSize: Int
)

data class UsbInterfaceInfo(
    val id: Int,
    val interfaceClass: Int,
    val interfaceSubclass: Int,
    val interfaceProtocol: Int,
    val isPrinterClass: Boolean,
    val endpoints: List<UsbEndpointInfo>
)

data class UsbDiagnosticInfo(
    val deviceName: String,
    val vendorIdHex: String,
    val productIdHex: String,
    val vendorIdInt: Int,
    val productIdInt: Int,
    val manufacturerName: String?,
    val productName: String?,
    val serialNumber: String?,
    val deviceClass: Int,
    val deviceSubclass: Int,
    val deviceProtocol: Int,
    val interfaces: List<UsbInterfaceInfo>,
    val ieee1284DeviceId: String?,
    val isCanonPixmaMg2500Series: Boolean,
    val hasBulkOutEndpoint: Boolean,
    val hasBulkInEndpoint: Boolean,
    val bulkOutEndpointAddress: Int?,
    val bulkInEndpointAddress: Int?,
    val rawDescriptorSummary: String
)
