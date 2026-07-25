/**
 * Loss-aware JPEG recompression + sensible max dimensions for web display.
 * Run from repo root: node scripts/optimize-media.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mediaRoot = path.join(root, "media");

function ruleFor(relPath) {
  const p = relPath.replace(/\\/g, "/");
  if (p.includes("/gallery/")) return { maxWidth: 1920, quality: 82 };
  if (p.includes("/services/cards/")) return { maxWidth: 960, quality: 82 };
  if (p.endsWith("og-gupt-navratri.jpg")) return { og: true, quality: 85 };
  if (p.includes("/site/hero_background")) return { maxWidth: 1920, quality: 82 };
  if (p.includes("/site/")) return { maxWidth: 1400, quality: 82 };
  if (/^media\/[^/]+\.(jpe?g)$/i.test(p)) {
    return { maxWidth: 480, quality: 84 };
  }
  if (p.includes("/services/") && !p.includes("/cards/")) return { maxWidth: 1200, quality: 82 };
  return { maxWidth: 1600, quality: 82 };
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, acc);
    else if (/\.(jpe?g)$/i.test(name.name)) acc.push(full);
  }
  return acc;
}

async function optimizeFile(absPath) {
  const rel = path.relative(root, absPath);
  const rule = ruleFor(rel);
  const before = fs.statSync(absPath).size;
  const input = sharp(absPath, { failOn: "none" }).rotate();

  let pipeline = input;
  if (rule.og) {
    pipeline = pipeline.resize(1200, 630, { fit: "cover", position: "centre" });
  } else if (rule.maxWidth) {
    pipeline = pipeline.resize({
      width: rule.maxWidth,
      withoutEnlargement: true
    });
  }

  const buffer = await pipeline
    .jpeg({ quality: rule.quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();

  if (buffer.length >= before) {
    return { rel, before, after: before, skipped: true };
  }

  fs.writeFileSync(absPath, buffer);
  return { rel, before, after: buffer.length, skipped: false };
}

const files = walk(mediaRoot);
let saved = 0;
for (const file of files) {
  const result = await optimizeFile(file);
  saved += result.before - result.after;
  const tag = result.skipped ? "keep" : "ok";
  console.log(
    `[${tag}] ${result.rel}: ${(result.before / 1024).toFixed(1)} → ${(result.after / 1024).toFixed(1)} KB`
  );
}
console.log(`\nSaved ${(saved / 1024 / 1024).toFixed(2)} MB across ${files.length} images.`);
