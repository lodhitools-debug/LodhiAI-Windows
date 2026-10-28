package com.lodhiai.companion.data.model

import com.google.gson.annotations.SerializedName

/**
 * Authentication and Device Pairing Models
 */
data class PairingRequest(
    @SerializedName("challengeId") val challengeId: String,
    @SerializedName("pin") val pin: String,
    @SerializedName("androidDeviceId") val androidDeviceId: String,
    @SerializedName("androidDeviceName") val androidDeviceName: String,
    @SerializedName("deviceModel") val deviceModel: String,
    @SerializedName("clientTimestamp") val clientTimestamp: Long = System.currentTimeMillis()
)

data class PairingResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("deviceId") val deviceId: String?,
    @SerializedName("deviceToken") val deviceToken: String?,
    @SerializedName("tenantId") val tenantId: String?,
    @SerializedName("desktopName") val desktopName: String?,
    @SerializedName("error") val error: String?
)

/**
 * Chat and LLM Stream Models
 */
data class ChatMessage(
    val id: String,
    val role: String, // "user" | "assistant" | "system"
    val content: String,
    val model: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val isStreaming: Boolean = false
)

/**
 * Autonomous Coding Agent and Approval Models
 */
data class AgentTask(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("status") val status: String, // "running" | "awaiting_approval" | "completed" | "failed"
    @SerializedName("currentStep") val currentStep: Int,
    @SerializedName("totalSteps") val totalSteps: Int,
    @SerializedName("pendingDiff") val pendingDiff: String? = null,
    @SerializedName("targetFiles") val targetFiles: List<String> = emptyList(),
    @SerializedName("riskLevel") val riskLevel: String = "low", // "low" | "medium" | "high"
    @SerializedName("createdAt") val createdAt: Long = System.currentTimeMillis()
)

data class ApprovalDecision(
    @SerializedName("taskId") val taskId: String,
    @SerializedName("actionId") val actionId: String,
    @SerializedName("decision") val decision: String, // "approved" | "rejected"
    @SerializedName("timestamp") val timestamp: Long = System.currentTimeMillis(),
    @SerializedName("signature") val signature: String? = null
)

/**
 * Remote Windows Desktop Status
 */
data class WindowsDevice(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("osVersion") val osVersion: String,
    @SerializedName("ipAddress") val ipAddress: String,
    @SerializedName("isOnline") val isOnline: Boolean,
    @SerializedName("activeModel") val activeModel: String,
    @SerializedName("cpuUsagePercent") val cpuUsagePercent: Float,
    @SerializedName("ramUsagePercent") val ramUsagePercent: Float,
    @SerializedName("lastSeen") val lastSeen: Long
)

/**
 * Entitlements & Subscription Status
 */
data class SubscriptionStatus(
    @SerializedName("tier") val tier: String, // "free" | "pro" | "business"
    @SerializedName("cloudTokensConsumed") val cloudTokensConsumed: Long,
    @SerializedName("cloudTokensLimit") val cloudTokensLimit: Long,
    @SerializedName("devicesActive") val devicesActive: Int,
    @SerializedName("devicesLimit") val devicesLimit: Int,
    @SerializedName("offlineGraceDays") val offlineGraceDays: Int
)

/**
 * Diagnostics and Health Report
 */
data class DiagnosticMetric(
    val name: String,
    val value: String,
    val status: String // "ok" | "warning" | "error"
)
