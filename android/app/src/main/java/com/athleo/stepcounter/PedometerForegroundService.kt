package com.athleo.stepcounter

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.ArrayDeque
import java.util.Date
import java.util.Locale
import kotlin.math.sqrt

/**
 * PedometerForegroundService
 *
 * Keeps tracking steps even when the app is swiped away / killed.
 *
 * KEY FIXES:
 *  1. TYPE_STEP_COUNTER is anchored PER DAY. The boot-cumulative raw value is
 *     stored as `base` the FIRST time we get a reading for a given calendar day.
 *     Steps = raw − base. On midnight rollover the base is re-anchored from the
 *     very next event, so yesterday's totals are never carried into today.
 *
 *  2. The accelerometer/linear-acceleration fallback uses a proper peak-valley
 *     detector so it only fires when the phone is actually moving with a
 *     human-walking rhythm — NOT just sensor noise at rest.
 *
 *  3. Per-day totals are stored under date-stamped keys so the JS side can read
 *     individual days for weekly/daily charts without ambiguity.
 */
class PedometerForegroundService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private lateinit var prefs: SharedPreferences
    private var wakeLock: PowerManager.WakeLock? = null

    private var isListening = false
    private var activeSensorType = 0

    // Today's accumulated steps (this session / day)
    private var sessionSteps = 0
    private var userWeightKg = 72.0
    private var userHeightCm = 176.0
    private var strideLengthM = 0.762
    private var stepGoal = 10000

    // ── TYPE_STEP_COUNTER per-day anchoring ──────────────────────────────────
    /** Boot-cumulative raw value recorded on the FIRST event of today. */
    private var counterBaseRaw = -1L
    /** Calendar-day string when counterBaseRaw was recorded. */
    private var counterBaseDate = ""

    // ── Cadence / speed ──────────────────────────────────────────────────────
    private val stepTimestamps = ArrayDeque<Long>(10)
    private var lastNotificationUpdateMs = 0L

    // ── Accelerometer peak-valley step detector with human gait calibration ──
    private val accWindow = ArrayDeque<Float>(28)   // rolling magnitude window
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

    override fun onCreate() {
        super.onCreate()
        try {
            sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
            prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Athleo:PedometerWakeLock")
            try { wakeLock?.acquire(24 * 60 * 60 * 1000L) } catch (_: Throwable) {}

            createNotificationChannel()
        } catch (t: Throwable) {
            android.util.Log.e("PedometerService", "Error in onCreate", t)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            val action = intent?.action
            if (action == ACTION_STOP) {
                stopTracking()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
                return START_NOT_STICKY
            }

            userWeightKg  = intent?.getDoubleExtra(EXTRA_WEIGHT, 72.0) ?: 72.0
            userHeightCm  = intent?.getDoubleExtra(EXTRA_HEIGHT, 176.0) ?: 176.0
            stepGoal      = intent?.getIntExtra(EXTRA_GOAL, 10000) ?: 10000
            strideLengthM = if (userHeightCm > 0) (userHeightCm * 0.415) / 100.0 else 0.762

            isServiceRunning = true

            // Restore today's accumulated steps (only if stored date matches today)
            val today = todayDateString()
            val savedDate = prefs.getString(KEY_DATE, "")
            sessionSteps = if (savedDate == today) prefs.getInt(KEY_STEPS, 0) else 0

            // Restore the step-counter per-day base (only valid for today)
            counterBaseDate = prefs.getString(KEY_BASE_DATE, "") ?: ""
            counterBaseRaw  = prefs.getLong(KEY_BASE_COUNTER, -1L)
            if (counterBaseDate != today) {
                // New day — invalidate the base so it re-anchors on the first event
                counterBaseRaw  = -1L
                counterBaseDate = ""
                prefs.edit().putInt(KEY_OFFSET_STEPS, 0).apply()
            }

            startForegroundNotification()
            startTracking()
        } catch (t: Throwable) {
            android.util.Log.e("PedometerService", "Error in onStartCommand", t)
        }

        return START_STICKY
    }

    // ── Notification ─────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Athleo Step Counter",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Active step tracking in background"
                    setShowBadge(false)
                }
                getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
            } catch (t: Throwable) {
                android.util.Log.e("PedometerService", "Failed to create channel", t)
            }
        }
    }

    private fun startForegroundNotification() {
        try {
            val notification = buildNotification(sessionSteps, 0.0, 0.0, 0.0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val hasActivityPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
                } else true

                val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    if (hasActivityPerm) {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    } else {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    }
                } else {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                }

                try {
                    startForeground(NOTIFICATION_ID, notification, type)
                } catch (_: Throwable) {
                    try {
                        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                    } catch (_: Throwable) {
                        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                            startForeground(NOTIFICATION_ID, notification)
                        }
                    }
                }
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (t: Throwable) {
            android.util.Log.e("PedometerService", "startForegroundNotification failed", t)
        }
    }

    private fun buildNotification(steps: Int, distanceKm: Double, speedKmh: Double, calories: Double): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: Intent()
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )
        val title = "🚶 Athleo Step Tracker • ${String.format(Locale.US, "%,d", steps)} Steps"
        val text  = "${String.format(Locale.US, "%.2f", distanceKm)} km  •  " +
                "${String.format(Locale.US, "%.1f", speedKmh)} km/h  •  " +
                "${String.format(Locale.US, "%.0f", calories)} kcal"

        val customIcon = try {
            resources.getIdentifier("ic_notification", "drawable", packageName)
        } catch (_: Throwable) { 0 }
        val iconRes: Int = if (customIcon != 0) customIcon else android.R.drawable.ic_dialog_info

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(iconRes)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    // ── Sensor registration ───────────────────────────────────────────────────

    private fun startTracking() {
        if (isListening) return

        val hasActivityPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
        } else true

        val counter  = if (hasActivityPerm) sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) else null
        val detector = if (hasActivityPerm) sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) else null
        val linear   = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
        val accel    = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        var registered = false
        val delay = SensorManager.SENSOR_DELAY_UI

        if (counter != null) {
            val ok = try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    sensorManager.registerListener(this, counter, delay, 0)
                } else {
                    sensorManager.registerListener(this, counter, delay)
                } || sensorManager.registerListener(this, counter, SensorManager.SENSOR_DELAY_NORMAL)
            } catch (_: Exception) { false }
            if (ok) {
                activeSensorType = Sensor.TYPE_STEP_COUNTER
                registered = true
            }
        }
        if (detector != null) {
            val ok = try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    sensorManager.registerListener(this, detector, delay, 0)
                } else {
                    sensorManager.registerListener(this, detector, delay)
                } || sensorManager.registerListener(this, detector, SensorManager.SENSOR_DELAY_GAME)
            } catch (_: Exception) { false }
            if (ok) {
                if (activeSensorType == 0) activeSensorType = Sensor.TYPE_STEP_DETECTOR
                registered = true
            }
        }
        // ALWAYS also register motion sensor (linear or accel) for instant responsiveness & fallback
        if (linear != null) {
            val ok = try {
                sensorManager.registerListener(this, linear, delay)
            } catch (_: Exception) { false }
            if (ok) {
                if (activeSensorType == 0) activeSensorType = Sensor.TYPE_LINEAR_ACCELERATION
                registered = true
            }
        } else if (accel != null) {
            val ok = try {
                sensorManager.registerListener(this, accel, delay)
            } catch (_: Exception) { false }
            if (ok) {
                if (activeSensorType == 0) activeSensorType = Sensor.TYPE_ACCELEROMETER
                registered = true
            }
        }

        isListening = registered
        isServiceRunning = registered
        prefs.edit().putBoolean(KEY_IS_ACTIVE, registered).apply()
    }

    private fun stopTracking() {
        try { sensorManager.unregisterListener(this) } catch (_: Exception) {}
        isListening = false
        isServiceRunning = false
        activeSensorType = 0
        prefs.edit().putBoolean(KEY_IS_ACTIVE, false).apply()
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {}
    }

    // ── SensorEventListener ───────────────────────────────────────────────────

    override fun onSensorChanged(event: SensorEvent) {
        val now = SystemClock.elapsedRealtime()

        when (event.sensor.type) {
            Sensor.TYPE_STEP_COUNTER   -> {
                lastHardwareEventMs = now
                handleStepCounter(event.values[0].toLong(), now)
            }
            Sensor.TYPE_STEP_DETECTOR  -> {
                lastHardwareEventMs = now
                if ((now - lastPeakMs) >= MIN_HUMAN_INTERVAL_MS) {
                    lastPeakMs = now
                    recordStep(now)
                }
            }
            Sensor.TYPE_LINEAR_ACCELERATION,
            Sensor.TYPE_ACCELEROMETER  -> {
                // If hardware step counter or detector is reporting, suppress raw motion
                val hasHardware = (sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null ||
                        sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null)
                if (hasHardware && (now - lastHardwareEventMs) < 8000L) {
                    return
                }

                if (detectMotionStep(event, now)) {
                    val interval = now - lastCandidateStepMs
                    if (interval > MAX_HUMAN_INTERVAL_MS) {
                        candidateStepsBuffer.clear()
                        inWalkingRhythm = false
                    }
                    lastCandidateStepMs = now

                    if (inWalkingRhythm) {
                        recordStep(now)
                    } else {
                        candidateStepsBuffer.addLast(now)
                        if (candidateStepsBuffer.size >= CONTINUITY_REQUIRED_STEPS) {
                            inWalkingRhythm = true
                            sessionSteps += candidateStepsBuffer.size
                            candidateStepsBuffer.clear()
                            persistAndNotify(now)
                        }
                    }
                }
            }
        }
    }

    /**
     * TYPE_STEP_COUNTER gives a boot-cumulative raw count.
     * We anchor it to a per-day base: steps = offset + (raw - base).
     *
     * Midnight rollover: re-anchors to raw, sets offset to 0.
     * Phone reboot: preserves previous steps in offset so steps never reset.
     */
    private fun handleStepCounter(raw: Long, now: Long) {
        val today = todayDateString()
        val savedDate = prefs.getString(KEY_DATE, "") ?: ""
        val savedSteps = if (savedDate == today) prefs.getInt(KEY_STEPS, 0) else 0

        if (counterBaseDate != today || counterBaseRaw < 0L) {
            // First event of a new day (or first ever) — anchor here
            counterBaseRaw  = raw
            counterBaseDate = today
            val initialOffset = maxOf(sessionSteps, savedSteps)
            sessionSteps = initialOffset
            prefs.edit()
                .putLong(KEY_BASE_COUNTER, counterBaseRaw)
                .putString(KEY_BASE_DATE, counterBaseDate)
                .putInt(KEY_OFFSET_STEPS, initialOffset)
                .putString(KEY_DATE, today)
                .apply()
            persistAndNotify(now)
            return
        }

        // Guard: counter reset (reboot while phone was on)
        if (raw < counterBaseRaw) {
            val savedOffset = prefs.getInt(KEY_OFFSET_STEPS, 0)
            val newOffset = maxOf(savedOffset, sessionSteps, savedSteps)
            counterBaseRaw = raw
            prefs.edit()
                .putLong(KEY_BASE_COUNTER, counterBaseRaw)
                .putInt(KEY_OFFSET_STEPS, newOffset)
                .apply()
            return
        }

        val offset = prefs.getInt(KEY_OFFSET_STEPS, 0)
        val delta = offset + (raw - counterBaseRaw).toInt()
        val finalSteps = maxOf(sessionSteps, savedSteps, delta)
        if (finalSteps != sessionSteps) {
            sessionSteps = finalSteps
            persistAndNotify(now)
        }
    }

    private fun recordStep(now: Long) {
        sessionSteps++
        persistAndNotify(now)
    }

    // ── Accelerometer peak-valley step detector ───────────────────────────────

    /**
     * Returns true when a genuine walking step is detected via peak-valley.
     */
    private fun detectMotionStep(event: SensorEvent, now: Long): Boolean {
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        val isLinear = event.sensor.type == Sensor.TYPE_LINEAR_ACCELERATION
        val magnitude = if (isLinear) {
            sqrt(x * x + y * y + z * z)
        } else {
            kotlin.math.abs(sqrt(x * x + y * y + z * z) - 9.80665f)
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

        // Real human walking gait thresholds:
        val absFloor = if (isLinear) 1.25f else 1.45f
        val threshold = maxOf(absFloor, mean + 0.40f * stdDev)

        val isRising = magnitude > lastMagnitude

        if (!goingUp && isRising) {
            lastTroughMag = lastMagnitude
            goingUp = true
        } else if (goingUp && !isRising) {
            val peakMag = lastMagnitude
            val swing   = peakMag - lastTroughMag
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

    // ── Persist & notify ──────────────────────────────────────────────────────

    private fun persistAndNotify(now: Long) {
        stepTimestamps.addLast(now)
        while (stepTimestamps.size > 8) stepTimestamps.removeFirst()

        val speedKmh: Double = if (stepTimestamps.size >= 2) {
            val durationSec = (now - stepTimestamps.first()) / 1000.0
            if (durationSec > 0.1) {
                val cadence = (stepTimestamps.size - 1) / durationSec
                (cadence * strideLengthM * 3.6).coerceIn(0.0, 35.0)
            } else 0.0
        } else 0.0

        val distanceKm = (sessionSteps * strideLengthM) / 1000.0
        val calories   = sessionSteps * userWeightKg * 0.00055

        // Persist to SharedPreferences — JS layer reads these
        val today = todayDateString()
        prefs.edit()
            .putInt(KEY_STEPS, sessionSteps)
            .putFloat(KEY_DISTANCE, distanceKm.toFloat())
            .putFloat(KEY_SPEED, speedKmh.toFloat())
            .putFloat(KEY_CALORIES, calories.toFloat())
            .putString(KEY_DATE, today)
            // Per-day keys for weekly chart access from JS
            .putInt("${KEY_STEPS}_$today", sessionSteps)
            .putFloat("${KEY_DISTANCE}_$today", distanceKm.toFloat())
            .putFloat("${KEY_CALORIES}_$today", calories.toFloat())
            .apply()

        // Inform StepCounterModule if app is open
        StepCounterModule.instance?.onBackgroundStepEvent(sessionSteps, speedKmh, distanceKm, calories)

        // Throttle notification updates to once every 1.5 seconds
        if (now - lastNotificationUpdateMs > 1500L) {
            lastNotificationUpdateMs = now
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(NOTIFICATION_ID, buildNotification(sessionSteps, distanceKm, speedKmh, calories))
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopTracking()
        super.onDestroy()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun todayDateString(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    // ── Companion ─────────────────────────────────────────────────────────────

    companion object {
        const val CHANNEL_ID      = "athleo_pedometer_channel"
        const val NOTIFICATION_ID = 998877

        const val PREFS_NAME       = "athleo_pedometer_prefs"
        const val KEY_STEPS        = "pedometer_steps"
        const val KEY_DISTANCE     = "pedometer_distance"
        const val KEY_SPEED        = "pedometer_speed"
        const val KEY_CALORIES     = "pedometer_calories"
        const val KEY_DATE         = "pedometer_date"
        /** Boot-cumulative raw value at start of today */
        const val KEY_BASE_COUNTER = "pedometer_base_counter"
        /** Calendar date when KEY_BASE_COUNTER was captured */
        const val KEY_BASE_DATE    = "pedometer_base_date"
        const val KEY_OFFSET_STEPS = "pedometer_offset_steps"
        const val KEY_IS_ACTIVE    = "pedometer_is_active"

        const val ACTION_START = "com.athleo.stepcounter.START"
        const val ACTION_STOP  = "com.athleo.stepcounter.STOP"

        const val EXTRA_WEIGHT = "extra_weight"
        const val EXTRA_HEIGHT = "extra_height"
        const val EXTRA_GOAL   = "extra_goal"

        @Volatile
        var isServiceRunning = false
    }
}
