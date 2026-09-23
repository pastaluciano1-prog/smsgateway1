package expo.modules.smsgateway

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Foreground service that OWNS the poll loop natively, so the gateway keeps
 * sending/receiving even when the app UI is minimized or the screen is off.
 * It fetches GET /outgoing, sends each SMS, and reports POST /status — all in
 * native code, independent of the React Native JS/Activity lifecycle.
 */
class PollingForegroundService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  @Volatile private var running = false
  private var worker: Thread? = null

  private var host = ""
  private var apiKey = ""
  private var intervalMs = 5000L

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SmsGateway::PollWakeLock").apply {
      setReferenceCounted(false)
      acquire()
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    intent?.getStringExtra("host")?.let { prefs.edit().putString("host", it).apply() }
    intent?.getStringExtra("apiKey")?.let { prefs.edit().putString("apiKey", it).apply() }
    val iv = intent?.getLongExtra("interval", 0L) ?: 0L
    if (iv > 0) prefs.edit().putLong("interval", iv).apply()

    host = prefs.getString("host", "") ?: ""
    apiKey = prefs.getString("apiKey", "") ?: ""
    intervalMs = prefs.getLong("interval", 5000L)

    startForeground(NOTIFICATION_ID, buildNotification())
    startWorker()
    return START_STICKY
  }

  override fun onDestroy() {
    running = false
    worker?.interrupt()
    try { wakeLock?.let { if (it.isHeld) it.release() } } catch (_: Exception) {}
    wakeLock = null
    super.onDestroy()
  }

  private fun startWorker() {
    if (running) return
    running = true
    worker = Thread {
      while (running) {
        try { pollOnce() } catch (_: Exception) {}
        try { Thread.sleep(intervalMs) } catch (_: InterruptedException) { break }
      }
    }.also { it.start() }
  }

  private fun pollOnce() {
    if (host.isBlank() || apiKey.isBlank()) return
    val base = host.trimEnd('/')

    val body = httpGet("$base/outgoing") ?: return
    val arr = try { JSONArray(body) } catch (_: Exception) { return }

    for (i in 0 until arr.length()) {
      if (!running) break
      val m = arr.optJSONObject(i) ?: continue
      val id = m.optString("id")
      val to = m.optString("to")
      val text = m.optString("body")
      val sim = if (m.isNull("sim")) -1 else m.optInt("sim", -1)
      if (id.isBlank() || to.isBlank()) continue

      try {
        sendSmsBlocking(to, text, sim)
        httpPost("$base/status", JSONObject().put("id", id).put("status", "sent"))
        bump("sent")
      } catch (e: Exception) {
        httpPost(
          "$base/status",
          JSONObject().put("id", id).put("status", "failed").put("error", e.message ?: "error")
        )
        bump("failed")
      }
    }
  }

  // ---- SMS ----
  private fun sendSmsBlocking(to: String, body: String, subId: Int) {
    val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val base = getSystemService(SmsManager::class.java)
      if (subId >= 0) base.createForSubscriptionId(subId) else base
    } else {
      @Suppress("DEPRECATION")
      if (subId >= 0) SmsManager.getSmsManagerForSubscriptionId(subId) else SmsManager.getDefault()
    }

    val parts = smsManager.divideMessage(body)
    val total = if (parts.isEmpty()) 1 else parts.size
    val action = "expo.modules.smsgateway.SVC_SENT_" + System.nanoTime()
    val latch = CountDownLatch(total)
    val failure = arrayOfNulls<String>(1)

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(c: Context, i: Intent) {
        if (resultCode != Activity.RESULT_OK && failure[0] == null) {
          failure[0] = describeError(resultCode)
        }
        latch.countDown()
      }
    }
    val filter = IntentFilter(action)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(receiver, filter)
    }

    val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    val base = (System.nanoTime() and 0xffffff).toInt()
    val sentIntents = ArrayList<PendingIntent>(total)
    for (i in 0 until total) {
      sentIntents.add(
        PendingIntent.getBroadcast(this, base + i, Intent(action).setPackage(packageName), flags)
      )
    }

    if (total > 1) smsManager.sendMultipartTextMessage(to, null, parts, sentIntents, null)
    else smsManager.sendTextMessage(to, null, body, sentIntents[0], null)

    latch.await(60, TimeUnit.SECONDS)
    try { unregisterReceiver(receiver) } catch (_: Exception) {}
    failure[0]?.let { throw Exception(it) }
  }

  private fun describeError(code: Int): String = when (code) {
    SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "generic failure"
    SmsManager.RESULT_ERROR_NO_SERVICE -> "no service"
    SmsManager.RESULT_ERROR_RADIO_OFF -> "radio off"
    SmsManager.RESULT_ERROR_NULL_PDU -> "null PDU"
    else -> "error code $code"
  }

  // ---- HTTP ----
  private fun httpGet(urlStr: String): String? {
    return try {
      val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        setRequestProperty("Authorization", "Bearer $apiKey")
        connectTimeout = 15000
        readTimeout = 15000
      }
      val code = conn.responseCode
      if (code in 200..299) conn.inputStream.bufferedReader().use { it.readText() } else null
    } catch (_: Exception) { null }
  }

  private fun httpPost(urlStr: String, json: JSONObject) {
    try {
      val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("Authorization", "Bearer $apiKey")
        setRequestProperty("Content-Type", "application/json")
        doOutput = true
        connectTimeout = 15000
        readTimeout = 15000
      }
      OutputStreamWriter(conn.outputStream).use { it.write(json.toString()) }
      conn.responseCode // trigger the request
      conn.inputStream.close()
    } catch (_: Exception) {}
  }

  private fun bump(name: String) {
    val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putInt("count_$name", prefs.getInt("count_$name", 0) + 1).apply()
  }

  private fun buildNotification(): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "SMS Gateway", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Keeps the gateway connected so it can send and receive SMS."
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("SMS Gateway is running")
      .setContentText("Connected — sending and receiving messages.")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  companion object {
    const val PREFS = "smsgateway_prefs"
    private const val CHANNEL_ID = "sms_gateway_service"
    private const val NOTIFICATION_ID = 4242
    private val idCounter = AtomicInteger(0)
  }
}
