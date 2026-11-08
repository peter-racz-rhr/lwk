// LOW NOON - web server. Serves the client and connects players to the game core over WebSockets.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createGame } from './shared/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const game = createGame({
  botsPerTeam: Number(process.env.BOTS_PER_TEAM ?? 2),
  startMoney: Number(process.env.START_MONEY) || undefined,
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };
const ROUTES = [
  ['/lib/', path.join(__dirname, 'node_modules/three/build') + path.sep],
  ['/peerjs/', path.join(__dirname, 'node_modules/peerjs/dist') + path.sep],
  ['/shared/', path.join(__dirname, 'shared') + path.sep],
  ['/', path.join(__dirname, 'public') + path.sep],
];
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { url = '/'; }
  if (url === '/') url = '/index.html';
  if (url === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (url === '/debug' && process.env.DEBUG) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(game.debug()));
    return;
  }
  for (const [prefix, dir] of ROUTES) {
    if (!url.startsWith(prefix)) continue;
    const file = path.normalize(path.join(dir, url.slice(prefix.length)));
    if (!file.startsWith(dir)) break;
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
wss.on('connection', (ws) => {
  const h = game.attach({ send: (s) => { if (ws.readyState === 1) ws.send(s); } });
  ws.on('message', (raw) => h.message(raw.toString()));
  ws.on('close', () => h.close());
});

server.listen(PORT, () => {
  console.log(`\n  LOW NOON server running on port ${PORT}`);
  console.log(`  Open on this computer:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) console.log(`  Friends on same WiFi:   http://${ni.address}:${PORT}`);
    }
  }
  console.log('');
});
