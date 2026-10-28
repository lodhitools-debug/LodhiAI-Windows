package com.lodhiai.companion.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.lodhiai.companion.ui.theme.AccentSuccess
import com.lodhiai.companion.ui.theme.BrandCyan

/**
 * Screen 13: Usage, Plan & Entitlements
 */
@Composable
fun UsageEntitlementsScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Subscription & Usage", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Current Plan: ", fontWeight = FontWeight.Medium)
                    Text("Developer Pro", fontWeight = FontWeight.Bold, color = BrandCyan)
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text("Cloud Tokens: 200,000 / 500,000 used (40%)", fontSize = 13.sp)
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(progress = { 0.4f }, modifier = Modifier.fillMaxWidth())

                Spacer(modifier = Modifier.height(12.dp))
                Text("Connected Devices: 2 / 3 active", fontSize = 13.sp)
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(progress = { 0.66f }, modifier = Modifier.fillMaxWidth())

                Spacer(modifier = Modifier.height(12.dp))
                Text("Offline Grace Period: 14 Days", fontSize = 13.sp)
            }
        }
    }
}

/**
 * Screen 14: Security, Permissions & Connected Devices
 */
@Composable
fun SecurityConnectedDevicesScreen() {
    var requireBiometrics by remember { mutableStateOf(true) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Security & Privacy", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Require Biometrics for Approvals", fontWeight = FontWeight.SemiBold)
                        Text("Require fingerprint or face unlock before approving code diffs.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Switch(checked = requireBiometrics, onCheckedChange = { requireBiometrics = it })
                }
                Spacer(modifier = Modifier.height(12.dp))
                Divider()
                Spacer(modifier = Modifier.height(12.dp))
                Text("Device Fingerprint: SHA256:7f8a9b2c...4d", fontSize = 12.sp)
                Text("Android Keystore: TEE-Backed (Non-exportable)", fontSize = 12.sp, color = AccentSuccess)
            }
        }
    }
}

/**
 * Screen 15: Diagnostics & Troubleshooting
 */
@Composable
fun DiagnosticsScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("System Diagnostics", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                DiagnosticRow("Cloud Relay Status", "CONNECTED (38ms)", AccentSuccess)
                DiagnosticRow("Windows Desktop IPC", "ACTIVE", AccentSuccess)
                DiagnosticRow("Local Speech Engine", "Android TTS Ready", AccentSuccess)
                DiagnosticRow("Microphone Hardware", "Granted (RECORD_AUDIO)", AccentSuccess)
                DiagnosticRow("Cache Storage", "14.2 MB", MaterialTheme.colorScheme.onSurface)

                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(onClick = {}, modifier = Modifier.fillMaxWidth()) {
                    Text("Clear Local Cache & Re-sync")
                }
            }
        }
    }
}

@Composable
fun DiagnosticRow(label: String, value: String, color: Color) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, modifier = Modifier.weight(1f), fontSize = 13.sp)
        Text(value, fontWeight = FontWeight.Bold, color = color, fontSize = 13.sp)
    }
}

/**
 * Screen 16: App Settings & Controls
 */
@Composable
fun AppSettingsScreen() {
    var darkMode by remember { mutableStateOf(true) }
    var romanUrdu by remember { mutableStateOf(true) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Application Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Dark Mode Theme", modifier = Modifier.weight(1f))
                    Switch(checked = darkMode, onCheckedChange = { darkMode = it })
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Roman Urdu AI Persona")
                        Text("Enable bilingual Roman Urdu conversational output.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Switch(checked = romanUrdu, onCheckedChange = { romanUrdu = it })
                }
                Spacer(modifier = Modifier.height(16.dp))
                Divider()
                Spacer(modifier = Modifier.height(8.dp))
                Text("Version: 0.1.0-companion (Android Native)", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
            }
        }
    }
}
