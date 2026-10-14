// Fetch candidate phoneme recordings + license metadata from Wikimedia Commons.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const OUT = 'tools/audition/candidates';
const API = 'https://commons.wikimedia.org/w/api.php';
const HEADERS = { 'User-Agent': 'SoundSprouts/0.1 (personal non-commercial phonics app)' };
export const COMMONS_CANDIDATES = Object.freeze({
  s: ['Voiceless_alveolar_sibilant.ogg'],
  a: ['Near-open_front_unrounded_vowel.ogg'],
  t: ['Voiceless_alveolar_plosive.ogg'],
  p: ['Voiceless_bilabial_plosive.ogg'],
  i: ['Near-close_near-front_unrounded_vowel.ogg'],
  n: ['Alveolar_nasal.ogg'],
});

async function fileInfo(title) {
  const url = `${API}?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&titles=${encodeURIComponent(`File:${title}`)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Commons lookup failed for ${title}: HTTP ${res.status}`);
  const page = Object.values((await res.json()).query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) throw new Error(`No file info for ${title}`);
  const meta = info.extmetadata ?? {};
  const strip = (html) => String(html ?? 'unknown').replace(/<[^>]+>/g, '').trim();
  return { url: info.url, page: info.descriptionurl, license: strip(meta.LicenseShortName?.value), artist: strip(meta.Artist?.value) };
}

function toMp3(input, output) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-ac', '1', '-b:a', '64k', output]);
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${input}: ${r.stderr}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const results = [];
  for (const [letter, titles] of Object.entries(COMMONS_CANDIDATES)) {
    for (const [index, title] of titles.entries()) {
      const info = await fileInfo(title);
      const res = await fetch(info.url, { headers: HEADERS });
      if (!res.ok) throw new Error(`Download failed for ${title}: HTTP ${res.status}`);
      const base = `${OUT}/${letter}-commons-${index}`;
      writeFileSync(`${base}.ogg`, Buffer.from(await res.arrayBuffer()));
      toMp3(`${base}.ogg`, `${base}.mp3`);
      results.push({ letter, file: `${base}.mp3`, source: 'Wikimedia Commons', ...info });
    }
  }
  writeFileSync(`${OUT}/commons.json`, JSON.stringify(results, null, 2));
  process.stdout.write(`Fetched ${results.length} candidates into ${OUT}\n`);
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exit(1); });
