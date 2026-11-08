#!/usr/bin/env node
/*
 * Pull note pyramids and accords from Fragrantica perfume pages and write
 * js/data.extra.js, which the game merges over the built-in list.
 *
 * Usage (Node 18+, run on your own machine):
 *   node scripts/fetch-fragrantica.mjs urls.txt
 *
 * urls.txt, one bottle per line. Fragrantica pages don't state the house
 * type or the concentration reliably, so add them after the URL:
 *   https://www.fragrantica.com/perfume/Dior/Sauvage-31861.html house=D conc=EDT lon=4 sil=3 pop=5
 *   https://www.fragrantica.com/perfume/Lattafa-Perfumes/Khamrah-75805.html house=A conc=EDP
 *
 *   house: D designer, N niche, A arabian, C celebrity, I indie (default D)
 *   conc:  EDC, EDT, EDP, Parfum, Extrait (default EDP)
 *   lon 1-5, sil 1-4, pop 1-5 (default 3)
 *
 * Fragrantica sits behind Cloudflare and its terms limit automated access.
 * Keep the list short, the script waits 4 s between pages, and if a page
 * comes back as a challenge, save it from your browser (Ctrl+S) and pass the
 * .html file path instead of the URL.
 */
import { readFile, writeFile } from "node:fs/promises";

const HOUSE = { D: "Designer", N: "Niche", A: "Arabian", C: "Celebrity", I: "Indie" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, "").trim();
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function notesIn(html) {
  // Note links look like /notes/Pink-Pepper-49.html; the link text or img alt holds the name.
  const out = [];
  const re = /<a[^>]+href="[^"]*\/notes\/[^"]+"[^>]*>([\s\S]*?)<\/a>\s*([^<]*)/g;
  let m;
  while ((m = re.exec(html))) {
    const alt = /alt="([^"]+)"/.exec(m[1]);
    const name = decode(alt ? alt[1] : m[2] || m[1]).toLowerCase();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

function parse(html, opts) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const heading = h1 ? decode(h1[1]) : "";
  const brand = decode((/itemprop="brand"[\s\S]*?itemprop="name"[^>]*>([^<]+)</.exec(html) || [])[1] || "");
  let gender = "U";
  if (/for women and men/i.test(heading)) gender = "U";
  else if (/for women/i.test(heading)) gender = "F";
  else if (/for men/i.test(heading)) gender = "M";
  const name = heading.replace(/\s+for (women and men|women|men)\s*$/i, "").replace(new RegExp("\\s+" + brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "").trim();
  const year = Number((/launched in (\d{4})/i.exec(html) || [])[1]) || null;

  const accords = [];
  const ar = /class="accord-bar"[^>]*>([^<]+)</g;
  let m;
  while ((m = ar.exec(html))) accords.push(title(decode(m[1])));

  // Split the pyramid on its headings.
  const tiers = { top: [], heart: [], base: [] };
  const idx = (label) => html.search(new RegExp(">\\s*" + label + "\\s*<", "i"));
  const t = idx("Top Notes"), mi = idx("Middle Notes"), b = idx("Base Notes");
  if (t >= 0 && mi > t) tiers.top = notesIn(html.slice(t, mi));
  if (mi >= 0 && b > mi) tiers.heart = notesIn(html.slice(mi, b));
  if (b >= 0) tiers.base = notesIn(html.slice(b, b + 20000).split(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/)[0]);
  if (t < 0 && mi < 0 && b < 0) {
    // Single-layer pyramid ("Fragrance Notes").
    const f = idx("Fragrance Notes");
    if (f >= 0) tiers.heart = notesIn(html.slice(f, f + 20000));
  }

  const n = (k, d) => (opts[k] ? Number(opts[k]) : d);
  return {
    id: (brand + "-" + name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name, brand, house: HOUSE[opts.house || "D"], country: opts.country || "", gender: { M: "Masculine", F: "Feminine", U: "Unisex" }[gender],
    year, conc: opts.conc || "EDP", family: accords[0] || "Woody", accords: accords.slice(0, 5),
    ...tiers, longevity: n("lon", 3), sillage: n("sil", 3), popularity: n("pop", 3),
  };
}

async function load(src) {
  if (!/^https?:/.test(src)) return readFile(src, "utf8");
  const res = await fetch(src, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const html = await res.text();
  if (/cf-challenge|Just a moment/i.test(html)) throw new Error("Cloudflare challenge; save the page from your browser and pass the file");
  return html;
}

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/fetch-fragrantica.mjs urls.txt"); process.exit(1); }
const lines = (await readFile(file, "utf8")).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const out = [];
for (const [i, line] of lines.entries()) {
  const [src, ...rest] = line.split(/\s+/);
  const opts = Object.fromEntries(rest.map((kv) => kv.split("=")));
  try {
    const f = parse(await load(src), opts);
    if (!f.top.length && !f.heart.length && !f.base.length) throw new Error("no notes found; page layout may have changed");
    out.push(f);
    console.error("ok   " + f.brand + " " + f.name + " (" + (f.top.length + f.heart.length + f.base.length) + " notes)");
  } catch (e) {
    console.error("fail " + src + ": " + e.message);
  }
  if (i < lines.length - 1 && /^https?:/.test(src)) await sleep(4000);
}
const target = new URL("../js/data.extra.js", import.meta.url);
await writeFile(target, "/* Generated by scripts/fetch-fragrantica.mjs */\nwindow.mergeExtraFragrances && window.mergeExtraFragrances(" + JSON.stringify(out, null, 1) + ");\n");
console.error("wrote " + out.length + " bottles to js/data.extra.js");
