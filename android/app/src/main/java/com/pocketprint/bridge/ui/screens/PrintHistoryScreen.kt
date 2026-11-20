package com.pocketprint.bridge.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pocketprint.bridge.data.model.JobStatus
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun PrintHistoryScreen(
    historyJobs: List<PrintJob>,
    onRetryJob: (PrintJob) -> Unit,
    onNavigateBack: () -> Unit
) {
    val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy950)
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Print History (${historyJobs.size})",
                color = White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (historyJobs.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.History,
                        contentDescription = null,
                        tint = Slate400,
                        modifier = Modifier.size(54.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "No Print History Yet",
                        color = White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Text(
                        text = "Completed and failed print jobs will be logged here.",
                        color = Slate400,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(historyJobs) { job ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Navy900)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = when (job.status) {
                                            JobStatus.COMPLETED -> Icons.Default.CheckCircle
                                            JobStatus.SIMULATED_COMPLETED -> Icons.Default.Science
                                            JobStatus.FAILED -> Icons.Default.Error
                                            else -> Icons.Default.Cancel
                                        },
                                        contentDescription = null,
                                        tint = when (job.status) {
                                            JobStatus.COMPLETED -> StatusGreen
                                            JobStatus.SIMULATED_COMPLETED -> StatusAmber
                                            JobStatus.FAILED -> StatusRed
                                            else -> Slate400
                                        },
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = job.fileName,
                                        color = White,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 14.sp
                                    )
                                }

                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = when (job.status) {
                                        JobStatus.COMPLETED -> StatusGreen.copy(alpha = 0.15f)
                                        JobStatus.SIMULATED_COMPLETED -> StatusAmber.copy(alpha = 0.15f)
                                        JobStatus.FAILED -> StatusRed.copy(alpha = 0.15f)
                                        else -> Navy800
                                    }
                                ) {
                                    Text(
                                        text = if (job.status == JobStatus.SIMULATED_COMPLETED) "SIMULATED" else job.status.name,
                                        color = when (job.status) {
                                            JobStatus.COMPLETED -> StatusGreen
                                            JobStatus.SIMULATED_COMPLETED -> StatusAmber
                                            JobStatus.FAILED -> StatusRed
                                            else -> Slate400
                                        },
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "${dateFormat.format(Date(job.createdAt))} • ${job.options.copies} copies • ${job.options.paperSize}",
                                color = Slate400,
                                fontSize = 12.sp
                            )

                            if (job.status == JobStatus.FAILED && !job.errorMessage.isNullOrEmpty()) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Error: ${job.errorMessage}",
                                    color = StatusRed,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
