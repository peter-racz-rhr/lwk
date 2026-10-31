# Ante bypass audit

Every way I could think of to get around Ante's block, what happens now, and how it is tested.
Status: **Closed** = Ante stops it. **Friction** = possible, but behind a wait or several deliberate
steps. **Open** = a known gap.

Most of this was tested on the JVM. `WatcherStressTest` and `TrustedClockTest` drive the real
blocking rules (`core/Watcher.kt`, `core/TimeBank.kt`, `core/TrustedClock.kt`) through attack
scenarios. A fuzz run sends 120,000 random events, sessions, bets and sleeps, and checks two
invariants after every step:

- A limited app that comes to the front without a running session is always blocked.
- Time never grows except through a bet that was won.

I confirmed the tests have teeth by putting two old weaknesses back into `Watcher`. Three tests
failed, including the fuzz run. A second ECC code review attacked strict mode and the clock, and
its findings are fixed and covered by tests (rows 6, 9, 14, 15, 24 and 25). Rows marked *device*
need checking on a real phone.

## Inside the rules

| # | Attempt | Status | How |
|---|---|---|---|
| 1 | Open the app again and again | Closed | Every window event for a limited app without a session blocks again, even if the last block screen never appeared. |
| 2 | Recents: switch straight back to the app from the block screen | Closed | Same as 1. The block screen runs in its own task, so Back goes home and never into the app. |
| 3 | Remove the limit, then add it back | Closed | A removed limit "parks" today's remaining time, and re-adding gives it back, not a full budget. |
| 4 | Raise the limit when it runs out | Closed | Raising a limit only adds time from tomorrow. Cuts apply straight away. |
| 5 | Open for 15 minutes, then put the phone to sleep for an hour | Closed | Android timers pause in deep sleep. Ante re-checks on screen-on, unlock and every window change, so the block comes back the moment the phone wakes. |
| 6 | Set the date to tomorrow to get tomorrow's budget | Closed | Ante runs its own clock on the phone's boot timer. The wall clock is only followed when automatic time is on and it agrees with that boot clock to within 2 minutes. That also covers the offline trick: switch automatic time off, change the date, then switch it back on. A later network correction can't freeze the clock either. |
| 7 | Set the clock back to stretch a session | Closed | Sessions run on the same trusted clock. |
| 8 | Change the time zone to one where it's already tomorrow | Closed | A reset needs local midnight and at least 23 hours since the day began. The most a zone hop can gain is under an hour. |
| 9 | Reboot after changing the date | Closed | Ante detects the reboot through Android's boot count, even when the new uptime is longer. With manual time it resumes from the last trusted moment instead of jumping. Side effect: time while the phone is off doesn't count towards midnight. Today shows a tip to turn automatic time on. With automatic time on, the network clock is trusted after a reboot, so a date forged offline then rebooted could still get through (open, minor). |
| 10 | Split-screen the app beside something else | Closed (device) | Ante presses Home before showing the block screen, which ends split-screen. |
| 11 | A picker, permission dialog or browser tab inside the app | Not a bypass | These no longer end your session early, which used to block you mid-task. |
| 12 | Cheat at the tables with a forged payout | Closed | Native code keeps every open stake and pays at most 100× it. A payout with no matching stake is refused. The page can't make time. |
| 13 | Debugging the web view in a debug build | Open in debug builds | Use the release build for real use. Web debugging is only on in debug builds. |

## Outside the rules

| # | Attempt | Status | How |
|---|---|---|---|
| 14 | Turn off Ante's accessibility switch in Settings | Friction with Strict mode | Strict mode covers Settings with a block screen. A 30-second wait, timed in native code, unlocks it for 2 minutes. When the 2 minutes are up, the screen is covered again even if you never left it. Settings' Internet and Volume pop-up panels stay free. Without Strict mode it is open, the same for every accessibility-based blocker. |
| 15 | Uninstall Ante (from Settings, the Play Store or the uninstaller) | Closed with Strict mode | The uninstall screen stays covered for as long as Strict mode is on, and the Settings pass doesn't open it. The Play Store, Samsung Device care and Xiaomi Security get the same wait as Settings. Turning Strict mode off takes the 30-second wait. Without Strict mode it is open. |
| 16 | Force stop Ante from App info | Friction with Strict mode | App info lives in Settings, which Strict mode covers. *Device:* check that Android restarts the service after a force stop. |
| 17 | Android stops the watcher to save battery (Xiaomi, Huawei, Samsung "sleeping apps") | Detected | Today shows "Blocking isn't running" when the switch is on but the service is dead, and a "Keep Ante awake" button for battery optimization. |
| 18 | Use the website in a browser (instagram.com) | **Open** | Ante never reads screen content, so it can't see URLs. Workaround: limit the browser too. Website blocking would need the content permission. |
| 19 | Lite or third-party versions of an app, or a cloned "dual app" | **Open** | They have different package names. Add each one as its own limit. |
| 20 | Picture-in-picture video (YouTube) after the time runs out | **Open** | Android keeps a picture-in-picture window above everything. Turn off picture-in-picture for that app in Settings. |
| 21 | Background audio, or replying from notifications | **Open** | There is no app window to cover. |
| 22 | Quick settings in the notification shade | Intentionally open | Emergency calls, Wi-Fi and the flashlight must never be locked. |
| 23 | Safe mode, or a factory reset | Open | Out of scope for any normal app. |
| 24 | Go home and reopen the app to skip the 5-second breath | Closed | The breath restarts every time the block screen comes back, even when the page is reused. |
| 25 | Freeform windows or DeX, with the app beside a block screen that is still open | Closed (device) | Ante no longer skips showing the block screen just because one looks visible. |
| 26 | Fly west, or set the time zone back | Minor | The reset correctly waits, but it can come a few hours late on that one day. |

## Compared with ScreenZen

Public reviews describe ScreenZen as delay screens before flagged apps, a strict block, and lock or
passcode features. It also blocks websites
([nibble-app](https://nibble-app.com/blog/screenzen), [lifestack](https://lifestack.ai/blog/screenzen-review)).

| Feature | Ante now |
|---|---|
| Delay before opening | The block screen asks you to take a breath for 5 seconds before Open works. |
| Strict lock against changing settings or uninstalling | Strict mode, with a 30-second wait timed in native code. |
| Time budgets per app | Yes, plus the tables. |
| Website blocking | **No** (row 18). This is the biggest gap left. |

I haven't verified ScreenZen's exact Android behaviour. The comparison is based on reviews only.

## Still to check on a real phone

1. Rows 10 and 16: split-screen, and what happens after a force stop.
2. That the block screen covers within about 150 ms on Pixel, Samsung and Xiaomi.
3. Strict mode on Samsung and Xiaomi, including whether their Settings and Security apps use the
   package names in `AppWatcherService.PASSABLE`.
