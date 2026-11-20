package com.pocketprint.bridge.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface PrintJobDao {
    @Query("SELECT * FROM local_print_jobs ORDER BY createdAt DESC")
    fun getAllJobs(): Flow<List<LocalPrintJob>>

    @Query("SELECT * FROM local_print_jobs WHERE status IN ('QUEUED', 'SENT_TO_DEVICE', 'RECEIVED_BY_DEVICE', 'RENDERING', 'PRINTING') ORDER BY createdAt ASC")
    fun getActiveQueue(): Flow<List<LocalPrintJob>>

    @Query("SELECT * FROM local_print_jobs WHERE id = :id")
    suspend fun getJobById(id: String): LocalPrintJob?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(job: LocalPrintJob)

    @Query("UPDATE local_print_jobs SET status = :status, progressPercent = :percent, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, percent: Int, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE local_print_jobs SET status = :status, errorMessage = :error, updatedAt = :updatedAt WHERE id = :id")
    suspend fun markFailed(id: String, status: String, error: String?, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM local_print_jobs WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM local_print_jobs")
    suspend fun clearAll()
}
