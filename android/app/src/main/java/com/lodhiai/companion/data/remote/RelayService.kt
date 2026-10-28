package com.lodhiai.companion.data.remote

import com.lodhiai.companion.data.model.*
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit REST API interface for Lodhi AI Cloud Relay & Pairing Gateway
 */
interface RelayApiService {

    @POST("/api/companion/pair")
    suspend fun redeemPairingChallenge(
        @Body request: PairingRequest
    ): Response<PairingResponse>

    @GET("/api/companion/devices")
    suspend fun listConnectedWindowsDevices(
        @Header("Authorization") bearerToken: String
    ): Response<List<WindowsDevice>>

    @GET("/api/companion/tasks/active")
    suspend fun getActiveAgentTasks(
        @Header("Authorization") bearerToken: String,
        @Query("deviceId") targetDeviceId: String
    ): Response<List<AgentTask>>

    @POST("/api/companion/actions/approve")
    suspend fun submitApprovalDecision(
        @Header("Authorization") bearerToken: String,
        @Body decision: ApprovalDecision
    ): Response<Map<String, String>>

    @DELETE("/api/companion/devices/{id}")
    suspend fun revokeDevice(
        @Header("Authorization") bearerToken: String,
        @Path("id") deviceId: String
    ): Response<Map<String, String>>

    @GET("/api/companion/entitlements")
    suspend fun getSubscriptionEntitlements(
        @Header("Authorization") bearerToken: String
    ): Response<SubscriptionStatus>
}
