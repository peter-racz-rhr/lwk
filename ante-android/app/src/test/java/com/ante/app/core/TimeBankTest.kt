package com.ante.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TimeBankTest {
    private val ig = "com.instagram.android"
    private val tt = "com.zhiliaoapp.musically"
    private val maps = "com.google.android.apps.maps"

    private fun bank(): TimeBank = TimeBank().apply {
        rollover("2026-10-31")
        setLimit(ig, "Instagram", 1200)
        setLimit(tt, "TikTok", 1800)
    }

    @Test fun newLimitStartsFull() {
        val b = bank()
        assertEquals(1200, b.limitFor(ig)!!.leftSec)
    }

    @Test fun changingLimitShiftsRemainingByTheDifference() {
        val b = bank()
        b.startSession(ig, 600, 0)
        b.endSession(600_000) // used all 600
        assertEquals(600, b.limitFor(ig)!!.leftSec)
        b.setLimit(ig, "Instagram", 900) // -300
        assertEquals(300, b.limitFor(ig)!!.leftSec)
        b.setLimit(ig, "Instagram", 60) // would go negative -> clamps to 0
        assertEquals(0, b.limitFor(ig)!!.leftSec)
    }

    @Test fun limitIsClampedToAllowedRange() {
        val b = bank()
        assertEquals(TimeBank.MIN_LIMIT_SEC, b.setLimit(ig, "Instagram", 1).limitSec)
        assertEquals(TimeBank.MAX_LIMIT_SEC, b.setLimit(ig, "Instagram", Int.MAX_VALUE).limitSec)
    }

    @Test fun removeLimitAlsoEndsItsSession() {
        val b = bank()
        b.startSession(ig, 300, 0)
        b.removeLimit(ig)
        assertNull(b.limitFor(ig))
        assertNull(b.state.session)
    }

    @Test fun rolloverResetsBudgetsAndLedgerOnlyOnNewDay() {
        val b = bank()
        b.placeBet(ig, 300)
        b.settleBet(ig, "Slots", 300, 0, 1)
        assertFalse(b.rollover("2026-10-31"))
        assertEquals(900, b.limitFor(ig)!!.leftSec)
        assertTrue(b.rollover("2026-11-01"))
        assertEquals(1200, b.limitFor(ig)!!.leftSec)
        assertTrue(b.state.ledger.isEmpty())
    }

    @Test fun sessionReservesTimeAndRefundsUnusedPart() {
        val b = bank()
        assertTrue(b.startSession(ig, 300, 1_000))
        assertEquals(900, b.limitFor(ig)!!.leftSec)
        val refund = b.endSession(1_000 + 120_000) // used 2 of 5 minutes
        assertEquals(180, refund)
        assertEquals(1080, b.limitFor(ig)!!.leftSec)
        assertNull(b.state.session)
    }

    @Test fun cannotOpenForMoreThanIsLeft() {
        val b = bank()
        assertFalse(b.startSession(ig, 1201, 0))
        assertFalse(b.startSession(ig, 0, 0))
        assertFalse(b.startSession(maps, 60, 0))
    }

    @Test fun foregroundBlocksLimitedAppWithoutSession() {
        val b = bank()
        assertEquals(Decision.BLOCK, b.onForeground(ig, 0))
        assertEquals(Decision.ALLOW, b.onForeground(maps, 0))
    }

    @Test fun foregroundAllowsDuringSessionAndBlocksAfterExpiry() {
        val b = bank()
        b.startSession(ig, 60, 0)
        assertEquals(Decision.ALLOW, b.onForeground(ig, 59_000))
        assertEquals(Decision.BLOCK, b.onForeground(ig, 60_000))
        assertNull(b.state.session)
        assertEquals(1140, b.limitFor(ig)!!.leftSec)
    }

    @Test fun switchingAwayEndsSessionWithRefund() {
        val b = bank()
        b.startSession(ig, 600, 0)
        assertEquals(Decision.ALLOW, b.onForeground(maps, 60_000))
        assertNull(b.state.session)
        assertEquals(1140, b.limitFor(ig)!!.leftSec)
    }

    @Test fun switchingToAnotherLimitedAppRefundsAndBlocks() {
        val b = bank()
        b.startSession(ig, 600, 0)
        assertEquals(Decision.BLOCK, b.onForeground(tt, 30_000))
        assertEquals(1170, b.limitFor(ig)!!.leftSec)
    }

    @Test fun expireSessionOnlyFiresAfterEnd() {
        val b = bank()
        b.startSession(ig, 60, 0)
        assertNull(b.expireSession(59_999))
        assertEquals(ig, b.expireSession(60_000))
        assertNull(b.state.session)
    }

    @Test fun betNeedsEnoughTime() {
        val b = bank()
        assertFalse(b.placeBet(ig, 1201))
        assertFalse(b.placeBet(ig, 0))
        assertTrue(b.placeBet(ig, 1200))
        assertEquals(0, b.limitFor(ig)!!.leftSec)
        assertFalse(b.placeBet(ig, 1))
    }

    @Test fun winningPaysReturnAndLogsNet() {
        val b = bank()
        b.placeBet(ig, 300)
        val net = b.settleBet(ig, "Blackjack", 300, 600, 42)
        assertEquals(300, net)
        assertEquals(1500, b.limitFor(ig)!!.leftSec)
        val bet = b.state.ledger.first()
        assertEquals("Blackjack", bet.game)
        assertEquals(300, bet.deltaSec)
    }

    @Test fun settleWithoutAPlacedStakePaysNothing() {
        val b = bank()
        val net = b.settleBet(ig, "Slots", 300, 30_000, 0)
        assertEquals(0, net)
        assertEquals(1200, b.limitFor(ig)!!.leftSec)
        assertTrue(b.state.ledger.isEmpty())
    }

    @Test fun payoutIsCappedAtMaxMultiple() {
        val b = bank()
        b.placeBet(ig, 60)
        b.settleBet(ig, "Slots", 60, Int.MAX_VALUE, 0)
        assertEquals(1140 + 60 * TimeBank.MAX_RETURN_MULTIPLE, b.limitFor(ig)!!.leftSec)
    }

    @Test fun doublingDownStacksStakes() {
        val b = bank()
        b.placeBet(ig, 300)
        b.placeBet(ig, 300)
        assertEquals(-600, b.settleBet(ig, "Blackjack", 600, 0, 0))
        assertEquals(600, b.limitFor(ig)!!.leftSec)
    }

    @Test fun ledgerIsBounded() {
        val b = bank()
        repeat(TimeBank.LEDGER_MAX + 10) {
            b.placeBet(ig, 1)
            b.settleBet(ig, "Coin flip", 1, 2, it.toLong())
        }
        assertEquals(TimeBank.LEDGER_MAX, b.state.ledger.size)
    }
}
