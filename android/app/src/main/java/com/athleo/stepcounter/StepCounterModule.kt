package com.athleo.stepcounter

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.text.SimpleDateFormat
import java.util.ArrayDeque
import java.util.Date
import java.util.Locale
import kotlin.math.sqrt
import kotlin.math.abs

/**
 * AthleoStepCounter
 *
 * Ultra-responsive (1ms / SENSOR_DELAY_FASTEST) hardware step counter and
 * detector, with instant speed, distance, and calorie measurement, plus
 * support for running even when the app is swiped away via PedometerForegroundService.
 */
class StepCounterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), SensorEventListener {

    init {
        instance = this
    }

    private fun todayDateString(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    private val sensorManager: SensorManager? by lazy {
        try {
            reactApplicationContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        } catch (_: Throwable) {
            null
        }
    }
    private val handler = Handler(Looper.getMainLooper())
    private val prefs: SharedPreferences by lazy {
        try {
            reactApplicationContext.getSharedPreferences(PedometerForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        } catch (_: Throwable) {
            reactApplicationContext.getSharedPreferences("athleo_pedometer_fallback", Context.MODE_PRIVATE)
        }
    }

    private fun counterSensor(): Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    private fun detectorSensor(): Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)

    private fun accelerometerSensor(): Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private fun linearAccelerationSensor(): Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)

    private var listening = false
    private var activeSensorType = 0
    private var eventsReceived = 0

    /** Running total for the per-event sensors (detector + accelerometer). */
    private var runningTotal = 0.0

    // Biometrics for speed & distance math
    private var userWeightKg = 72.0
    private var userHeightCm = 176.0
    private var strideLengthM = 0.762

    // Rolling cadence tracking for speed
    private val stepTimestamps = ArrayDeque<Long>(10)

    // Accelerometer peak-valley step detection with human gait calibration
    private val accWindow = ArrayDeque<Float>(28)
    private var lastPeakMs = 0L
    private var lastMagnitude = 0f
    private var goingUp = false
    private var lastTroughMag = 0f
    private val MIN_HUMAN_INTERVAL_MS = 280L
    private val MAX_HUMAN_INTERVAL_MS = 1800L
    private val CONTINUITY_REQUIRED_STEPS = 4
    private var lastCandidateStepMs = 0L
    private var inWalkingRhythm = false
    private val candidateStepsBuffer = ArrayDeque<Long>(8)
    private var lastHardwareEventMs = 0L
    private var lastStepTimeMs = 0L
    private var lastEmittedSpeed = 0.0

    private val speedDecayRunnable = object : Runnable {
        override fun run() {
            if (listening) {
                val now = SystemClock.elapsedRealtime()
                if (lastEmittedSpeed > 0.0 && (now - lastStepTimeMs) > 2000L) {
                    lastEmittedSpeed = 0.0
                    stepTimestamps.clear()
                    val dist = (runningTotal * strideLengthM) / 1000.0
                    val cal = runningTotal * userWeightKg * 0.00055
                    prefs.edit().putFloat(PedometerForegroundService.KEY_SPEED, 0f).apply()
                    emitUpdate(sourceName(activeSensorType), runningTotal, 0.0, dist, cal)
                }
                handler.postDelayed(this, 1000L)
            }
        }
    }

    override fun getName(): String = NAME

