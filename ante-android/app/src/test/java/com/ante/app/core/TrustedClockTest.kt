package com.ante.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

/** Attacks on the day reset and session clock: changing the date, time zone or rebooting. */
class TrustedClockTest {
    private val zone = ZoneId.of("Europe/Budapest")
    private val hour = 3_600_000L
    private fun at(y: Int, mo: Int, d: Int, h: Int, mi: Int = 0, z: ZoneId = zone) =
        LocalDateTime.of(y, mo, d, h, mi).atZone(z).toInstant().toEpochMilli()

    @Test fun automaticTimeIsTrusted() {
        val c = TrustedClock.tick(ClockAnchor(), wallMs = 1000, elapsedMs = 50, autoTime = true)
        assertEquals(1000, c.nowMs)
    }

    @Test fun manualClockJumpForwardIsIgnored() {
        var c = TrustedClock.tick(ClockAnchor(), wallMs = at(2026, 10, 31, 22), elapsedMs = 10_000, autoTime = false)
        // User sets the phone to tomorrow; only 60 s really passed.
        c = TrustedClock.tick(c.anchor, wallMs = at(2026, 11, 1, 22), elapsedMs = 70_000, autoTime = false)
        assertEquals(at(2026, 10, 31, 22) + 60_000, c.nowMs)
    }

    @Test fun manualClockJumpBackwardIsIgnored() {
        var c = TrustedClock.tick(ClockAnchor(), wallMs = at(2026, 10, 31, 22), elapsedMs = 10_000, autoTime = false)
        c = TrustedClock.tick(c.anchor, wallMs = at(2026, 10, 31, 9), elapsedMs = 20_000, autoTime = false)
        assertEquals(at(2026, 10, 31, 22) + 10_000, c.nowMs)
    }

    @Test fun rebootWithManualTimeNeverJumpsForward() {
        var c = TrustedClock.tick(ClockAnchor(), wallMs = at(2026, 10, 31, 22), elapsedMs = 5_000_000, autoTime = false)
        // Reboot: elapsed restarts near zero, wall clock was pushed a day ahead.
        c = TrustedClock.tick(c.anchor, wallMs = at(2026, 11, 1, 22), elapsedMs = 30_000, autoTime = false)
        assertEquals(at(2026, 10, 31, 22), c.nowMs)
        // and it keeps counting from there
        c = TrustedClock.tick(c.anchor, wallMs = at(2026, 11, 1, 23), elapsedMs = 90_000, autoTime = false)
        assertEquals(at(2026, 10, 31, 22) + 60_000, c.nowMs)
    }

    @Test fun trustedTimeNeverGoesBackwards() {
        var c = TrustedClock.tick(ClockAnchor(), wallMs = at(2026, 10, 31, 22), elapsedMs = 1_000, autoTime = true)
        c = TrustedClock.tick(c.anchor, wallMs = at(2026, 10, 31, 21), elapsedMs = 2_000, autoTime = true)
        assertTrue(c.nowMs >= at(2026, 10, 31, 22))
    }

    @Test fun midnightResetsTheDay() {
        val b = TimeBank()
        assertTrue(b.rolloverIfDue(at(2026, 10, 31, 9), zone))
        b.setLimit("ig", "Instagram", 1200)
        b.placeBet("ig", 1200)
        assertFalse(b.rolloverIfDue(at(2026, 10, 31, 23, 59), zone))
        assertTrue(b.rolloverIfDue(at(2026, 11, 1, 0, 1), zone))
        assertEquals(1200, b.limitFor("ig")!!.leftSec)
    }

    @Test fun timeZoneHopCannotResetEarly() {
        val b = TimeBank()
        b.rolloverIfDue(at(2026, 10, 31, 0, 30), zone)
        b.setLimit("ig", "Instagram", 1200)
        b.placeBet("ig", 1200)
        // 13:00 local: switch the phone to UTC+14, where it is already tomorrow.
        val now = at(2026, 10, 31, 13)
        assertFalse(b.rolloverIfDue(now, ZoneId.of("Pacific/Kiritimati")))
        assertEquals(0, b.limitFor("ig")!!.leftSec)
    }

    @Test fun shortDstDayStillResets() {
        val ny = ZoneId.of("America/New_York")
        val b = TimeBank()
        b.rolloverIfDue(at(2026, 3, 7, 12, z = ny), ny)
        // 8 March 2026 is 23 hours long in New York.
        assertTrue(b.rolloverIfDue(at(2026, 3, 8, 0, 5, z = ny), ny))
        assertTrue(b.rolloverIfDue(at(2026, 3, 9, 0, 5, z = ny), ny))
    }

    @Test fun firstLaunchLateAtNightStillResetsAtMidnight() {
        val b = TimeBank()
        b.rolloverIfDue(at(2026, 10, 31, 23, 50), zone)
        assertTrue(b.rolloverIfDue(at(2026, 11, 1, 0, 10), zone))
    }

    @Test fun oldSaveWithoutDayStartRollsOverNormally() {
        val b = TimeBank(BankState(day = "2026-10-30"))
        assertTrue(b.rolloverIfDue(at(2026, 10, 31, 8), zone))
        assertEquals("2026-10-31", b.state.day)
        assertEquals(at(2026, 10, 31, 0), b.state.dayStartMs)
    }

    @Test fun movingClockBackDoesNotStretchASession() {
        // With automatic time off, sessions run on the trusted clock, so the wall clock can't stretch them.
        var c = TrustedClock.tick(ClockAnchor(), wallMs = at(2026, 10, 31, 20), elapsedMs = 0, autoTime = false)
        val b = TimeBank()
        b.rolloverIfDue(c.nowMs, zone)
        b.setLimit("ig", "Instagram", 1200)
        b.startSession("ig", 300, c.nowMs)
        c = TrustedClock.tick(c.anchor, wallMs = at(2026, 10, 31, 18), elapsedMs = 301_000, autoTime = false)
        assertEquals(Decision.BLOCK, b.onForeground("ig", c.nowMs))
        assertTrue(hour > 0)
    }
}
