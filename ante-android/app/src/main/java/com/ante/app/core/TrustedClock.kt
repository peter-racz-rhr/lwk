package com.ante.app.core

/** Where the trusted clock last pinned wall time to the monotonic boot clock. */
data class ClockAnchor(
    val wallMs: Long = 0,
    val elapsedMs: Long = 0,
    val lastTrustedMs: Long = 0,
)

data class ClockReading(val nowMs: Long, val anchor: ClockAnchor)

/**
 * A clock the user can't wind. With automatic date & time on, the network-synced wall clock is
 * trusted. With it off, time is measured on the monotonic boot clock from the last anchor, so
 * moving the date forward (to get tomorrow's budget) or back (to stretch a session) does nothing.
 * After a reboot with manual time the downtime can't be measured, so the clock resumes from the
 * last trusted moment instead of jumping. Trusted time never goes backwards.
 */
object TrustedClock {
    fun tick(a: ClockAnchor, wallMs: Long, elapsedMs: Long, autoTime: Boolean): ClockReading {
        val firstRun = a.wallMs == 0L
        val monotonic = !firstRun && !autoTime && elapsedMs >= a.elapsedMs
        val raw = when {
            firstRun || autoTime -> wallMs
            monotonic -> a.wallMs + (elapsedMs - a.elapsedMs)
            else -> a.lastTrustedMs // rebooted with manual time
        }
        val now = maxOf(raw, a.lastTrustedMs)
        val anchor = if (monotonic) a.copy(lastTrustedMs = now) else ClockAnchor(now, elapsedMs, now)
        return ClockReading(now, anchor)
    }
}
