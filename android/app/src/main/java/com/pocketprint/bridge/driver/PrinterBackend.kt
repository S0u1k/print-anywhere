package com.pocketprint.bridge.driver

import android.graphics.Bitmap
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.usb.UsbDiagnosticInfo

sealed class PrintResult {
    data class Success(
        val verifiedPhysical: Boolean,
        val message: String,
        val bytesTransmitted: Long
    ) : PrintResult()

    data class Error(
        val errorType: String,
        val message: String,
        val canRetry: Boolean = false
    ) : PrintResult()
}

interface PrinterBackend {
    val backendId: String
    val displayName: String
    val isSimulated: Boolean

    fun isCompatible(device: UsbDevice?, diag: UsbDiagnosticInfo?): Boolean

    suspend fun processJob(
        job: PrintJob,
        pageBitmaps: List<Bitmap>,
        connection: UsbDeviceConnection?,
        bulkOut: UsbEndpoint?,
        bulkIn: UsbEndpoint?,
        onProgress: (stage: String, percent: Int, message: String) -> Unit
    ): PrintResult
}
