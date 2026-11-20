package com.pocketprint.bridge.driver

import android.graphics.Bitmap
import android.graphics.Color
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.util.Log
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.usb.UsbDiagnosticInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

class CanonPixmaBackend : PrinterBackend {
    companion object {
        private const val TAG = "CanonPixmaBackend"
        const val CANON_VID = 0x04A9
        const val CANON_MG2570S_PID = 0x176D

        private val PJL_ESCAPE = byteArrayOf(0x1B, 0x25, 0x2D, 0x31, 0x32, 0x33, 0x34, 0x35, 0x58) // \x1b%-12345X
    }

    override val backendId: String = "CANON_PIXMA_MG2500"
    override val displayName: String = "Canon PIXMA MG2500 Series (BJL / BJRaster3)"
    override val isSimulated: Boolean = false

    override fun isCompatible(device: UsbDevice?, diag: UsbDiagnosticInfo?): Boolean {
        if (device == null) return false
        if (device.vendorId == CANON_VID && device.productId == CANON_MG2570S_PID) {
            return true
        }
        if (diag?.isCanonPixmaMg2500Series == true) return true
        val ieee = diag?.ieee1284DeviceId?.uppercase() ?: ""
        return ieee.contains("CANON") && (ieee.contains("MG2500") || ieee.contains("MG2570") || ieee.contains("BJL"))
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
            return@withContext PrintResult.Error(
                errorType = "USB_DISCONNECTED",
                message = "Cannot print: USB connection or Bulk OUT endpoint is not open."
            )
        }

        try {
            onProgress("INITIALIZING", 5, "Preparing Canon BJL job header...")

            // 1. Build BJL Job Header
            val headerStream = ByteArrayOutputStream()
            headerStream.write(PJL_ESCAPE)
            val bjlCommands = StringBuilder()
                .append("@PJL\r\n")
                .append("@BJL START JOB\r\n")
                .append("@BJL SET RESOLUTION=${job.options.dpi}\r\n")
                .append("@BJL SET PAPER=${job.options.paperSize}\r\n")
                .append("@BJL SET MEDIATYPE=PLAIN\r\n")
                .append("@BJL SET COLOR=${if (job.options.colorMode == "MONOCHROME") "MONO" else "COLOR"}\r\n")
                .append("@BJL SET COPIES=${job.options.copies}\r\n")
                .toString()
            headerStream.write(bjlCommands.toByteArray(Charsets.US_ASCII))

            val headerBytes = headerStream.toByteArray()
            val headerWritten = connection.bulkTransfer(bulkOut, headerBytes, headerBytes.size, 5000)
            if (headerWritten < 0) {
                return@withContext PrintResult.Error(
                    errorType = "USB_TRANSFER_FAILED",
                    message = "Failed to send Canon BJL header: USB transfer returned code $headerWritten"
                )
            }

            var totalBytesSent = headerBytes.size.toLong()
            val totalPages = pageBitmaps.size

            // 2. Stream Page Raster Swaths
            for (pageIndex in 0 until totalPages) {
                val bitmap = pageBitmaps[pageIndex]
                val pageProgressBase = 10 + (pageIndex * 80 / totalPages)
                onProgress("RENDERING", pageProgressBase, "Rasterizing Page ${pageIndex + 1} of $totalPages...")

                val pageRaster = encodePageToCanonRaster(bitmap, job.options.colorMode == "MONOCHROME")
                val chunkSize = 4096
                var offset = 0
                val pageLength = pageRaster.size

                while (offset < pageLength) {
                    val remaining = pageLength - offset
                    val sendLen = minOf(chunkSize, remaining)
                    val chunk = ByteArray(sendLen)
                    System.arraycopy(pageRaster, offset, chunk, 0, sendLen)

                    val sent = connection.bulkTransfer(bulkOut, chunk, sendLen, 8000)
                    if (sent < 0) {
                        return@withContext PrintResult.Error(
                            errorType = "USB_PIPE_STALL",
                            message = "USB transmission stalled at Page ${pageIndex + 1}, offset $offset"
                        )
                    }

                    offset += sent
                    totalBytesSent += sent

                    val currentProgress = pageProgressBase + ((offset.toFloat() / pageLength) * (80f / totalPages)).toInt()
                    onProgress("PRINTING", minOf(95, currentProgress), "Streaming page ${pageIndex + 1}/$totalPages: $offset / $pageLength bytes...")
                }

                // Check Bulk IN status response if available
                bulkIn?.let { inEp ->
                    val statusBuffer = ByteArray(64)
                    val read = connection.bulkTransfer(inEp, statusBuffer, statusBuffer.size, 500)
                    if (read > 0) {
                        val statusStr = String(statusBuffer, 0, read, Charsets.US_ASCII)
                        Log.d(TAG, "Bulk IN status from Canon printer: $statusStr")
                        if (statusStr.contains("ERROR") || statusStr.contains("JAM")) {
                            return@withContext PrintResult.Error(
                                errorType = "PRINTER_HARDWARE_ERROR",
                                message = "Hardware status returned error: $statusStr"
                            )
                        }
                    }
                }
            }

            // 3. Send BJL End of Job
            val footerStream = ByteArrayOutputStream()
            val footerCommands = "@BJL END JOB\r\n"
            footerStream.write(footerCommands.toByteArray(Charsets.US_ASCII))
            footerStream.write(PJL_ESCAPE)
            val footerBytes = footerStream.toByteArray()
            connection.bulkTransfer(bulkOut, footerBytes, footerBytes.size, 5000)
            totalBytesSent += footerBytes.size

            onProgress("DATA_ACCEPTED", 98, "Printer accepted all $totalBytesSent bytes successfully.")

            PrintResult.Success(
                verifiedPhysical = true,
                message = "Canon PIXMA MG2500 accepted all $totalPages pages ($totalBytesSent bytes) via USB.",
                bytesTransmitted = totalBytesSent
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error during Canon print job execution", e)
            PrintResult.Error(
                errorType = "EXECUTION_EXCEPTION",
                message = "Exception during print: ${e.message}",
                canRetry = true
            )
        }
    }

