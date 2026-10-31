# Ante: spec and slice plan

Built with ECC's `orch-build-mvp` flow (spec → vertical slices → TDD → review → commit).

## Product

Ante is an Android screen-time app. You give apps a daily time budget. When you open a limited app,
Ante covers it with a block screen that shows how much time is left. From there you either open the
app for a chosen number of minutes, or stake minutes at a casino table (coin flip, blackjack,
roulette, poker, slots). Wins go back to that app's budget. Losses are gone for the day. Every game
has a small house edge, so over time playing reduces screen time.

No real money is involved anywhere.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Platform | Android first, minSdk 26, target/compile 35 | Android allows a full custom screen over other apps |
| Detecting app launches | `AccessibilityService` (`TYPE_WINDOW_STATE_CHANGED`) | Works without root, reacts instantly |
| Covering the app | Our own `BlockActivity` launched on top in its own task | No overlay permission needed |
| UI | Native Kotlin shell + bundled HTML/CSS/JS in a `WebView` | Rich animations, and the whole UI can be tested in a desktop browser |
| Dependencies | Android framework only (no AndroidX) | Fewer moving parts; the code compiles against the bare SDK |
| Source of truth | Native `TimeBank` in `SharedPreferences` | The service and both screens share one state |
| Odds | Coin 95%, blackjack ≈99%, roulette 97.3%, poker ≈96%, slots 93% | Slight house edge |
| Payout cap | A single payout can't exceed 100× the stake | Slots top prize; stops a forged bridge call minting time |

## How time is counted

- **Open for N minutes:** N minutes are reserved (taken from the budget) and a session starts.
- **Leave early:** when another app comes to the front, the unused part of the session is refunded.
- **Session runs out while you're still in the app:** the block screen comes back.
- **Midnight:** every budget resets to its limit and the bet history clears.

## Vertical slices

1. **Core bank (pure Kotlin + JUnit).** Limits, sessions, bets, day rollover, JSON codec.
2. **Shell.** `MainActivity` with WebView, the JS bridge, a browser mock bridge for testing.
3. **Watcher.** `AppWatcherService` detects the foreground app and launches `BlockActivity`; session expiry.
4. **UI.** Today, limits editor with the real installed-app list, onboarding for the accessibility permission.
5. **Tables.** Animated coin flip, blackjack, roulette, poker, slots, with pure game logic tested in Node.
6. **Polish and verify.** Haptics, review agents, Playwright run, README for Android Studio.

## Content states

| State | Where | Behaviour |
|---|---|---|
| Permission | Today | A card explains the accessibility switch, including Android 13+ "restricted settings" for sideloaded APKs |
| Empty | Today, no limits | "Add an app" call to action |
| Loading | App picker | Installed apps load on open; the list shows a short loading line first |
| Error | Bridge call refused | A toast says what failed (for example "Not enough Instagram time for this stake") |
| Success | After a bet | Result line plus count-up of the minutes won or lost |
| Partial | Stake app under 1 minute | That app's chip is disabled; other apps stay playable |
