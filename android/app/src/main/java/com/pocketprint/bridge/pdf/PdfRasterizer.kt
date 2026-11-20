package com.pocketprint.bridge.pdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Log
import com.pocketprint.bridge.data.model.PrintOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class PdfRasterizer(private val context: Context) {
    companion object {
        private const val TAG = "PdfRasterizer"
    }

    suspend fun rasterize(
        pdfFile: File,
        options: PrintOptions,
        onPageRendered: (Int, Int) -> Unit = { _, _ -> }
    ): List<Bitmap> = withContext(Dispatchers.IO) {
        val bitmaps = mutableListOf<Bitmap>()
        var pfd: ParcelFileDescriptor? = null
        var renderer: PdfRenderer? = null

        try {
            pfd = ParcelFileDescriptor.open(pdfFile, ParcelFileDescriptor.MODE_READ_ONLY)
            renderer = PdfRenderer(pfd)
            val pageCount = renderer.pageCount
            val pagesToPrint = parsePageRange(options.pageRange, pageCount)

            // Dimensions: Standard A4 at 300 DPI is approx 2480 x 3508.
            // For memory efficiency in mobile heap, compute based on PDF native points (72 DPI) scaled to target DPI.
            val scale = options.dpi.toFloat() / 72f

            for (pageIndex in pagesToPrint) {
                val page = renderer.openPage(pageIndex)

                var targetWidth = (page.width * scale).toInt()
                var targetHeight = (page.height * scale).toInt()

                // Limit maximum width to avoid OutOfMemory on lower-tier phones
                val maxDimension = 3000
                if (targetWidth > maxDimension || targetHeight > maxDimension) {
                    val ratio = minOf(maxDimension.toFloat() / targetWidth, maxDimension.toFloat() / targetHeight)
                    targetWidth = (targetWidth * ratio).toInt()
                    targetHeight = (targetHeight * ratio).toInt()
                }

                if (options.orientation == "LANDSCAPE" && targetWidth < targetHeight) {
                    val tmp = targetWidth
                    targetWidth = targetHeight
                    targetHeight = tmp
                }

                val bitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                canvas.drawColor(Color.WHITE) // PDF background must be white, not transparent

                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                page.close()

                bitmaps.add(bitmap)
                onPageRendered(bitmaps.size, pagesToPrint.size)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error rasterizing PDF: ${pdfFile.absolutePath}", e)
            // Recycle already created bitmaps if failed
            bitmaps.forEach { it.recycle() }
            bitmaps.clear()
            throw e
        } finally {
            try {
                renderer?.close()
                pfd?.close()
            } catch (e: Exception) {
                Log.e(TAG, "Error closing PdfRenderer", e)
            }
        }

        return@withContext bitmaps
    }

    private fun parsePageRange(rangeStr: String, maxPages: Int): List<Int> {
        val trimmed = rangeStr.trim().uppercase()
        if (trimmed == "ALL" || trimmed.isEmpty()) {
            return (0 until maxPages).toList()
        }

        val result = mutableSetOf<Int>()
        val parts = trimmed.split(",")
        for (part in parts) {
            val range = part.trim()
            if (range.contains("-")) {
                val bounds = range.split("-")
                val start = (bounds[0].toIntOrNull() ?: 1) - 1
                val end = (bounds[1].toIntOrNull() ?: maxPages) - 1
                for (p in maxOf(0, start)..minOf(maxPages - 1, end)) {
                    result.add(p)
                }
            } else {
                val page = (range.toIntOrNull() ?: 1) - 1
                if (page in 0 until maxPages) {
                    result.add(page)
                }
            }
        }
        return result.sorted()
    }
}
