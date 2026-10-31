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
            parked = emptyMap(),
        )
        openStakes.clear()
        return true
    }

    fun limitFor(pkg: String): Limit? = state.limits.firstOrNull { it.pkg == pkg }

    /**
     * Adds or changes a limit. Lowering a limit takes effect now; raising one only adds time from
     * tomorrow, so a limit can't be pushed up to get around today's block. A limit removed earlier
     * today comes back with the time it had left.
     */
    fun setLimit(pkg: String, label: String, limitSec: Int): Limit {
        val clamped = limitSec.coerceIn(MIN_LIMIT_SEC, MAX_LIMIT_SEC)
        val existing = limitFor(pkg)
        val updated = if (existing == null) {
            val left = state.parked[pkg]?.coerceAtMost(clamped) ?: clamped
            Limit(pkg, label, clamped, left)
        } else {
            val cut = (existing.limitSec - clamped).coerceAtLeast(0)
            val left = (existing.leftSec - cut).coerceAtLeast(0)
            existing.copy(label = label, limitSec = clamped, leftSec = left)
        }
        state = state.copy(
            limits = if (existing == null) state.limits + updated else state.limits.map { if (it.pkg == pkg) updated else it },
            parked = state.parked - pkg,
        )
        return updated
    }

    fun removeLimit(pkg: String) {
        val existing = limitFor(pkg) ?: return
        val session = state.session
        // Unused session time counts as left when parking the limit.
        val reserved = if (session != null && session.pkg == pkg) session.grantedSec else 0
        state = state.copy(
            limits = state.limits.filterNot { it.pkg == pkg },
            session = session?.takeUnless { it.pkg == pkg },
            parked = state.parked + (pkg to (existing.leftSec + reserved).coerceAtMost(existing.limitSec)),
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

    /**
     * Called whenever a different app comes to the front. A session ends early (with a refund) only
     * when the user goes home or opens another limited app; pickers, permission dialogs and browser
     * tabs opened from inside the app leave it running.
     */
    fun onForeground(pkg: String, nowMs: Long, isHome: Boolean = false): Decision {
        val session = state.session
        val limited = limitFor(pkg) != null
        if (session != null) {
            if (session.pkg == pkg) {
                if (nowMs < session.endsAtMs) return Decision.ALLOW
                expireSession(nowMs)
            } else if (isHome || limited) {
                endSession(nowMs)
            }
        }
        return if (limited) Decision.BLOCK else Decision.ALLOW
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
     * A settle without a matching open stake pays nothing and returns [INVALID_SETTLE]; the return is capped.
     */
    fun settleBet(pkg: String, game: String, stakeSec: Int, returnSec: Int, nowMs: Long): Int {
        val open = openStakes[pkg] ?: 0
        if (stakeSec <= 0 || stakeSec > open || limitFor(pkg) == null) return INVALID_SETTLE
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

        /** Returned by [settleBet] when there is no matching open stake. */
        const val INVALID_SETTLE = Int.MIN_VALUE
    }
}
