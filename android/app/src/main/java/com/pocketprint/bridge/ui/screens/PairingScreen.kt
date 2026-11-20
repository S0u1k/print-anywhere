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
fun PairingScreen(
    currentServerUrl: String,
    currentDeviceId: String,
    isPaired: Boolean,
    onPairSubmit: (serverUrl: String, deviceId: String, token: String, deviceName: String) -> Unit,
    onNavigateBack: () -> Unit
) {
    var serverUrl by remember { mutableStateOf(currentServerUrl.ifEmpty { "http://10.0.2.2:5000" }) }
    var deviceId by remember { mutableStateOf(currentDeviceId.ifEmpty { "phone-" + (1000..9999).random() }) }
    var deviceName by remember { mutableStateOf("Android Gateway Phone") }
    var pairingCodeOrToken by remember { mutableStateOf("") }
    var selectedTab by remember { mutableStateOf(0) } // 0: 8-Digit Pairing Code / QR, 1: Direct Token / Advanced

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950)
            .padding(20.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Device Pairing & Gateway",
                color = White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Navy900)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (isPaired) Icons.Default.CheckCircle else Icons.Default.QrCodeScanner,
                        contentDescription = null,
                        tint = if (isPaired) StatusGreen else StatusAmber
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = if (isPaired) "Gateway Paired & Connected" else "Bidirectional Pairing Ready",
                        color = if (isPaired) StatusGreen else StatusAmber,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Pair this Android phone with your PocketPrint Web Dashboard (Account or Guest Quick Pair) to route print jobs over the Internet to Canon PIXMA MG2570S.",
                    color = Slate400,
                    fontSize = 13.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Tabs
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = Navy900,
            contentColor = White
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = { Text("8-Digit Code / QR") }
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = { Text("Direct Token") }
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        OutlinedTextField(
            value = serverUrl,
            onValueChange = { serverUrl = it },
            label = { Text("Cloud Relay Server URL") },
            placeholder = { Text("e.g. http://10.0.2.2:5000 or https://relay.example.com") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            leadingIcon = { Icon(Icons.Default.Dns, contentDescription = null, tint = Slate400) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = White,
                unfocusedTextColor = Slate200,
                focusedBorderColor = BrandBlue,
                unfocusedBorderColor = Navy700
            )
        )

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
            value = deviceName,
            onValueChange = { deviceName = it },
            label = { Text("Gateway Device Name") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            leadingIcon = { Icon(Icons.Default.Smartphone, contentDescription = null, tint = Slate400) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = White,
                unfocusedTextColor = Slate200,
                focusedBorderColor = BrandBlue,
                unfocusedBorderColor = Navy700
            )
        )

        Spacer(modifier = Modifier.height(14.dp))

        if (selectedTab == 0) {
            OutlinedTextField(
                value = pairingCodeOrToken,
                onValueChange = {
                    val cleaned = it.uppercase().replace("[^A-Z2-9-]".toRegex(), "")
                    pairingCodeOrToken = cleaned
                },
                label = { Text("8-Character Pairing Code") },
                placeholder = { Text("e.g. 7X9K-4M2P") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                leadingIcon = { Icon(Icons.Default.Pin, contentDescription = null, tint = StatusGreen) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = White,
                    unfocusedTextColor = Slate200,
                    focusedBorderColor = StatusGreen,
                    unfocusedBorderColor = Navy700
                )
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Enter the 8-digit pairing code shown on your Laptop Web Dashboard, or paste the scanned QR payload.",
                color = Slate400,
                fontSize = 12.sp
            )
        } else {
            OutlinedTextField(
                value = deviceId,
                onValueChange = { deviceId = it },
                label = { Text("Unique Gateway Device ID") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                leadingIcon = { Icon(Icons.Default.Fingerprint, contentDescription = null, tint = Slate400) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = White,
                    unfocusedTextColor = Slate200,
                    focusedBorderColor = BrandBlue,
                    unfocusedBorderColor = Navy700
                )
            )

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedTextField(
                value = pairingCodeOrToken,
                onValueChange = { pairingCodeOrToken = it },
                label = { Text("Device Token (JWT)") },
                placeholder = { Text("Paste auth token") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                leadingIcon = { Icon(Icons.Default.VpnKey, contentDescription = null, tint = Slate400) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = White,
                    unfocusedTextColor = Slate200,
                    focusedBorderColor = BrandBlue,
                    unfocusedBorderColor = Navy700
                )
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                onPairSubmit(serverUrl.trim(), deviceId.trim(), pairingCodeOrToken.trim(), deviceName.trim())
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = if (selectedTab == 0) StatusGreen else BrandBlue)
        ) {
            Icon(Icons.Default.Link, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                if (selectedTab == 0) "Claim Code & Start Gateway" else "Connect with Token",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
