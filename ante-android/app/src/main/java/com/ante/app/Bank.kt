package com.ante.app

import android.content.Context
import android.content.SharedPreferences
import android.os.SystemClock
import android.provider.Settings
import com.ante.app.core.Codec
import com.ante.app.core.TimeBank
import com.ante.app.core.TrustedClock
import java.time.ZoneId

/**
 * Process-wide owner of the [TimeBank]. The watcher service and both screens run in the same
 * process and go through here, so every read and write is serialized and persisted.
 * All times come from [TrustedClock], so changing the phone's date can't refill or stretch time.
 */
object Bank {
    private const val PREFS = "ante"
    private const val KEY = "bank"

    private var app: Context? = null
    private var prefs: SharedPreferences? = null
    private var bank: TimeBank? = null

    @Synchronized
    fun init(context: Context) {
        if (bank != null) return
        val c = context.applicationContext
        app = c
        val p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs = p
        bank = TimeBank(Codec.decode(p.getString(KEY, null)))
    }

    /** Runs [block] with the trusted time after a day rollover check, then saves. */
    @Synchronized
    fun <T> editAt(block: (TimeBank, Long) -> T): T {
        val b = checkNotNull(bank) { "Bank.init() was not called" }
        val now = tick(b)
        b.rolloverIfDue(now, ZoneId.systemDefault())
        val result = block(b, now)
        save(b)
        return result
    }

    fun <T> edit(block: (TimeBank) -> T): T = editAt { b, _ -> block(b) }

    /** Read-only access. Still runs the rollover so a stale day never shows, but only saves when it rolled over. */
    @Synchronized
    fun <T> read(block: (TimeBank) -> T): T {
        val b = checkNotNull(bank) { "Bank.init() was not called" }
        if (b.rolloverIfDue(tick(b), ZoneId.systemDefault())) save(b)
        return block(b)
    }

    @Synchronized
    fun now(): Long = tick(checkNotNull(bank) { "Bank.init() was not called" })

    /** True when the phone sets its clock from the network, so the wall clock can be trusted. */
    fun autoTimeOn(): Boolean {
        val c = app ?: return true
        return try {
            Settings.Global.getInt(c.contentResolver, Settings.Global.AUTO_TIME, 1) == 1
        } catch (e: Exception) {
            true
        }
    }

    /** Increments on every boot, so a reboot is noticed even when the new uptime is longer. */
    private fun bootCount(): Int {
        val c = app ?: return -1
        return try {
            Settings.Global.getInt(c.contentResolver, Settings.Global.BOOT_COUNT, -1)
        } catch (e: Exception) {
            -1
        }
    }

    private fun tick(b: TimeBank): Long {
        val r = TrustedClock.tick(b.state.clock, System.currentTimeMillis(), SystemClock.elapsedRealtime(), bootCount(), autoTimeOn())
        b.setClock(r.anchor)
        return r.nowMs
    }

    private fun save(b: TimeBank) {
        prefs?.edit()?.putString(KEY, Codec.encode(b.state))?.apply()
    }
}
