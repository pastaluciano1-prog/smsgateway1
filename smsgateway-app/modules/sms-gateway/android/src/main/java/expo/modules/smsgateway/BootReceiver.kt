package expo.modules.smsgateway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Restarts the polling service after a device reboot, so the gateway comes back
 * on its own. Only starts if the phone was previously connected (config saved).
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    val prefs = context.getSharedPreferences(
      PollingForegroundService.PREFS, Context.MODE_PRIVATE
    )
    val host = prefs.getString("host", "") ?: ""
    val apiKey = prefs.getString("apiKey", "") ?: ""
    if (host.isBlank() || apiKey.isBlank()) return

    val svc = Intent(context, PollingForegroundService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(svc)
    } else {
      context.startService(svc)
    }
  }
}
