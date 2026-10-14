// Downloads OpenMoji color SVGs (CC BY-SA 4.0) into assets/img/<word>.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { IMAGE_CODEPOINTS } from './image-map.mjs';

const BASE = process.env.OPENMOJI_BASE ?? 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/15.1.0/color/svg';

async function fetchSvg(codepoint) {
  for (const name of [codepoint, `${codepoint}-FE0F`]) {
    const res = await fetch(`${BASE}/${name}.svg`);
    if (res.ok) return res.text();
  }
  throw new Error(`OpenMoji SVG not found for ${codepoint}`);
}

async function main() {
  mkdirSync('assets/img', { recursive: true });
  for (const [id, codepoint] of Object.entries(IMAGE_CODEPOINTS)) {
    const svg = await fetchSvg(codepoint);
    if (!svg.trimStart().startsWith('<svg')) throw new Error(`Unexpected content for ${id}`);
    writeFileSync(`assets/img/${id}.svg`, svg);
  }
  process.stdout.write(`Saved ${Object.keys(IMAGE_CODEPOINTS).length} images\n`);
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exit(1); });
