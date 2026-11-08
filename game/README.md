# LOW NOON

A 2v2 round-based tactical shooter that runs in the browser, with a crunchy PS2-era look.
Attackers plant the bomb at site **A** or **B**, and Defenders stop them or defuse it. First team to **7 rounds** wins, and sides switch after round 6.
Empty slots are filled with **bots**, so it works with 1, 2, 3 or 4 players.

## Controls
| Key | Action |
|---|---|
| WASD | move |
| Mouse | aim / shoot |
| Space | jump |
| Shift | walk (no footstep sounds) |
| C | crouch (more accurate) |
| R | reload |
| 1 / 2 / 3 / Q / wheel | rifle / pistol / knife / last weapon |
| E (hold) | plant bomb (attackers, inside a site) / defuse (defenders, at the bomb) |
| Tab | scoreboard |
| T | chat |

Tips: shoot while standing still (moving = inaccurate), tap or burst instead of spraying, and aim for the head (rifle one-shots heads).

## Run it

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
- `server.js`: web server plus game logic (rounds, bomb, bots, hit validation)
- `public/index.html`: menu + HUD
- `public/client.js`: 3D rendering (Three.js), PS2 effects, movement, shooting, sound
- `shared/`: map, physics and weapon stats used by both client and server
