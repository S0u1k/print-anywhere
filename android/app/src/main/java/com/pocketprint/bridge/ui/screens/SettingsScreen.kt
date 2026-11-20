package com.pocketprint.bridge.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pocketprint.bridge.ui.theme.*

@Composable
fun SettingsScreen(
    isSimulatedMode: Boolean,
    onToggleSimulated: (Boolean) -> Unit,
    onRequestBatteryExemption: () -> Unit,
    onNavigateBack: () -> Unit
) {
    var defaultPaperSize by remember { mutableStateOf("A4") }
    var defaultDpi by remember { mutableStateOf("300") }

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
                text = "Gateway Settings",
                color = White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Hardware Simulator Sandbox
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Navy900)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Simulated Printer Engine",
                            color = White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "Enables virtual sandbox test harness. Validates PDF rasterization without needing a physical Canon USB printer.",
                            color = Slate400,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                    Switch(
                        checked = isSimulatedMode,
                        onCheckedChange = onToggleSimulated,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = White,
                            checkedTrackColor = BrandBlue,
                            uncheckedTrackColor = Navy700
                        )
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Battery Optimization Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Navy900)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.BatteryChargingFull, contentDescription = null, tint = StatusGreen)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Android Doze & Background Execution",
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "To allow PocketPrint Bridge to receive print jobs while the screen is off or the phone is unattended, exempt this app from Android battery restrictions.",
                    color = Slate400,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = onRequestBatteryExemption,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = White)
                ) {
                    Icon(Icons.Default.PowerSettingsNew, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Request Battery Optimization Exemption")
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Print Pipeline Defaults
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Navy900)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "PIPELINE DEFAULTS",
                    color = Slate400,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Default Media Size", color = Slate200, fontSize = 14.sp)
                    Row {
                        FilterChip(
                            selected = defaultPaperSize == "A4",
                            onClick = { defaultPaperSize = "A4" },
                            label = { Text("A4") },
                            modifier = Modifier.padding(end = 6.dp)
                        )
                        FilterChip(
                            selected = defaultPaperSize == "LETTER",
                            onClick = { defaultPaperSize = "LETTER" },
                            label = { Text("Letter") }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Render Resolution", color = Slate200, fontSize = 14.sp)
                    Row {
                        FilterChip(
                            selected = defaultDpi == "300",
                            onClick = { defaultDpi = "300" },
                            label = { Text("300 DPI") },
                            modifier = Modifier.padding(end = 6.dp)
                        )
                        FilterChip(
                            selected = defaultDpi == "600",
                            onClick = { defaultDpi = "600" },
                            label = { Text("600 DPI") }
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Open Source & Version
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("PocketPrint Bridge v1.0.0", color = Slate400, fontSize = 12.sp)
            Text("Open Source USB Gateway • MIT License", color = Slate400, fontSize = 11.sp)
        }
    }
}
