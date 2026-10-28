package com.lodhiai.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.*
import com.lodhiai.companion.ui.navigation.Screen
import com.lodhiai.companion.ui.screens.*
import com.lodhiai.companion.ui.theme.LodhiAITheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LodhiAITheme {
                val navController = rememberNavController()
                val currentBackStack by navController.currentBackStackEntryAsState()
                val currentRoute = currentBackStack?.destination?.route

                Scaffold(
                    bottomBar = {
                        if (currentRoute !in listOf(Screen.Onboarding.route, Screen.Login.route)) {
                            NavigationBar {
                                NavigationBarItem(
                                    selected = currentRoute == Screen.Dashboard.route,
                                    onClick = { navController.navigate(Screen.Dashboard.route) },
                                    icon = { Icon(Icons.Default.Dashboard, contentDescription = null) },
                                    label = { Text("Home") }
                                )
                                NavigationBarItem(
                                    selected = currentRoute == Screen.Chat.route,
                                    onClick = { navController.navigate(Screen.Chat.route) },
                                    icon = { Icon(Icons.Default.Chat, contentDescription = null) },
                                    label = { Text("Chat") }
                                )
                                NavigationBarItem(
                                    selected = currentRoute == Screen.Voice.route,
                                    onClick = { navController.navigate(Screen.Voice.route) },
                                    icon = { Icon(Icons.Default.Mic, contentDescription = null) },
                                    label = { Text("Voice") }
                                )
                                NavigationBarItem(
                                    selected = currentRoute == Screen.TaskApprovals.route,
                                    onClick = { navController.navigate(Screen.TaskApprovals.route) },
                                    icon = { Icon(Icons.Default.AssignmentTurnedIn, contentDescription = null) },
                                    label = { Text("Tasks") }
                                )
                                NavigationBarItem(
                                    selected = currentRoute == Screen.Settings.route,
                                    onClick = { navController.navigate(Screen.Settings.route) },
                                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                                    label = { Text("Settings") }
                                )
                            }
                        }
                    }
                ) { paddingValues ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Onboarding.route,
                        modifier = Modifier.padding(paddingValues)
                    ) {
                        composable(Screen.Onboarding.route) {
                            OnboardingPairingScreen(
                                onPairSuccess = {
                                    navController.navigate(Screen.Dashboard.route) {
                                        popUpTo(Screen.Onboarding.route) { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable(Screen.Login.route) {
                            LoginScreen(
                                onLoginSuccess = {
                                    navController.navigate(Screen.Dashboard.route)
                                }
                            )
                        }
                        composable(Screen.Dashboard.route) {
                            DashboardScreen(
                                onNavigateToChat = { navController.navigate(Screen.Chat.route) },
                                onNavigateToVoice = { navController.navigate(Screen.Voice.route) },
                                onNavigateToTasks = { navController.navigate(Screen.TaskApprovals.route) }
                            )
                        }
                        composable(Screen.Chat.route) { ChatScreen() }
                        composable(Screen.Voice.route) { VoiceAssistantScreen() }
                        composable(Screen.Devices.route) { WindowsDevicesScreen() }
                        composable(Screen.Projects.route) { ProjectsScreen() }
                        composable(Screen.CodingAgent.route) { CodingAgentScreen() }
                        composable(Screen.TaskApprovals.route) { TaskApprovalsScreen() }
                        composable(Screen.Documents.route) { DocumentsKnowledgeScreen() }
                        composable(Screen.Models.route) { ModelSettingsScreen() }
                        composable(Screen.Notifications.route) { NotificationsScreen() }
                        composable(Screen.Usage.route) { UsageEntitlementsScreen() }
                        composable(Screen.Security.route) { SecurityConnectedDevicesScreen() }
                        composable(Screen.Diagnostics.route) { DiagnosticsScreen() }
                        composable(Screen.Settings.route) { AppSettingsScreen() }
                    }
                }
            }
        }
    }
}
