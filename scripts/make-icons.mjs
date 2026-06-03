/**
 * Generates the extension PNG icons from the same lightning bolt + brand circle
 * used by the on-page floating launcher (src/ui/FloatingIcon.tsx), so the
 * toolbar/extensions icon matches it exactly.
 *
 * Run with: npm run icons
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = resolve(import.meta.dirname, "../public/icon");
const sizes = [16, 32, 48, 96, 128];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="12" fill="#0176d3"/>
  <g transform="translate(12 12) scale(0.82) translate(-12 -12)">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="#fff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
  </g>
</svg>`;

await mkdir(outDir, { recursive: true });
for (const size of sizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`${outDir}/${size}.png`);
}
console.log("Wrote", sizes.length, "icons to", outDir);
