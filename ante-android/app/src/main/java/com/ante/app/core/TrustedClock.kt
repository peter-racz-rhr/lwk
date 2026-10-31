package com.ante.app.core

import kotlin.math.abs

/** Where the trusted clock last pinned wall time to the monotonic boot clock. */
data class ClockAnchor(
    val wallMs: Long = 0,
    val elapsedMs: Long = 0,
    val lastTrustedMs: Long = 0,
    /** Settings.Global.BOOT_COUNT at the anchor, or -1 when unknown. */
    val bootCount: Int = -1,
)

data class ClockReading(val nowMs: Long, val anchor: ClockAnchor)

/**
 * A clock the user can't wind. Time is measured on the monotonic boot clock from the last anchor.
 * The wall clock is only followed when automatic date & time is on and it agrees with the boot
 * clock to within [TOLERANCE_MS], so a date forged while offline (then "automatic" switched back
 * on) is ignored, and a later network correction can't freeze the clock. After a reboot the
 * boot clock restarts: with automatic time the wall clock is trusted, with manual time the clock
 * resumes from the last trusted moment instead of jumping. Trusted time never goes backwards.
 */
object TrustedClock {
    const val TOLERANCE_MS = 2L * 60 * 1000

    fun tick(a: ClockAnchor, wallMs: Long, elapsedMs: Long, bootCount: Int = -1, autoTime: Boolean): ClockReading {
        val firstRun = a.wallMs == 0L
        val rebooted = !firstRun && (elapsedMs < a.elapsedMs || (bootCount >= 0 && a.bootCount >= 0 && bootCount != a.bootCount))
        val byBootClock = a.wallMs + (elapsedMs - a.elapsedMs)
        val raw = when {
            firstRun -> wallMs
            rebooted -> if (autoTime) wallMs else a.lastTrustedMs
            autoTime && abs(wallMs - byBootClock) <= TOLERANCE_MS -> wallMs
            else -> byBootClock
        }
        val now = maxOf(raw, a.lastTrustedMs)
        return ClockReading(now, ClockAnchor(now, elapsedMs, now, bootCount))
    }
}
