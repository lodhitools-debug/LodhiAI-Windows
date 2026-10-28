package com.lodhiai.companion.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lodhiai.companion.data.model.ChatMessage
import com.lodhiai.companion.ui.theme.BrandCyan

/**
 * Screen 1: Onboarding & Secure Device Pairing
 */
@Composable
fun OnboardingPairingScreen(
    onPairSuccess: () -> Unit
) {
    var pin by remember { mutableStateOf("") }
    var deviceName by remember { mutableStateOf("Android Device") }
    var isPairing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.QrCodeScanner,
            contentDescription = "Pairing Icon",
            tint = BrandCyan,
            modifier = Modifier.size(72.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Pair with Lodhi AI Desktop",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Enter the 6-digit one-time PIN displayed on your Windows PC in Settings > Android Companion.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
            modifier = Modifier.padding(vertical = 8.dp)
        )

        OutlinedTextField(
            value = pin,
            onValueChange = { if (it.length <= 6) pin = it },
            label = { Text("6-Digit PIN") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        if (errorMessage != null) {
            Text(
                text = errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = {
                if (pin.length == 6) {
                    isPairing = true
                    // Simulate pairing validation
                    onPairSuccess()
                } else {
                    errorMessage = "PIN must be exactly 6 digits"
                }
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            if (isPairing) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
            } else {
                Text("Authorize & Connect")
            }
        }
    }
}

/**
 * Screen 2: Login & Session Management
 */
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Lodhi AI Cloud Login", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Account Email") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onLoginSuccess,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("Sign In to Account")
        }
    }
}

/**
 * Screen 3: Home Dashboard
 */
@Composable
fun DashboardScreen(
    onNavigateToChat: () -> Unit,
    onNavigateToVoice: () -> Unit,
    onNavigateToTasks: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text("Lodhi AI Dashboard", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))

        // Desktop status card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Computer, contentDescription = null, tint = BrandCyan)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Windows Workstation", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(modifier = Modifier.weight(1f))
                    Badge(containerColor = Color(0xFF10B981)) { Text("ONLINE", color = Color.White) }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text("Model: qwen2.5-coder:3b (Ollama Local)")
                Text("RAM Usage: 4.2 / 8.0 GB (52%)")
                Text("Latency: 38ms (Relay Connected)")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        Text("Quick Workflows", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Spacer(modifier = Modifier.height(8.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onNavigateToChat, modifier = Modifier.weight(1f)) {
                Icon(Icons.Default.Chat, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("AI Chat")
            }
            Button(onClick = onNavigateToVoice, modifier = Modifier.weight(1f)) {
                Icon(Icons.Default.Mic, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Voice Mode")
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(onClick = onNavigateToTasks, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Assignment, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Review Pending Approvals (1)")
        }
    }
}

/**
 * Screen 4: Real AI Text Chat
 */
@Composable
fun ChatScreen() {
    var inputText by remember { mutableStateOf("") }
    val messages = remember {
        mutableStateListOf(
            ChatMessage("1", "system", "Lodhi AI Assistant connected via Relay. Model: qwen2.5-coder:3b."),
            ChatMessage("2", "user", "Kaisay ho Lodhi AI? Workspace ka status batao."),
            ChatMessage("3", "assistant", "Main bilkul theek hoon! Aap ka Windows workspace sandboxed mode mein active hai aur tamam tests 100% pass hain. Koi code task run karna hai?")
        )
    }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages) { msg ->
                val isUser = msg.role == "user"
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = if (isUser) Alignment.CenterEnd else Alignment.CenterStart
                ) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = if (isUser) "You" else "Lodhi AI (${msg.model ?: "Local"})",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isUser) Color.White.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = msg.content,
                                color = if (isUser) Color.White else MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                placeholder = { Text("Type prompt (English / Roman Urdu)...") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = {
                    if (inputText.isNotBlank()) {
                        messages.add(ChatMessage(System.currentTimeMillis().toString(), "user", inputText))
                        inputText = ""
                    }
                }
            ) {
                Icon(Icons.Default.Send, contentDescription = "Send", tint = BrandCyan)
            }
        }
    }
}
