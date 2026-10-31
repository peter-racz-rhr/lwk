package com.ante.app

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.ante.app.core.Codec
import org.json.JSONObject

/**
 * The JavaScript interface exposed to the bundled web UI as `window.AnteNative`.
 * Every argument is validated here: the web layer is never trusted with the time budget.
 */
class AnteBridge(
    private val activity: Activity,
    private val webView: WebView,
    private val mode: String,
    private val blockedPkg: () -> String?,
    private val blockNote: () -> String?,
) {
    private val ctx get() = activity.applicationContext

    @JavascriptInterface
    fun state(): String {
        val json = Bank.read { Codec.toJson(it.state) }
        json.put("now", Bank.now())
        json.put("accessibility", isWatcherEnabled())
        // Health checks shown on Today: is the watcher really running, can the clock be trusted,
        // and is Android allowed to kill Ante to save battery.
        json.put("watching", AppWatcherService.instance != null)
        json.put("autoTime", Bank.autoTimeOn())
        json.put("batteryOk", isIgnoringBatteryOptimizations())
        json.put("lastEventAt", AppWatcherService.lastEventAt)
        return json.toString()
    }

    @JavascriptInterface
    fun context(): String {
        val pkg = blockedPkg()
        val o = JSONObject().put("mode", mode).put("platform", "android")
        if (pkg != null) {
            o.put("pkg", pkg)
            o.put("label", AppCatalog.labelFor(ctx, pkg))
            o.put("icon", AppCatalog.iconFor(ctx, pkg))
        }
        blockNote()?.let { o.put("note", it) }
        return o.toString()
    }

    /** Installed apps without icons (fast); the page fetches icons one by one with [icon]. */
    @JavascriptInterface
    fun apps(): String = AppCatalog.launchableApps(ctx).toString()

    @JavascriptInterface
    fun icon(pkg: String): String = if (validPkg(pkg)) AppCatalog.iconFor(ctx, pkg) else ""

    @JavascriptInterface
    fun setLimit(pkg: String, label: String, limitSec: Int): Boolean {
        if (!validPkg(pkg) || pkg == ctx.packageName) return false
        Bank.edit { it.setLimit(pkg, label.take(60).ifBlank { pkg }, limitSec) }
        return true
    }

    @JavascriptInterface
    fun removeLimit(pkg: String): Boolean {
        if (!validPkg(pkg)) return false
        Bank.edit { it.removeLimit(pkg) }
        return true
    }

    @JavascriptInterface
    fun bet(pkg: String, stakeSec: Int): Boolean =
        validPkg(pkg) && Bank.edit { it.placeBet(pkg, stakeSec) }

    @JavascriptInterface
    fun settle(pkg: String, game: String, stakeSec: Int, returnSec: Int): Int {
        if (!validPkg(pkg)) return 0
        return Bank.editAt { b, now -> b.settleBet(pkg, game, stakeSec, returnSec, now) }
    }

    /** Reserves time and opens the app. */
    @JavascriptInterface
    fun open(pkg: String, seconds: Int): Boolean {
        if (!validPkg(pkg)) return false
        val launch = ctx.packageManager.getLaunchIntentForPackage(pkg) ?: return false
        val ok = Bank.editAt { b, now -> b.startSession(pkg, seconds, now) }
        if (!ok) return false
        AppWatcherService.instance?.scheduleExpiry()
        activity.runOnUiThread {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                activity.startActivity(launch)
                if (activity is BlockActivity) activity.finish()
            } catch (e: Exception) {
                // App vanished between the check and the launch: give the reserved time back.
                Bank.editAt { b, now -> b.endSession(now) }
                webView.evaluateJavascript("window.anteRefresh && window.anteRefresh()", null)
            }
        }
        return true
    }

    /** Leaves the block screen for the home screen. */
    @JavascriptInterface
    fun closeBlock() {
        activity.runOnUiThread {
            val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(home)
            if (activity is BlockActivity) activity.finish()
        }
    }

    @JavascriptInterface
    fun openAnte() {
        activity.runOnUiThread {
            activity.startActivity(Intent(activity, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            if (activity is BlockActivity) activity.finish()
        }
    }

    /* ---- Strict mode. Leaving it, or opening Settings while it is on, needs a 30 s wait that
       the native side times, so the page can't skip it. ---- */

    @JavascriptInterface
    fun startWait() { waitStartedAt = Bank.now() }

    @JavascriptInterface
    fun waitLeftMs(): Long = (waitStartedAt + WAIT_MS - Bank.now()).coerceAtLeast(0)

    private fun waitDone(): Boolean {
        val since = Bank.now() - waitStartedAt
        return waitStartedAt > 0 && since in WAIT_MS..WAIT_VALID_MS
    }

    @JavascriptInterface
    fun setStrict(on: Boolean): Boolean {
        if (!on && Bank.read { it.state.strict } && !waitDone()) return false
        Bank.edit { it.setStrict(on) }
        waitStartedAt = 0
        return true
    }

    /** From a strict-mode block screen: open Settings for two minutes after the wait. */
    @JavascriptInterface
    fun openGuarded(pkg: String): Boolean {
        if (!validPkg(pkg) || !waitDone()) return false
        Bank.editAt { b, now -> b.grantSettingsPass(now) }
        waitStartedAt = 0
        val launch = ctx.packageManager.getLaunchIntentForPackage(pkg)
        activity.runOnUiThread {
            if (launch != null) activity.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            if (activity is BlockActivity) activity.finish()
        }
        return true
    }

    /** Settings shortcuts from Ante. In strict mode they need the wait too, then open a pass. */
    private fun openSettings(intent: Intent): Boolean {
        if (Bank.read { it.state.strict }) {
            if (!waitDone()) return false
            Bank.editAt { b, now -> b.grantSettingsPass(now) }
            waitStartedAt = 0
        }
        activity.runOnUiThread {
            try { activity.startActivity(intent) } catch (e: Exception) { activity.startActivity(Intent(Settings.ACTION_SETTINGS)) }
        }
        return true
    }

    @JavascriptInterface
    fun openAccessibilitySettings(): Boolean = openSettings(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))

    /** App info page, where Android 13+ hides "Allow restricted settings" for sideloaded apps. */
    @JavascriptInterface
    fun openAppInfo(): Boolean =
        openSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null)))

    /** Asks Android to stop putting Ante to sleep, which on some phones also stops the watcher. */
    @JavascriptInterface
    fun openBatterySettings(): Boolean =
        openSettings(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.packageName)))

    @JavascriptInterface
    fun openDateSettings(): Boolean = openSettings(Intent(Settings.ACTION_DATE_SETTINGS))

    @JavascriptInterface
    fun haptic(kind: String) {
        val constant = when (kind) {
            "win" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
            "loss" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
            "tick" -> HapticFeedbackConstants.CLOCK_TICK
            else -> HapticFeedbackConstants.KEYBOARD_TAP
        }
        webView.post { webView.performHapticFeedback(constant) }
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        val pm = ctx.getSystemService(android.content.Context.POWER_SERVICE) as? android.os.PowerManager ?: return true
        return pm.isIgnoringBatteryOptimizations(ctx.packageName)
    }

    private fun isWatcherEnabled(): Boolean {
        val enabled = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        val me = ComponentName(ctx, AppWatcherService::class.java)
        return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
    }

    private fun validPkg(pkg: String?): Boolean = isValidPackage(pkg)

    companion object {
        private const val WAIT_MS = 30_000L
        private const val WAIT_VALID_MS = 10 * 60_000L

        /** Shared by every page, so the wait can't be restarted from a second screen. */
        @Volatile
        private var waitStartedAt = 0L

        private val PKG = Regex("^[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)*$")

        fun isValidPackage(pkg: String?): Boolean = pkg != null && pkg.length in 1..255 && PKG.matches(pkg)
    }
}
