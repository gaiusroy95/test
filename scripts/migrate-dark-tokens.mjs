/**
 * One-off migration: replace hardcoded light-theme Tailwind colors with semantic tokens.
 * Run: node scripts/migrate-dark-tokens.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "src");

const SKIP_FILES = new Set([
  "LoginPage.tsx",
  "switch.tsx",
]);

const REPLACEMENTS = [
  [/bg-white/g, "bg-card"],
  [/bg-amber-50/g, "bg-warn-tint"],
  [/bg-emerald-50/g, "bg-ok-tint"],
  [/bg-green-100/g, "bg-ok-tint"],
  [/bg-red-50/g, "bg-destructive-tint"],
  [/bg-sky-50/g, "bg-info-tint"],
  [/bg-blue-50/g, "bg-info-tint"],
  [/bg-violet-50/g, "bg-accent"],
  [/bg-violet-100/g, "bg-accent"],
  [/text-amber-700/g, "text-warn"],
  [/text-amber-600/g, "text-warn"],
  [/text-emerald-700/g, "text-ok"],
  [/text-emerald-600/g, "text-ok"],
  [/text-green-700/g, "text-ok"],
  [/text-red-700/g, "text-destructive"],
  [/text-red-600/g, "text-destructive"],
  [/text-sky-700/g, "text-info"],
  [/text-sky-600/g, "text-info"],
  [/text-blue-600/g, "text-info"],
  [/text-violet-700/g, "text-accent-foreground"],
  [/text-violet-800/g, "text-accent-foreground"],
  [/border-amber-200/g, "border-warn/30"],
  [/border-amber-300/g, "border-warn/40"],
  [/border-emerald-200/g, "border-ok/30"],
  [/border-red-200/g, "border-destructive/30"],
  [/border-red-300/g, "border-destructive/40"],
  [/border-sky-200/g, "border-info/30"],
  [/border-violet-200/g, "border-accent-foreground/20"],
  [/hover:bg-amber-50/g, "hover:bg-warn-tint"],
  [/hover:bg-emerald-50/g, "hover:bg-ok-tint"],
  [/hover:bg-red-50/g, "hover:bg-destructive-tint"],
  [/hover:bg-sky-50/g, "hover:bg-accent"],
  [/hover:bg-white/g, "hover:bg-accent"],
];

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(tsx|ts|css)$/.test(name)) files.push(p);
  }
  return files;
}

let changed = 0;
for (const file of walk(SRC)) {
  if (SKIP_FILES.has(path.basename(file))) continue;
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.replace(from, to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    changed++;
    console.log("updated:", path.relative(SRC, file));
  }
}
console.log(`Done. ${changed} files updated.`);
