package com.ante.app.core

/** One app's daily budget. All times are in seconds. */
data class Limit(
    val pkg: String,
    val label: String,
    val limitSec: Int,
    val leftSec: Int,
)

/** Time reserved when the user opens a limited app from the block screen. */
data class Session(
    val pkg: String,
    val startedAtMs: Long,
    val grantedSec: Int,
) {
    val endsAtMs: Long get() = startedAtMs + grantedSec * 1000L
}

/** One settled bet. [deltaSec] is the net change: positive for a win. */
data class Bet(
    val game: String,
    val pkg: String,
    val deltaSec: Int,
    val atMs: Long,
)

data class BankState(
    val day: String = "",
    val limits: List<Limit> = emptyList(),
    val ledger: List<Bet> = emptyList(),
    val session: Session? = null,
    /** Time left on limits removed today, so removing and re-adding a limit can't refill it. */
    val parked: Map<String, Int> = emptyMap(),
    /** Local midnight (epoch ms) of [day]; the next reset can't come sooner than 23 h after it. */
    val dayStartMs: Long = 0,
    val clock: ClockAnchor = ClockAnchor(),
    /** Strict mode: Settings and the uninstall screen are covered too, behind a wait. */
    val strict: Boolean = false,
    /** Until when Settings may be used despite strict mode. */
    val settingsPassUntilMs: Long = 0,
    /** Screen time actually spent in limited apps today (sessions only, not bets). */
    val usedTodaySec: Int = 0,
    val usedTodayByApp: Map<String, Int> = emptyMap(),
    /** Minutes won and lost at the tables today, counted per bet (the ledger only keeps the latest 50). */
    val wonTodaySec: Int = 0,
    val lostTodaySec: Int = 0,
    /** Finished days, newest first. */
    val history: List<DaySummary> = emptyList(),
)

/** One finished day, kept for the history charts. */
data class DaySummary(
    val day: String,
    val usedSec: Int,
    val wonSec: Int,
    val lostSec: Int,
    /** Seconds used per app that day. */
    val byApp: Map<String, Int> = emptyMap(),
)

enum class Decision { ALLOW, BLOCK }
