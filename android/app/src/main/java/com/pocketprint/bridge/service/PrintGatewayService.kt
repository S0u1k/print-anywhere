package com.pocketprint.bridge.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.pocketprint.bridge.MainActivity
import com.pocketprint.bridge.R
import com.pocketprint.bridge.data.local.AppDatabase
import com.pocketprint.bridge.data.local.LocalPrintJob
import com.pocketprint.bridge.data.model.DeviceStatus
import com.pocketprint.bridge.data.model.JobStatus
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.driver.CanonPixmaBackend
import com.pocketprint.bridge.driver.PrintResult
import com.pocketprint.bridge.driver.PrinterBackendRegistry
import com.pocketprint.bridge.network.RelayWebSocketClient
import com.pocketprint.bridge.pdf.PdfRasterizer
import com.pocketprint.bridge.usb.UsbPrinterManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File

class PrintGatewayService : Service() {
    companion object {
        private const val TAG = "PrintGatewayService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "pocketprint_gateway_channel"

        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
    }

    inner class LocalBinder : Binder() {
        fun getService(): PrintGatewayService = this@PrintGatewayService
    }

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    lateinit var usbPrinterManager: UsbPrinterManager
    lateinit var relayClient: RelayWebSocketClient
    private lateinit var pdfRasterizer: PdfRasterizer
    private lateinit var database: AppDatabase
    private var wakeLock: PowerManager.WakeLock? = null

    private val _isServiceActive = MutableStateFlow(false)
    val isServiceActive: StateFlow<Boolean> = _isServiceActive.asStateFlow()

    private val _currentActiveJob = MutableStateFlow<PrintJob?>(null)
    val currentActiveJob: StateFlow<PrintJob?> = _currentActiveJob.asStateFlow()

    private var heartbeatJob: Job? = null
    private var isSimulatedMode = false

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Creating PrintGatewayService...")

        usbPrinterManager = UsbPrinterManager(this)
        usbPrinterManager.initialize()

        relayClient = RelayWebSocketClient(this)
        pdfRasterizer = PdfRasterizer(this)
        database = AppDatabase.getDatabase(this)

