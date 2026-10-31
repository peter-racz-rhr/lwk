package com.ante.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/**
 * Stress test of the blocking rules. Thousands of random window events, sessions, bets and
 * sleeps; after every step the invariants that make Ante a real blocker must hold.
 */
class WatcherStressTest {
    private val own = "com.ante.app"
    private val ig = "com.instagram.android"
    private val tt = "com.zhiliaoapp.musically"
    private val maps = "com.google.android.apps.maps"
    private val home = "com.android.launcher3"
    private val shade = "com.android.systemui"
    private val picker = "com.google.android.documentsui"
    private val limited = setOf(ig, tt)

    private fun setup(): Pair<TimeBank, Watcher> {
        val bank = TimeBank()
        bank.rollover("d")
        bank.setLimit(ig, "Instagram", 1200)
        bank.setLimit(tt, "TikTok", 600)
        return bank to Watcher(own)
    }

    private fun budget(b: TimeBank, now: Long): Long {
        val s = b.state.session
        val reserved = if (s == null) 0L else ((s.endsAtMs - now).coerceAtLeast(0) + 999) / 1000
        return b.state.limits.sumOf { it.leftSec.toLong() } + reserved
    }

    @Test fun randomUseNeverLeaksALimitedApp() {
        repeat(40) { seed -> fuzz(Random(seed), steps = 3000) }
    }

    private fun fuzz(rnd: Random, steps: Int) {
        val (bank, w) = setup()
        var now = 1_000_000L
        val apps = listOf(ig, tt, maps, home, shade, picker, own)
        for (step in 0 until steps) {
            val before = budget(bank, now)
            when (rnd.nextInt(10)) {
                in 0..5 -> { // a window comes to the front
                    val pkg = apps[rnd.nextInt(apps.size)]
                    val isActivity = rnd.nextInt(8) != 0
                    val ignored = pkg == shade
                    val sessionBefore = bank.isSessionActive(pkg, now)
                    val action = w.onWindow(bank, pkg, isActivity, ignored, isHome = pkg == home, nowMs = now)
                    if (pkg in limited && isActivity && !ignored && !sessionBefore) {
                        assertTrue("step $step: $pkg shown without a session must be blocked, got $action",
                            action is Watcher.Action.Block && action.pkg == pkg)
                        // The block screen comes up on top.
                        w.onWindow(bank, own, isActivity = true, ignored = false, isHome = false, nowMs = now)
                    }
                    if (action is Watcher.Action.Block) {
                        assertTrue("never block a non-limited app: $action", action.pkg in limited)
                    }
                }
                6 -> { // user opens a limited app from the block screen
                    val pkg = if (rnd.nextBoolean()) ig else tt
                    val left = bank.limitFor(pkg)!!.leftSec
                    if (left > 0) bank.startSession(pkg, 1 + rnd.nextInt(left), now)
                }
                7 -> { // a bet
                    val pkg = if (rnd.nextBoolean()) ig else tt
                    val left = bank.limitFor(pkg)!!.leftSec
                    if (left >= 60 && bank.placeBet(pkg, 60)) {
                        assertEquals(before - 60, budget(bank, now))
                        val ret = listOf(0, 60, 114, 120, 6000)[rnd.nextInt(5)]
                        bank.settleBet(pkg, "Slots", 60, ret, now)
                        continue
                    }
                }
                8 -> { // the session timer fires
                    val s = bank.state.session
                    val fg = w.foreground
                    val action = w.onTimer(bank, now)
                    if (s != null && now >= s.endsAtMs && fg == s.pkg) {
                        assertTrue("expired session in front must block", action is Watcher.Action.Block && action.pkg == s.pkg)
                    }
                    if (s != null && now < s.endsAtMs) assertEquals(Watcher.Action.None, action)
                }
                else -> now += listOf(500L, 5_000L, 60_000L, 600_000L)[rnd.nextInt(4)] // time passes, maybe asleep
            }
            assertTrue("step $step: budget grew without a win (${before} -> ${budget(bank, now)})", budget(bank, now) <= before)
            bank.state.limits.forEach { assertTrue(it.leftSec >= 0) }
        }
    }

    @Test fun sameAppEventsKeepBlockingWhenTheBlockScreenFailedToShow() {
        val (bank, w) = setup()
        assertTrue(w.onWindow(bank, ig, true, false, false, 0) is Watcher.Action.Block)
        // No block-screen event arrived (launch was refused). Instagram keeps sending events.
        assertTrue(w.onWindow(bank, ig, true, false, false, 1_000) is Watcher.Action.Block)
    }

    @Test fun sessionRunningOutInsideTheAppBlocks() {
        val (bank, w) = setup()
        bank.startSession(ig, 60, 0)
        assertEquals(Watcher.Action.None, w.onWindow(bank, ig, true, false, false, 0))
        assertEquals(Watcher.Action.None, w.onTimer(bank, 59_000))
        val a = w.onTimer(bank, 60_000)
        assertTrue(a is Watcher.Action.Block && a.note != null)
    }

