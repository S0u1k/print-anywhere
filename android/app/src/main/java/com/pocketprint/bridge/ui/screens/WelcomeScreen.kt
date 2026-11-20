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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pocketprint.bridge.ui.theme.*

@Composable
fun WelcomeScreen(onGetStarted: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950)
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(modifier = Modifier.height(32.dp))
            Icon(
                imageVector = Icons.Default.Print,
                contentDescription = "Printer",
                tint = BrandBlueLight,
                modifier = Modifier.size(72.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "PocketPrint Bridge",
                color = White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Turn your phone into a remote USB Print Gateway",
                color = Slate400,
                fontSize = 15.sp,
                modifier = Modifier.padding(top = 8.dp)
            )

            Spacer(modifier = Modifier.height(36.dp))

            FeatureCard(
                icon = Icons.Default.Usb,
                title = "USB OTG Host Connectivity",
                desc = "Direct hardware connection to Canon PIXMA MG2570S and USB printers via USB Host API."
            )
            Spacer(modifier = Modifier.height(12.dp))
            FeatureCard(
                icon = Icons.Default.CloudQueue,
                title = "Remote Internet Printing",
                desc = "Receive PDF print jobs from anywhere in the world over encrypted WebSockets without port forwarding."
            )
            Spacer(modifier = Modifier.height(12.dp))
            FeatureCard(
                icon = Icons.Default.Security,
                title = "Secure Pairing & Token Auth",
                desc = "End-to-end device authorization and expiring download tokens to protect your privacy."
            )
            Spacer(modifier = Modifier.height(12.dp))
            FeatureCard(
                icon = Icons.Default.Speed,
                title = "Native PDF Rasterization",
                desc = "High-precision 300/600 DPI rendering and modular Canon BJL / BJRaster3 encoding."
            )
        }

        Button(
            onClick = onGetStarted,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .padding(vertical = 4.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
        ) {
            Text("Set Up & Pair Device", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun FeatureCard(icon: ImageVector, title: String, desc: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Navy900)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = BrandBlueLight,
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(text = title, color = White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                Text(text = desc, color = Slate400, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}
