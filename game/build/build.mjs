// Builds dist/LOW-NOON.html: the whole game (three.js, PeerJS, game core, client) in one file.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  entryPoints: [path.join(root, 'build/standalone.js')],
  bundle: true, format: 'iife', minify: true, write: false, target: 'es2020',
  legalComments: 'none', logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
const tag = '<script type="module" src="client.js"></script>';
if (!html.includes(tag)) throw new Error('client script tag not found in index.html');
html = html.replace(tag, () => `<script>\n${js}\n</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/LOW-NOON.html');
fs.writeFileSync(out, html);
console.log(`Built ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
