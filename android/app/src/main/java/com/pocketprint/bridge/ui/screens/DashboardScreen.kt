package com.pocketprint.bridge.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pocketprint.bridge.data.model.DeviceStatus
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.ui.theme.*

@Composable
fun DashboardScreen(
    status: DeviceStatus,
    activeJob: PrintJob?,
    onNavigateUsb: () -> Unit,
    onNavigateQueue: () -> Unit,
    onNavigateDiagnostics: () -> Unit,
    onNavigateCloud: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // App Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "PocketPrint Bridge",
                    color = White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Android USB Print Gateway",
                    color = Slate400,
                    fontSize = 13.sp
                )
            }
            // Online Indicator badge
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = if (status.isOnline) StatusGreen.copy(alpha = 0.15f) else StatusRed.copy(alpha = 0.15f)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(if (status.isOnline) StatusGreen else StatusRed, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (status.isOnline) "CLOUD ONLINE" else "DISCONNECTED",
                        color = if (status.isOnline) StatusGreen else StatusRed,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Hardware & Relay Status Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = Navy900)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "HARDWARE & LINK STATUS",
                    color = Slate400,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(12.dp))

                StatusRow(
                    icon = Icons.Default.CloudQueue,
                    label = "Cloud Relay",
                    value = if (status.isOnline) "Connected (WSS)" else "Offline",
                    valueColor = if (status.isOnline) StatusGreen else StatusRed
                )
                Divider(color = Navy800, modifier = Modifier.padding(vertical = 10.dp))

                StatusRow(
                    icon = Icons.Default.Usb,
                    label = "USB Printer",
                    value = if (status.isPrinterConnected) "Connected via OTG" else "No USB Printer Detected",
                    valueColor = if (status.isPrinterConnected) StatusGreen else StatusAmber
                )
                Divider(color = Navy800, modifier = Modifier.padding(vertical = 10.dp))

                StatusRow(
                    icon = Icons.Default.Print,
                    label = "Target Printer Model",
                    value = status.printerModel ?: "Canon PIXMA MG2570S (Standby)",
                    valueColor = if (status.printerModel != null) White else Slate400
                )
                Divider(color = Navy800, modifier = Modifier.padding(vertical = 10.dp))

                StatusRow(
                    icon = Icons.Default.Build,
                    label = "Active Backend Engine",
                    value = status.activeBackend ?: "CanonPixmaBackend",
                    valueColor = BrandBlueLight
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Metrics Grid
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Pending Jobs",
                count = status.pendingJobsCount.toString(),
                color = BrandBlueLight
            )
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Completed",
                count = status.completedJobsCount.toString(),
                color = StatusGreen
            )
            MetricCard(
                modifier = Modifier.weight(1f),
                title = "Failed",
                count = status.failedJobsCount.toString(),
                color = if (status.failedJobsCount > 0) StatusRed else Slate400
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Active Job Progress Card (if job is currently executing)
        if (activeJob != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Navy800)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "NOW PRINTING",
                            color = BrandBlueLight,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${activeJob.progressPercent}%",
                            color = White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = activeJob.fileName,
                        color = White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { activeJob.progressPercent / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp),
                        color = BrandBlue,
                        trackColor = Navy900
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Status: ${activeJob.status.name} • ${if (activeJob.isSimulated) "Simulated Driver" else "Physical USB"}",
                        color = Slate400,
                        fontSize = 12.sp
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Quick Navigation Buttons
        Text(
            text = "ACTIONS & DIAGNOSTICS",
            color = Slate400,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = onNavigateUsb,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = White)
            ) {
                Icon(Icons.Default.Usb, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("USB Status")
            }
            OutlinedButton(
                onClick = onNavigateDiagnostics,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = White)
            ) {
                Icon(Icons.Default.Analytics, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Diagnostics")
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = onNavigateQueue,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = White)
            ) {
                Icon(Icons.Default.FormatListNumbered, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Print Queue")
            }
            OutlinedButton(
                onClick = onNavigateCloud,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = White)
            ) {
                Icon(Icons.Default.CloudSync, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Cloud Link")
            }
        }
    }
}

@Composable
private fun StatusRow(icon: ImageVector, label: String, value: String, valueColor: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(imageVector = icon, contentDescription = null, tint = Slate400, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = label, color = Slate200, fontSize = 14.sp)
        }
        Text(text = value, color = valueColor, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun MetricCard(modifier: Modifier = Modifier, title: String, count: String, color: Color) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Navy900)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = count, color = color, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = title, color = Slate400, fontSize = 12.sp)
        }
    }
}
