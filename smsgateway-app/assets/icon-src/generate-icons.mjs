// Rasterizes the source SVGs into the PNGs Expo expects.
// Run: node assets/icon-src/generate-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..");

const jobs = [
  { src: "icon.svg", out: "icon.png", size: 1024 },
  { src: "adaptive-icon.svg", out: "adaptive-icon.png", size: 1024 },
  { src: "adaptive-icon.svg", out: "splash-icon.png", size: 1024 },
  { src: "icon.svg", out: "favicon.png", size: 48 },
];

for (const j of jobs) {
  await sharp(join(here, j.src), { density: 384 })
    .resize(j.size, j.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(assets, j.out));
  console.log(`✓ ${j.out} (${j.size}px)`);
}
console.log("done");
