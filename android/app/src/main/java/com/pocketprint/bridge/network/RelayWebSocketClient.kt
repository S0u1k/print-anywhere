package com.pocketprint.bridge.network

import android.content.Context
import android.os.BatteryManager
import android.util.Log
import com.google.gson.Gson
import com.pocketprint.bridge.data.model.DeviceStatus
import com.pocketprint.bridge.data.model.JobStatus
import com.pocketprint.bridge.data.model.PrintJob
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class RelayWebSocketClient(private val context: Context) {
    companion object {
        private const val TAG = "RelayWebSocketClient"
    }

    private val gson = Gson()
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private var socket: Socket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pollingJob: Job? = null
    private val processedJobIds = mutableSetOf<String>()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _connectionError = MutableStateFlow<String?>(null)
    val connectionError: StateFlow<String?> = _connectionError.asStateFlow()

    var onJobReceived: ((PrintJob) -> Unit)? = null
    var onJobCancelRequested: ((String) -> Unit)? = null

    private var currentDeviceId: String = ""
    private var currentToken: String = ""
    private var currentServerUrl: String = ""

    fun connect(serverUrl: String, deviceId: String, token: String, deviceName: String = "Android Gateway") {
        currentServerUrl = serverUrl
        currentDeviceId = deviceId
        currentToken = token

        try {
            disconnect()

            val opts = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 2000
                reconnectionDelayMax = 10000
                timeout = 10000
                auth = mapOf(
                    "token" to token,
                    "deviceId" to deviceId,
                    "role" to "device"
                )
            }

            Log.i(TAG, "Connecting to Cloud Relay: $serverUrl with deviceId: $deviceId")
            socket = IO.socket(serverUrl, opts)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.i(TAG, "Socket.IO connected to Cloud Relay")
                _isConnected.value = true
                _connectionError.value = null

                // Send device registration
                val regPayload = JSONObject().apply {
                    put("deviceId", deviceId)
                    put("token", token)
                    put("name", deviceName)
                    put("clientType", "android_gateway")
                    put("gatewayType", "ANDROID_USB")
                    put("appVersion", "1.0.0")
                }
                socket?.emit("device:register", regPayload)
            }

            socket?.on(Socket.EVENT_DISCONNECT) { args ->
                Log.w(TAG, "Socket.IO disconnected from Cloud Relay: ${args.firstOrNull()}")
                _isConnected.value = false
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                val err = args.firstOrNull()?.toString() ?: "Unknown connection error"
                Log.e(TAG, "Socket.IO connect error: $err")
                _isConnected.value = false
                _connectionError.value = err
            }

            socket?.on("job:incoming") { args ->
                try {
                    val data = args.firstOrNull()
                    Log.i(TAG, "Received incoming print job event: $data")
                    if (data is JSONObject) {
                        val job = gson.fromJson(data.toString(), PrintJob::class.java)
                        onJobReceived?.invoke(job)
                    } else if (data is String) {
                        val job = gson.fromJson(data, PrintJob::class.java)
                        onJobReceived?.invoke(job)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing incoming job", e)
                }
            }

            socket?.on("job:cancel") { args ->
                val jobId = args.firstOrNull()?.toString()
                if (jobId != null) {
                    onJobCancelRequested?.invoke(jobId)
                }
            }

            socket?.connect()
            startPollingLoop()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize socket connection", e)
            _connectionError.value = e.message
            startPollingLoop()
        }
    }

    private fun startPollingLoop() {
        pollingJob?.cancel()
        pollingJob = scope.launch {
            while (isActive) {
                try {
                    if (currentServerUrl.isNotEmpty() && currentToken.isNotEmpty()) {
                        val url = "${currentServerUrl.removeSuffix("/")}/api/jobs"
                        val req = Request.Builder()
                            .url(url)
                            .addHeader("Authorization", "Bearer $currentToken")
                            .addHeader("X-Device-Token", currentToken)
                            .build()
                        val resp = httpClient.newCall(req).execute()
                        if (resp.isSuccessful) {
                            val bodyStr = resp.body?.string()
                            if (!bodyStr.isNullOrEmpty()) {
                                val root = JSONObject(bodyStr)
                                val arr = root.optJSONArray("jobs")
                                if (arr != null) {
                                    for (i in 0 until arr.length()) {
                                        val jObj = arr.getJSONObject(i)
                                        val id = jObj.optString("id")
                                        val st = jObj.optString("status")
                                        val devId = jObj.optString("deviceId")
                                        val gw = jObj.optString("gatewayType")
                                        if (id.isNotEmpty() && !processedJobIds.contains(id) &&
                                            (st == "QUEUED" || st == "DISPATCHED") &&
                                            (devId == currentDeviceId || gw == "ANDROID_USB")
                                        ) {
                                            processedJobIds.add(id)
                                            val job = gson.fromJson(jObj.toString(), PrintJob::class.java)
                                            onJobReceived?.invoke(job)
                                        }
                                    }
                                }
                            }
                        }
                        resp.close()
                    }
                } catch (e: Exception) {
                    // Suppress transient network polling exceptions
                }
                delay(5000)
            }
        }
    }

    fun sendHeartbeat(status: DeviceStatus) {
        if (socket?.connected() != true) return
        try {
            val payload = JSONObject().apply {
                put("deviceId", status.deviceId)
                put("gatewayType", "ANDROID_USB")
                put("isPrinterConnected", status.isPrinterConnected)
                put("printerModel", status.printerModel ?: "None")
                put("printerVid", status.printerVid ?: 0)
                put("printerPid", status.printerPid ?: 0)
                put("activeBackend", status.activeBackend ?: "None")
                put("pendingJobs", status.pendingJobsCount)
                put("completedJobs", status.completedJobsCount)
                put("failedJobs", status.failedJobsCount)
                put("batteryPercent", getBatteryPercentage())
                put("timestamp", System.currentTimeMillis())
            }
            socket?.emit("device:heartbeat", payload)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending heartbeat", e)
        }
    }

    fun emitJobStatusUpdate(
        jobId: String,
        status: JobStatus,
        progressPercent: Int,
        message: String?,
        isSimulated: Boolean
    ) {
        if (socket?.connected() == true) {
            try {
                val payload = JSONObject().apply {
                    put("jobId", jobId)
                    put("deviceId", currentDeviceId)
                    put("status", status.name)
                    put("progressPercent", progressPercent)
                    put("message", message ?: "")
                    put("isSimulated", isSimulated)
                    put("timestamp", System.currentTimeMillis())
                }
                socket?.emit("job:status_update", payload)
                Log.d(TAG, "Emitted job status update via socket: $jobId -> ${status.name} ($progressPercent%)")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit job status update via socket", e)
            }
        }

        // Dual/fallback REST dispatch (ensures status updates persist in serverless cloud relay)
        if (currentServerUrl.isNotEmpty() && currentToken.isNotEmpty()) {
            scope.launch {
                try {
                    val url = "${currentServerUrl.removeSuffix("/")}/api/jobs/$jobId/status"
                    val jsonBody = JSONObject().apply {
                        put("status", status.name)
                        put("progressPercent", progressPercent)
                        put("message", message ?: "")
                        put("isSimulated", isSimulated)
                    }.toString()
                    val req = Request.Builder()
                        .url(url)
                        .patch(jsonBody.toRequestBody("application/json".toMediaTypeOrNull()))
                        .addHeader("Authorization", "Bearer $currentToken")
                        .addHeader("X-Device-Token", currentToken)
                        .build()
                    val resp = httpClient.newCall(req).execute()
                    resp.close()
                    Log.d(TAG, "Emitted job status update via REST: $jobId -> ${status.name}")
                } catch (e: Exception) {
                    Log.w(TAG, "REST status update error (non-fatal): ${e.message}")
                }
            }
        }
    }

    suspend fun downloadPdfFile(fileUrl: String, downloadToken: String?, targetFile: File): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
                fileUrl
            } else {
                "${currentServerUrl.removeSuffix("/")}/${fileUrl.removePrefix("/")}"
            }

            val requestBuilder = Request.Builder().url(url)
            if (!downloadToken.isNullOrEmpty()) {
                requestBuilder.addHeader("Authorization", "Bearer $downloadToken")
                requestBuilder.addHeader("X-Download-Token", downloadToken)
            }

            val response = httpClient.newCall(requestBuilder.build()).execute()
            if (!response.isSuccessful) {
                Log.e(TAG, "PDF download failed with HTTP code: ${response.code}")
                return@withContext false
            }

            response.body?.byteStream()?.use { input ->
                FileOutputStream(targetFile).use { output ->
                    input.copyTo(output)
                }
            }
            Log.i(TAG, "PDF downloaded successfully to: ${targetFile.absolutePath} (${targetFile.length()} bytes)")
            return@withContext true
        } catch (e: Exception) {
            Log.e(TAG, "Error downloading PDF file", e)
            return@withContext false
        }
    }

    private fun getBatteryPercentage(): Int {
        return try {
            val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        } catch (e: Exception) {
            100
        }
    }

    fun disconnect() {
        try {
            pollingJob?.cancel()
            pollingJob = null
            socket?.disconnect()
            socket?.off()
            socket = null
            _isConnected.value = false
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting socket", e)
        }
    }
}
