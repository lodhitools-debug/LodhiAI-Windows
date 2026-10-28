package com.lodhiai.companion.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lodhiai.companion.ui.theme.AccentDanger
import com.lodhiai.companion.ui.theme.AccentSuccess
import com.lodhiai.companion.ui.theme.BrandCyan

/**
 * Screen 9: Running Tasks, Approvals & Task History
 */
@Composable
fun TaskApprovalsScreen() {
    var hasApproved by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Pending Approvals", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(12.dp))

        if (!hasApproved) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Security, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Task #492: Write File Proposal", fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Target: src/services/logger.ts", fontSize = 13.sp)
                    Text("Risk Level: MEDIUM (Modifies source code)", fontSize = 12.sp, color = MaterialTheme.colorScheme.error)

                    Spacer(modifier = Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.Black.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                            .padding(8.dp)
                    ) {
                        Text(
                            "+ export function sanitizeLogText(msg: string): string\n- rawText.replace(secretKey, '')",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = Color(0xFF6EE7B7)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { hasApproved = true },
                            colors = ButtonDefaults.buttonColors(containerColor = AccentSuccess),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Approve Changes")
                        }
                        OutlinedButton(
                            onClick = { hasApproved = true },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = AccentDanger),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Deny Action")
                        }
                    }
                }
            }
        } else {
            Card(modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = AccentSuccess, modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No pending approvals. All agent actions are verified.")
                }
            }
        }
    }
}

/**
 * Screen 10: Documents & Knowledge Base (RAG)
 */
@Composable
fun DocumentsKnowledgeScreen() {
    val documents = listOf(
        "Lodhi_AI_Technical_Whitepaper.pdf" to "142 chunks • BM25 indexed",
        "Windows_Hardware_Architecture.pdf" to "86 chunks • BM25 indexed",
        "Cloud_SaaS_Deployment_Guide.md" to "34 chunks • BM25 indexed"
    )

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Knowledge Base & RAG", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = "",
            onValueChange = {},
            label = { Text("Search documents via BM25 semantic index...") },
            modifier = Modifier.fillMaxWidth(),
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
        )
        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(documents) { (title, subtitle) ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.PictureAsPdf, contentDescription = null, tint = BrandCyan)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                        }
                    }
                }
            }
        }
    }
}

/**
 * Screen 11: AI Models & Provider Settings
 */
@Composable
fun ModelSettingsScreen() {
    var selectedModel by remember { mutableStateOf("qwen2.5-coder:3b") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("AI Model Providers", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Active Inference Engine", fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                RadioButtonRow("Local Ollama (qwen2.5-coder:3b)", selectedModel == "qwen2.5-coder:3b") { selectedModel = "qwen2.5-coder:3b" }
                RadioButtonRow("Google Gemini 1.5 Pro (BYOK)", selectedModel == "gemini-pro") { selectedModel = "gemini-pro" }
                RadioButtonRow("Managed Cloud Pro Fast Router", selectedModel == "cloud-pro") { selectedModel = "cloud-pro" }
            }
        }
    }
}

@Composable
fun RadioButtonRow(text: String, selected: Boolean, onClick: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        RadioButton(selected = selected, onClick = onClick)
        Spacer(modifier = Modifier.width(8.dp))
        Text(text, fontSize = 14.sp)
    }
}

/**
 * Screen 12: Notifications
 */
@Composable
fun NotificationsScreen() {
    val notifications = listOf(
        "Agent completed task #491" to "TypeScript type check passed with 0 errors.",
        "Security Alert" to "New Android companion paired from 192.168.1.105.",
        "Model Pre-warmed" to "qwen2.5-coder:3b loaded in Windows RAM (4,096 context tokens)."
    )

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(notifications) { (title, body) ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(body, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                }
            }
        }
    }
}
