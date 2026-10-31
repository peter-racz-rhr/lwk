package com.ante.app.core

/**
 * The blocking rules, separate from the Android service so they can be stress tested.
 * Feed it every window change and every timer tick; act on the [Action] it returns.
 *
 * Strict mode: [passable] packages (Settings, Play Store) open for two minutes after a wait;
 * [locked] packages (the uninstaller) stay covered until strict mode is turned off.
 */
class Watcher(
    private val ownPkg: String,
    private val passable: Set<String> = emptySet(),
    private val locked: Set<String> = emptySet(),
) {
    sealed interface Action {
        data object None : Action
        data class Block(val pkg: String, val note: String?) : Action
    }

    /** Package of the last real activity window in front. */
    var foreground: String? = null
        private set

    private fun guarded(bank: TimeBank, pkg: String, nowMs: Long): Boolean = bank.state.strict &&
        (pkg in locked || (pkg in passable && bank.isGuardActive(nowMs)))

    fun onWindow(bank: TimeBank, pkg: String, isActivity: Boolean, ignored: Boolean, isHome: Boolean, nowMs: Long): Action {
        // Every event is a chance to catch a session that ran out while the timer was asleep.
        val expired = expireSession(bank, nowMs)
        if (ignored || !isActivity) return expired

        // Screens inside the same app don't count, unless that app should be blocked right now:
        // then keep blocking on every event, in case the block screen failed to appear.
        val guard = guarded(bank, pkg, nowMs)
        val shouldBlock = pkg != ownPkg && (guard || (bank.limitFor(pkg) != null && !bank.isSessionActive(pkg, nowMs)))
        if (pkg == foreground && !shouldBlock) return expired
        foreground = pkg
        if (guard) {
            bank.onForeground(pkg, nowMs, isHome = false)
            return Action.Block(pkg, GUARD_NOTE)
        }

        val decision = bank.onForeground(pkg, nowMs, isHome)
        if (decision == Decision.BLOCK && pkg != ownPkg) {
            return if (expired is Action.Block && expired.pkg == pkg) expired else Action.Block(pkg, null)
        }
        return expired
    }

    /** Timer, screen-on and clock-change hook: session expiry, and a Settings pass running out. */
    fun onTimer(bank: TimeBank, nowMs: Long): Action {
        val expired = expireSession(bank, nowMs)
        if (expired is Action.Block) return expired
        val fg = foreground ?: return Action.None
        return if (guarded(bank, fg, nowMs)) Action.Block(fg, GUARD_NOTE) else Action.None
    }

    private fun expireSession(bank: TimeBank, nowMs: Long): Action {
        val expired = bank.expireSession(nowMs) ?: return Action.None
        return if (expired == foreground) Action.Block(expired, "Session over.") else Action.None
    }

    companion object {
        /** Note on a block screen that covers Settings or the uninstaller in strict mode. */
        const val GUARD_NOTE = "strict"
    }
}
