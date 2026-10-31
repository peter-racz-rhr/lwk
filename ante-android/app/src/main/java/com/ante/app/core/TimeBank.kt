package com.ante.app.core

import java.time.Instant
import java.time.ZoneId

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
    fun rollover(today: String, nowMs: Long? = null): Boolean {
        if (state.day == today) return false
        // A session still running at midnight counts towards the day it ran in.
        val running = state.session
        if (running != null && nowMs != null) {
            val used = ((nowMs - running.startedAtMs).coerceAtLeast(0) / 1000L).toInt().coerceAtMost(running.grantedSec)
            state = state.copy(usedTodaySec = state.usedTodaySec + used)
        }
        val archived = if (state.day.isEmpty()) state.history else {
            (listOf(DaySummary(state.day, state.usedTodaySec, state.wonTodaySec, state.lostTodaySec)) + state.history).take(HISTORY_MAX)
        }
        state = state.copy(
            history = archived,
            usedTodaySec = 0,
            wonTodaySec = 0,
            lostTodaySec = 0,
            day = today,
            limits = state.limits.map { it.copy(leftSec = it.limitSec) },
            ledger = emptyList(),
            session = null,
            parked = emptyMap(),
        )
        openStakes.clear()
        return true
    }

    /**
     * Resets the day when trusted time has crossed local midnight. A reset also needs at least
     * 23 hours since the current day began (the shortest day, with daylight saving), so hopping
     * time zones can't bring tomorrow's budget early.
     */
    fun rolloverIfDue(nowMs: Long, zone: ZoneId): Boolean {
        val date = Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()
        val today = date.toString()
        if (today == state.day) {
            // Saves from before the 23 h gate existed: give today its start so the gate applies now.
            if (state.dayStartMs == 0L) state = state.copy(dayStartMs = date.atStartOfDay(zone).toInstant().toEpochMilli())
            return false
        }
        if (state.dayStartMs != 0L && nowMs < state.dayStartMs + MIN_DAY_MS) return false
        rollover(today, nowMs)
        state = state.copy(dayStartMs = date.atStartOfDay(zone).toInstant().toEpochMilli())
        return true
    }

    fun setStrict(on: Boolean) {
        state = state.copy(strict = on, settingsPassUntilMs = if (on) state.settingsPassUntilMs else 0)
    }

    /** Opens Settings for a short while in strict mode, after the user waited it out. */
    fun grantSettingsPass(nowMs: Long) {
        state = state.copy(settingsPassUntilMs = nowMs + SETTINGS_PASS_MS)
    }

    fun isGuardActive(nowMs: Long): Boolean = state.strict && nowMs >= state.settingsPassUntilMs

    fun setClock(anchor: ClockAnchor) {
        if (anchor != state.clock) state = state.copy(clock = anchor)
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

    fun removeLimit(pkg: String, nowMs: Long? = null) {
        val existing = limitFor(pkg) ?: return
        val session = state.session
        if (session != null && session.pkg == pkg && nowMs != null) {
            val used = ((nowMs - session.startedAtMs).coerceAtLeast(0) / 1000L).toInt().coerceAtMost(session.grantedSec)
            state = state.copy(usedTodaySec = state.usedTodaySec + used)
        }
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
        state = state.copy(session = null, usedTodaySec = state.usedTodaySec + (s.grantedSec - refund))
        if (refund > 0) adjustLeft(s.pkg, refund)
        return refund
    }

    /** Clears a session whose time has run out. Returns its package, or null when nothing expired. */
    fun expireSession(nowMs: Long): String? {
        val s = state.session ?: return null
        if (nowMs < s.endsAtMs) return null
        state = state.copy(session = null, usedTodaySec = state.usedTodaySec + s.grantedSec)
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
        state = state.copy(
            ledger = (listOf(bet) + state.ledger).take(LEDGER_MAX),
            wonTodaySec = state.wonTodaySec + net.coerceAtLeast(0),
            lostTodaySec = state.lostTodaySec + (-net).coerceAtLeast(0),
        )
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
        const val HISTORY_MAX = 186
        const val MIN_DAY_MS = 23L * 60 * 60 * 1000
        const val SETTINGS_PASS_MS = 2L * 60 * 1000

        /** Returned by [settleBet] when there is no matching open stake. */
        const val INVALID_SETTLE = Int.MIN_VALUE
    }
}
