// Builds tools/audition/index.html listing every candidate clip so the parent can listen and choose.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = 'tools/audition';
const files = readdirSync(`${DIR}/candidates`).filter((f) => f.endsWith('.mp3')).sort();
const commons = existsSync(`${DIR}/candidates/commons.json`) ? JSON.parse(readFileSync(`${DIR}/candidates/commons.json`, 'utf8')) : [];
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const credit = (file) => {
  const hit = commons.find((c) => file.startsWith(`${c.letter}-commons`));
  return hit ? `${escape(hit.license)} — ${escape(hit.artist)}` : 'Piper TTS, LJSpeech voice (public domain)';
};
const rows = files.map((f) => `<tr><td><b>${escape(f.split('-')[0])}</b></td><td>${escape(f.replace('.mp3', ''))}</td><td><audio controls preload="none" src="candidates/${escape(f)}"></audio></td><td>${credit(f)}</td></tr>`).join('\n');
const pictures = readdirSync('assets/img').filter((f) => f.endsWith('.svg')).sort()
  .map((f) => `<figure style="margin:0;text-align:center"><img src="../../assets/img/${escape(f)}" width="96" height="96" alt=""><figcaption>${escape(f.replace('.svg', ''))}</figcaption></figure>`).join('');
const SAMPLE_CLIPS = ['prompt/which_starts_with', 'prompt/find_the_letter', 'prompt/tap_each_letter', 'prompt/great_job_3', 'letter/a', 'word/sip', 'word/nap', 'word/tin'];
const samples = SAMPLE_CLIPS.filter((c) => existsSync(`assets/audio/${c}.mp3`))
  .map((c) => `<tr><td>${escape(c)}</td><td><audio controls preload="none" src="../../assets/audio/${escape(c)}.mp3"></audio></td></tr>`).join('\n');
writeFileSync(`${DIR}/index.html`, `<!doctype html><meta charset="utf-8"><title>Sound Sprouts audition</title>
<style>body{font-family:system-ui;margin:24px}td{padding:8px;border-bottom:1px solid #ddd}</style>
<h1>Phoneme audition</h1><p>Pick the clip that sounds like the pure sound a teacher would say (no "uh" after t or p).</p>
<table>${rows}</table>
<h2>Pictures (should be obvious to a 4-year-old)</h2>
<div style="display:flex;flex-wrap:wrap;gap:16px">${pictures}</div>
<h2>Sample prompts and words (Piper voice)</h2>
<table>${samples}</table>`);
process.stdout.write(`Wrote ${DIR}/index.html with ${files.length} clips\n`);