    @Test fun expiryIsCaughtOnTheNextEventEvenIfTheTimerSlept() {
        val (bank, w) = setup()
        bank.startSession(ig, 60, 0)
        w.onWindow(bank, ig, true, false, false, 0)
        // Screen off for 30 minutes; timer never fired. First event after wake is the shade.
        val a = w.onWindow(bank, shade, true, true, false, 1_800_000)
        assertTrue(a is Watcher.Action.Block && a.pkg == ig)
        assertNull(bank.state.session)
    }

    @Test fun pickerInsideTheAppDoesNotEndTheSession() {
        val (bank, w) = setup()
        bank.startSession(ig, 300, 0)
        w.onWindow(bank, ig, true, false, false, 0)
        assertEquals(Watcher.Action.None, w.onWindow(bank, picker, true, false, false, 10_000))
        assertEquals(Watcher.Action.None, w.onWindow(bank, ig, true, false, false, 20_000))
    }

    @Test fun goingHomeRefundsAndReopeningBlocks() {
        val (bank, w) = setup()
        bank.startSession(ig, 300, 0)
        w.onWindow(bank, ig, true, false, false, 0)
        w.onWindow(bank, home, true, false, true, 60_000)
        assertEquals(1200 - 60, bank.limitFor(ig)!!.leftSec)
        assertTrue(w.onWindow(bank, ig, true, false, false, 61_000) is Watcher.Action.Block)
    }

    private val settings = "com.android.settings"
    private val installer = "com.google.android.packageinstaller"
    private val store = "com.android.vending"
    private fun strictWatcher() = Watcher(own, passable = setOf(settings, store), locked = setOf(installer))

    @Test fun strictModeCoversSettingsAndUninstall() {
        val (bank, _) = setup()
        val w = strictWatcher()
        assertEquals(Watcher.Action.None, w.onWindow(bank, settings, true, false, false, 0))
        bank.setStrict(true)
        w.onWindow(bank, home, true, false, true, 1)
        val a = w.onWindow(bank, settings, true, false, false, 2)
        assertTrue(a is Watcher.Action.Block && a.pkg == settings && a.note == Watcher.GUARD_NOTE)
        assertTrue(w.onWindow(bank, installer, true, false, false, 3) is Watcher.Action.Block)
    }

    @Test fun settingsPassLastsTwoMinutes() {
        val (bank, _) = setup()
        val w = strictWatcher()
        bank.setStrict(true)
        bank.grantSettingsPass(10_000)
        assertEquals(Watcher.Action.None, w.onWindow(bank, settings, true, false, false, 11_000))
        w.onWindow(bank, home, true, false, true, 20_000)
        assertTrue(w.onWindow(bank, settings, true, false, false, 10_000 + TimeBank.SETTINGS_PASS_MS) is Watcher.Action.Block)
    }

    @Test fun settingsPassRunsOutWhileStillOnTheScreen() {
        val (bank, _) = setup()
        val w = strictWatcher()
        bank.setStrict(true)
        bank.grantSettingsPass(0)
        assertEquals(Watcher.Action.None, w.onWindow(bank, settings, true, false, false, 1_000))
        assertEquals(Watcher.Action.None, w.onTimer(bank, TimeBank.SETTINGS_PASS_MS - 1))
        val a = w.onTimer(bank, TimeBank.SETTINGS_PASS_MS)
        assertTrue(a is Watcher.Action.Block && a.pkg == settings && a.note == Watcher.GUARD_NOTE)
    }

    @Test fun settingsPassDoesNotUnlockTheUninstaller() {
        val (bank, _) = setup()
        val w = strictWatcher()
        bank.setStrict(true)
        bank.grantSettingsPass(0)
        w.onWindow(bank, settings, true, false, false, 1_000)
        val a = w.onWindow(bank, installer, true, false, false, 2_000)
        assertTrue(a is Watcher.Action.Block && a.pkg == installer)
    }

    @Test fun leavingSettingsDoesNotBlockTheHomeScreen() {
        val (bank, _) = setup()
        val w = strictWatcher()
        bank.setStrict(true)
        bank.grantSettingsPass(0)
        w.onWindow(bank, settings, true, false, false, 1_000)
        assertEquals(Watcher.Action.None, w.onWindow(bank, home, true, false, true, TimeBank.SETTINGS_PASS_MS + 5))
    }

    @Test fun strictModeSurvivesARestart() {
        val (bank, _) = setup()
        bank.setStrict(true)
        val reloaded = TimeBank(Codec.decode(Codec.encode(bank.state)))
        assertTrue(strictWatcher().onWindow(reloaded, settings, true, false, false, 0) is Watcher.Action.Block)
    }

    @Test fun dialogsAndToastsAreNotTreatedAsAppSwitches() {
        val (bank, w) = setup()
        bank.startSession(ig, 300, 0)
        w.onWindow(bank, ig, true, false, false, 0)
        assertEquals(Watcher.Action.None, w.onWindow(bank, home, isActivity = false, ignored = false, isHome = true, nowMs = 1_000))
        assertTrue(bank.isSessionActive(ig, 1_000))
    }
}
