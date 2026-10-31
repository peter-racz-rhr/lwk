package com.ante.app

import android.content.Context
import android.content.SharedPreferences
import com.ante.app.core.Codec
import com.ante.app.core.TimeBank
import java.time.LocalDate

/**
 * Process-wide owner of the [TimeBank]. The watcher service and both screens run in the same
 * process and go through here, so every read and write is serialized and persisted.
 */
object Bank {
    private const val PREFS = "ante"
    private const val KEY = "bank"

    private var prefs: SharedPreferences? = null
    private var bank: TimeBank? = null

    @Synchronized
    fun init(context: Context) {
        if (bank != null) return
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs = p
        bank = TimeBank(Codec.decode(p.getString(KEY, null)))
    }

    /** Runs [block] against the bank after a day rollover check, then saves. */
    @Synchronized
    fun <T> edit(block: (TimeBank) -> T): T {
        val b = checkNotNull(bank) { "Bank.init() was not called" }
        b.rollover(today())
        val result = block(b)
        prefs?.edit()?.putString(KEY, Codec.encode(b.state))?.apply()
        return result
    }

    /** Read-only access. Still runs the rollover so a stale day never shows. */
    fun <T> read(block: (TimeBank) -> T): T = edit(block)

    private fun today(): String = LocalDate.now().toString()
}
