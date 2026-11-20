package com.pocketprint.bridge.driver

import android.graphics.Bitmap
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.usb.UsbDiagnosticInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

class GenericRasterBackend : PrinterBackend {
    override val backendId: String = "GENERIC_RASTER"
    override val displayName: String = "Generic USB Raster Stream"
    override val isSimulated: Boolean = false

    override fun isCompatible(device: UsbDevice?, diag: UsbDiagnosticInfo?): Boolean {
        return diag?.hasBulkOutEndpoint == true
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
            var totalBytes = 0L
            for (i in pageBitmaps.indices) {
                val bmp = pageBitmaps[i]
                onProgress("PRINTING", 20 + (i * 70 / pageBitmaps.size), "Sending generic raster page ${i + 1}...")

                val stream = ByteArrayOutputStream()
                bmp.compress(Bitmap.CompressFormat.PNG, 100, stream)
                val rawBytes = stream.toByteArray()
                connection.bulkTransfer(bulkOut, rawBytes, rawBytes.size, 15000)
                totalBytes += rawBytes.size
            }
            onProgress("DATA_ACCEPTED", 100, "Generic raster sent $totalBytes bytes.")
            PrintResult.Success(true, "Generic raster complete", totalBytes)
        } catch (e: Exception) {
            PrintResult.Error("GENERIC_EXCEPTION", "Error: ${e.message}")
        }
    }
}
