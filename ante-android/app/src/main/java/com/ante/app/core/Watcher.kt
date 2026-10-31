package com.ante.app.core

/**
 * The blocking rules, separate from the Android service so they can be stress tested.
 * Feed it every window change and every timer tick; act on the [Action] it returns.
 */
class Watcher(private val ownPkg: String, private val guarded: Set<String> = emptySet()) {
    sealed interface Action {
        data object None : Action
        data class Block(val pkg: String, val note: String?) : Action
    }

    /** Package of the last real activity window in front. */
    var foreground: String? = null
        private set

    fun onWindow(bank: TimeBank, pkg: String, isActivity: Boolean, ignored: Boolean, isHome: Boolean, nowMs: Long): Action {
        // Every event is a chance to catch a session that ran out while the timer was asleep.
        val expired = onTimer(bank, nowMs)
        if (ignored || !isActivity) return expired

        // Screens inside the same app don't count, unless that app should be blocked right now:
        // then keep blocking on every event, in case the block screen failed to appear.
        val guard = pkg in guarded && bank.isGuardActive(nowMs)
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

    companion object {
        /** Note on a block screen that covers Settings or the uninstaller in strict mode. */
        const val GUARD_NOTE = "strict"
    }

    /** Session timer, screen-on and clock-change hook. Blocks when the app whose time ran out is in front. */
    fun onTimer(bank: TimeBank, nowMs: Long): Action {
        val expired = bank.expireSession(nowMs) ?: return Action.None
        return if (expired == foreground) Action.Block(expired, "Session over.") else Action.None
    }
}
