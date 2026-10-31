# Ante

Ante is an Android screen-time app. You give apps a daily budget. When you open one of them, Ante covers it
with a block screen that shows the time left. From there you can open the app for a set number of minutes,
or stake some of those minutes at a casino table. You can play roulette, blackjack, slots, video poker or
coin flip. Wins go back to that app's budget, and losses are gone for the day. Every table has a small house
edge, so playing tends to cut screen time. No real money is involved.

## Build the APK in Android Studio

1. Open Android Studio (Ladybug 2024.2 or newer) and choose **File → Open**, then pick this `ante-android` folder.
2. Let Gradle sync finish. The first sync downloads Gradle 8.11.1, Android Gradle Plugin 8.7.3 and SDK 35.
   If Studio asks to install SDK Platform 35, accept.
3. **Debug APK:** use **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. The file lands in
   `app/build/outputs/apk/debug/app-debug.apk`.
4. **Release APK:** use **Build → Generate Signed App Bundle / APK…**, or run `./gradlew assembleRelease`.
   The release build is signed with the debug key so it installs right away. Use your own keystore before
   you publish anywhere.
5. Install it on a phone with **Run ▶** or `adb install app/build/outputs/apk/debug/app-debug.apk`.

From a terminal: `./gradlew assembleDebug`, and `./gradlew test` for the unit tests.

## Google sign-in (one-time setup, about 10 minutes)

Sign-in uses Android's Credential Manager ("Sign in with Google"), so Google shows its own account
sheet and Ante never sees a password. Until you finish these steps, the Google button says sign-in
isn't set up, and everything else works.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (for example "Ante").
2. Open **Google Auth Platform**, also listed as APIs & Services → OAuth consent screen. Fill in the
   app name and support email, then choose **External**. While the app is in *Testing*, add your own
   Google account under **Audience → Test users**.
3. **Get your app's SHA-1.** In Android Studio, open the Gradle panel → *app* → *Tasks* → *android* →
   **signingReport**, or run `./gradlew signingReport`. Copy the SHA1 of the `debug` variant.
4. **Create the Android client.** Go to **Clients → Create client → Android**. Enter package name
   `com.ante.app` and paste the SHA-1.
5. **Create the Web client.** Go to **Clients → Create client → Web application**. It needs no
   redirect URIs. Copy its **Client ID**, which ends in `.apps.googleusercontent.com`.
6. Paste that **Web** client ID into `app/src/main/res/values/google.xml` in place of
   `REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com`.
7. Rebuild and install. The phone needs Google Play services and a Google account.

The release build is signed with a different key, so it has a different SHA-1. Before you share a
release APK, add a second Android client with the release key's SHA-1.

**What signing in does today:** it saves your name and email on the phone and shows them on
Profile. Ante has no server, so nothing is synced or backed up yet. To add cloud backup later,
send `GoogleIdTokenCredential.idToken` to a backend (for example Firebase Auth) that verifies it.

## First run on the phone

1. Open Ante and tap **Open Accessibility settings**. Find **Ante app limits** and switch it on.
2. **If the switch is greyed out:** Android 13 and newer block this switch for apps installed from an APK.
   Go to **Settings → Apps → Ante**, tap **⋮**, then tap **Allow restricted settings**, and try the switch again.
   Ante's permission card has a button that opens this page.
3. Add a limit, for example Instagram at 20:00, then open Instagram to see the block screen.

Ante's accessibility service only asks for window-change events. It never reads screen content
(`canRetrieveWindowContent="false"`).

## How it is built

