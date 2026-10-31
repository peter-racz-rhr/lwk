package com.ante.app.core

/**
 * All of Ante's time accounting. Pure Kotlin so it can be unit tested on the JVM.
 * Not thread safe: callers (see [com.ante.app.Bank]) synchronize access.
 */
class TimeBank(initial: BankState = BankState()) {
    var state: BankState = initial
        private set

    /** Stakes placed but not settled yet, per app. Kept in memory only: an unfinished hand is lost. */
    private val openStakes = mutableMapOf<String, Int>()

    /** Resets every budget when the calendar day changes. Returns true when a reset happened. */
    fun rollover(today: String): Boolean {
        if (state.day == today) return false
        state = state.copy(
            day = today,
            limits = state.limits.map { it.copy(leftSec = it.limitSec) },
            ledger = emptyList(),
            session = null,
        )
        openStakes.clear()
        return true
    }

    fun limitFor(pkg: String): Limit? = state.limits.firstOrNull { it.pkg == pkg }

    fun setLimit(pkg: String, label: String, limitSec: Int): Limit {
        val clamped = limitSec.coerceIn(MIN_LIMIT_SEC, MAX_LIMIT_SEC)
        val existing = limitFor(pkg)
        val updated = if (existing == null) {
            Limit(pkg, label, clamped, clamped)
        } else {
            val left = (existing.leftSec.toLong() + clamped - existing.limitSec).coerceIn(0, Int.MAX_VALUE.toLong()).toInt()
            existing.copy(label = label, limitSec = clamped, leftSec = left)
        }
        state = state.copy(limits = if (existing == null) state.limits + updated else state.limits.map { if (it.pkg == pkg) updated else it })
        return updated
    }

    fun removeLimit(pkg: String) {
        state = state.copy(
            limits = state.limits.filterNot { it.pkg == pkg },
            session = state.session?.takeUnless { it.pkg == pkg },
        )
        openStakes.remove(pkg)
    }

    fun isSessionActive(pkg: String, nowMs: Long): Boolean {
        val s = state.session ?: return false
        return s.pkg == pkg && nowMs < s.endsAtMs
    }

    /** Reserves [seconds] from the app's budget. Ends any other session first. */
    fun startSession(pkg: String, seconds: Int, nowMs: Long): Boolean {
        val limit = limitFor(pkg) ?: return false
        if (seconds <= 0 || seconds > limit.leftSec) return false
        endSession(nowMs)
        adjustLeft(pkg, -seconds)
        state = state.copy(session = Session(pkg, nowMs, seconds))
        return true
    }

    /** Ends the current session and refunds the unused seconds. Returns the refund. */
    fun endSession(nowMs: Long): Int {
        val s = state.session ?: return 0
        val usedSec = ((nowMs - s.startedAtMs).coerceAtLeast(0) / 1000L).toInt()
        val refund = (s.grantedSec - usedSec).coerceIn(0, s.grantedSec)
        state = state.copy(session = null)
        if (refund > 0) adjustLeft(s.pkg, refund)
        return refund
    }

    /** Clears a session whose time has run out. Returns its package, or null when nothing expired. */
    fun expireSession(nowMs: Long): String? {
        val s = state.session ?: return null
        if (nowMs < s.endsAtMs) return null
        state = state.copy(session = null)
        return s.pkg
    }

    /** Called whenever a different app comes to the front. */
    fun onForeground(pkg: String, nowMs: Long): Decision {
        val session = state.session
        if (session != null) {
            if (session.pkg == pkg) {
                if (nowMs < session.endsAtMs) return Decision.ALLOW
                expireSession(nowMs)
            } else {
                endSession(nowMs)
            }
        }
        return if (limitFor(pkg) != null) Decision.BLOCK else Decision.ALLOW
    }

    /** Takes a stake from the app's budget. */
    fun placeBet(pkg: String, stakeSec: Int): Boolean {
        val limit = limitFor(pkg) ?: return false
        if (stakeSec <= 0 || stakeSec > limit.leftSec) return false
        adjustLeft(pkg, -stakeSec)
        openStakes[pkg] = (openStakes[pkg] ?: 0) + stakeSec
        return true
    }

    /**
     * Pays [returnSec] back for a stake placed earlier with [placeBet]. Returns the net change.
     * A settle without a matching open stake pays nothing, and the return is capped.
     */
    fun settleBet(pkg: String, game: String, stakeSec: Int, returnSec: Int, nowMs: Long): Int {
        val open = openStakes[pkg] ?: 0
        if (stakeSec <= 0 || stakeSec > open || limitFor(pkg) == null) return 0
        openStakes[pkg] = open - stakeSec
        val ret = returnSec.toLong().coerceIn(0, stakeSec.toLong() * MAX_RETURN_MULTIPLE).toInt()
        if (ret > 0) adjustLeft(pkg, ret)
        val net = ret - stakeSec
        val bet = Bet(game.take(32), pkg, net, nowMs)
        state = state.copy(ledger = (listOf(bet) + state.ledger).take(LEDGER_MAX))
        return net
    }

    private fun adjustLeft(pkg: String, delta: Int) {
        state = state.copy(limits = state.limits.map {
            if (it.pkg == pkg) it.copy(leftSec = (it.leftSec.toLong() + delta).coerceIn(0, Int.MAX_VALUE.toLong()).toInt()) else it
        })
    }

    companion object {
        const val MIN_LIMIT_SEC = 60
        const val MAX_LIMIT_SEC = 24 * 60 * 60
        const val MAX_RETURN_MULTIPLE = 100
        const val LEDGER_MAX = 50
    }
}
