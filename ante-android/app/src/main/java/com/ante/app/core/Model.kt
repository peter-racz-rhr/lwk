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
)

enum class Decision { ALLOW, BLOCK }
