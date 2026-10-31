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
import com.ante.app.core.Watcher

/**
 * Watches which app is in front and covers limited apps. Only window-state changes are requested,
 * and no window content is read (see res/xml/accessibility_config.xml). The rules live in
 * [Watcher], which is stress tested on the JVM.
 */
class AppWatcherService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val expiryCheck = Runnable { onTick() }
    private lateinit var watcher: Watcher
    private var homePackages: Set<String> = emptySet()

    /** Handler delays pause in deep sleep, so re-check the session whenever the screen comes back. */
    private val wakeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = onTick()
    }
    private var receiverRegistered = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        Bank.init(this)
        watcher = Watcher(packageName, passable = PASSABLE, locked = LOCKED)
        instance = this
        homePackages = findHomePackages()
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
            addAction(Intent.ACTION_TIME_CHANGED)
            addAction(Intent.ACTION_TIMEZONE_CHANGED)
        }
        register(filter)
        scheduleExpiry()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || !::watcher.isInitialized) return
        lastEventAt = System.currentTimeMillis()
        val pkg = event.packageName?.toString()
        if (pkg == null) {
            onTick()
            return
        }
        val cls = event.className?.toString()
        // Settings' Internet and Volume panels pop up over other apps; never lock them.
        val panel = pkg == "com.android.settings" && cls != null && cls.contains("Panel")
        val ignored = pkg in IGNORED || pkg == currentKeyboard() || panel
        val isActivity = !ignored && isActivityWindow(pkg, cls)
        val action = Bank.editAt { bank, now -> watcher.onWindow(bank, pkg, isActivity, ignored, pkg in homePackages, now) }
        act(action)
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

    /** Wakes up when the current session's time, or a strict-mode Settings pass, runs out. */
    fun scheduleExpiry() {
        handler.post {
            handler.removeCallbacks(expiryCheck)
            val now = Bank.now()
            val (session, passUntil) = Bank.read { it.state.session to (if (it.state.strict) it.state.settingsPassUntilMs else 0L) }
            val next = listOfNotNull(session?.endsAtMs, passUntil.takeIf { it > now }).minOrNull() ?: return@post
            handler.postDelayed(expiryCheck, (next - now).coerceAtLeast(0) + 250)
        }
    }

    private fun onTick() {
        if (!::watcher.isInitialized) return
        act(Bank.editAt { bank, now -> watcher.onTimer(bank, now) })
        scheduleExpiry()
    }

    /**
     * Covers the app. Going home first also ends split-screen and keeps the blocked app out of
     * the visible task, so the block screen can't sit beside it.
     */
    private fun act(action: Watcher.Action) {
        if (action !is Watcher.Action.Block) return
        performGlobalAction(GLOBAL_ACTION_HOME)
        handler.postDelayed({ BlockActivity.show(this, action.pkg, action.note) }, BLOCK_DELAY_MS)
    }

    private fun register(filter: IntentFilter) {
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(wakeReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else registerReceiver(wakeReceiver, filter)
        receiverRegistered = true
    }

    private fun shutdown() {
        handler.removeCallbacksAndMessages(null)
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
        private const val BLOCK_DELAY_MS = 120L
        private val IGNORED = setOf("com.android.systemui", "android")

        /** Strict mode: open for two minutes after a 30 s wait. Places where blocking could be switched off. */
        private val PASSABLE = setOf(
            "com.android.settings",
            "com.android.vending", // Play Store can uninstall apps
            "com.samsung.android.lool", // Samsung Device care
            "com.miui.securitycenter",
        )

        /** Strict mode: the uninstaller stays covered until strict mode is turned off. */
        private val LOCKED = setOf(
            "com.google.android.packageinstaller",
            "com.android.packageinstaller",
            "com.samsung.android.packageinstaller",
        )

        @Volatile
        var instance: AppWatcherService? = null
            private set

        /** Wall time of the last window event, shown in Ante as proof the watcher is alive. */
        @Volatile
        var lastEventAt: Long = 0
            private set
    }
}
