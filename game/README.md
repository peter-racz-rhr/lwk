# LOW NOON

A 2v2 round-based tactical shooter that runs in the browser, with a crunchy PS2-era look.
Classic bomb mode: Attackers carry the bomb and plant it at site **A** or **B**. Defenders stop them or defuse it.
First team to **7 rounds** wins, and sides switch after round 6.
Empty slots are filled with **bots** that buy, carry the bomb, plant and defuse, so it works with 1, 2, 3 or 4 players.

## Economy and buy menu
- Everyone starts with **$800**. Press **B** in your spawn during the first 20 seconds of a round to buy.
- Round win: $3250 (elimination/time) or $3500 (bomb exploded/defused). Losing gives $1400, plus $500 more for each loss in a row (up to $3400).
- If the bomb was planted, the attackers still get +$800 even when they lose. Planting or defusing gives +$300.
- Kill rewards: rifles/pistols $300, SMG $600, shotgun $900, knife $1500, sniper $100.
- If you **survive**, you keep your weapons and armor. If you die, you're back to a pistol.
- Money and gear reset at halftime.

| Item | Price | Notes |
|---|---|---|
| P9 Pistol | $200 | default sidearm |
| Hand Cannon | $700 | heavy pistol, headshot kills |
| Wasp SMG | $1250 | fast, cheap, good kill money |
| Thunder-12 | $1100 | shotgun, close range |
| Raider AR | $2700 | attacker rifle |
| Guardian AR | $3100 | defender rifle |
| Longbow | $4750 | sniper, right-click scope, one-shot body |
| Kevlar / Kevlar+Helmet | $650 / $1000 | armor; helmet protects from headshots |
| Defuse kit | $400 | defenders: 2.5s defuse instead of 5s |
| HE / Flashbang / Smoke | $300 / $200 / $300 | grenades |

## Controls
| Key | Action |
|---|---|
| WASD | move |
| Mouse | aim / shoot |
| Space | jump |
| Shift | walk (no footstep sounds) |
| C | crouch (more accurate) |
| R | reload |
| Right mouse | sniper scope / underhand grenade throw |
| 1 / 2 / 3 / 4 | main gun / pistol / knife / grenades (press again to cycle) |
| Q / wheel | last weapon / cycle weapons |
| B | buy menu |
| E (hold) | plant bomb (bomb carrier, inside a site) / defuse (defenders, at the bomb) |
| G | drop the bomb (give it to a teammate) |
| Tab | scoreboard |
| T | chat |

Tips: shoot while standing still (moving = inaccurate), tap or burst instead of spraying, and aim for the head (rifle one-shots heads).

## Easiest: the single HTML file

**`dist/LOW-NOON.html`** is the whole game in one file. Copy it to any computer and double-click it.

- **PLAY WITH BOTS** works completely offline.
- **HOST GAME**: your browser runs the match and shows a 4-letter room code (top-left).
- **JOIN**: friends open the same file, type the code and press JOIN. Bots fill the empty slots.

Host/Join connect the browsers directly (WebRTC). It needs internet for the first handshake
(the free public PeerJS service), and some school or company networks block it. If joining fails,
use the Node server below.
Keep the host's game tab in front: browsers slow down background tabs.

Rebuild the file after changing the code: `npm install && npm run build`.

## Run the server version

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
cd game
npm install
npm start
```

Then open `http://localhost:3000`.

### Option A: one laptop is the server (same WiFi)
Run `npm start` on one computer. It prints a line like
`Friends on same WiFi: http://192.168.1.23:3000`. Everyone else opens that address.
(Some school WiFi networks block traffic between devices. If friends can't connect, use option B.)

### Option B: free online hosting on Render (most reliable)
1. Push this repo to GitHub (it's already there).
2. Go to https://render.com, sign in with GitHub, and click **New → Blueprint**.
3. Pick this repo. Render reads `render.yaml` and creates the `low-noon` web service.
4. Wait for the deploy, then share the `https://low-noon-xxxx.onrender.com` link.

The free Render plan goes to sleep when nobody uses it. The first visit can take about 30-50 seconds to wake up, so open it a few minutes before class.

## Files
- `server.js`: web server that connects players to the game core over WebSockets
- `shared/core.js`: game logic (rounds, economy, bomb, grenades, bots); runs on the server or in the host's browser
- `build/build.mjs`: bundles everything into `dist/LOW-NOON.html`
- `public/index.html`: menu + HUD
- `public/client.js`: 3D rendering (Three.js), PS2 effects, movement, shooting, sound
- `shared/`: map, physics and weapon stats used by both client and server