        setupRelayListeners()
        createNotificationChannel()

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PocketPrint:WakeLock")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopGateway()
                stopSelf()
            }
            else -> {
                startForeground(NOTIFICATION_ID, buildNotification("Listening for remote print jobs..."))
                _isServiceActive.value = true
                acquireWakeLock()
                startHeartbeatLoop()
            }
        }
        return START_STICKY
    }

    fun startGateway(serverUrl: String, deviceId: String, token: String, deviceName: String, simulated: Boolean) {
        this.isSimulatedMode = simulated
        relayClient.connect(serverUrl, deviceId, token, deviceName)
        startHeartbeatLoop()
    }

    fun stopGateway() {
        _isServiceActive.value = false
        heartbeatJob?.cancel()
        relayClient.disconnect()
        usbPrinterManager.disconnect()
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    fun setSimulatedMode(enabled: Boolean) {
        this.isSimulatedMode = enabled
    }

    private fun setupRelayListeners() {
        relayClient.onJobReceived = { job ->
            serviceScope.launch {
                handleIncomingJob(job)
            }
        }

        relayClient.onJobCancelRequested = { jobId ->
            serviceScope.launch {
                handleCancelJob(jobId)
            }
        }
    }

    private suspend fun handleIncomingJob(job: PrintJob) {
        Log.i(TAG, "Handling incoming job: ${job.id} (${job.fileName})")
        _currentActiveJob.value = job

        // 1. Save to Room database
        database.printJobDao().insertOrUpdate(LocalPrintJob.fromDomain(job.copy(status = JobStatus.RECEIVED_BY_DEVICE)))
        relayClient.emitJobStatusUpdate(job.id, JobStatus.RECEIVED_BY_DEVICE, 5, "Received by Android gateway", isSimulatedMode)

        updateNotification("Processing job: ${job.fileName}")

        // 2. Download PDF file
        val tempDir = File(cacheDir, "jobs")
        if (!tempDir.exists()) tempDir.mkdirs()
        val pdfFile = File(tempDir, "${job.id}.pdf")

        val downloaded = relayClient.downloadPdfFile(job.fileUrl, job.downloadToken, pdfFile)
        if (!downloaded) {
            val err = "Failed to download PDF payload from relay"
            database.printJobDao().markFailed(job.id, JobStatus.FAILED.name, err)
            relayClient.emitJobStatusUpdate(job.id, JobStatus.FAILED, 0, err, isSimulatedMode)
            _currentActiveJob.value = null
            return
        }

        // 3. Rasterize PDF
        val pageBitmaps = mutableListOf<Bitmap>()
        try {
            database.printJobDao().updateStatus(job.id, JobStatus.RENDERING.name, 15)
            relayClient.emitJobStatusUpdate(job.id, JobStatus.RENDERING, 15, "Rendering PDF pages into bitmaps...", isSimulatedMode)

            val rendered = pdfRasterizer.rasterize(pdfFile, job.options) { current, total ->
                val pct = 15 + ((current.toFloat() / total) * 15).toInt()
                relayClient.emitJobStatusUpdate(job.id, JobStatus.RENDERING, pct, "Rendered page $current of $total", isSimulatedMode)
            }
            pageBitmaps.addAll(rendered)
        } catch (e: Exception) {
            Log.e(TAG, "Rasterization failed", e)
            val err = "PDF rendering error: ${e.message}"
            database.printJobDao().markFailed(job.id, JobStatus.FAILED.name, err)
            relayClient.emitJobStatusUpdate(job.id, JobStatus.FAILED, 0, err, isSimulatedMode)
            _currentActiveJob.value = null
            pdfFile.delete()
            return
        }

        // 4. Select Backend
        val activeDevice = usbPrinterManager.connectedDevice.value
        val diag = usbPrinterManager.diagnosticInfo.value

        val backend = PrinterBackendRegistry.detectBackend(
            device = activeDevice,
            diag = diag,
            forceSimulated = isSimulatedMode || (activeDevice == null)
        )

        Log.i(TAG, "Selected Printer Backend: ${backend.displayName} (isSimulated=${backend.isSimulated})")

        // 5. Execute Printing
        database.printJobDao().updateStatus(job.id, JobStatus.PRINTING.name, 35)
        relayClient.emitJobStatusUpdate(job.id, JobStatus.PRINTING, 35, "Transmitting via ${backend.displayName}...", backend.isSimulated)

        val result = backend.processJob(
            job = job,
            pageBitmaps = pageBitmaps,
            connection = usbPrinterManager.getActiveConnection(),
            bulkOut = usbPrinterManager.getBulkOutEndpoint(),
            bulkIn = usbPrinterManager.getBulkInEndpoint()
        ) { stage, percent, msg ->
            database.printJobDao().updateStatus(job.id, JobStatus.PRINTING.name, percent)
            relayClient.emitJobStatusUpdate(job.id, JobStatus.PRINTING, percent, msg, backend.isSimulated)
            updateNotification("${job.fileName}: $percent% ($msg)")
        }

        // 6. Handle Completion / Failure
        when (result) {
            is PrintResult.Success -> {
                val finalStatus = if (result.verifiedPhysical) JobStatus.COMPLETED else JobStatus.SIMULATED_COMPLETED
                database.printJobDao().updateStatus(job.id, finalStatus.name, 100)
                relayClient.emitJobStatusUpdate(job.id, finalStatus, 100, result.message, !result.verifiedPhysical)
                updateNotification("Print finished: ${job.fileName}")
            }
            is PrintResult.Error -> {
                database.printJobDao().markFailed(job.id, JobStatus.FAILED.name, result.message)
                relayClient.emitJobStatusUpdate(job.id, JobStatus.FAILED, 0, result.message, backend.isSimulated)
                updateNotification("Print failed: ${result.message}")
            }
        }

        // 7. Cleanup
        pageBitmaps.forEach { it.recycle() }
        pdfFile.delete()
        _currentActiveJob.value = null
    }

    private suspend fun handleCancelJob(jobId: String) {
        val job = database.printJobDao().getJobById(jobId)
        if (job != null) {
            database.printJobDao().updateStatus(jobId, JobStatus.CANCELLED.name, 0)
            relayClient.emitJobStatusUpdate(jobId, JobStatus.CANCELLED, 0, "Cancelled by user request", isSimulatedMode)
        }
    }

    private fun startHeartbeatLoop() {
        heartbeatJob?.cancel()
        heartbeatJob = serviceScope.launch {
            while (isActive) {
                try {
                    val dev = usbPrinterManager.connectedDevice.value
                    val diag = usbPrinterManager.diagnosticInfo.value
                    val status = DeviceStatus(
                        deviceId = "android-gateway",
                        isOnline = relayClient.isConnected.value,
                        isPrinterConnected = dev != null,
                        printerModel = diag?.productName ?: if (dev != null) "VID:0x${Integer.toHexString(dev.vendorId)} PID:0x${Integer.toHexString(dev.productId)}" else null,
                        printerVid = dev?.vendorId,
                        printerPid = dev?.productId,
                        activeBackend = if (isSimulatedMode) "SIMULATED_PRINTER" else if (dev != null) "CANON_PIXMA_MG2500" else "NONE"
                    )
                    relayClient.sendHeartbeat(status)
                } catch (e: Exception) {
                    Log.w(TAG, "Heartbeat failed", e)
                }
                delay(15000) // 15 seconds heartbeat
            }
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == false) {
            wakeLock?.acquire(12 * 60 * 60 * 1000L) // 12 hours timeout
        }
    }

    private fun releaseWakeLock() {
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.notification_channel_desc)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val stopIntent = Intent(this, PrintGatewayService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("PocketPrint Bridge Active")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_agenda)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Service", stopPendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, buildNotification(text))
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        super.onDestroy()
        stopGateway()
        usbPrinterManager.unregister()
        serviceScope.cancel()
    }
}