    private fun encodePageToCanonRaster(bitmap: Bitmap, isMonochrome: Boolean): ByteArray {
        val stream = ByteArrayOutputStream()
        val width = bitmap.width
        val height = bitmap.height

        // Page start escape sequence
        stream.write(byteArrayOf(0x1B, 0x28, 0x72, 0x01, 0x00, 0x01)) // ESC ( r 1 (Raster mode start)

        val rowBytes = (width + 7) / 8
        val rowBuffer = ByteArray(rowBytes)

        for (y in 0 until height) {
            java.util.Arrays.fill(rowBuffer, 0.toByte())
            var hasBlackPixel = false

            for (x in 0 until width) {
                val pixel = bitmap.getPixel(x, y)
                val isDark = if (isMonochrome) {
                    val lum = (Color.red(pixel) * 299 + Color.green(pixel) * 587 + Color.blue(pixel) * 114) / 1000
                    lum < 128
                } else {
                    val red = Color.red(pixel)
                    val green = Color.green(pixel)
                    val blue = Color.blue(pixel)
                    (red < 200 || green < 200 || blue < 200)
                }

                if (isDark) {
                    hasBlackPixel = true
                    val byteIndex = x / 8
                    val bitIndex = 7 - (x % 8)
                    rowBuffer[byteIndex] = (rowBuffer[byteIndex].toInt() or (1 shl bitIndex)).toByte()
                }
            }

            if (hasBlackPixel) {
                // ESC ( A len_low len_high [bytes]
                stream.write(0x1B)
                stream.write(0x28)
                stream.write(0x41)
                stream.write(rowBytes and 0xFF)
                stream.write((rowBytes shr 8) and 0xFF)
                stream.write(rowBuffer)
            } else {
                // Empty raster line advance
                stream.write(byteArrayOf(0x1B, 0x28, 0x65, 0x01, 0x00, 0x01))
            }
        }

        // Form Feed & Raster End
        stream.write(byteArrayOf(0x0C)) // Form feed (Page Eject)
        stream.write(byteArrayOf(0x1B, 0x28, 0x72, 0x00, 0x00)) // Raster mode end
        return stream.toByteArray()
    }
}
