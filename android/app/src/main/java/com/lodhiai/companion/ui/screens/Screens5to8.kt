package com.lodhiai.companion.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lodhiai.companion.ui.theme.BrandCyan

/**
 * Screen 5: Push-to-Talk Voice Assistant
 */
@Composable
fun VoiceAssistantScreen() {
    var isRecording by remember { mutableStateOf(false) }
    var recognizedText by remember { mutableStateOf("Tap and hold the microphone button to speak naturally.") }
    var assistantSpeech by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Voice Interaction", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                "Push-to-Talk • STT • AI Model • On-Device TTS",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Recognized Voice Input:", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text(recognizedText, style = MaterialTheme.typography.bodyLarge)

                if (assistantSpeech != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Divider()
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Spoken AI Response:", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = BrandCyan)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(assistantSpeech!!, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        // Push to talk button
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            FilledIconButton(
                onClick = {
                    isRecording = !isRecording
                    if (isRecording) {
                        recognizedText = "Listening... 'Run unit tests on Windows PC'"
                        assistantSpeech = null
                    } else {
                        recognizedText = "Run unit tests on Windows PC"
                        assistantSpeech = "Executing test suite on paired desktop. 18 test files running."
                    }
                },
                modifier = Modifier.size(96.dp),
                shape = CircleShape,
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = if (isRecording) MaterialTheme.colorScheme.error else BrandCyan
                )
            ) {
                Icon(
                    imageVector = if (isRecording) Icons.Default.Stop else Icons.Default.Mic,
                    contentDescription = "Microphone",
                    modifier = Modifier.size(48.dp),
                    tint = Color.Black
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(if (isRecording) "Recording... Tap to stop" else "Tap to Speak", fontWeight = FontWeight.Medium)
        }
    }
}

/**
 * Screen 6: Windows Devices & Connection Status
 */
@Composable
fun WindowsDevicesScreen() {
    val devices = remember {
        listOf(
            "DESKTOP-UMAR-WIN11" to "Online (192.168.1.100 - Relay OK)",
            "LODHI-WORKSTATION-2" to "Offline (Last seen 2 days ago)"
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(devices) { (name, status) ->
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.LaptopWindows, contentDescription = null, tint = BrandCyan)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(name, fontWeight = FontWeight.Bold)
                        Text(status, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    }
                    IconButton(onClick = {}) {
                        Icon(Icons.Default.DeleteOutline, contentDescription = "Revoke Device", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}

/**
 * Screen 7: Projects & Workspaces
 */
@Composable
fun ProjectsScreen() {
    val workspaces = listOf(
        "LodhiAI-Windows" to "E:\\LodhiAI-Windows (Active Workspace - Sandboxed)",
        "QistFlow" to "E:\\QistFlow (Allowed)"
    )

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(workspaces) { (name, path) ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Folder, contentDescription = null, tint = BrandCyan)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(name, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(path, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
            }
        }
    }
}

/**
 * Screen 8: Autonomous Coding Agent & Task Execution
 */
@Composable
fun CodingAgentScreen() {
    var taskInput by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Autonomous Coding Agent", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Submit software engineering tasks to the paired Windows workstation.")

        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = taskInput,
            onValueChange = { taskInput = it },
            label = { Text("Task Instruction") },
            placeholder = { Text("e.g. Audit security tokens and run type checks") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3
        )
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = { taskInput = "" },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.PlayArrow, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Dispatch Task to Desktop")
        }
    }
}