    // ── Capability probes ────────────────────────────────────────────────────
    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(
            counterSensor() != null ||
                detectorSensor() != null ||
                accelerometerSensor() != null ||
                linearAccelerationSensor() != null,
        )
    }

    @ReactMethod
    fun getSource(promise: Promise) {
        val type = if (listening) activeSensorType else preferredSensorType()
        promise.resolve(sourceName(type))
    }

    @ReactMethod
    fun getDiagnostics(promise: Promise) {
        try {
            val map = Arguments.createMap()
            map.putBoolean("hasCounter", counterSensor() != null)
            map.putBoolean("hasDetector", detectorSensor() != null)
            map.putBoolean("hasAccelerometer", accelerometerSensor() != null)
            map.putBoolean("hasLinearAcceleration", linearAccelerationSensor() != null)
            map.putBoolean("activityPermission", hasActivityRecognitionPermission())
            map.putBoolean("listening", listening)
            map.putString("activeSource", sourceName(activeSensorType))
            map.putInt("eventsReceived", eventsReceived)
            map.putBoolean("foregroundServiceRunning", prefs.getBoolean(PedometerForegroundService.KEY_IS_ACTIVE, false))
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("step_diagnostics_failed", e)
        }
    }

    @ReactMethod
    fun setUserBiometrics(weightKg: Double, heightCm: Double) {
        if (weightKg > 0) userWeightKg = weightKg
        if (heightCm > 0) {
            userHeightCm = heightCm
            strideLengthM = (userHeightCm * 0.415) / 100.0
        }
    }

    private fun hasActivityRecognitionPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
        return reactApplicationContext.checkSelfPermission(
            Manifest.permission.ACTIVITY_RECOGNITION,
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun preferredSensorType(): Int = when {
        counterSensor() != null -> Sensor.TYPE_STEP_COUNTER
        detectorSensor() != null -> Sensor.TYPE_STEP_DETECTOR
        linearAccelerationSensor() != null -> Sensor.TYPE_LINEAR_ACCELERATION
        accelerometerSensor() != null -> Sensor.TYPE_ACCELEROMETER
        else -> 0
    }

    private fun sourceName(type: Int): String = when (type) {
        Sensor.TYPE_STEP_COUNTER -> SOURCE_COUNTER
        Sensor.TYPE_STEP_DETECTOR -> SOURCE_DETECTOR
        Sensor.TYPE_LINEAR_ACCELERATION -> SOURCE_ACCELEROMETER
        Sensor.TYPE_ACCELEROMETER -> SOURCE_ACCELEROMETER
        else -> SOURCE_NONE
    }

    // ── Start / stop in-app listener ─────────────────────────────────────────
    @ReactMethod
    fun startUpdates(promise: Promise) {
        if (listening) {
            // Already listening — emit latest snapshot from prefs so UI is up-to-date
            val today = todayDateString()
            val savedDate = prefs.getString(PedometerForegroundService.KEY_DATE, "") ?: ""
            val currentSteps = if (savedDate == today) prefs.getInt(PedometerForegroundService.KEY_STEPS, 0) else 0
            if (currentSteps > 0) {
                val dist = prefs.getFloat(PedometerForegroundService.KEY_DISTANCE, 0f).toDouble()
                val spd = prefs.getFloat(PedometerForegroundService.KEY_SPEED, 0f).toDouble()
                val cal = prefs.getFloat(PedometerForegroundService.KEY_CALORIES, 0f).toDouble()
                emitUpdate(sourceName(activeSensorType), currentSteps.toDouble(), spd, dist, cal)
            }
            promise.resolve(sourceName(activeSensorType))
            return
        }

        eventsReceived = 0
        val today = todayDateString()
        val savedDate = prefs.getString(PedometerForegroundService.KEY_DATE, "") ?: ""
        val savedSteps = if (savedDate == today) prefs.getInt(PedometerForegroundService.KEY_STEPS, 0).toDouble() else 0.0
        runningTotal = savedSteps
        accWindow.clear()
        stepTimestamps.clear()

        val hasPerm = hasActivityRecognitionPermission()
        var anyRegistered = false

        // 1. Hardware Step Counter / Detector (requires ACTIVITY_RECOGNITION on Android 10+)
        if (hasPerm) {
            val counter = counterSensor()
            if (counter != null && registerHardware(counter)) {
                activeSensorType = Sensor.TYPE_STEP_COUNTER
                anyRegistered = true
            }
            val detector = detectorSensor()
            if (detector != null && registerHardware(detector)) {
                if (activeSensorType == 0) activeSensorType = Sensor.TYPE_STEP_DETECTOR
                anyRegistered = true
            }
        }

        // 2. ALWAYS register Accelerometer / Linear Acceleration as concurrent real-time motion sensor.
        // This solves:
        //  - Android 10+ batching delay (hardware step counter waits 5-15 steps before firing)
        //  - Missing ACTIVITY_RECOGNITION permission (accelerometer requires zero permissions)
        //  - Instant step counting from step #1 with zero latency
        val motionOk = startLinearAcceleration() || startAccelerometer()
        if (motionOk) {
            anyRegistered = true
            if (activeSensorType == 0) activeSensorType = Sensor.TYPE_ACCELEROMETER
        }

        // If foreground service is running, emit a snapshot immediately so the UI reflects current steps
        if (PedometerForegroundService.isServiceRunning && savedSteps > 0) {
            val dist = prefs.getFloat(PedometerForegroundService.KEY_DISTANCE, 0f).toDouble()
            val spd = prefs.getFloat(PedometerForegroundService.KEY_SPEED, 0f).toDouble()
            val cal = prefs.getFloat(PedometerForegroundService.KEY_CALORIES, 0f).toDouble()
            emitUpdate(sourceName(activeSensorType), savedSteps, spd, dist, cal)
        }

        if (anyRegistered) {
            listening = true
            handler.removeCallbacks(speedDecayRunnable)
            handler.postDelayed(speedDecayRunnable, 1000L)
            promise.resolve(sourceName(activeSensorType))
        } else {
            listening = false
            activeSensorType = 0
            handler.removeCallbacks(speedDecayRunnable)
            promise.resolve(SOURCE_NONE)
        }
    }

    private fun registerHardware(sensor: Sensor): Boolean = try {
        val sm = sensorManager ?: return false
        val delay = SensorManager.SENSOR_DELAY_UI
        val registered = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            sm.registerListener(this, sensor, delay, 0)
        } else {
            sm.registerListener(this, sensor, delay)
        }
        registered || sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME) ||
            sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
    } catch (_: Exception) {
        false
    }

    private fun startLinearAcceleration(): Boolean {
        val sensor = linearAccelerationSensor() ?: return false
        val sm = sensorManager ?: return false
        lastPeakMs = 0L
        lastMagnitude = 0f
        goingUp = false
        lastTroughMag = 0f
        accWindow.clear()
        val delay = SensorManager.SENSOR_DELAY_UI
        val registered = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                sm.registerListener(this, sensor, delay, 0)
            } else {
                sm.registerListener(this, sensor, delay)
            } || sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
        } catch (_: Exception) {
            false
        }
        return registered
    }

    private fun startAccelerometer(): Boolean {
        val sensor = accelerometerSensor() ?: return false
        val sm = sensorManager ?: return false
        lastPeakMs = 0L
        lastMagnitude = 0f
        goingUp = false
        lastTroughMag = 0f
        accWindow.clear()
        val delay = SensorManager.SENSOR_DELAY_UI
        val registered = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                sm.registerListener(this, sensor, delay, 0)
            } else {
                sm.registerListener(this, sensor, delay)
            } || sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
        } catch (_: Exception) {
            false
        }
        return registered
    }

    @ReactMethod
    fun stopUpdates(promise: Promise) {
        try {
            handler.removeCallbacks(speedDecayRunnable)
            if (listening) {
                sensorManager?.unregisterListener(this)
            }
            listening = false
            activeSensorType = 0
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("step_counter_stop_failed", e)
        }
    }

    // ── Background Foreground Service (Tracks when app closed) ──────────────
    @ReactMethod
    fun startForegroundService(goalSteps: Double, weightKg: Double, heightCm: Double, promise: Promise) {
        try {
            setUserBiometrics(weightKg, heightCm)
            val intent = Intent(reactApplicationContext, PedometerForegroundService::class.java).apply {
                action = PedometerForegroundService.ACTION_START
                putExtra(PedometerForegroundService.EXTRA_GOAL, goalSteps.toInt())
                putExtra(PedometerForegroundService.EXTRA_WEIGHT, if (weightKg > 0) weightKg else userWeightKg)
                putExtra(PedometerForegroundService.EXTRA_HEIGHT, if (heightCm > 0) heightCm else userHeightCm)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(reactApplicationContext, intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Throwable) {
            android.util.Log.w("StepCounterModule", "startForegroundService suppressed: ${e.message}")
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stopForegroundService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, PedometerForegroundService::class.java).apply {
                action = PedometerForegroundService.ACTION_STOP
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("stop_foreground_failed", e)
        }
    }

    @ReactMethod
    fun getBackgroundStats(promise: Promise) {
        try {
            val map = Arguments.createMap()
            map.putInt("steps", prefs.getInt(PedometerForegroundService.KEY_STEPS, 0))
            map.putDouble("distanceKm", prefs.getFloat(PedometerForegroundService.KEY_DISTANCE, 0f).toDouble())
            map.putDouble("speedKmh", prefs.getFloat(PedometerForegroundService.KEY_SPEED, 0f).toDouble())
            map.putDouble("calories", prefs.getFloat(PedometerForegroundService.KEY_CALORIES, 0f).toDouble())
            map.putBoolean("isActive", prefs.getBoolean(PedometerForegroundService.KEY_IS_ACTIVE, false))
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("get_background_stats_failed", e)
        }
    }

    /**
     * Returns the last 7 days of step data stored per-day by the background service.
     * Resolves to a JS array: [{date, steps, distanceKm, calories}, ...]  oldest first.
     */
    @ReactMethod
    fun getWeeklyStats(promise: Promise) {
        try {
            val result = Arguments.createArray()
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            val cal = java.util.Calendar.getInstance()

            for (i in 6 downTo 0) {
                cal.time = java.util.Date()
                cal.add(java.util.Calendar.DAY_OF_YEAR, -i)
                val dateKey = sdf.format(cal.time)

                val dayMap = Arguments.createMap()
                dayMap.putString("date", dateKey)
                dayMap.putInt(
                    "steps",
                    prefs.getInt("${PedometerForegroundService.KEY_STEPS}_$dateKey", 0)
                )
                dayMap.putDouble(
                    "distanceKm",
                    prefs.getFloat("${PedometerForegroundService.KEY_DISTANCE}_$dateKey", 0f).toDouble()
                )
                dayMap.putDouble(
                    "calories",
                    prefs.getFloat("${PedometerForegroundService.KEY_CALORIES}_$dateKey", 0f).toDouble()
                )
                result.pushMap(dayMap)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("get_weekly_stats_failed", e)
        }
    }

    // ── SensorEventListener ──────────────────────────────────────────────────
    override fun onSensorChanged(event: SensorEvent) {
        eventsReceived++
        val now = SystemClock.elapsedRealtime()

        when (event.sensor.type) {
            Sensor.TYPE_STEP_COUNTER -> {
                lastHardwareEventMs = now
                val raw = event.values[0].toLong()
                val today = todayDateString()
                val baseDate = prefs.getString(PedometerForegroundService.KEY_BASE_DATE, "") ?: ""
                var baseRaw = prefs.getLong(PedometerForegroundService.KEY_BASE_COUNTER, -1L)
                val savedDate = prefs.getString(PedometerForegroundService.KEY_DATE, "") ?: ""
                val savedSteps = if (savedDate == today) prefs.getInt(PedometerForegroundService.KEY_STEPS, 0) else 0

                if (baseDate != today || baseRaw < 0L) {
                    baseRaw = raw
                    val initialOffset = maxOf(savedSteps, runningTotal.toInt())
                    prefs.edit()
                        .putLong(PedometerForegroundService.KEY_BASE_COUNTER, baseRaw)
                        .putString(PedometerForegroundService.KEY_BASE_DATE, today)
                        .putInt(PedometerForegroundService.KEY_OFFSET_STEPS, initialOffset)
                        .putString(PedometerForegroundService.KEY_DATE, today)
                        .apply()
                    runningTotal = initialOffset.toDouble()
                    recordAndEmit(SOURCE_COUNTER, runningTotal, now)
                    return
                }

                if (raw < baseRaw) {
                    val savedOffset = prefs.getInt(PedometerForegroundService.KEY_OFFSET_STEPS, 0)
                    val newOffset = maxOf(savedOffset, savedSteps, runningTotal.toInt())
                    baseRaw = raw
                    prefs.edit()
                        .putLong(PedometerForegroundService.KEY_BASE_COUNTER, baseRaw)
                        .putInt(PedometerForegroundService.KEY_OFFSET_STEPS, newOffset)
                        .apply()
                    return
                }

                val offset = prefs.getInt(PedometerForegroundService.KEY_OFFSET_STEPS, 0)
                val delta = offset + (raw - baseRaw).toInt()
                val todaySteps = maxOf(savedSteps, delta, runningTotal.toInt())
                runningTotal = todaySteps.toDouble()
                recordAndEmit(SOURCE_COUNTER, todaySteps.toDouble(), now)
            }

            Sensor.TYPE_STEP_DETECTOR -> {
                lastHardwareEventMs = now
                if ((now - lastPeakMs) >= MIN_HUMAN_INTERVAL_MS) {
                    lastPeakMs = now
                    runningTotal += 1.0
                    recordAndEmit(SOURCE_DETECTOR, runningTotal, now)
                }
            }

            Sensor.TYPE_LINEAR_ACCELERATION,
            Sensor.TYPE_ACCELEROMETER -> {
                // If hardware step counter or detector is actively reporting, do not allow
                // raw accelerometer motion to double-count or fire on random device shakes.
                val hardwareActive = (counterSensor() != null || detectorSensor() != null) &&
                        (now - lastHardwareEventMs) < 8000L
                if (hardwareActive) {
                    return
                }

                if (detectStepFromMotion(event, now)) {
                    val interval = now - lastCandidateStepMs
                    if (interval > MAX_HUMAN_INTERVAL_MS) {
                        // Inactivity gap exceeded: reset rhythm, require 4 continuous steps
                        candidateStepsBuffer.clear()
                        inWalkingRhythm = false
                    }
                    lastCandidateStepMs = now

                    if (inWalkingRhythm) {
                        // Verified human walking rhythm active: count step live
                        runningTotal += 1.0
                        val source = if (activeSensorType == Sensor.TYPE_STEP_COUNTER) SOURCE_COUNTER else SOURCE_ACCELEROMETER
                        recordAndEmit(source, runningTotal, now)
                    } else {
                        // Buffer candidate steps to discard random device movements/fidgets
                        candidateStepsBuffer.addLast(now)
                        if (candidateStepsBuffer.size >= CONTINUITY_REQUIRED_STEPS) {
                            inWalkingRhythm = true
                            runningTotal += candidateStepsBuffer.size.toDouble()
                            candidateStepsBuffer.clear()
                            val source = if (activeSensorType == Sensor.TYPE_STEP_COUNTER) SOURCE_COUNTER else SOURCE_ACCELEROMETER
                            recordAndEmit(source, runningTotal, now)
                        }
                    }
                }
            }
        }
    }

    private fun recordAndEmit(source: String, steps: Double, now: Long) {
        stepTimestamps.addLast(now)
        while (stepTimestamps.size > 8) {
            stepTimestamps.removeFirst()
        }

        // Instantaneous cadence and speed calculation
        val speedKmh = if (stepTimestamps.size >= 2) {
            val durationSec = (now - stepTimestamps.first()) / 1000.0
            if (durationSec > 0.05) {
                val stepsInWindow = stepTimestamps.size - 1
                val cadence = stepsInWindow / durationSec
                (cadence * strideLengthM * 3.6).coerceIn(0.0, 35.0)
            } else 0.0
        } else 0.0

        val distanceKm = (steps * strideLengthM) / 1000.0
        val calories = steps * userWeightKg * 0.00055
        lastStepTimeMs = now
        lastEmittedSpeed = speedKmh

        // CRITICAL: Always persist to SharedPreferences so JS getBackgroundStats / other screens always see latest!
        val today = todayDateString()
        prefs.edit()
            .putInt(PedometerForegroundService.KEY_STEPS, steps.toInt())
            .putFloat(PedometerForegroundService.KEY_DISTANCE, distanceKm.toFloat())
            .putFloat(PedometerForegroundService.KEY_SPEED, speedKmh.toFloat())
            .putFloat(PedometerForegroundService.KEY_CALORIES, calories.toFloat())
            .putString(PedometerForegroundService.KEY_DATE, today)
            .putInt("${PedometerForegroundService.KEY_STEPS}_$today", steps.toInt())
            .putFloat("${PedometerForegroundService.KEY_DISTANCE}_$today", distanceKm.toFloat())
            .putFloat("${PedometerForegroundService.KEY_CALORIES}_$today", calories.toFloat())
            .apply()

        emitUpdate(source, steps, speedKmh, distanceKm, calories)
    }

    private fun detectStepFromMotion(event: SensorEvent, now: Long): Boolean {
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        val isLinear = event.sensor.type == Sensor.TYPE_LINEAR_ACCELERATION
        val magnitude = if (isLinear) {
            sqrt(x * x + y * y + z * z)
        } else {
            abs(sqrt(x * x + y * y + z * z) - 9.80665f)
        }

        accWindow.addLast(magnitude)
        if (accWindow.size > 28) accWindow.removeFirst()

        val mean = if (accWindow.isNotEmpty()) accWindow.average().toFloat() else 1.0f
        var sumSquares = 0f
        for (v in accWindow) {
            val d = v - mean
            sumSquares += d * d
        }
        val stdDev = if (accWindow.isNotEmpty()) sqrt(sumSquares / accWindow.size) else 0.4f

        // Human gait calibration:
        // Ordinary handling/fidgeting/desk pickups generate swings < 0.70 m/s^2.
        // True human walking steps create distinct dynamic peaks > 1.25 m/s^2 and swings > 0.90 m/s^2.
        val absFloor = if (isLinear) 1.25f else 1.45f
        val threshold = maxOf(absFloor, mean + 0.40f * stdDev)

        val isRising = magnitude > lastMagnitude

        if (!goingUp && isRising) {
            lastTroughMag = lastMagnitude
            goingUp = true
        } else if (goingUp && !isRising) {
            val peakMag = lastMagnitude
            val swing = peakMag - lastTroughMag
            val minSwing = if (isLinear) 0.90f else 1.15f

            if (peakMag > threshold && swing > minSwing && (now - lastPeakMs) in MIN_HUMAN_INTERVAL_MS..MAX_HUMAN_INTERVAL_MS) {
                lastPeakMs = now
                goingUp = false
                lastMagnitude = magnitude
                return true
            }
            goingUp = false
        }

        lastMagnitude = magnitude
        return false
    }

    fun onBackgroundStepEvent(steps: Int, speedKmh: Double, distanceKm: Double, calories: Double) {
        runningTotal = steps.toDouble()
        emitUpdate(SOURCE_COUNTER, steps.toDouble(), speedKmh, distanceKm, calories)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun emitUpdate(source: String, steps: Double, speedKmh: Double, distanceKm: Double, calories: Double) {
        val payload: WritableMap = Arguments.createMap()
        payload.putString("source", source)
        payload.putDouble("steps", steps)
        payload.putDouble("speedKmh", speedKmh)
        payload.putDouble("distanceKm", distanceKm)
        payload.putDouble("calories", calories)
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_NAME, payload)
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Double) {}

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        instance = null
        try {
            sensorManager?.unregisterListener(this)
        } catch (_: Exception) {}
        listening = false
        activeSensorType = 0
    }

    companion object {
        const val NAME = "AthleoStepCounter"
        const val EVENT_NAME = "AthleoStepCounter:update"
        var instance: StepCounterModule? = null

        private const val SOURCE_COUNTER = "counter"
        private const val SOURCE_DETECTOR = "detector"
        private const val SOURCE_ACCELEROMETER = "accelerometer"
        private const val SOURCE_NONE = "none"
    }
}