| Part | Where | What it does |
|---|---|---|
| `TimeBank` | `app/src/main/java/com/ante/app/core` | All time accounting: limits, sessions, bets, midnight reset. Pure Kotlin. |
| `Bank` | `…/Bank.kt` | Shares one `TimeBank` across the process and saves it to SharedPreferences. |
| `AppWatcherService` | `…/AppWatcherService.kt` | Accessibility service. Sees the front app, shows the block screen, ends sessions. |
| `BlockActivity` | `…/BlockActivity.kt` | Covers a limited app in its own task, so Back never lands in the app. |
| `MainActivity` | `…/MainActivity.kt` | Ante's own screen. |
| `AnteBridge` | `…/AnteBridge.kt` | The `window.AnteNative` JavaScript interface. Validates every argument. |
| Web UI | `app/src/main/assets/web` | Today, limits, block screen and the animated tables. Works offline. |

How time works:

- **Opening an app for N minutes** reserves N minutes.
- **Leaving early** refunds the unused part as soon as another app comes to the front.
- **Running out of session time** while still in the app brings the block screen back.
- **Other apps:** a picker, permission dialog or browser tab opened from inside the app does not end the session. Going home or opening another limited app does.
- **Changing limits:** lowering a limit applies now. Raising it adds the extra time from tomorrow, and a limit removed and added back keeps today's remaining time, so neither can be used to skip a block.
- **Sleep:** the session is checked again whenever the screen turns on or any window changes, because Android timers pause in deep sleep.
- **Payout cap:** a payout can never be more than 100× its stake, and a payout with no matching stake is ignored.
- **Failed rounds:** if a round fails mid-animation, the stake is refunded.

The app uses only the Android framework, plus AndroidX Credential Manager and Google Identity for sign-in.

### Returns per table

| Table | Rules | Return |
|---|---|---|
| Roulette | Single zero, 37 pockets | 97.3% |
| Blackjack | 6 decks, dealer stands on all 17s, pays 3 to 2, double on any two cards | about 99% |
| Slots | 3 weighted reels, three 7s pay 100× | 93.0% (exact) |
| Video poker | Jacks or better, royal pays 250× | about 96% |
| Coin flip | Pays 1.9× | 95% |

## Tests

| Command | What it checks |
|---|---|
| `./gradlew test` | 63 JUnit tests: time accounting, daily history, JSON codec, tamper-proof clock, and a 120,000-step fuzz of the blocking rules |
| `node --test web-tests/games.test.js` | 14 tests of game rules and returns (exact slots return, roulette 36/37, simulated blackjack) |
| `node web-tests/e2e.js` | Full UI run in Chromium with Playwright and the browser mock |

The e2e run covers adding a limit, every table, the block screen, the empty state, 340px width and
reduced motion. It fails on any console error or horizontal scroll. Install Playwright first with
`npm i -D playwright`.

To try the UI in a desktop browser, open `app/src/main/assets/web/index.html`. Add
`?mode=block&pkg=com.instagram.android` to the address to see the block screen.

## Blocking and bypasses

See [`docs/BYPASS-AUDIT.md`](docs/BYPASS-AUDIT.md) for 23 ways around a block, which ones Ante closes, and how each is tested.
In short: no remove-and-re-add refill, no clock or time-zone tricks, sleep and split-screen are handled, and
**Strict mode** (on Today) covers Settings and uninstalling behind a 30-second wait. Still open: websites in a
browser, picture-in-picture video and background audio.

## Sounds

Every table has sound: chips, the card shoe, the ball on the wheel, the reel motor, a coin ring, and win and
loss stings. They are all synthesized with Web Audio, so there are no audio files. The speaker button in each
table's header mutes them, and the choice is remembered.

## Known limits

- **Google Play:** apps that use an AccessibilityService for something other than helping people with
  disabilities have to pass Play's accessibility review and show a prominent disclosure. Sideloading the APK
  is not affected.
- **Detection gap:** a few apps open without a normal activity window change, which can delay detection.
- **No sounds yet.** Haptics are on.

Fonts: Inter, under the SIL Open Font License (`assets/web/fonts/OFL.txt`).
Design credits: the floating pill navigation and the morphing sign-in are original code, inspired by
[Skiper UI](https://skiper-ui.com) components 43 (Vercel tooltip) and 21. The card layouts follow
the look of [shadcn/ui](https://ui.shadcn.com).
