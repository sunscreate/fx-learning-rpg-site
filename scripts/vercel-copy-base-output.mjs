import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "fx-learning-rpg-site";
const distDir = path.join(ROOT, "dist");
const baseDir = path.join(distDir, BASE);

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

await rm(baseDir, { recursive: true, force: true });
await mkdir(baseDir, { recursive: true });

const entries = [
  "404.html",
  "_astro",
  "category",
  "fx-broker-checklist",
  "level",
  "search",
  "sitemap.xml",
  "tag",
  "index.html",
];

for (const entry of entries) {
  await cp(path.join(distDir, entry), path.join(baseDir, entry), {
    recursive: true,
    force: true,
  });
}

console.log(`Created Vercel base-path copy at dist/${BASE}/`);
