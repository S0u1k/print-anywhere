package com.pocketprint.bridge.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.pocketprint.bridge.data.model.JobStatus
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.data.model.PrintOptions

@Entity(tableName = "local_print_jobs")
data class LocalPrintJob(
    @PrimaryKey val id: String,
    val userId: String,
    val deviceId: String,
    val fileName: String,
    val fileSize: Long,
    val fileUrl: String,
    val downloadToken: String?,
    val status: String,
    val copies: Int,
    val pageRange: String,
    val paperSize: String,
    val orientation: String,
    val colorMode: String,
    val dpi: Int,
    val totalPages: Int,
    val currentPage: Int,
    val progressPercent: Int,
    val errorMessage: String?,
    val isSimulated: Boolean,
    val createdAt: Long,
    val updatedAt: Long
) {
    fun toDomain(): PrintJob {
        return PrintJob(
            id = id,
            userId = userId,
            deviceId = deviceId,
            fileName = fileName,
            fileSize = fileSize,
            fileUrl = fileUrl,
            downloadToken = downloadToken,
            status = try { JobStatus.valueOf(status) } catch (e: Exception) { JobStatus.QUEUED },
            options = PrintOptions(
                copies = copies,
                pageRange = pageRange,
                paperSize = paperSize,
                orientation = orientation,
                colorMode = colorMode,
                dpi = dpi
            ),
            totalPages = totalPages,
            currentPage = currentPage,
            progressPercent = progressPercent,
            errorMessage = errorMessage,
            isSimulated = isSimulated,
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }

    companion object {
        fun fromDomain(job: PrintJob): LocalPrintJob {
            return LocalPrintJob(
                id = job.id,
                userId = job.userId,
                deviceId = job.deviceId,
                fileName = job.fileName,
                fileSize = job.fileSize,
                fileUrl = job.fileUrl,
                downloadToken = job.downloadToken,
                status = job.status.name,
                copies = job.options.copies,
                pageRange = job.options.pageRange,
                paperSize = job.options.paperSize,
                orientation = job.options.orientation,
                colorMode = job.options.colorMode,
                dpi = job.options.dpi,
                totalPages = job.totalPages,
                currentPage = job.currentPage,
                progressPercent = job.progressPercent,
                errorMessage = job.errorMessage,
                isSimulated = job.isSimulated,
                createdAt = job.createdAt,
                updatedAt = job.updatedAt
            )
        }
    }
}
