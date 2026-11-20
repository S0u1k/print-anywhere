package com.pocketprint.bridge.ui.screens

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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pocketprint.bridge.ui.theme.*
import com.pocketprint.bridge.usb.UsbDiagnosticInfo

@Composable
fun DiagnosticsScreen(
    diagnosticInfo: UsbDiagnosticInfo?,
    onRunSelfTest: () -> Unit,
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
                text = "Printer Diagnostics & Descriptors",
                color = White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (diagnosticInfo == null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Navy900)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.SearchOff,
                        contentDescription = null,
                        tint = Slate400,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "No USB Device Connected to Inspect",
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Text(
                        text = "Connect your Canon PIXMA MG2570S via USB OTG cable to inspect real hardware descriptors.",
                        color = Slate400,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        } else {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Navy900)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "HARDWARE IDENTIFIERS",
                        color = Slate400,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    DiagParamRow("Vendor ID (VID):", "${diagnosticInfo.vendorIdHex} (${diagnosticInfo.vendorIdInt})")
                    DiagParamRow("Product ID (PID):", "${diagnosticInfo.productIdHex} (${diagnosticInfo.productIdInt})")
                    DiagParamRow("Manufacturer:", diagnosticInfo.manufacturerName ?: "Canon Inc.")
                    DiagParamRow("Product Name:", diagnosticInfo.productName ?: "Canon MG2500 series")
                    DiagParamRow("Serial Number:", diagnosticInfo.serialNumber ?: "N/A")
                    DiagParamRow("Target Match:", if (diagnosticInfo.isCanonPixmaMg2500Series) "EXACT MATCH (MG2570S)" else "GENERIC / OTHER")
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // IEEE-1284 Device ID String
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Navy900)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "IEEE-1284 DEVICE ID STRING",
                        color = Slate400,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = diagnosticInfo.ieee1284DeviceId
                            ?: "MFG:Canon;CMD:BJL,BJRaster3,BSCCe,NCCe,IVEC,IVECPLI;MDL:MG2500 series;CLS:PRINTER;",
                        color = BrandBlueLight,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier
                            .background(Navy950, RoundedCornerShape(6.dp))
                            .padding(10.dp)
                            .fillMaxWidth()
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Detailed Interfaces Dump
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Navy900)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "USB INTERFACES & ENDPOINTS",
                        color = Slate400,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    diagnosticInfo.interfaces.forEachIndexed { idx, intf ->
                        Text(
                            text = "Interface $idx (Class: 0x${Integer.toHexString(intf.interfaceClass).uppercase()}, Sub: 0x${Integer.toHexString(intf.interfaceSubclass).uppercase()}, Proto: 0x${Integer.toHexString(intf.interfaceProtocol).uppercase()})",
                            color = White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        intf.endpoints.forEach { ep ->
                            Text(
                                text = "  • Endpoint 0x${Integer.toHexString(ep.address).uppercase()} [${ep.direction}] ${ep.type} (MaxPacket: ${ep.maxPacketSize}B)",
                                color = Slate400,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = onRunSelfTest,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
        ) {
            Icon(Icons.Default.PlayArrow, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Send Diagnostic Test Page")
        }
    }
}

@Composable
private fun DiagParamRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, color = Slate400, fontSize = 13.sp)
        Text(text = value, color = White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}
