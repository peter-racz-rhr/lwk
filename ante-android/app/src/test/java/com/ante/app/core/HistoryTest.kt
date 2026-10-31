package com.ante.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HistoryTest {
    private val ig = "ig"

    private fun bank() = TimeBank().apply {
        rollover("2026-10-30")
        setLimit(ig, "Instagram", 3600)
    }

    @Test fun endingASessionEarlyCountsOnlyTheTimeUsed() {
        val b = bank()
        b.startSession(ig, 600, 0)
        b.endSession(90_000)
        assertEquals(90, b.state.usedTodaySec)
    }

    @Test fun anExpiredSessionCountsInFull() {
        val b = bank()
        b.startSession(ig, 300, 0)
        b.expireSession(300_000)
        assertEquals(300, b.state.usedTodaySec)
    }

    @Test fun rolloverArchivesTheDayWithWinsAndLosses() {
        val b = bank()
        b.startSession(ig, 120, 0)
        b.endSession(120_000)
        b.placeBet(ig, 300); b.settleBet(ig, "Slots", 300, 600, 1) // +300
        b.placeBet(ig, 60); b.settleBet(ig, "Roulette", 60, 0, 2) // -60
        b.rollover("2026-10-31")
        val d = b.state.history.first()
        assertEquals(DaySummary("2026-10-30", usedSec = 120, wonSec = 300, lostSec = 60), d)
        assertEquals(0, b.state.usedTodaySec)
    }

    @Test fun newestDayComesFirstAndHistoryIsBounded() {
        val b = bank()
        repeat(TimeBank.HISTORY_MAX + 20) { i -> b.rollover("day-$i") }
        assertEquals(TimeBank.HISTORY_MAX, b.state.history.size)
        assertEquals("day-${TimeBank.HISTORY_MAX + 18}", b.state.history.first().day)
    }

    @Test fun firstEverDayIsNotArchived() {
        val b = TimeBank()
        b.rollover("2026-10-31")
        assertTrue(b.state.history.isEmpty())
    }

    @Test fun winsAndLossesCountEveryBetNotJustTheLedgerWindow() {
        val b = bank()
        repeat(80) { b.placeBet(ig, 1); b.settleBet(ig, "Coin flip", 1, 2, it.toLong()) } // +1 each
        assertEquals(80, b.state.wonTodaySec)
        b.rollover("2026-10-31")
        assertEquals(80, b.state.history.first().wonSec)
        assertEquals(0, b.state.wonTodaySec)
    }

    @Test fun aSessionRunningAtMidnightCountsTowardsTheDayItRanIn() {
        val b = bank()
        b.startSession(ig, 600, 0)
        b.rollover("2026-10-31", nowMs = 240_000)
        assertEquals(240, b.state.history.first().usedSec)
        assertEquals(null, b.state.session)
    }

    @Test fun removingALimitMidSessionKeepsTheTimeUsed() {
        val b = bank()
        b.startSession(ig, 600, 0)
        b.removeLimit(ig, nowMs = 90_000)
        assertEquals(90, b.state.usedTodaySec)
    }

    @Test fun historySurvivesSaveAndLoad() {
        val b = bank()
        b.startSession(ig, 60, 0); b.expireSession(60_000)
        b.rollover("2026-10-31")
        val again = Codec.decode(Codec.encode(b.state))
        assertEquals(b.state.history, again.history)
        assertEquals(b.state.usedTodaySec, again.usedTodaySec)
        assertEquals(b.state.wonTodaySec, again.wonTodaySec)
        assertEquals(b.state.lostTodaySec, again.lostTodaySec)
    }
}
