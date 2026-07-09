/**
 * Token migration: replace legacy hardcoded Tailwind color classes with design tokens.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src");
const SKIP = new Set(["LoginPage.tsx"]);

const REPLACEMENTS = [
  [/text-brand-navy/g, "text-foreground"],
  [/hover:text-brand-navy/g, "hover:text-foreground"],
  [/text-brand-accent/g, "text-primary"],
  [/hover:text-brand-accent/g, "hover:text-primary"],
  [/bg-brand-accent/g, "bg-primary"],
  [/border-brand-accent/g, "border-primary"],
  [/ring-brand-accent/g, "ring-primary"],
  [/focus:ring-brand-accent/g, "focus:ring-primary"],
  [/focus:border-brand-accent/g, "focus:border-primary"],
  [/from-brand-accent/g, "from-primary"],
  [/to-brand-accent/g, "to-primary"],
  [/text-slate-700/g, "text-foreground/90"],
  [/text-slate-600/g, "text-muted-foreground"],
  [/text-slate-500/g, "text-muted-foreground"],
  [/text-slate-400/g, "text-muted-foreground"],
  [/text-slate-300/g, "text-muted-foreground/40"],
  [/bg-slate-50\/50/g, "bg-sunken/50"],
  [/bg-slate-50\/80/g, "bg-sunken/80"],
  [/bg-slate-50\/30/g, "bg-sunken/30"],
  [/bg-slate-50/g, "bg-sunken"],
  [/bg-slate-100/g, "bg-sunken"],
  [/hover:bg-slate-50/g, "hover:bg-sunken"],
  [/hover:bg-slate-100/g, "hover:bg-accent"],
  [/border-slate-50/g, "border-[hsl(var(--border-hairline))]"],
  [/border-slate-100/g, "border-[hsl(var(--border-hairline))]"],
  [/border-slate-200/g, "border-border"],
  [/divide-slate-100/g, "divide-border/60"],
  [/divide-slate-50/g, "divide-border/40"],
  [/hover:border-slate-300/g, "hover:border-border"],
  [/bg-brand-navy\/95/g, "bg-foreground/95"],
  [/bg-brand-navy/g, "bg-primary"],
  [/border-brand-navy/g, "border-primary"],
  [/text-brand-navy/g, "text-foreground"],
  [/border-l-brand-accent/g, "border-l-primary"],
  [/accent-brand-accent/g, "accent-primary"],
  [/bg-sky-50\/60/g, "bg-primary/5"],
  [/bg-slate-200/g, "bg-border"],
  [/bg-slate-300/g, "bg-border"],
  [/bg-slate-700/g, "bg-border"],
  [/text-slate-100/g, "text-muted-foreground"],
  [/text-slate-200/g, "text-border"],
  [/border-slate-300/g, "border-border"],
  [/ring-slate-300/g, "ring-border"],
  [/disabled:bg-slate-300/g, "disabled:bg-muted"],
  [/shadow-brand-accent\/20/g, "shadow-primary/20"],
  [/to-brand-teal/g, "to-teal"],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(tsx|ts)$/.test(ent.name) && !SKIP.has(ent.name)) files.push(p);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;
  for (const [from, to] of REPLACEMENTS) {
    src = src.replace(from, to);
  }
  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("updated:", path.relative(ROOT, file));
  }
}
console.log(`\nDone. ${changed} files updated.`);
