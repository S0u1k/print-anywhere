package com.pocketprint.bridge.ui.screens

import android.hardware.usb.UsbDevice
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pocketprint.bridge.ui.theme.*
import com.pocketprint.bridge.usb.UsbDiagnosticInfo

@Composable
fun UsbConnectionScreen(
    device: UsbDevice?,
    hasPermission: Boolean,
    diagnosticInfo: UsbDiagnosticInfo?,
    onRequestPermission: () -> Unit,
    onRefreshScan: () -> Unit,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "USB Printer Connection",
                color = White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Connection Summary Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Navy900)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (device != null) Icons.Default.Usb else Icons.Default.UsbOff,
                        contentDescription = null,
                        tint = if (device != null) StatusGreen else StatusAmber,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = if (device != null) "USB Device Connected" else "No USB Device Attached",
                            color = White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = if (device != null) device.deviceName else "Connect printer via USB OTG cable",
                            color = Slate400,
                            fontSize = 13.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (device != null) {
                    val isCanon = device.vendorId == 0x04A9 && device.productId == 0x176D
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (isCanon) StatusGreen.copy(alpha = 0.15f) else Navy800
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (isCanon) Icons.Default.CheckCircle else Icons.Default.Info,
                                contentDescription = null,
                                tint = if (isCanon) StatusGreen else BrandBlueLight
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (isCanon)
                                    "Target Printer Matched: Canon PIXMA MG2570S (0x04A9:0x176D)"
                                else
                                    "Device: VID 0x${Integer.toHexString(device.vendorId).uppercase()} PID 0x${Integer.toHexString(device.productId).uppercase()}",
                                color = if (isCanon) StatusGreen else Slate200,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Permission Status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Android Host Permission", color = Slate200, fontSize = 14.sp)
                        Text(
                            text = if (hasPermission) "GRANTED" else "REQUIRED",
                            color = if (hasPermission) StatusGreen else StatusAmber,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }

                    if (!hasPermission) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = onRequestPermission,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                        ) {
                            Text("Grant USB Permission")
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Endpoints & Descriptors
        if (diagnosticInfo != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Navy900)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "ENDPOINT SPECIFICATIONS",
                        color = Slate400,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Bulk OUT (Data): ${if (diagnosticInfo.hasBulkOutEndpoint) "Endpoint 0x" + Integer.toHexString(diagnosticInfo.bulkOutEndpointAddress ?: 0).uppercase() + " [READY]" else "MISSING"}",
                        color = if (diagnosticInfo.hasBulkOutEndpoint) StatusGreen else StatusRed,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Bulk IN (Status): ${if (diagnosticInfo.hasBulkInEndpoint) "Endpoint 0x" + Integer.toHexString(diagnosticInfo.bulkInEndpointAddress ?: 0).uppercase() + " [READY]" else "NOT AVAILABLE"}",
                        color = if (diagnosticInfo.hasBulkInEndpoint) StatusGreen else Slate400,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Printer Class Interfaces: ${diagnosticInfo.interfaces.count { it.isPrinterClass }}",
                        color = White,
                        fontSize = 13.sp
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        OutlinedButton(
            onClick = onRefreshScan,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = White)
        ) {
            Icon(Icons.Default.Refresh, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Re-scan USB Bus")
        }
    }
}
