package com.pocketprint.bridge

import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.pocketprint.bridge.data.local.AppDatabase
import com.pocketprint.bridge.data.model.DeviceStatus
import com.pocketprint.bridge.data.model.JobStatus
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.service.PrintGatewayService
import com.pocketprint.bridge.ui.screens.*
import com.pocketprint.bridge.ui.theme.PocketPrintTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private var gatewayService: PrintGatewayService? = null
    private var isBound by mutableStateOf(false)

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as PrintGatewayService.LocalBinder
            gatewayService = binder.getService()
            isBound = true
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            gatewayService = null
            isBound = false
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startGatewayService()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Check Notification Permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            } else {
                startGatewayService()
            }
        } else {
            startGatewayService()
        }

        setContent {
            PocketPrintTheme {
                MainAppHost()
            }
        }
    }

    private fun startGatewayService() {
        val intent = Intent(this, PrintGatewayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    @Composable
    private fun MainAppHost() {
        val scope = rememberCoroutineScope()
        val db = remember { AppDatabase.getDatabase(this) }
        val jobsFlow = db.printJobDao().getAllJobs().collectAsState(initial = emptyList())

        var currentScreen by remember { mutableStateOf("dashboard") }
        var isSimulatedMode by remember { mutableStateOf(false) }

        val connectedUsbDevice = gatewayService?.usbPrinterManager?.connectedDevice?.collectAsState()?.value
        val hasUsbPermission = gatewayService?.usbPrinterManager?.hasPermission?.collectAsState()?.value ?: false
        val diagInfo = gatewayService?.usbPrinterManager?.diagnosticInfo?.collectAsState()?.value
        val isCloudConnected = gatewayService?.relayClient?.isConnected?.collectAsState()?.value ?: false
        val cloudError = gatewayService?.relayClient?.connectionError?.collectAsState()?.value
        val activeJob = gatewayService?.currentActiveJob?.collectAsState()?.value

        val allJobs = jobsFlow.value.map { it.toDomain() }
        val activeQueue = allJobs.filter { !it.status.isTerminal() }
        val historyJobs = allJobs.filter { it.status.isTerminal() }

        val deviceStatus = DeviceStatus(
            deviceId = "android-gateway",
            isOnline = isCloudConnected,
            isPrinterConnected = connectedUsbDevice != null,
            printerModel = diagInfo?.productName ?: if (connectedUsbDevice != null) "VID:0x${Integer.toHexString(connectedUsbDevice.vendorId).uppercase()}" else null,
            printerVid = connectedUsbDevice?.vendorId,
            printerPid = connectedUsbDevice?.productId,
            activeBackend = if (isSimulatedMode) "SIMULATED_PRINTER" else if (connectedUsbDevice != null) "CANON_PIXMA_MG2500" else "NONE",
            pendingJobsCount = activeQueue.size,
            completedJobsCount = historyJobs.count { it.status == JobStatus.COMPLETED || it.status == JobStatus.SIMULATED_COMPLETED },
            failedJobsCount = historyJobs.count { it.status == JobStatus.FAILED }
        )

        Scaffold(
            bottomBar = {
                NavigationBar {
                    NavigationBarItem(
                        selected = currentScreen == "dashboard",
                        onClick = { currentScreen = "dashboard" },
                        icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") },
                        label = { Text("Dashboard") }
                    )
                    NavigationBarItem(
                        selected = currentScreen == "usb",
                        onClick = { currentScreen = "usb" },
                        icon = { Icon(Icons.Default.Usb, contentDescription = "USB") },
                        label = { Text("USB") }
                    )
                    NavigationBarItem(
                        selected = currentScreen == "queue",
                        onClick = { currentScreen = "queue" },
                        icon = { Icon(Icons.Default.FormatListNumbered, contentDescription = "Queue") },
                        label = { Text("Queue (${activeQueue.size})") }
                    )
                    NavigationBarItem(
                        selected = currentScreen == "history",
                        onClick = { currentScreen = "history" },
                        icon = { Icon(Icons.Default.History, contentDescription = "History") },
                        label = { Text("History") }
                    )
                    NavigationBarItem(
                        selected = currentScreen == "settings",
                        onClick = { currentScreen = "settings" },
                        icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                        label = { Text("Settings") }
                    )
                }
            }
        ) { paddingValues ->
            Box(modifier = Modifier.padding(paddingValues)) {
                when (currentScreen) {
                    "welcome" -> WelcomeScreen(
                        onGetStarted = { currentScreen = "pairing" }
                    )
                    "pairing" -> PairingScreen(
                        currentServerUrl = "http://10.0.2.2:5000",
                        currentDeviceId = "android-gateway-01",
                        isPaired = isCloudConnected,
                        onPairSubmit = { serverUrl, devId, token, name ->
                            gatewayService?.startGateway(serverUrl, devId, token, name, isSimulatedMode)
                            currentScreen = "dashboard"
                            Toast.makeText(this@MainActivity, "Connecting to Cloud Relay...", Toast.LENGTH_SHORT).show()
                        },
                        onNavigateBack = { currentScreen = "dashboard" }
                    )
                    "dashboard" -> DashboardScreen(
                        status = deviceStatus,
                        activeJob = activeJob,
                        onNavigateUsb = { currentScreen = "usb" },
                        onNavigateQueue = { currentScreen = "queue" },
                        onNavigateDiagnostics = { currentScreen = "diagnostics" },
                        onNavigateCloud = { currentScreen = "cloud" }
                    )
                    "usb" -> UsbConnectionScreen(
                        device = connectedUsbDevice,
                        hasPermission = hasUsbPermission,
                        diagnosticInfo = diagInfo,
                        onRequestPermission = {
                            connectedUsbDevice?.let { gatewayService?.usbPrinterManager?.requestPermission(it) }
                        },
                        onRefreshScan = {
                            gatewayService?.usbPrinterManager?.scanDevices()
                            Toast.makeText(this@MainActivity, "Scanning USB devices...", Toast.LENGTH_SHORT).show()
                        },
                        onNavigateBack = { currentScreen = "dashboard" }
                    )
                    "diagnostics" -> DiagnosticsScreen(
                        diagnosticInfo = diagInfo,
                        onRunSelfTest = {
                            Toast.makeText(this@MainActivity, "Running diagnostic test page...", Toast.LENGTH_SHORT).show()
                        },
                        onNavigateBack = { currentScreen = "dashboard" }
                    )
                    "queue" -> JobQueueScreen(
                        activeJobs = activeQueue,
                        onCancelJob = { jobId ->
                            scope.launch {
                                db.printJobDao().updateStatus(jobId, JobStatus.CANCELLED.name, 0)
                            }
                        },
                        onNavigateBack = { currentScreen = "dashboard" }
                    )
                    "history" -> PrintHistoryScreen(
                        historyJobs = historyJobs,
                        onRetryJob = { job ->
                            scope.launch {
                                db.printJobDao().updateStatus(job.id, JobStatus.QUEUED.name, 0)
                            }
                        },
                        onNavigateBack = { currentScreen = "dashboard" }
                    )
                    "cloud" -> CloudStatusScreen(
                        isConnected = isCloudConnected,
                        serverUrl = "http://localhost:5000 / remote WSS",
                        deviceId = "android-gateway-01",
                        lastError = cloudError,
                        onReconnect = {
                            gatewayService?.startGateway("http://10.0.2.2:5000", "android-gateway-01", "dev_token", "Android Gateway", isSimulatedMode)
                        },
                        onNavigateBack = { currentScreen = "dashboard" }
                    )
                    "settings" -> SettingsScreen(
                        isSimulatedMode = isSimulatedMode,
                        onToggleSimulated = { enabled ->
                            isSimulatedMode = enabled
                            gatewayService?.setSimulatedMode(enabled)
                            Toast.makeText(this@MainActivity, if (enabled) "Virtual Simulator Enabled" else "Physical USB Driver Mode Enabled", Toast.LENGTH_SHORT).show()
                        },
                        onRequestBatteryExemption = {
                            requestBatteryOptimization()
                        },
                        onNavigateBack = { currentScreen = "dashboard" }
                    )
                }
            }
        }
    }

    private fun requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            } else {
                Toast.makeText(this, "Battery optimization already disabled for PocketPrint", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isBound) {
            unbindService(serviceConnection)
            isBound = false
        }
    }
}
