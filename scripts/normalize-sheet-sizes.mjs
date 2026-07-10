/**
 * Normalize SheetContent max-w-* overrides to size="default|wide|xl".
 * Run: node scripts/normalize-sheet-sizes.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "src");

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (/\.tsx$/.test(name)) files.push(p);
  }
  return files;
}

/** Map pixel/tailwind widths → size token */
function sizeFor(maxClass) {
  const n = maxClass.match(/max-w-\[(\d+)px\]/);
  if (n) {
    const px = Number(n[1]);
    if (px <= 600) return "default";
    if (px <= 800) return "wide";
    return "xl";
  }
  if (/max-w-(md|lg|xl)\b/.test(maxClass) || maxClass === "max-w-sm") return "default";
  if (/max-w-2xl\b/.test(maxClass)) return "wide";
  if (/max-w-(3xl|4xl|5xl|6xl|7xl)\b/.test(maxClass)) return "xl";
  return "default";
}

const RE = /<SheetContent([^>]*)>/g;

let changed = 0;
for (const file of walk(SRC)) {
  if (file.endsWith(`${path.sep}sheet.tsx`)) continue;
  let content = fs.readFileSync(file, "utf8");
  const original = content;

  content = content.replace(RE, (full, attrs) => {
    // Already has size=
    if (/\bsize=/.test(attrs)) {
      // Still strip max-w from className
      return full.replace(/className="([^"]*)"/, (_, cls) => {
        const cleaned = cls
          .replace(/\bmax-w-\[[^\]]+\]/g, "")
          .replace(/\bmax-w-(sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/g, "")
          .replace(/\bw-full\b/g, "")
          .replace(/\s+/g, " ")
          .trim();
        return cleaned ? `className="${cleaned}"` : "";
      }).replace(/\s+>/, ">").replace(/<SheetContent\s+>/, "<SheetContent>");
    }

    const classMatch = attrs.match(/className="([^"]*)"/);
    if (!classMatch) return full;

    const cls = classMatch[1];
    const maxTokens = cls.match(/max-w-\[[^\]]+\]|max-w-(?:sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)/g) || [];
    if (maxTokens.length === 0) return full;

    const size = sizeFor(maxTokens[maxTokens.length - 1]);
    let cleaned = cls;
    for (const t of maxTokens) cleaned = cleaned.replace(t, "");
    cleaned = cleaned.replace(/\bw-full\b/g, "").replace(/\s+/g, " ").trim();

    let nextAttrs = attrs.replace(/className="[^"]*"/, cleaned ? `className="${cleaned}"` : "");
    nextAttrs = nextAttrs.replace(/\s{2,}/g, " ").trim();
    const sizeAttr = size === "default" ? "" : ` size="${size}"`;
    if (nextAttrs) return `<SheetContent${sizeAttr} ${nextAttrs}>`;
    return `<SheetContent${sizeAttr}>`.replace(" >", ">");
  });

  // tidy empty className=""
  content = content.replace(/\s+className=""/g, "");
  content = content.replace(/<SheetContent\s+>/g, "<SheetContent>");

  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    changed++;
    console.log("updated:", path.relative(SRC, file));
  }
}
console.log(`Done. ${changed} files updated.`);
