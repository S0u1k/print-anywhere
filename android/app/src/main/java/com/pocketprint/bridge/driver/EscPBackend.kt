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

class EscPBackend : PrinterBackend {
    override val backendId: String = "EPSON_ESCP_R"
    override val displayName: String = "Epson ESC/P-R Compatible Driver"
    override val isSimulated: Boolean = false

    override fun isCompatible(device: UsbDevice?, diag: UsbDiagnosticInfo?): Boolean {
        val ieee = diag?.ieee1284DeviceId?.uppercase() ?: ""
        return ieee.contains("ESC/P") || (device?.vendorId == 0x04B8) // Epson Vendor ID
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
            onProgress("INITIALIZING", 5, "Initializing Epson ESC/P mode...")
            val stream = ByteArrayOutputStream()
            // Reset printer: ESC @
            stream.write(byteArrayOf(0x1B, 0x40))

            val initBytes = stream.toByteArray()
            connection.bulkTransfer(bulkOut, initBytes, initBytes.size, 5000)
            var totalBytes = initBytes.size.toLong()

            for (i in pageBitmaps.indices) {
                val bmp = pageBitmaps[i]
                onProgress("PRINTING", 20 + (i * 70 / pageBitmaps.size), "Sending ESC/P raster for Page ${i + 1}...")

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
                    // ESC . m h v nL nH
                    pageStream.write(byteArrayOf(0x1B, 0x2E, 0x00, 0x0A, 0x0A, (rowBytes and 0xFF).toByte(), ((rowBytes shr 8) and 0xFF).toByte()))
                    pageStream.write(rowBuf)
                }

                pageStream.write(byteArrayOf(0x0C)) // Form feed
                val pageData = pageStream.toByteArray()
                connection.bulkTransfer(bulkOut, pageData, pageData.size, 15000)
                totalBytes += pageData.size
            }

            onProgress("DATA_ACCEPTED", 100, "Epson printer accepted $totalBytes bytes.")
            PrintResult.Success(true, "Epson ESC/P printing complete", totalBytes)
        } catch (e: Exception) {
            PrintResult.Error("ESCP_EXCEPTION", "Epson error: ${e.message}")
        }
    }
}
