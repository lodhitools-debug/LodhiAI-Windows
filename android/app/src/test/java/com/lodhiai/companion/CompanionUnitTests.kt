package com.lodhiai.companion

import com.lodhiai.companion.data.model.AgentTask
import com.lodhiai.companion.data.model.SubscriptionStatus
import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for Lodhi AI Android Companion logic
 */
class CompanionUnitTests {

    @Test
    fun testPinValidationFormat() {
        val validPin = "492105"
        val shortPin = "123"
        val alphaPin = "492A05"

        assertTrue(validPin.length == 6 && validPin.all { it.isDigit() })
        assertFalse(shortPin.length == 6 && shortPin.all { it.isDigit() })
        assertFalse(alphaPin.length == 6 && alphaPin.all { it.isDigit() })
    }

    @Test
    fun testTaskRiskAssessmentInvariant() {
        val writeTask = AgentTask(
            id = "t1",
            title = "Write to logger.ts",
            status = "awaiting_approval",
            currentStep = 3,
            totalSteps = 5,
            pendingDiff = "+ export function sanitizeLogText",
            targetFiles = listOf("src/services/logger.ts"),
            riskLevel = "medium"
        )

        assertEquals("awaiting_approval", writeTask.status)
        assertEquals("medium", writeTask.riskLevel)
        assertTrue(writeTask.targetFiles.contains("src/services/logger.ts"))
    }

    @Test
    fun testUsageQuotaCalculation() {
        val status = SubscriptionStatus(
            tier = "pro",
            cloudTokensConsumed = 200000L,
            cloudTokensLimit = 500000L,
            devicesActive = 2,
            devicesLimit = 3,
            offlineGraceDays = 14
        )

        val percentage = (status.cloudTokensConsumed.toFloat() / status.cloudTokensLimit.toFloat()) * 100
        assertEquals(40f, percentage, 0.01f)
        assertTrue(status.cloudTokensConsumed < status.cloudTokensLimit)
    }
}
