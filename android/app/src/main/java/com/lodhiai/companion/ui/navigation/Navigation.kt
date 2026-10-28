package com.lodhiai.companion.ui.navigation

sealed class Screen(val route: String, val title: String) {
    object Onboarding : Screen("onboarding", "Pair Device")
    object Login : Screen("login", "Account Login")
    object Dashboard : Screen("dashboard", "Dashboard")
    object Chat : Screen("chat", "AI Chat")
    object Voice : Screen("voice", "Voice Assistant")
    object Devices : Screen("devices", "Windows Devices")
    object Projects : Screen("projects", "Workspaces")
    object CodingAgent : Screen("coding_agent", "Coding Agent")
    object TaskApprovals : Screen("task_approvals", "Approvals & Tasks")
    object Documents : Screen("documents", "Knowledge Base")
    object Models : Screen("models", "Model Providers")
    object Notifications : Screen("notifications", "Notifications")
    object Usage : Screen("usage", "Plan & Usage")
    object Security : Screen("security", "Security & Devices")
    object Diagnostics : Screen("diagnostics", "Diagnostics")
    object Settings : Screen("settings", "App Settings")
}
