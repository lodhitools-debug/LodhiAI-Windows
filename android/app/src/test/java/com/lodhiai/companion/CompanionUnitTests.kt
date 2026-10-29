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

    @Test
    fun testOfflineVoiceMissingModelFailsGracefully() {
        val tempDir = java.nio.file.Files.createTempDirectory("lodhi_voice_test").toFile()
        val metadata = com.lodhiai.companion.voice.VoiceModelMetadata(
            modelId = "vosk-model-en-us-0.22",
            languageCode = "en-US",
            license = "Apache-2.0",
            expectedSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            sizeBytes = 40960000L
        )

        val engine = com.lodhiai.companion.voice.OfflineSpeechEngine(metadata, tempDir)
        val loadResult = engine.verifyAndLoadModel()

        assertTrue(loadResult.isFailure)
        assertTrue(loadResult.exceptionOrNull()?.message?.contains("not found") == true)
        assertFalse(engine.isModelLoaded)
        tempDir.deleteRecursively()
    }

    @Test
    fun testOfflineVoiceCorruptedModelIntegrityFails() {
        val tempDir = java.nio.file.Files.createTempDirectory("lodhi_voice_corrupt").toFile()
        val dummyFile = java.io.File(tempDir, "vosk-model-en-us-0.22.bin")
        dummyFile.writeBytes("corrupted audio model payload".toByteArray())

        val metadata = com.lodhiai.companion.voice.VoiceModelMetadata(
            modelId = "vosk-model-en-us-0.22",
            languageCode = "en-US",
            license = "Apache-2.0",
            expectedSha256 = "0000000000000000000000000000000000000000000000000000000000000000",
            sizeBytes = dummyFile.length()
        )

        val engine = com.lodhiai.companion.voice.OfflineSpeechEngine(metadata, tempDir)
        val loadResult = engine.verifyAndLoadModel()

        assertTrue(loadResult.isFailure)
        assertTrue(loadResult.exceptionOrNull()?.message?.contains("SHA-256 mismatch") == true)
        assertFalse(engine.isModelLoaded)
        tempDir.deleteRecursively()
    }

    @Test
    fun testOfflineVoiceValidModelDecodesSuccessfully() {
        val tempDir = java.nio.file.Files.createTempDirectory("lodhi_voice_valid").toFile()
        val dummyFile = java.io.File(tempDir, "vosk-model-ur-pk-0.1.bin")
        val samplePayload = "valid acoustic weights".toByteArray()
        dummyFile.writeBytes(samplePayload)

        // Compute valid sha256
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val validSha256 = digest.digest(samplePayload).joinToString("") { "%02x".format(it) }

        val metadata = com.lodhiai.companion.voice.VoiceModelMetadata(
            modelId = "vosk-model-ur-pk-0.1",
            languageCode = "ur-PK",
            license = "Apache-2.0",
            expectedSha256 = validSha256,
            sizeBytes = dummyFile.length()
        )

        val engine = com.lodhiai.companion.voice.OfflineSpeechEngine(metadata, tempDir)
        val loadResult = engine.verifyAndLoadModel()
        assertTrue(loadResult.isSuccess)
        assertTrue(engine.isModelLoaded)

        // Transcribe audio
        val audioBytes = ByteArray(1024) { 0x12 }
        val decodeResult = engine.decodeAudioSamples(
            audioSamples = audioBytes,
            hasAudioPermission = true,
            isNetworkAvailable = false // Offline / airplane mode
        )

        assertTrue(decodeResult.isSuccess)
        assertTrue(decodeResult.getOrNull()?.contains("ur-PK") == true)
        tempDir.deleteRecursively()
    }

    @Test
    fun testOfflineVoicePermissionDenied() {
        val tempDir = java.nio.file.Files.createTempDirectory("lodhi_perm_test").toFile()
        val metadata = com.lodhiai.companion.voice.VoiceModelMetadata(
            modelId = "m1", languageCode = "en-US", license = "Apache-2.0", expectedSha256 = "abc", sizeBytes = 100
        )
        val engine = com.lodhiai.companion.voice.OfflineSpeechEngine(metadata, tempDir)

        val decodeResult = engine.decodeAudioSamples(
            audioSamples = ByteArray(10),
            hasAudioPermission = false,
            isNetworkAvailable = true
        )
        assertTrue(decodeResult.isFailure)
        assertTrue(decodeResult.exceptionOrNull() is SecurityException)
        tempDir.deleteRecursively()
    }

    @Test
    fun testOfflineVoiceAirplaneModeRejectionWhenNoModel() {
        val tempDir = java.nio.file.Files.createTempDirectory("lodhi_airplane_test").toFile()
        val metadata = com.lodhiai.companion.voice.VoiceModelMetadata(
            modelId = "m1", languageCode = "en-US", license = "Apache-2.0", expectedSha256 = "abc", sizeBytes = 100
        )
        val engine = com.lodhiai.companion.voice.OfflineSpeechEngine(metadata, tempDir)

        val decodeResult = engine.decodeAudioSamples(
            audioSamples = ByteArray(10),
            hasAudioPermission = true,
            isNetworkAvailable = false // Airplane mode with no model loaded
        )
        assertTrue(decodeResult.isFailure)
        assertTrue(decodeResult.exceptionOrNull() is IllegalStateException)
        tempDir.deleteRecursively()
    }
}
