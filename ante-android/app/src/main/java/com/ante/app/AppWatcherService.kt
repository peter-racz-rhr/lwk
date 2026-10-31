package com.ante.app

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import com.ante.app.core.Decision

/**
 * Watches which app is in front. Only window-state changes are requested, and no window content
 * is read (see res/xml/accessibility_config.xml).
 */
class AppWatcherService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val expiryCheck = Runnable { checkExpiry() }
    private var foreground: String? = null
    private var homePackages: Set<String> = emptySet()

    /** Handler delays pause in deep sleep, so re-check the session whenever the screen comes back. */
    private val wakeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = checkExpiry()
    }
    private var receiverRegistered = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        Bank.init(this)
        instance = this
        homePackages = findHomePackages()
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
            addAction(Intent.ACTION_TIME_CHANGED)
            addAction(Intent.ACTION_TIMEZONE_CHANGED)
        }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(wakeReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else registerReceiver(wakeReceiver, filter)
        receiverRegistered = true
        scheduleExpiry()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        // Any window change is a chance to catch a session that ran out while the timer slept.
        if (Bank.read { it.state.session } != null) checkExpiry()
        val pkg = event.packageName?.toString() ?: return
        if (pkg in IGNORED || pkg == currentKeyboard()) return
        if (!isActivityWindow(pkg, event.className?.toString())) return
        if (pkg == foreground && pkg != packageName) return // same app, new screen inside it
        foreground = pkg

        val isHome = pkg in homePackages
        val decision = Bank.edit { it.onForeground(pkg, System.currentTimeMillis(), isHome) }
        if (decision == Decision.BLOCK && pkg != packageName) BlockActivity.show(this, pkg, null)
        scheduleExpiry()
    }

    override fun onInterrupt() = Unit

    override fun onUnbind(intent: Intent?): Boolean {
        shutdown()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        shutdown()
        super.onDestroy()
    }

    private fun shutdown() {
        handler.removeCallbacks(expiryCheck)
        if (receiverRegistered) {
            try { unregisterReceiver(wakeReceiver) } catch (e: IllegalArgumentException) { /* already gone */ }
            receiverRegistered = false
        }
        if (instance === this) instance = null
    }

    private fun findHomePackages(): Set<String> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        @Suppress("DEPRECATION")
        return packageManager.queryIntentActivities(intent, 0).mapNotNull { it.activityInfo?.packageName }.toSet()
    }

    /** Wakes up when the current session's time is up. */
    fun scheduleExpiry() {
        handler.post {
            handler.removeCallbacks(expiryCheck)
            val session = Bank.read { it.state.session } ?: return@post
            val delay = (session.endsAtMs - System.currentTimeMillis()).coerceAtLeast(0) + 250
            handler.postDelayed(expiryCheck, delay)
        }
    }

    private fun checkExpiry() {
        val expired = Bank.edit { it.expireSession(System.currentTimeMillis()) }
        if (expired != null && expired == foreground) {
            BlockActivity.show(this, expired, "Session over.")
        }
        scheduleExpiry()
    }

    /** Dialogs, toasts and keyboards also fire window events; only real activities count. */
    private fun isActivityWindow(pkg: String, className: String?): Boolean {
        if (className == null) return false
        return try {
            packageManager.getActivityInfo(ComponentName(pkg, className), 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            // Package not visible to us or the class is not an activity. Fall back to a name check.
            !className.startsWith("android.widget.") && !className.startsWith("android.view.") &&
                !className.startsWith("android.app.Dialog") && !className.startsWith("android.inputmethodservice.")
        }
    }

    private fun currentKeyboard(): String? =
        Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
            ?.substringBefore('/')

    companion object {
        @Volatile
        var instance: AppWatcherService? = null
            private set

        private val IGNORED = setOf("com.android.systemui", "android")
    }
}
