// Writes docs/legal/*.md from the in-app texts (assets/web/js/legal.js), so both stay identical.
// Usage: node scripts/export-legal.js
global.window = {};
const L = require("../app/src/main/assets/web/js/legal.js");
const fs = require("fs"), path = require("path");
const md = html => html.replace(/<br>/g, "  \n").replace(/<[^>]+>/g, "");
for (const [id, d] of Object.entries(L.DOCS)) {
  const body = [`# ${d.title}`, "", md(d.intro), "", ...d.sections.flatMap(([h, t]) => [`## ${h}`, "", md(t), ""]),
    "---", "", "_Draft prepared from how the app works. Not legal advice: have it reviewed by a lawyer before publishing._", ""].join("\n");
  fs.writeFileSync(path.join(__dirname, "../docs/legal", `${id}.md`), body);
  console.log("wrote", id);
}
