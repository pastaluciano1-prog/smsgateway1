package expo.modules.smsgateway

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class SmsGatewayModule : Module() {
  private val counter = AtomicInteger(0)

  override fun definition() = ModuleDefinition {
    Name("SmsGateway")

    // Returns a list of active SIMs on the device.
    // Each item: { slot, subscriptionId, carrier, number }
    Function("getSimInfo") {
      val context = appContext.reactContext
        ?: return@Function emptyList<Map<String, Any?>>()

      val granted = ContextCompat.checkSelfPermission(
        context, Manifest.permission.READ_PHONE_STATE
      ) == PackageManager.PERMISSION_GRANTED
      if (!granted) return@Function emptyList<Map<String, Any?>>()

      val subManager = context.getSystemService(SubscriptionManager::class.java)
        ?: return@Function emptyList<Map<String, Any?>>()
      val subs = subManager.activeSubscriptionInfoList
        ?: return@Function emptyList<Map<String, Any?>>()

      subs.map { info ->
        mapOf(
          "slot" to info.simSlotIndex,
          "subscriptionId" to info.subscriptionId,
          "carrier" to (info.carrierName?.toString() ?: ""),
          "number" to (info.number ?: "")
        )
      }
    }

    // Sends an SMS on a specific SIM (by subscriptionId, or -1 for default) and
    // resolves ONLY after the platform reports the actual send result. This is
    // what surfaces real failures (no credit, no service, radio off) instead of
    // the old fire-and-forget behavior that always looked successful.
    AsyncFunction("sendSms") { to: String, body: String, subscriptionId: Int, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("no_context", "No Android context available", null)
        return@AsyncFunction
      }

      try {
        val smsManager = resolveSmsManager(context, subscriptionId)
        val parts = smsManager.divideMessage(body)
        val total = if (parts.isEmpty()) 1 else parts.size

        val id = counter.incrementAndGet()
        val action = "expo.modules.smsgateway.SMS_SENT_$id"
        val received = AtomicInteger(0)
        val settled = AtomicBoolean(false)
        val mainHandler = Handler(Looper.getMainLooper())

        // Declared up front so the receiver and timeout can both unregister it.
        val holder = arrayOfNulls<BroadcastReceiver>(1)

        fun finish(unregister: Boolean, ok: Boolean, reason: String?) {
          if (!settled.compareAndSet(false, true)) return
          if (unregister) {
            try { holder[0]?.let { context.unregisterReceiver(it) } } catch (_: Exception) {}
          }
          mainHandler.removeCallbacksAndMessages(null)
          if (ok) promise.resolve(true)
          else promise.reject("send_failed", reason ?: "send failed", null)
        }

        val receiver = object : BroadcastReceiver() {
          override fun onReceive(ctx: Context, intent: Intent) {
            val code = resultCode
            if (code != Activity.RESULT_OK) {
              finish(true, false, describeError(code))
              return
            }
            if (received.incrementAndGet() >= total) {
              finish(true, true, null)
            }
          }
        }
        holder[0] = receiver

        val filter = IntentFilter(action)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
          @Suppress("UnspecifiedRegisterReceiverFlag")
          context.registerReceiver(receiver, filter)
        }

        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        val sentIntents = ArrayList<PendingIntent>(total)
        for (i in 0 until total) {
          val pi = PendingIntent.getBroadcast(
            context,
            id * 100 + i,
            Intent(action).setPackage(context.packageName),
            flags
          )
          sentIntents.add(pi)
        }

        // Safety net: never leave the JS promise hanging (which would wedge the
        // poll loop). If the platform never reports back, fail after 60s.
        mainHandler.postDelayed({ finish(true, false, "timeout waiting for send result") }, 60_000)

        if (total > 1) {
          smsManager.sendMultipartTextMessage(to, null, parts, sentIntents, null)
        } else {
          smsManager.sendTextMessage(to, null, body, sentIntents[0], null)
        }
      } catch (e: Exception) {
        promise.reject("send_exception", e.message ?: "send failed", e)
      }
    }

    // Start/stop the foreground service that keeps polling alive with screen off.
    Function("startService") {
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(context, PollingForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      true
    }

    Function("stopService") {
      val context = appContext.reactContext ?: return@Function false
      context.stopService(Intent(context, PollingForegroundService::class.java))
      true
    }

    // Battery-optimization exemption (greatly improves background reliability).
    Function("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function false
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("requestIgnoreBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function false
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:" + context.packageName)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try { context.startActivity(intent) } catch (_: Exception) {}
      }
      true
    }
  }

  private fun resolveSmsManager(context: Context, subscriptionId: Int): SmsManager {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val base = context.getSystemService(SmsManager::class.java)
      if (subscriptionId >= 0) base.createForSubscriptionId(subscriptionId) else base
    } else {
      @Suppress("DEPRECATION")
      if (subscriptionId >= 0) SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
      else SmsManager.getDefault()
    }
  }

  private fun describeError(code: Int): String = when (code) {
    SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "generic failure"
    SmsManager.RESULT_ERROR_NO_SERVICE -> "no service"
    SmsManager.RESULT_ERROR_RADIO_OFF -> "radio off"
    SmsManager.RESULT_ERROR_NULL_PDU -> "null PDU"
    else -> "error code $code"
  }
}
