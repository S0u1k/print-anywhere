package com.pocketprint.bridge.data.model

import com.google.gson.annotations.SerializedName

enum class JobStatus {
    @SerializedName("UPLOADED")
    UPLOADED,

    @SerializedName("QUEUED")
    QUEUED,

    @SerializedName("SENT_TO_DEVICE")
    SENT_TO_DEVICE,

    @SerializedName("RECEIVED_BY_DEVICE")
    RECEIVED_BY_DEVICE,

    @SerializedName("RENDERING")
    RENDERING,

    @SerializedName("PRINTING")
    PRINTING,

    @SerializedName("DATA_ACCEPTED")
    DATA_ACCEPTED,

    @SerializedName("COMPLETED")
    COMPLETED,

    @SerializedName("SIMULATED_COMPLETED")
    SIMULATED_COMPLETED,

    @SerializedName("FAILED")
    FAILED,

    @SerializedName("CANCELLED")
    CANCELLED;

    fun isTerminal(): Boolean = this in listOf(COMPLETED, SIMULATED_COMPLETED, FAILED, CANCELLED)
}

data class PrintOptions(
    val copies: Int = 1,
    val pageRange: String = "ALL", // "ALL", "1-3", "2"
    val paperSize: String = "A4",   // "A4", "LETTER"
    val orientation: String = "PORTRAIT", // "PORTRAIT", "LANDSCAPE"
    val colorMode: String = "COLOR", // "COLOR", "MONOCHROME"
    val dpi: Int = 300
)

data class PrintJob(
    val id: String,
    val userId: String,
    val deviceId: String,
    val fileName: String,
    val fileSize: Long,
    val fileUrl: String,
    val downloadToken: String? = null,
    val status: JobStatus = JobStatus.QUEUED,
    val options: PrintOptions = PrintOptions(),
    val totalPages: Int = 0,
    val currentPage: Int = 0,
    val progressPercent: Int = 0,
    val errorMessage: String? = null,
    val isSimulated: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

data class DeviceStatus(
    val deviceId: String,
    val isOnline: Boolean,
    val isPrinterConnected: Boolean,
    val printerModel: String?,
    val printerVid: Int?,
    val printerPid: Int?,
    val activeBackend: String?,
    val pendingJobsCount: Int = 0,
    val completedJobsCount: Int = 0,
    val failedJobsCount: Int = 0,
    val lastSuccessfulPrintTime: Long? = null,
    val batteryPercent: Int = 100,
    val isPowerConnected: Boolean = true
)

data class PairingInfo(
    val pairingCode: String,
    val qrPayload: String,
    val relayServerUrl: String,
    val expiresAt: Long
)
