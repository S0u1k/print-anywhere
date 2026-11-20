package com.pocketprint.bridge.driver

import android.graphics.Bitmap
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.usb.UsbDiagnosticInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

class SimulatedPrinterBackend : PrinterBackend {
    override val backendId: String = "SIMULATED_PRINTER"
    override val displayName: String = "PocketPrint Virtual Simulator (Hardware Sandbox)"
    override val isSimulated: Boolean = true

    override fun isCompatible(device: UsbDevice?, diag: UsbDiagnosticInfo?): Boolean {
        // Can be used on-demand or as fallback
        return true
    }

    override suspend fun processJob(
        job: PrintJob,
        pageBitmaps: List<Bitmap>,
        connection: UsbDeviceConnection?,
        bulkOut: UsbEndpoint?,
        bulkIn: UsbEndpoint?,
        onProgress: (stage: String, percent: Int, message: String) -> Unit
    ): PrintResult = withContext(Dispatchers.IO) {
        onProgress("INITIALIZING", 5, "[SIMULATED] Initializing virtual print engine...")
        delay(400)

        val totalPages = pageBitmaps.size
        var virtualBytes = 0L

        for (pageIndex in 0 until totalPages) {
            val bitmap = pageBitmaps[pageIndex]
            val pageProgressBase = 10 + (pageIndex * 80 / totalPages)
            onProgress(
                "RENDERING",
                pageProgressBase,
                "[SIMULATED] Rasterizing Page ${pageIndex + 1}/$totalPages (${bitmap.width}x${bitmap.height} px)..."
            )
            delay(350)

            // Simulate sending swaths
            val swaths = 8
            for (swath in 1..swaths) {
                val swathProgress = pageProgressBase + ((swath.toFloat() / swaths) * (80f / totalPages)).toInt()
                val swathBytes = (bitmap.width * (bitmap.height / swaths) * 4) / 8 // ~1bpp equivalent
                virtualBytes += swathBytes

                onProgress(
                    "PRINTING",
                    minOf(95, swathProgress),
                    "[SIMULATED] Virtual printhead swath $swath/$swaths for Page ${pageIndex + 1}..."
                )
                delay(200)
            }
        }

        onProgress("DATA_ACCEPTED", 98, "[SIMULATED] Virtual spooler acknowledged receipt of all pages.")
        delay(300)

        PrintResult.Success(
            verifiedPhysical = false,
            message = "[SIMULATED PRINT] Job completed in virtual sandbox ($virtualBytes virtual raster bytes processed). Not sent to physical hardware.",
            bytesTransmitted = virtualBytes
        )
    }
}
