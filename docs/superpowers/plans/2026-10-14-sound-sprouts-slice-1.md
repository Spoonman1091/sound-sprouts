# Sound Sprouts — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a tablet-first, offline-capable phonics web app on GitHub Pages that teaches rhyming, the sounds s/a/t/p/i/n, CVC blending and name spelling to one 4-year-old, with a parent area.

**Architecture:** Static site with no bundler: `index.html` loads `src/main.js` as an ES module. Pure model modules (progress, curriculum, scheduler) are unit-tested in Vitest/jsdom. Activity modules render into a container and resolve `{ firstTry }`. One shared `HTMLAudioElement` plays pre-built MP3 clips. A service worker precaches everything for offline use. GitHub Actions runs tests, then deploys `_site/` to Pages.

**Tech Stack:** Vanilla JS (ES2022 modules), CSS, Vitest + jsdom + @vitest/coverage-v8, Playwright (Chromium "Galaxy Tab S4" + WebKit "iPad (gen 7)"), http-server, Piper TTS + ffmpeg (content build only), OpenMoji SVGs, Andika font (@fontsource/andika), GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-10-14-sound-sprouts-design.md`

## Global Constraints

- Project root: `/Users/spoonman/sound-sprouts`. All paths below are relative to it.
- No bundler and no runtime dependencies: everything under `src/` is plain ES modules loaded by the browser. npm packages are dev-only.
- Every asset URL is **relative** (no leading `/`), because Pages serves the app under `/sound-sprouts/`.
- Immutability: model functions return new objects and never mutate their inputs. DOM mutation inside renderers is fine.
- No `console.log` in `src/`. Errors surface to the parent dashboard instead.
- Unit coverage ≥ 80% (lines/branches/functions/statements) on `src/**` excluding `src/main.js`.
- Files stay under 400 lines; functions under 50 lines.
- Touch targets are ≥ 96 CSS px for child-facing controls and ≥ 48 px in the parent area.
- No network calls at runtime except the app's own files. No analytics. The child's name lives only in device storage, never in the repo.
- Child-facing copy is spoken; on-screen text for the child is limited to letters and words being taught.
- Commit messages: conventional commits (`feat:`, `test:`, `chore:` …). End each with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Never push to GitHub or create the remote repo without the user's explicit OK in chat** (Task 15 asks).

## Review Focus

1. **Random/rapid tapping** (during prompts, double-tapping the right answer, tapping blend tiles out of order) must not score, double-advance or skip. Pinned in Tasks 8 and 9.
2. **Audio that fails** (missing file, offline first run, autoplay blocked, iOS Range requests) must never freeze an activity, and the parent sees a warning. Pinned in Tasks 7, 8, 12 and 13.
3. **Corrupt, old-version or unavailable saved data** (bad JSON, private mode, quota) must start fresh without crashing and tell the parent. Pinned in Tasks 3, 12 and 14.
4. **Unusual names** (accents like "Zoë", hyphens, apostrophes, two words, repeated letters like "Anna", empty) must validate sensibly and be spellable. Pinned in Tasks 3 and 9.
5. **Interrupted sessions** (screen locks, app switch, tab closed mid-session) must stop audio, and every completed item must already be saved. Pinned in Tasks 10 and 11.

---

## File Map

```
index.html                 app shell
credits.html               attributions
manifest.webmanifest       PWA manifest
sw.js                      service worker (cache-first + Range support)
precache.js                GENERATED list of files + version hash
styles/app.css             all styles
src/
  config.js                tunable constants (CONFIG)
  main.js                  wiring/router (E2E-covered only)
  ui/dom.js                el() element helper
  ui/long-press.js         press-and-hold detection
  state/progress.js        pure progress model
  state/storage.js         validated load/save + memory fallback
  state/name.js            child-name validation + name letters
  curriculum/units.js      letters, words, rhyme sets, blend words
  curriculum/random.js     shuffle/pick with injectable rng
  curriculum/unlock.js     unlockedLetters, letterStatus
  curriculum/tasks.js      buildTask(itemId) → concrete task
  curriculum/scheduler.js  planSession and helpers
  audio/clips.js           clip/image path helpers, PROMPT_IDS
  audio/player.js          single-element audio player + speech
  audio/visibility.js      stop audio when app is hidden
  activities/pick-one.js   choose-the-right-picture/letter
  activities/blend.js      tap sounds → hop → pick picture
  activities/name-spell.js tap name letters in order
  activities/index.js      ACTIVITIES registry
  screens/garden.js        garden view
  screens/home.js          home screen
  screens/session.js       session runner
  screens/done.js          end-of-session celebration
  parent/gate.js           grown-ups arithmetic gate
  parent/report.js         pure reporting helpers
  parent/dashboard.js      parent dashboard
  parent/minibook.js       printable mini-book
assets/audio/{phoneme,letter,word,prompt}/*.mp3
assets/img/*.svg           OpenMoji
assets/icons/*.png         PWA icons
assets/fonts/*.woff2       Andika
tools/                     content + build scripts (Node, dev only)
tests/unit/*.test.js       Vitest
tests/e2e/*.spec.js        Playwright
.github/workflows/deploy.yml
```

---

### Task 1: Project scaffold and test tooling

**Files:**
- Create: `package.json`, `.gitignore`, `vitest.config.js`, `index.html`, `src/config.js`, `src/ui/dom.js`, `src/main.js` (temporary shell, replaced in Task 11)
- Test: `tests/unit/dom.test.js`, `tests/helpers.js`

**Interfaces:**
- Produces: `CONFIG` (frozen object, keys below); `el(tag, props = {}, children = []) → HTMLElement` where `props.class` sets className, `props.dataset` sets data-*, `on<Event>` props add listeners, and every other prop is `setAttribute`. Test helpers: `seededRng(seed) → () => number`, `fakePlayer(overrides) → player`, `flush() → Promise`.

- [ ] **Step 1: Initialise the repo and install dev dependencies**

```bash
cd ~/sound-sprouts
git init -b main
npm init -y
npm pkg set type=module private=true --json
npm pkg delete main
npm pkg set scripts.test="vitest run --coverage" scripts.test:watch="vitest" scripts.e2e="playwright test" scripts.serve="http-server . -p 4173 -c-1"
npm install -D vitest @vitest/coverage-v8 jsdom @playwright/test http-server @fontsource/andika
```

`.gitignore`:

```
node_modules/
coverage/
_site/
test-results/
playwright-report/
.venv-audio/
voices/
tools/audition/candidates/
.DS_Store
```

- [ ] **Step 2: Write `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/main.js'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

- [ ] **Step 3: Write `src/config.js`**

```js
export const CONFIG = Object.freeze({
  STORAGE_KEY: 'sound-sprouts:v1',
  SCHEMA_VERSION: 1,
  SESSION_LENGTH: 8,
  FOCUS_ITEMS: 4,
  MAX_RHYMES_PER_SESSION: 2,
  LETTER_CHOICES: 3,
  MIN_UNLOCKED_LETTERS: 2,
  MASTERY_STREAK: 3,
  MASTERY_MIN_SESSIONS: 2,
  STRUGGLE_WINDOW: 4,
  STRUGGLE_MISSES: 2,
  ATTEMPT_HISTORY: 8,
  SESSION_HISTORY: 90,
  AUDIO_TIMEOUT_MS: 6000,
  PARENT_HOLD_MS: 2000,
  NAME_MAX_LENGTH: 20,
  DAY_MS: 86_400_000,
});
```

- [ ] **Step 4: Write test helpers `tests/helpers.js`**

```js
import { vi } from 'vitest';

// mulberry32: deterministic rng for repeatable tests
export function seededRng(seed = 1) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fakePlayer(overrides = {}) {
  return {
    play: vi.fn(async () => ({ ok: true })),
    playSequence: vi.fn(async () => ({ ok: true })),
    say: vi.fn(async () => ({ ok: true })),
    stop: vi.fn(),
    ...overrides,
  };
}

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
```

- [ ] **Step 5: Write the failing test `tests/unit/dom.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { el } from '../../src/ui/dom.js';

describe('el', () => {
  it('creates an element with class, attributes, dataset and children', () => {
    const node = el('button', { class: 'choice', 'aria-label': 'sun', dataset: { choiceId: 'sun' } }, ['hi', el('span')]);
    expect(node.tagName).toBe('BUTTON');
    expect(node.className).toBe('choice');
    expect(node.getAttribute('aria-label')).toBe('sun');
    expect(node.dataset.choiceId).toBe('sun');
    expect(node.textContent).toBe('hi');
    expect(node.querySelector('span')).not.toBeNull();
  });

  it('wires on* props as event listeners', () => {
    const onClick = vi.fn();
    el('button', { onClick }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('skips null and undefined children', () => {
    expect(el('div', {}, [null, 'a', undefined]).textContent).toBe('a');
  });
});
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npx vitest run tests/unit/dom.test.js`
Expected: FAIL, because `src/ui/dom.js` cannot be resolved.

- [ ] **Step 7: Implement `src/ui/dom.js`**

```js
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.entries(value).forEach(([k, v]) => { node.dataset[k] = v; });
    else if (/^on[A-Z]/.test(key)) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  });
  children.filter((child) => child !== null && child !== undefined).forEach((child) => node.append(child));
  return node;
}
```

- [ ] **Step 8: Write the app shell `index.html` and temporary `src/main.js`**

`index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <title>Sound Sprouts</title>
  <meta name="description" content="A free phonics garden for young readers.">
  <meta name="theme-color" content="#7cc47f">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="assets/icons/icon-180.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Sprouts">
  <link rel="stylesheet" href="styles/app.css">
  <script type="module" src="src/main.js"></script>
</head>
<body>
  <div id="app" class="app"></div>
  <div id="print" class="print-only" aria-hidden="true"></div>
  <noscript>Sound Sprouts needs JavaScript turned on.</noscript>
</body>
</html>
```

`src/main.js` (temporary; fully replaced in Task 11):

```js
import { el } from './ui/dom.js';

document.getElementById('app').replaceChildren(el('h1', {}, ['Sound Sprouts']));
```

- [ ] **Step 9: Run tests; confirm they pass**

Run: `npm test`
Expected: 3 tests pass, and coverage meets the thresholds (only `dom.js` is covered).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Sound Sprouts with vitest and app shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Audio sourcing spike (USER CHECKPOINT)

This is exploratory. The deliverable is six approved phoneme clips (`assets/audio/phoneme/{s,a,t,p,i,n}.mp3`), a chosen Piper voice whose license permits redistribution, and the exact Piper CLI invocation, all recorded in `assets/audio/SOURCES.md`.

**Files:**
- Create: `tools/fetch-phoneme-candidates.mjs`, `tools/make-audition.mjs`, `tools/audition/index.html` (generated, committed), `assets/audio/phoneme/*.mp3`, `assets/audio/SOURCES.md`

**Interfaces:**
- Produces: `assets/audio/phoneme/<letter>.mp3` for every letter in `['s','a','t','p','i','n']`. `assets/audio/SOURCES.md` records, per clip: source URL, author, license. It also records `PIPER_VOICE=<name>` and the exact working `piper` command line, which Task 6 relies on.

- [ ] **Step 1: Install the audio toolchain**

```bash
brew install ffmpeg
python3 -m venv .venv-audio
.venv-audio/bin/pip install piper-tts
.venv-audio/bin/piper --help
```

Record the flags `--help` shows for model, data dir, output file, speed (`--length-scale`) and raw phoneme input. Piper ≥1.3 accepts `[[ phonemes ]]` inline. Confirm this against `--help` or the README.

- [ ] **Step 2: Download candidate voices and check their licenses**

```bash
mkdir -p voices
.venv-audio/bin/python -m piper.download_voices --data-dir voices en_US-ljspeech-high en_US-lessac-medium en_US-amy-medium
ls voices
```

For each voice, open its `MODEL_CARD` (downloaded beside the `.onnx`, or on the voice's Hugging Face page under `rhasspy/piper-voices`). Note the **dataset license**. Keep only voices that allow redistribution (LJSpeech is public domain; check the others). Generate a test sentence with each acceptable voice:

```bash
.venv-audio/bin/piper -m en_US-ljspeech-high --data-dir voices -f /tmp/ss-test.wav -- "Which one starts with... Great job!"
afplay /tmp/ss-test.wav
```

- [ ] **Step 3: Write `tools/fetch-phoneme-candidates.mjs`**

```js
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
```

Run: `node tools/fetch-phoneme-candidates.mjs`
Expected: `Fetched 6 candidates …`. If a title 404s, search Commons for "IPA <sound name>.ogg" and update `COMMONS_CANDIDATES`.

- [ ] **Step 4: Generate Piper phoneme candidates**

Create two candidates per letter using the voice chosen in Step 2. Use raw phonemes (`[[ … ]]`), stretching continuants and keeping stops short and unvoiced (no "uh"):

```bash
P=".venv-audio/bin/piper -m en_US-ljspeech-high --data-dir voices"
D=tools/audition/candidates
$P -f $D/s-piper-0.wav -- "[[ sːːː ]]";   $P -f $D/s-piper-1.wav -- "sss"
$P -f $D/a-piper-0.wav -- "[[ æː ]]";     $P -f $D/a-piper-1.wav -- "a, as in apple"
$P -f $D/t-piper-0.wav -- "[[ tʰ ]]";     $P -f $D/t-piper-1.wav -- "[[ t ]]"
$P -f $D/p-piper-0.wav -- "[[ pʰ ]]";     $P -f $D/p-piper-1.wav -- "[[ p ]]"
$P -f $D/i-piper-0.wav -- "[[ ɪː ]]";     $P -f $D/i-piper-1.wav -- "i, as in igloo"
$P -f $D/n-piper-0.wav -- "[[ nːːː ]]";   $P -f $D/n-piper-1.wav -- "nnn"
for f in $D/*-piper-*.wav; do ffmpeg -y -loglevel error -i "$f" -ac 1 -b:a 64k "${f%.wav}.mp3"; done
```

If the `[[ ]]` syntax is not supported, note that in SOURCES.md and keep only the plain-text candidates.

- [ ] **Step 5: Write `tools/make-audition.mjs` and generate the audition page**

```js
// Builds tools/audition/index.html listing every candidate clip so the parent can listen and choose.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = 'tools/audition';
const files = readdirSync(`${DIR}/candidates`).filter((f) => f.endsWith('.mp3')).sort();
const commons = existsSync(`${DIR}/candidates/commons.json`) ? JSON.parse(readFileSync(`${DIR}/candidates/commons.json`, 'utf8')) : [];
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const credit = (file) => {
  const hit = commons.find((c) => c.file.endsWith(file));
  return hit ? `${escape(hit.license)} — ${escape(hit.artist)}` : 'Piper TTS (see voice license)';
};
const rows = files.map((f) => `<tr><td><b>${escape(f.split('-')[0])}</b></td><td>${escape(f)}</td><td><audio controls preload="none" src="candidates/${escape(f)}"></audio></td><td>${credit(f)}</td></tr>`).join('\n');
writeFileSync(`${DIR}/index.html`, `<!doctype html><meta charset="utf-8"><title>Sound Sprouts audition</title>
<style>body{font-family:system-ui;margin:24px}td{padding:8px;border-bottom:1px solid #ddd}</style>
<h1>Phoneme audition</h1><p>Pick the clip that sounds like the pure sound a teacher would say (no "uh" after t or p).</p>
<table>${rows}</table>`);
process.stdout.write(`Wrote ${DIR}/index.html with ${files.length} clips\n`);
```

Run: `node tools/make-audition.mjs && open tools/audition/index.html`

- [ ] **Step 6: USER CHECKPOINT. Stop and ask the user to listen**

Message the user: "The audition page is open. For each sound (s, a, t, p, i, n), which clip number sounds right, or should we record that one ourselves?" **Wait for their answer.** If no candidate is acceptable for a sound, offer to build a small recorder page in a later task, or to try another Piper voice. Do not continue until each of the six letters has an approved clip.

- [ ] **Step 7: Install the approved clips, trimmed and loudness-normalised**

For each approved candidate (example for `s`):

```bash
mkdir -p assets/audio/phoneme
ffmpeg -y -loglevel error -i tools/audition/candidates/s-commons-0.mp3 \
  -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16" \
  -ac 1 -ar 44100 -b:a 64k assets/audio/phoneme/s.mp3
afplay assets/audio/phoneme/s.mp3
```

If a Commons file contains several repetitions, add `-t <seconds>` after `-i` to keep the first one. Check by ear.

- [ ] **Step 8: Write `assets/audio/SOURCES.md`**

Record one line per phoneme: `s.mp3 — <source URL> — <author> — <license>`. Add the chosen `PIPER_VOICE=<name>`, its dataset license and model card URL, and the exact working command template, e.g. `.venv-audio/bin/piper -m <voice> --data-dir voices --length-scale 1.15 -f <out.wav> -- "<text>"`.

- [ ] **Step 9: Commit**

```bash
git add tools/fetch-phoneme-candidates.mjs tools/make-audition.mjs tools/audition/index.html assets/audio/phoneme assets/audio/SOURCES.md
git commit -m "feat: add approved phoneme clips and audio sourcing tools

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Progress model, storage and child name

**Files:**
- Create: `src/state/progress.js`, `src/state/storage.js`, `src/state/name.js`
- Test: `tests/unit/progress.test.js`, `tests/unit/storage.test.js`, `tests/unit/name.test.js`

**Interfaces:**
- Consumes: `CONFIG`.
- Produces:
  - `Progress = { version: 1, childName: string, items: { [itemId]: { attempts: Attempt[], masteredAt: number|null } }, sessions: Session[] }`
  - `Attempt = { firstTry: boolean, sessionId: string, at: number }`; `Session = { sessionId: string, at: number, itemCount: number }`
  - `createProgress() → Progress`
  - `recordAttempt(progress, { itemId, firstTry, sessionId, at }) → Progress`
  - `recordSession(progress, { sessionId, at, itemCount }) → Progress`
  - `isMastered(progress, itemId) → boolean` (sticky), `isStruggling(progress, itemId) → boolean`, `lastSeen(progress, itemId) → number` (0 if never)
  - `setChildName(progress, name) → Progress`
  - `loadProgress(storage) → { progress, status: 'fresh'|'loaded'|'reset'|'unavailable' }`, `saveProgress(storage, progress) → boolean`, `createMemoryStorage() → Storage-like`
  - `validateChildName(input) → { ok: true, value } | { ok: false, error }`
  - `nameLetters(name) → Array<{ display: string, key: string }>` (first word only; letters only; `key` is lower-case with accents removed)

- [ ] **Step 1: Write the failing test `tests/unit/progress.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import {
  createProgress, recordAttempt, recordSession, isMastered, isStruggling, lastSeen, setChildName,
} from '../../src/state/progress.js';

const attempt = (p, itemId, firstTry, sessionId, at) => recordAttempt(p, { itemId, firstTry, sessionId, at });

describe('recordAttempt', () => {
  it('appends without mutating the original', () => {
    const before = createProgress();
    const after = attempt(before, 'ls:s', true, 's1', 10);
    expect(before.items).toEqual({});
    expect(after.items['ls:s'].attempts).toEqual([{ firstTry: true, sessionId: 's1', at: 10 }]);
  });

  it('keeps only the last ATTEMPT_HISTORY attempts', () => {
    const p = Array.from({ length: CONFIG.ATTEMPT_HISTORY + 3 }, (_, i) => i)
      .reduce((acc, i) => attempt(acc, 'ls:s', false, 's1', i), createProgress());
    expect(p.items['ls:s'].attempts).toHaveLength(CONFIG.ATTEMPT_HISTORY);
    expect(p.items['ls:s'].attempts[0].at).toBe(3);
  });
});

describe('mastery', () => {
  it('needs MASTERY_STREAK first-try successes across two sessions', () => {
    let p = attempt(createProgress(), 'ls:s', true, 's1', 1);
    p = attempt(p, 'ls:s', true, 's1', 2);
    expect(isMastered(p, 'ls:s')).toBe(false);
    p = attempt(p, 'ls:s', true, 's2', 3);
    expect(isMastered(p, 'ls:s')).toBe(true);
    expect(p.items['ls:s'].masteredAt).toBe(3);
  });

  it('does not master when all successes are in one session', () => {
    const p = [1, 2, 3].reduce((acc, at) => attempt(acc, 'ls:s', true, 's1', at), createProgress());
    expect(isMastered(p, 'ls:s')).toBe(false);
  });

  it('does not master when a miss is inside the streak', () => {
    let p = attempt(createProgress(), 'ls:s', true, 's1', 1);
    p = attempt(p, 'ls:s', false, 's2', 2);
    p = attempt(p, 'ls:s', true, 's2', 3);
    expect(isMastered(p, 'ls:s')).toBe(false);
  });

  it('stays mastered after a later miss', () => {
    let p = [['s1', 1], ['s1', 2], ['s2', 3]].reduce((acc, [s, at]) => attempt(acc, 'ls:s', true, s, at), createProgress());
    p = attempt(p, 'ls:s', false, 's3', 4);
    expect(isMastered(p, 'ls:s')).toBe(true);
  });

  it('is false for unknown items', () => {
    expect(isMastered(createProgress(), 'nope')).toBe(false);
  });
});

describe('isStruggling', () => {
  it('is true with STRUGGLE_MISSES misses in the last STRUGGLE_WINDOW', () => {
    let p = attempt(createProgress(), 'fs:a', false, 's1', 1);
    expect(isStruggling(p, 'fs:a')).toBe(false);
    p = attempt(p, 'fs:a', false, 's1', 2);
    expect(isStruggling(p, 'fs:a')).toBe(true);
  });

  it('is false for unknown items', () => {
    expect(isStruggling(createProgress(), 'nope')).toBe(false);
  });
});

describe('lastSeen, recordSession, setChildName', () => {
  it('lastSeen returns the latest attempt time or 0', () => {
    const p = attempt(attempt(createProgress(), 'x', true, 's1', 5), 'x', true, 's1', 9);
    expect(lastSeen(p, 'x')).toBe(9);
    expect(lastSeen(p, 'y')).toBe(0);
  });

  it('recordSession keeps the last SESSION_HISTORY sessions immutably', () => {
    const before = createProgress();
    const p = Array.from({ length: CONFIG.SESSION_HISTORY + 1 }, (_, i) => i)
      .reduce((acc, i) => recordSession(acc, { sessionId: `s${i}`, at: i, itemCount: 8 }), before);
    expect(before.sessions).toEqual([]);
    expect(p.sessions).toHaveLength(CONFIG.SESSION_HISTORY);
    expect(p.sessions[0].sessionId).toBe('s1');
  });

  it('setChildName returns a new progress', () => {
    const before = createProgress();
    expect(setChildName(before, 'Ava').childName).toBe('Ava');
    expect(before.childName).toBe('');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/progress.test.js`
Expected: FAIL, because the module was not found.

- [ ] **Step 3: Implement `src/state/progress.js`**

```js
import { CONFIG } from '../config.js';

export function createProgress() {
  return { version: CONFIG.SCHEMA_VERSION, childName: '', items: {}, sessions: [] };
}

const attemptsOf = (progress, itemId) => progress.items[itemId]?.attempts ?? [];

function meetsMastery(attempts) {
  const recent = attempts.slice(-CONFIG.MASTERY_STREAK);
  if (recent.length < CONFIG.MASTERY_STREAK) return false;
  const sessions = new Set(recent.map((a) => a.sessionId));
  return recent.every((a) => a.firstTry) && sessions.size >= CONFIG.MASTERY_MIN_SESSIONS;
}

export function recordAttempt(progress, { itemId, firstTry, sessionId, at }) {
  const previous = progress.items[itemId] ?? { attempts: [], masteredAt: null };
  const attempts = [...previous.attempts, { firstTry, sessionId, at }].slice(-CONFIG.ATTEMPT_HISTORY);
  const masteredAt = previous.masteredAt ?? (meetsMastery(attempts) ? at : null);
  return { ...progress, items: { ...progress.items, [itemId]: { attempts, masteredAt } } };
}

export function recordSession(progress, { sessionId, at, itemCount }) {
  const sessions = [...progress.sessions, { sessionId, at, itemCount }].slice(-CONFIG.SESSION_HISTORY);
  return { ...progress, sessions };
}

export const isMastered = (progress, itemId) => Boolean(progress.items[itemId]?.masteredAt);

export function isStruggling(progress, itemId) {
  const recent = attemptsOf(progress, itemId).slice(-CONFIG.STRUGGLE_WINDOW);
  return recent.filter((a) => !a.firstTry).length >= CONFIG.STRUGGLE_MISSES;
}

export function lastSeen(progress, itemId) {
  const attempts = attemptsOf(progress, itemId);
  return attempts.length ? attempts[attempts.length - 1].at : 0;
}

export const setChildName = (progress, childName) => ({ ...progress, childName });
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run tests/unit/progress.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing test `tests/unit/storage.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import { createProgress, recordAttempt } from '../../src/state/progress.js';
import { loadProgress, saveProgress, createMemoryStorage } from '../../src/state/storage.js';

const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };

describe('storage', () => {
  it('returns fresh progress when nothing is saved', () => {
    expect(loadProgress(createMemoryStorage())).toEqual({ progress: createProgress(), status: 'fresh' });
  });

  it('round-trips saved progress', () => {
    const storage = createMemoryStorage();
    const progress = recordAttempt(createProgress(), { itemId: 'ls:s', firstTry: true, sessionId: 's1', at: 1 });
    expect(saveProgress(storage, progress)).toBe(true);
    expect(loadProgress(storage)).toEqual({ progress, status: 'loaded' });
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['an old schema version', JSON.stringify({ ...createProgress(), version: 0 })],
    ['a malformed item', JSON.stringify({ ...createProgress(), items: { x: { attempts: 'bad' } } })],
    ['a malformed session', JSON.stringify({ ...createProgress(), sessions: [{ at: 'yesterday' }] })],
    ['an over-long name', JSON.stringify({ ...createProgress(), childName: 'x'.repeat(CONFIG.NAME_MAX_LENGTH + 1) })],
    ['a non-object', '42'],
  ])('resets on %s', (_, raw) => {
    const storage = createMemoryStorage();
    storage.setItem(CONFIG.STORAGE_KEY, raw);
    expect(loadProgress(storage)).toEqual({ progress: createProgress(), status: 'reset' });
  });

  it('reports unavailable storage instead of throwing', () => {
    expect(loadProgress(throwing)).toEqual({ progress: createProgress(), status: 'unavailable' });
    expect(saveProgress(throwing, createProgress())).toBe(false);
  });
});
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npx vitest run tests/unit/storage.test.js`
Expected: FAIL, because the module was not found.

- [ ] **Step 7: Implement `src/state/storage.js`**

```js
import { CONFIG } from '../config.js';
import { createProgress } from './progress.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isAttempt = (a) => isObject(a) && typeof a.firstTry === 'boolean' && typeof a.sessionId === 'string' && Number.isFinite(a.at);
const isItem = (i) => isObject(i) && Array.isArray(i.attempts) && i.attempts.every(isAttempt)
  && (i.masteredAt === null || Number.isFinite(i.masteredAt));
const isSession = (s) => isObject(s) && typeof s.sessionId === 'string' && Number.isFinite(s.at) && Number.isFinite(s.itemCount);

function isValidProgress(data) {
  return isObject(data)
    && data.version === CONFIG.SCHEMA_VERSION
    && typeof data.childName === 'string' && data.childName.length <= CONFIG.NAME_MAX_LENGTH
    && isObject(data.items) && Object.values(data.items).every(isItem)
    && Array.isArray(data.sessions) && data.sessions.every(isSession);
}

function parse(raw) {
  try {
    const data = JSON.parse(raw);
    return isValidProgress(data) ? data : null;
  } catch {
    return null;
  }
}

export function loadProgress(storage) {
  try {
    const raw = storage.getItem(CONFIG.STORAGE_KEY);
    if (raw === null) return { progress: createProgress(), status: 'fresh' };
    const progress = parse(raw);
    return progress ? { progress, status: 'loaded' } : { progress: createProgress(), status: 'reset' };
  } catch {
    return { progress: createProgress(), status: 'unavailable' };
  }
}

export function saveProgress(storage, progress) {
  try {
    storage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}
```

- [ ] **Step 8: Run it and confirm it passes**

Run: `npx vitest run tests/unit/storage.test.js`
Expected: PASS.

- [ ] **Step 9: Write the failing test `tests/unit/name.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { validateChildName, nameLetters } from '../../src/state/name.js';

describe('validateChildName', () => {
  it.each([
    ['  Ava  ', 'Ava'],
    ['Mary   Jo', 'Mary Jo'],
    ['Zoë', 'Zoë'],
    ['Mary-Jo', 'Mary-Jo'],
    ["D'Andre", "D'Andre"],
    ['', ''],
  ])('accepts %j as %j', (input, value) => {
    expect(validateChildName(input)).toEqual({ ok: true, value });
  });

  it.each(['Ava2', '-Ava', '<b>', 'x'.repeat(21)])('rejects %j with a message', (input) => {
    const result = validateChildName(input);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/\w/);
  });

  it('treats null/undefined as empty', () => {
    expect(validateChildName(undefined)).toEqual({ ok: true, value: '' });
  });
});

describe('nameLetters', () => {
  it('uses only the first word and keeps case for display', () => {
    expect(nameLetters('Ava Rose')).toEqual([
      { display: 'A', key: 'a' }, { display: 'v', key: 'v' }, { display: 'a', key: 'a' },
    ]);
  });

  it('drops hyphens/apostrophes and strips accents from keys', () => {
    expect(nameLetters("Zoë-D'x").map((l) => l.key).join('')).toBe('zoedx');
    expect(nameLetters('Zoë')[2]).toEqual({ display: 'ë', key: 'e' });
  });

  it('returns [] for an empty name', () => {
    expect(nameLetters('')).toEqual([]);
    expect(nameLetters('   ')).toEqual([]);
  });
});
```

- [ ] **Step 10: Run it and confirm it fails**

Run: `npx vitest run tests/unit/name.test.js`
Expected: FAIL, because the module was not found.

- [ ] **Step 11: Implement `src/state/name.js`**

```js
import { CONFIG } from '../config.js';

const NAME_PATTERN = /^\p{L}[\p{L}\p{M} '\-]*$/u;

export function validateChildName(input) {
  const value = String(input ?? '').trim().replace(/\s+/g, ' ');
  if (value === '') return { ok: true, value };
  if (value.length > CONFIG.NAME_MAX_LENGTH) {
    return { ok: false, error: `Please use ${CONFIG.NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (!NAME_PATTERN.test(value)) {
    return { ok: false, error: 'Please use letters, spaces, hyphens or apostrophes, starting with a letter.' };
  }
  return { ok: true, value };
}

export function nameLetters(name) {
  const firstWord = String(name ?? '').trim().split(/\s+/)[0];
  return [...firstWord]
    .filter((ch) => /\p{L}/u.test(ch))
    .map((ch) => ({ display: ch, key: ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() }));
}
```

- [ ] **Step 12: Run all unit tests**

Run: `npm test`
Expected: all pass; coverage ≥ 80%.

- [ ] **Step 13: Commit**

```bash
git add src/state tests/unit/progress.test.js tests/unit/storage.test.js tests/unit/name.test.js
git commit -m "feat: add progress model, validated storage and child-name rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Curriculum data, clip paths and task builder

**Files:**
- Create: `src/curriculum/units.js`, `src/curriculum/random.js`, `src/curriculum/unlock.js`, `src/curriculum/tasks.js`, `src/audio/clips.js`
- Test: `tests/unit/units.test.js`, `tests/unit/random.test.js`, `tests/unit/unlock.test.js`, `tests/unit/tasks.test.js`, and add `withMastered` to `tests/helpers.js`

**Interfaces:**
- Consumes: `CONFIG`, `isMastered`, `isStruggling`, `recordAttempt`, `createProgress`, `nameLetters`.
- Produces:
  - `LETTER_ORDER`, `FIRST_SOUND_WORDS`, `RHYME_SETS`, `BLEND_WORDS`, `PICTURE_WORDS`, `CHEERS` (all frozen)
  - `shuffle(items, rng) → new array`, `pick(items, rng) → item` (throws on empty)
  - `unlockedLetters(progress) → string[]`, `letterStatus(progress, letter) → 'seed'|'sprout'|'flower'|'thirsty'`
  - `PROMPT_IDS`, `phoneme(id)`, `letterName(id)`, `word(id)`, `prompt(id)` (throws on unknown), `imgPath(id)`; all return relative paths
  - Item ids: `rhyme:<index>`, `fs:<letter>`, `ls:<letter>`, `blend:<word>`, `name`
  - `buildTask(itemId, { progress, rng }) → Task` where every Task has `{ itemId, cheer, activity }`, plus:
    - pickOne: `{ prompt: string[], choices: Choice[], focusImg?: string }`, `Choice = { id, label, img?, audio, correct }`
    - blend: `{ word, letters: string[], choices: Choice[] }`
    - nameSpell: `{ name, letters: {display,key}[], tileOrder: number[] }`

- [ ] **Step 1: Add the `withMastered` helper to `tests/helpers.js`**

```js
import { createProgress, recordAttempt } from '../src/state/progress.js';

// Master each id with 3 first-try successes across sessions m1..m3 (at = 1..3).
export function withMastered(progress = createProgress(), ids = []) {
  return ids.reduce(
    (p, itemId) => [1, 2, 3].reduce(
      (acc, n) => recordAttempt(acc, { itemId, firstTry: true, sessionId: `m${n}`, at: n }), p),
    progress,
  );
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/units.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { LETTER_ORDER, FIRST_SOUND_WORDS, RHYME_SETS, BLEND_WORDS, PICTURE_WORDS } from '../../src/curriculum/units.js';

describe('curriculum data', () => {
  it('first-sound words start with their letter', () => {
    Object.entries(FIRST_SOUND_WORDS).forEach(([letter, words]) => {
      expect(LETTER_ORDER).toContain(letter);
      words.forEach((w) => expect(w[0]).toBe(letter));
    });
  });

  it('blend words only use taught letters', () => {
    BLEND_WORDS.forEach((w) => [...w].forEach((ch) => expect(LETTER_ORDER).toContain(ch)));
  });

  it('every rhyme set has a target plus at least one rhyme, and no word is in two sets', () => {
    RHYME_SETS.forEach((set) => expect(set.length).toBeGreaterThanOrEqual(2));
    const all = RHYME_SETS.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('PICTURE_WORDS is the unique union of all pictured words', () => {
    const expected = new Set([...Object.values(FIRST_SOUND_WORDS).flat(), ...RHYME_SETS.flat(), ...BLEND_WORDS]);
    expect(new Set(PICTURE_WORDS)).toEqual(expected);
    expect(PICTURE_WORDS.length).toBe(expected.size);
  });
});
```

`tests/unit/random.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { shuffle, pick } from '../../src/curriculum/random.js';
import { seededRng } from '../helpers.js';

describe('random', () => {
  it('shuffle returns a permutation without mutating', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seededRng(7));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(input);
  });

  it('pick returns an element and throws on empty', () => {
    expect(['a', 'b']).toContain(pick(['a', 'b'], seededRng(1)));
    expect(() => pick([], seededRng(1))).toThrow(/non-empty/);
  });
});
```

`tests/unit/unlock.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createProgress, recordAttempt } from '../../src/state/progress.js';
import { unlockedLetters, letterStatus } from '../../src/curriculum/unlock.js';
import { withMastered } from '../helpers.js';

describe('unlockedLetters', () => {
  it('opens the first two letters at the start', () => {
    expect(unlockedLetters(createProgress())).toEqual(['s', 'a']);
  });

  it('opens the next letter once the previous ones are mastered', () => {
    expect(unlockedLetters(withMastered(undefined, ['ls:s', 'ls:a']))).toEqual(['s', 'a', 't']);
  });

  it('opens everything when all are mastered', () => {
    const all = ['s', 'a', 't', 'p', 'i', 'n'];
    expect(unlockedLetters(withMastered(undefined, all.map((l) => `ls:${l}`)))).toEqual(all);
  });
});

describe('letterStatus', () => {
  it('maps to seed, sprout, flower and thirsty', () => {
    const mastered = withMastered(undefined, ['ls:s']);
    expect(letterStatus(createProgress(), 'n')).toBe('seed');
    expect(letterStatus(createProgress(), 's')).toBe('sprout');
    expect(letterStatus(mastered, 's')).toBe('flower');
    const missed = [4, 5].reduce((p, at) => recordAttempt(p, { itemId: 'ls:s', firstTry: false, sessionId: 'x', at }), mastered);
    expect(letterStatus(missed, 's')).toBe('thirsty');
  });
});
```

`tests/unit/tasks.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createProgress, setChildName } from '../../src/state/progress.js';
import { buildTask } from '../../src/curriculum/tasks.js';
import { RHYME_SETS, FIRST_SOUND_WORDS, BLEND_WORDS } from '../../src/curriculum/units.js';
import { prompt, phoneme, word } from '../../src/audio/clips.js';
import { seededRng, withMastered } from '../helpers.js';

const fresh = createProgress();
const correctOf = (task) => task.choices.filter((c) => c.correct);

describe('buildTask', () => {
  it.each([1, 2, 3, 4, 5])('rhyme task (seed %i) asks about the target and offers one rhyme', (seed) => {
    const task = buildTask('rhyme:0', { progress: fresh, rng: seededRng(seed) });
    const [target, ...rhymes] = RHYME_SETS[0];
    expect(task.activity).toBe('pickOne');
    expect(task.prompt).toEqual([prompt('which_rhymes_with'), word(target)]);
    expect(task.focusImg).toBe(`assets/img/${target}.svg`);
    expect(correctOf(task)).toHaveLength(1);
    expect(rhymes).toContain(correctOf(task)[0].id);
    expect(RHYME_SETS[0]).not.toContain(task.choices.find((c) => !c.correct).id);
  });

  it('first-sound task offers a matching word and a non-matching distractor', () => {
    const task = buildTask('fs:s', { progress: fresh, rng: seededRng(3) });
    expect(task.prompt).toEqual([prompt('which_starts_with'), phoneme('s')]);
    expect(FIRST_SOUND_WORDS.s).toContain(correctOf(task)[0].id);
    expect(task.choices.find((c) => !c.correct).id[0]).not.toBe('s');
  });

  it('letter-sound task only uses unlocked letters, at most LETTER_CHOICES', () => {
    const progress = withMastered(undefined, ['ls:s', 'ls:a', 'ls:t']);
    const task = buildTask('ls:t', { progress, rng: seededRng(9) });
    expect(task.prompt).toEqual([prompt('find_the_letter'), phoneme('t')]);
    expect(task.choices).toHaveLength(3);
    task.choices.forEach((c) => expect(['s', 'a', 't', 'p']).toContain(c.label));
    expect(correctOf(task)[0].label).toBe('t');
  });

  it('letter-sound task has two choices when only two letters are open', () => {
    expect(buildTask('ls:s', { progress: fresh, rng: seededRng(1) }).choices).toHaveLength(2);
  });

  it('blend task splits the word and pictures it among two choices', () => {
    const task = buildTask('blend:pin', { progress: fresh, rng: seededRng(2) });
    expect(task).toMatchObject({ activity: 'blend', word: 'pin', letters: ['p', 'i', 'n'] });
    expect(correctOf(task)[0].id).toBe('pin');
    expect(BLEND_WORDS).toContain(task.choices.find((c) => !c.correct).id);
  });

  it('name task shuffles tile order over all name letters', () => {
    const task = buildTask('name', { progress: setChildName(fresh, 'Anna Lee'), rng: seededRng(4) });
    expect(task.activity).toBe('nameSpell');
    expect(task.name).toBe('Anna');
    expect([...task.tileOrder].sort()).toEqual([0, 1, 2, 3]);
  });

  it('every task carries a cheer clip', () => {
    expect(buildTask('ls:s', { progress: fresh, rng: seededRng(1) }).cheer).toMatch(/assets\/audio\/prompt\/great_job_\d\.mp3/);
  });

  it.each(['zzz:1', 'fs:i', 'fs:q', 'rhyme:99', 'blend:dog', 'ls:z'])('throws for unknown item %s', (id) => {
    expect(() => buildTask(id, { progress: fresh, rng: seededRng(1) })).toThrow();
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npx vitest run tests/unit/units.test.js tests/unit/random.test.js tests/unit/unlock.test.js tests/unit/tasks.test.js`
Expected: FAIL, because the modules were not found.

- [ ] **Step 4: Implement `src/curriculum/units.js`**

```js
// Letter order follows common synthetic-phonics programmes: s a t p i n first.
export const LETTER_ORDER = Object.freeze(['s', 'a', 't', 'p', 'i', 'n']);

// No reliable picturable short-/i/ word exists in OpenMoji, so 'i' has no first-sound item.
export const FIRST_SOUND_WORDS = Object.freeze({
  s: ['sun', 'sock'],
  a: ['apple', 'ant'],
  t: ['tent', 'tiger'],
  p: ['pig', 'pizza'],
  n: ['nest', 'nose'],
});

// First word is the target; the rest rhyme with it.
export const RHYME_SETS = Object.freeze([
  ['cat', 'hat', 'bat'],
  ['car', 'star'],
  ['bee', 'tree'],
  ['cake', 'snake'],
  ['mouse', 'house'],
  ['goat', 'boat'],
  ['fox', 'box'],
  ['frog', 'log'],
  ['moon', 'spoon'],
]);

export const BLEND_WORDS = Object.freeze(['pin', 'tap', 'pan', 'tin', 'sip', 'nap']);

export const PICTURE_WORDS = Object.freeze([
  ...new Set([...Object.values(FIRST_SOUND_WORDS).flat(), ...RHYME_SETS.flat(), ...BLEND_WORDS]),
]);

export const CHEERS = Object.freeze(['great_job_1', 'great_job_2', 'great_job_3']);
```

Note: `ant` appears in `FIRST_SOUND_WORDS.a`, so it is not reused as a blend word. Words like `pat`/`sat` have no clear picture, so they are left out until decodable sentences arrive.

- [ ] **Step 5: Implement `src/curriculum/random.js`**

```js
export function shuffle(items, rng = Math.random) {
  return items
    .map((item) => ({ item, key: rng() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

export function pick(items, rng = Math.random) {
  if (items.length === 0) throw new Error('pick() needs a non-empty list');
  return items[Math.floor(rng() * items.length)];
}
```

- [ ] **Step 6: Implement `src/audio/clips.js`**

```js
export const PROMPT_IDS = Object.freeze([
  'which_starts_with', 'which_rhymes_with', 'find_the_letter', 'tap_each_letter',
  'which_picture', 'spell_your_name', 'great_job_1', 'great_job_2', 'great_job_3',
  'try_again', 'all_done', 'new_flower', 'lets_play',
]);

const clipPath = (kind, id) => `assets/audio/${kind}/${id}.mp3`;

export const phoneme = (id) => clipPath('phoneme', id);
export const letterName = (id) => clipPath('letter', id);
export const word = (id) => clipPath('word', id);
export const imgPath = (id) => `assets/img/${id}.svg`;

export function prompt(id) {
  if (!PROMPT_IDS.includes(id)) throw new Error(`Unknown prompt: ${id}`);
  return clipPath('prompt', id);
}
```

- [ ] **Step 7: Implement `src/curriculum/unlock.js`**

```js
import { CONFIG } from '../config.js';
import { LETTER_ORDER } from './units.js';
import { isMastered, isStruggling } from '../state/progress.js';

export function unlockedLetters(progress) {
  const firstUnmastered = LETTER_ORDER.findIndex((l) => !isMastered(progress, `ls:${l}`));
  const masteredPrefix = firstUnmastered === -1 ? LETTER_ORDER.length : firstUnmastered;
  const count = Math.min(LETTER_ORDER.length, Math.max(CONFIG.MIN_UNLOCKED_LETTERS, masteredPrefix + 1));
  return LETTER_ORDER.slice(0, count);
}

export function letterStatus(progress, letter) {
  const id = `ls:${letter}`;
  if (isMastered(progress, id)) return isStruggling(progress, id) ? 'thirsty' : 'flower';
  return unlockedLetters(progress).includes(letter) ? 'sprout' : 'seed';
}
```

- [ ] **Step 8: Implement `src/curriculum/tasks.js`**

```js
import { CONFIG } from '../config.js';
import { LETTER_ORDER, FIRST_SOUND_WORDS, RHYME_SETS, BLEND_WORDS, CHEERS } from './units.js';
import { shuffle, pick } from './random.js';
import { unlockedLetters } from './unlock.js';
import { phoneme, word, prompt, imgPath } from '../audio/clips.js';
import { nameLetters } from '../state/name.js';

const pictureChoice = (w, correct) => ({ id: w, label: w, img: imgPath(w), audio: word(w), correct });
const letterChoice = (l, correct) => ({ id: l, label: l, audio: phoneme(l), correct });

function assertKnown(condition, itemId) {
  if (!condition) throw new Error(`Unknown item id: ${itemId}`);
}

function rhymeTask(index, rng) {
  const [target, ...rhymes] = RHYME_SETS[index];
  const others = RHYME_SETS.filter((_, i) => i !== index).flat();
  return {
    activity: 'pickOne',
    focusImg: imgPath(target),
    prompt: [prompt('which_rhymes_with'), word(target)],
    choices: shuffle([pictureChoice(pick(rhymes, rng), true), pictureChoice(pick(others, rng), false)], rng),
  };
}

function firstSoundTask(letter, rng) {
  const others = Object.entries(FIRST_SOUND_WORDS).filter(([l]) => l !== letter).flatMap(([, ws]) => ws);
  return {
    activity: 'pickOne',
    prompt: [prompt('which_starts_with'), phoneme(letter)],
    choices: shuffle([pictureChoice(pick(FIRST_SOUND_WORDS[letter], rng), true), pictureChoice(pick(others, rng), false)], rng),
  };
}

function letterSoundTask(letter, progress, rng) {
  const pool = unlockedLetters(progress).filter((l) => l !== letter);
  const distractors = shuffle(pool, rng).slice(0, CONFIG.LETTER_CHOICES - 1);
  return {
    activity: 'pickOne',
    prompt: [prompt('find_the_letter'), phoneme(letter)],
    choices: shuffle([letterChoice(letter, true), ...distractors.map((l) => letterChoice(l, false))], rng),
  };
}

function blendTask(w, rng) {
  const other = pick(BLEND_WORDS.filter((x) => x !== w), rng);
  return { activity: 'blend', word: w, letters: [...w], choices: shuffle([pictureChoice(w, true), pictureChoice(other, false)], rng) };
}

function nameTask(progress, rng) {
  const letters = nameLetters(progress.childName);
  return {
    activity: 'nameSpell',
    name: progress.childName.trim().split(/\s+/)[0],
    letters,
    tileOrder: shuffle(letters.map((_, i) => i), rng),
  };
}

export function buildTask(itemId, { progress, rng = Math.random }) {
  const [kind, arg] = itemId.split(':');
  const builders = {
    rhyme: () => { assertKnown(RHYME_SETS[Number(arg)], itemId); return rhymeTask(Number(arg), rng); },
    fs: () => { assertKnown(FIRST_SOUND_WORDS[arg], itemId); return firstSoundTask(arg, rng); },
    ls: () => { assertKnown(LETTER_ORDER.includes(arg), itemId); return letterSoundTask(arg, progress, rng); },
    blend: () => { assertKnown(BLEND_WORDS.includes(arg), itemId); return blendTask(arg, rng); },
    name: () => { assertKnown(nameLetters(progress.childName).length > 0, itemId); return nameTask(progress, rng); },
  };
  assertKnown(builders[kind], itemId);
  return { itemId, cheer: prompt(pick(CHEERS, rng)), ...builders[kind]() };
}
```

- [ ] **Step 9: Run tests; confirm they pass**

Run: `npm test`
Expected: all pass; coverage ≥ 80%.

- [ ] **Step 10: Commit**

```bash
git add src/curriculum src/audio/clips.js tests
git commit -m "feat: add curriculum data, unlock rules and task builder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Session scheduler

**Files:**
- Create: `src/curriculum/scheduler.js`
- Test: `tests/unit/scheduler.test.js`

**Interfaces:**
- Consumes: `unlockedLetters`, `isMastered`, `isStruggling`, `lastSeen`, `nameLetters`, `shuffle`, units.
- Produces: `availableItems(progress) → string[]`, `sortForReview(progress, ids) → string[]`, `interleave(a, b) → array`, `dedupeAdjacent(ids) → string[]`, `planSession(progress, rng) → string[]` (length 1..SESSION_LENGTH, no adjacent duplicates).

- [ ] **Step 1: Write the failing test `tests/unit/scheduler.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import { createProgress, setChildName, recordAttempt } from '../../src/state/progress.js';
import { availableItems, sortForReview, interleave, dedupeAdjacent, planSession } from '../../src/curriculum/scheduler.js';
import { LETTER_ORDER, FIRST_SOUND_WORDS } from '../../src/curriculum/units.js';
import { seededRng, withMastered } from '../helpers.js';

const allLetterSounds = LETTER_ORDER.map((l) => `ls:${l}`);
const allFirstSounds = Object.keys(FIRST_SOUND_WORDS).map((l) => `fs:${l}`);

describe('helpers', () => {
  it('interleave alternates and keeps leftovers', () => {
    expect(interleave([1, 2, 3], ['a'])).toEqual([1, 'a', 2, 3]);
  });

  it('dedupeAdjacent removes back-to-back repeats only', () => {
    expect(dedupeAdjacent(['a', 'a', 'b', 'a'])).toEqual(['a', 'b', 'a']);
  });

  it('sortForReview puts struggling items first, then least recently seen', () => {
    let p = withMastered(undefined, ['ls:s', 'ls:a', 'fs:s']);
    p = recordAttempt(p, { itemId: 'fs:s', firstTry: true, sessionId: 'z', at: 50 });
    p = [60, 61].reduce((acc, at) => recordAttempt(acc, { itemId: 'ls:a', firstTry: false, sessionId: 'z', at }), p);
    expect(sortForReview(p, ['fs:s', 'ls:s', 'ls:a'])).toEqual(['ls:a', 'ls:s', 'fs:s']);
  });
});

describe('availableItems', () => {
  it('starts with rhymes and the first two letters only', () => {
    const items = availableItems(createProgress());
    expect(items).toEqual(expect.arrayContaining(['rhyme:0', 'ls:s', 'fs:s', 'ls:a', 'fs:a']));
    expect(items.some((id) => id.startsWith('blend:'))).toBe(false);
    expect(items).not.toContain('ls:t');
    expect(items).not.toContain('name');
  });

  it('adds name when a spellable name is set', () => {
    expect(availableItems(setChildName(createProgress(), 'Ava'))).toContain('name');
  });

  it('adds blends only when every letter in the word is mastered', () => {
    const p = withMastered(undefined, ['ls:s', 'ls:a', 'ls:t', 'ls:p', 'ls:i', 'ls:n']);
    expect(availableItems(p)).toEqual(expect.arrayContaining(['blend:pin', 'blend:sip', 'blend:tap']));
    expect(availableItems(withMastered(undefined, ['ls:s', 'ls:a']))).not.toContain('blend:tap');
  });

  it('has no fs:i item', () => {
    expect(availableItems(withMastered(undefined, allLetterSounds))).not.toContain('fs:i');
  });
});

describe('planSession', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('fresh session (seed %i) is well-formed', (seed) => {
    const plan = planSession(createProgress(), seededRng(seed));
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThanOrEqual(CONFIG.SESSION_LENGTH);
    expect(plan[0]).toMatch(/^rhyme:/);
    expect(plan).toEqual(expect.arrayContaining(['ls:s', 'fs:s', 'ls:a', 'fs:a']));
    plan.forEach((id, i) => expect(id).not.toBe(plan[i - 1]));
  });

  it('warms up with the name when it is not mastered yet', () => {
    expect(planSession(setChildName(createProgress(), 'Ava'), seededRng(1))[0]).toBe('name');
  });

  it('focuses on the newly unlocked letter', () => {
    const plan = planSession(withMastered(undefined, ['ls:s', 'fs:s', 'ls:a', 'fs:a']), seededRng(2));
    expect(plan).toEqual(expect.arrayContaining(['ls:t', 'fs:t']));
  });

  it('includes blends once letters and first sounds are mastered', () => {
    const plan = planSession(withMastered(undefined, [...allLetterSounds, ...allFirstSounds]), seededRng(3));
    expect(plan.some((id) => id.startsWith('blend:'))).toBe(true);
  });

  it('still produces a full session when everything is mastered', () => {
    const everything = availableItems(withMastered(undefined, allLetterSounds));
    const plan = planSession(withMastered(undefined, everything), seededRng(4));
    expect(plan).toHaveLength(CONFIG.SESSION_LENGTH);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/scheduler.test.js`
Expected: FAIL, because the module was not found.

- [ ] **Step 3: Implement `src/curriculum/scheduler.js`**

```js
import { CONFIG } from '../config.js';
import { RHYME_SETS, FIRST_SOUND_WORDS, BLEND_WORDS } from './units.js';
import { unlockedLetters } from './unlock.js';
import { shuffle } from './random.js';
import { isMastered, isStruggling, lastSeen } from '../state/progress.js';
import { nameLetters } from '../state/name.js';

const isRhyme = (id) => id.startsWith('rhyme:');

export function availableItems(progress) {
  const letters = unlockedLetters(progress);
  const masteredLetters = letters.filter((l) => isMastered(progress, `ls:${l}`));
  const letterItems = letters.flatMap((l) => (FIRST_SOUND_WORDS[l] ? [`ls:${l}`, `fs:${l}`] : [`ls:${l}`]));
  const blendItems = BLEND_WORDS
    .filter((w) => [...w].every((ch) => masteredLetters.includes(ch)))
    .map((w) => `blend:${w}`);
  const nameItems = nameLetters(progress.childName).length > 0 ? ['name'] : [];
  return [...nameItems, ...RHYME_SETS.map((_, i) => `rhyme:${i}`), ...letterItems, ...blendItems];
}

export function sortForReview(progress, ids) {
  return [...ids].sort((a, b) =>
    Number(isStruggling(progress, b)) - Number(isStruggling(progress, a))
    || lastSeen(progress, a) - lastSeen(progress, b));
}

export function interleave(a, b) {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]])
    .flat()
    .filter((x) => x !== undefined);
}

export const dedupeAdjacent = (ids) => ids.filter((id, i) => id !== ids[i - 1]);

function pickWarmup(progress, available) {
  if (available.includes('name') && !isMastered(progress, 'name')) return 'name';
  return sortForReview(progress, available.filter(isRhyme))[0];
}

export function planSession(progress, rng = Math.random) {
  const available = availableItems(progress);
  const warmup = pickWarmup(progress, available);
  const rest = available.filter((id) => id !== warmup);
  const focus = shuffle(rest.filter((id) => !isRhyme(id) && !isMastered(progress, id)), rng)
    .slice(0, CONFIG.FOCUS_ITEMS);
  const rhymes = shuffle(rest.filter((id) => isRhyme(id) && !isMastered(progress, id)), rng)
    .slice(0, CONFIG.MAX_RHYMES_PER_SESSION);
  const review = sortForReview(progress, rest.filter((id) => !focus.includes(id) && !rhymes.includes(id)));
  const body = interleave([...focus, ...focus], [...rhymes, ...review]);
  return dedupeAdjacent([warmup, ...body]).slice(0, CONFIG.SESSION_LENGTH);
}
```

- [ ] **Step 4: Run tests; confirm they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/curriculum/scheduler.js tests/unit/scheduler.test.js
git commit -m "feat: add mastery-aware session scheduler

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Content pipeline (speech, pictures, font, credits)

**Files:**
- Create: `tools/audio-script.mjs`, `tools/build-audio.mjs`, `tools/image-map.mjs`, `tools/fetch-images.mjs`, `tools/copy-fonts.mjs`, `credits.html`, `assets/audio/{prompt,word,letter}/*.mp3`, `assets/img/*.svg`, `assets/fonts/andika-{400,700}.woff2`
- Test: `tests/unit/assets.test.js`

**Interfaces:**
- Consumes: `PROMPT_IDS`, `PICTURE_WORDS`, `LETTER_ORDER`; `PIPER_VOICE` and the command template from `assets/audio/SOURCES.md` (Task 2).
- Produces: `PROMPT_TEXT`, `LETTER_NAME_TEXT` (tools); `IMAGE_CODEPOINTS` (tools/image-map.mjs); `GARDEN_IMAGES = ['seedling','tulip','wilted_flower']` used by Task 10; asset files on disk.

- [ ] **Step 1: Write the failing test `tests/unit/assets.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { PROMPT_IDS, prompt, phoneme, letterName, word, imgPath } from '../../src/audio/clips.js';
import { LETTER_ORDER, PICTURE_WORDS } from '../../src/curriculum/units.js';
import { PROMPT_TEXT, LETTER_NAME_TEXT } from '../../tools/audio-script.mjs';
import { IMAGE_CODEPOINTS, GARDEN_IMAGES } from '../../tools/image-map.mjs';

const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz'];
const missing = (paths) => paths.filter((p) => !existsSync(p));

describe('content assets', () => {
  it('has text for exactly the prompts the code uses', () => {
    expect(Object.keys(PROMPT_TEXT).sort()).toEqual([...PROMPT_IDS].sort());
    expect(Object.keys(LETTER_NAME_TEXT).sort()).toEqual(ALPHABET);
  });

  it('has an image mapping for every picture and garden image', () => {
    [...PICTURE_WORDS, ...GARDEN_IMAGES].forEach((w) => expect(IMAGE_CODEPOINTS[w]).toMatch(/^[0-9A-F-]+$/));
  });

  it('has every audio clip on disk', () => {
    expect(missing([
      ...PROMPT_IDS.map(prompt),
      ...LETTER_ORDER.map(phoneme),
      ...ALPHABET.map(letterName),
      ...PICTURE_WORDS.map(word),
    ])).toEqual([]);
  });

  it('has every image and font on disk', () => {
    expect(missing([
      ...[...PICTURE_WORDS, ...GARDEN_IMAGES].map(imgPath),
      'assets/fonts/andika-400.woff2',
      'assets/fonts/andika-700.woff2',
    ])).toEqual([]);
  });

  it('credits every third-party source', () => {
    const credits = readFileSync('credits.html', 'utf8');
    ['OpenMoji', 'CC BY-SA 4.0', 'Piper', 'Andika', 'SIL Open Font License'].forEach((s) => expect(credits).toContain(s));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/assets.test.js`
Expected: FAIL, because `tools/audio-script.mjs` was not found.

- [ ] **Step 3: Write `tools/audio-script.mjs`**

```js
import { PICTURE_WORDS } from '../src/curriculum/units.js';

export const PROMPT_TEXT = Object.freeze({
  which_starts_with: 'Which one starts with...',
  which_rhymes_with: 'Which one rhymes with...',
  find_the_letter: 'Find the letter that says...',
  tap_each_letter: 'Tap each letter. Then hop them together!',
  which_picture: 'Which picture is it?',
  spell_your_name: "Let's spell your name!",
  great_job_1: 'Great job!',
  great_job_2: 'You did it!',
  great_job_3: 'Yes! Nice listening!',
  try_again: "Hmm. Let's try again.",
  all_done: 'All done for today! Look how your garden grows.',
  new_flower: 'Wow! A new flower bloomed!',
  lets_play: "Let's play!",
});

// Spelled phonetically because TTS often reads a bare "a" as "uh".
export const LETTER_NAME_TEXT = Object.freeze({
  a: 'Ay.', b: 'Bee.', c: 'See.', d: 'Dee.', e: 'Ee.', f: 'Ef.', g: 'Jee.', h: 'Aitch.', i: 'Eye.',
  j: 'Jay.', k: 'Kay.', l: 'El.', m: 'Em.', n: 'En.', o: 'Oh.', p: 'Pee.', q: 'Cue.', r: 'Ar.',
  s: 'Ess.', t: 'Tee.', u: 'You.', v: 'Vee.', w: 'Double you.', x: 'Ex.', y: 'Why.', z: 'Zee.',
});

export const WORD_TEXT = Object.freeze(Object.fromEntries(PICTURE_WORDS.map((w) => [w, `${w}.`])));
```

- [ ] **Step 4: Write `tools/build-audio.mjs`**

Use the voice and flags recorded in `assets/audio/SOURCES.md` (Task 2). The defaults below match the Task 2 template.

```js
// Builds prompt/word/letter-name MP3s with Piper. Usage: node tools/build-audio.mjs [--force]
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { PROMPT_TEXT, WORD_TEXT, LETTER_NAME_TEXT } from './audio-script.mjs';

const PIPER = process.env.PIPER_BIN ?? '.venv-audio/bin/piper';
const VOICE = process.env.PIPER_VOICE ?? 'en_US-ljspeech-high';
const LENGTH_SCALE = process.env.PIPER_LENGTH_SCALE ?? '1.15';
const FORCE = process.argv.includes('--force');
const TRIM_AND_NORMALISE = [
  'silenceremove=start_periods=1:start_threshold=-45dB',
  'areverse', 'silenceremove=start_periods=1:start_threshold=-45dB', 'areverse',
  'loudnorm=I=-16',
].join(',');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${cmd} failed (${result.status}): ${result.stderr}`);
}

function synth(kind, id, text) {
  const dir = `assets/audio/${kind}`;
  const mp3 = `${dir}/${id}.mp3`;
  if (existsSync(mp3) && !FORCE) return 0;
  mkdirSync(dir, { recursive: true });
  const wav = `${dir}/${id}.wav`;
  run(PIPER, ['-m', VOICE, '--data-dir', 'voices', '--length-scale', LENGTH_SCALE, '-f', wav, '--', text]);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', TRIM_AND_NORMALISE, '-ac', '1', '-ar', '44100', '-b:a', '64k', mp3]);
  rmSync(wav);
  return 1;
}

const jobs = [
  ...Object.entries(PROMPT_TEXT).map(([id, text]) => ['prompt', id, text]),
  ...Object.entries(WORD_TEXT).map(([id, text]) => ['word', id, text]),
  ...Object.entries(LETTER_NAME_TEXT).map(([id, text]) => ['letter', id, text]),
];

try {
  const built = jobs.reduce((count, [kind, id, text]) => count + synth(kind, id, text), 0);
  process.stdout.write(`Built ${built} clips (${jobs.length - built} already existed)\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
```

- [ ] **Step 5: Write `tools/image-map.mjs` and `tools/fetch-images.mjs`**

`tools/image-map.mjs`:

```js
// OpenMoji codepoints (https://openmoji.org). Keys are picture words / garden states.
export const GARDEN_IMAGES = Object.freeze(['seedling', 'tulip', 'wilted_flower']);

export const IMAGE_CODEPOINTS = Object.freeze({
  sun: '2600', sock: '1F9E6', apple: '1F34E', ant: '1F41C', tent: '26FA', tiger: '1F42F',
  pig: '1F437', pizza: '1F355', nest: '1FAB9', nose: '1F443',
  cat: '1F431', hat: '1F3A9', bat: '1F987', car: '1F697', star: '2B50', bee: '1F41D', tree: '1F333',
  cake: '1F382', snake: '1F40D', mouse: '1F42D', house: '1F3E0', goat: '1F410', boat: '26F5',
  fox: '1F98A', box: '1F4E6', frog: '1F438', log: '1FAB5', moon: '1F319', spoon: '1F944',
  pin: '1F4CC', tap: '1F6B0', pan: '1F373', tin: '1F96B', sip: '1F964', nap: '1F634',
  seedling: '1F331', tulip: '1F337', wilted_flower: '1F940',
});
```

`tools/fetch-images.mjs`:

```js
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
```

- [ ] **Step 6: Write `tools/copy-fonts.mjs`**

```js
import { copyFileSync, mkdirSync } from 'node:fs';

const SRC = 'node_modules/@fontsource/andika/files';
mkdirSync('assets/fonts', { recursive: true });
[400, 700].forEach((weight) => {
  copyFileSync(`${SRC}/andika-latin-${weight}-normal.woff2`, `assets/fonts/andika-${weight}.woff2`);
});
process.stdout.write('Copied Andika fonts\n');
```

Add scripts: `npm pkg set scripts.content:audio="node tools/build-audio.mjs" scripts.content:images="node tools/fetch-images.mjs" scripts.content:fonts="node tools/copy-fonts.mjs"`

- [ ] **Step 7: Build all content and spot-check it**

```bash
npm run content:fonts && npm run content:images && npm run content:audio
open assets/img/pat.svg assets/img/tap.svg assets/img/nap.svg
afplay assets/audio/prompt/which_starts_with.mp3; afplay assets/audio/letter/a.mp3; afplay assets/audio/word/sip.mp3
```

Expected: every script exits 0. If an image is ambiguous for a 4-year-old (for example `nap` or `tin`), swap its codepoint in `image-map.mjs` or drop the word from `BLEND_WORDS`. If a word is mispronounced, adjust its text in `audio-script.mjs` and rebuild that clip with `--force`.

- [ ] **Step 8: Write `credits.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sound Sprouts credits</title>
  <link rel="stylesheet" href="styles/app.css">
</head>
<body class="credits">
  <main>
    <h1>Credits</h1>
    <h2>Pictures</h2>
    <p>Emoji artwork by <a href="https://openmoji.org">OpenMoji</a>, the open-source emoji and icon project, licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</p>
    <h2>Voices</h2>
    <p>Spoken prompts and words were generated with <a href="https://github.com/OHF-Voice/piper1-gpl">Piper</a> text-to-speech. The voice and its dataset license are listed below.</p>
    <!-- Paste the voice line and each phoneme source line from assets/audio/SOURCES.md here as <li> items. -->
    <ul id="audio-sources"></ul>
    <h2>Font</h2>
    <p><a href="https://software.sil.org/andika/">Andika</a> by SIL International, licensed under the SIL Open Font License 1.1.</p>
    <p><a href="./">Back to Sound Sprouts</a></p>
  </main>
</body>
</html>
```

Fill `#audio-sources` with one `<li>` per entry in `assets/audio/SOURCES.md`. Each entry needs a link, author and license.

- [ ] **Step 9: Run tests; confirm they pass**

Run: `npm test`
Expected: all pass, including `assets.test.js`.

- [ ] **Step 10: Commit**

```bash
git add tools assets credits.html package.json tests/unit/assets.test.js
git commit -m "feat: add generated speech, OpenMoji pictures, Andika font and credits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Audio player and visibility handling

**Files:**
- Create: `src/audio/player.js`, `src/audio/visibility.js`
- Test: `tests/unit/player.test.js`, `tests/unit/visibility.test.js`

**Interfaces:**
- Consumes: `CONFIG.AUDIO_TIMEOUT_MS`.
- Produces: `createPlayer({ audio, timeoutMs, speech, Utterance, onError }) → { play(src) → Promise<Result>, playSequence(srcs) → Promise<Result>, say(text) → Promise<Result>, stop() }` where `Result = { ok: boolean, stopped?: true }`. **The returned promises never reject.** `onError(src)` is called for failed (not stopped) clips. Also `stopWhenHidden(doc, player)`.

- [ ] **Step 1: Write the failing test `tests/unit/player.test.js`**

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayer } from '../../src/audio/player.js';

function fakeAudio({ playImpl } = {}) {
  return {
    src: '',
    onended: null,
    onerror: null,
    play: vi.fn(playImpl ?? (() => Promise.resolve())),
    pause: vi.fn(),
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createPlayer', () => {
  it('resolves ok when the clip ends', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ audio });
    const result = player.play('a.mp3');
    expect(audio.src).toBe('a.mp3');
    audio.onended();
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('resolves not-ok and reports on a media error', async () => {
    const audio = fakeAudio();
    const onError = vi.fn();
    const result = createPlayer({ audio, onError }).play('missing.mp3');
    audio.onerror();
    await expect(result).resolves.toEqual({ ok: false });
    expect(onError).toHaveBeenCalledWith('missing.mp3');
  });

  it('resolves not-ok when play() is rejected (autoplay blocked)', async () => {
    const audio = fakeAudio({ playImpl: () => Promise.reject(new Error('NotAllowedError')) });
    const onError = vi.fn();
    await expect(createPlayer({ audio, onError }).play('a.mp3')).resolves.toEqual({ ok: false });
    expect(onError).toHaveBeenCalledOnce();
  });

  it('resolves not-ok when play() throws synchronously', async () => {
    const audio = fakeAudio({ playImpl: () => { throw new Error('boom'); } });
    await expect(createPlayer({ audio }).play('a.mp3')).resolves.toEqual({ ok: false });
  });

  it('times out if the clip never ends', async () => {
    const audio = fakeAudio();
    const result = createPlayer({ audio, timeoutMs: 1000 }).play('a.mp3');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ ok: false });
  });

  it('stop() resolves the current clip as stopped without reporting', async () => {
    const audio = fakeAudio();
    const onError = vi.fn();
    const player = createPlayer({ audio, onError });
    const result = player.play('a.mp3');
    player.stop();
    await expect(result).resolves.toEqual({ ok: false, stopped: true });
    expect(audio.pause).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('a new play() stops the previous one and late events are ignored', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ audio });
    const first = player.play('a.mp3');
    const firstEnded = audio.onended;
    const second = player.play('b.mp3');
    await expect(first).resolves.toEqual({ ok: false, stopped: true });
    firstEnded();
    audio.onended();
    await expect(second).resolves.toEqual({ ok: true });
  });

  it('playSequence plays clips in order and aborts when stopped', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ audio });
    const seq = player.playSequence(['a.mp3', 'b.mp3', 'c.mp3']);
    audio.onended();
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.src).toBe('b.mp3');
    player.stop();
    await expect(seq).resolves.toEqual({ ok: false, stopped: true });
    expect(audio.src).toBe('b.mp3');
  });

  it('playSequence reports not-ok if any clip failed but still plays the rest', async () => {
    const audio = fakeAudio();
    const seq = createPlayer({ audio }).playSequence(['a.mp3', 'b.mp3']);
    audio.onerror();
    await vi.advanceTimersByTimeAsync(0);
    audio.onended();
    await expect(seq).resolves.toEqual({ ok: false });
  });

  it('say() uses speech synthesis when available', async () => {
    const speech = { speak: vi.fn((u) => u.onend()), cancel: vi.fn() };
    function Utterance(text) { this.text = text; }
    const player = createPlayer({ audio: fakeAudio(), speech, Utterance });
    await expect(player.say('Ava')).resolves.toEqual({ ok: true });
    expect(speech.speak.mock.calls[0][0].text).toBe('Ava');
  });

  it('say() resolves not-ok without speech support, on error, or on timeout', async () => {
    await expect(createPlayer({ audio: fakeAudio(), speech: null }).say('Ava')).resolves.toEqual({ ok: false });
    function Utterance(text) { this.text = text; }
    const failing = { speak: vi.fn((u) => u.onerror()), cancel: vi.fn() };
    await expect(createPlayer({ audio: fakeAudio(), speech: failing, Utterance }).say('Ava')).resolves.toEqual({ ok: false });
    const silent = { speak: vi.fn(), cancel: vi.fn() };
    const pending = createPlayer({ audio: fakeAudio(), speech: silent, Utterance, timeoutMs: 500 }).say('Ava');
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toEqual({ ok: false });
  });
});
```

`tests/unit/visibility.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { stopWhenHidden } from '../../src/audio/visibility.js';
import { fakePlayer } from '../helpers.js';

describe('stopWhenHidden', () => {
  it('stops audio when the document becomes hidden', () => {
    const player = fakePlayer();
    stopWhenHidden(document, player);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.stop).toHaveBeenCalledOnce();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.stop).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/unit/player.test.js tests/unit/visibility.test.js`
Expected: FAIL, because the modules were not found.

- [ ] **Step 3: Implement `src/audio/player.js`**

One `HTMLAudioElement` is reused for every clip. iOS only unlocks an element after it has been played from a tap, so reusing one element keeps it unlocked for the whole session.

```js
import { CONFIG } from '../config.js';

export function createPlayer({
  audio = new Audio(),
  timeoutMs = CONFIG.AUDIO_TIMEOUT_MS,
  speech = globalThis.speechSynthesis ?? null,
  Utterance = globalThis.SpeechSynthesisUtterance,
  onError = () => {},
} = {}) {
  let pending = null;

  function stop() {
    if (pending) {
      audio.pause();
      pending.finish({ ok: false, stopped: true });
    }
    speech?.cancel?.();
  }

  function play(src) {
    stop();
    return new Promise((resolve) => {
      const token = Symbol(src);
      let timer = null;
      const finish = (result) => {
        if (pending?.token !== token) return;
        pending = null;
        clearTimeout(timer);
        audio.onended = null;
        audio.onerror = null;
        if (!result.ok && !result.stopped) onError(src);
        resolve(result);
      };
      pending = { token, finish };
      timer = setTimeout(() => finish({ ok: false }), timeoutMs);
      audio.onended = () => finish({ ok: true });
      audio.onerror = () => finish({ ok: false });
      audio.src = src;
      try {
        Promise.resolve(audio.play()).catch(() => finish({ ok: false }));
      } catch {
        finish({ ok: false });
      }
    });
  }

  async function playSequence(srcs) {
    let allOk = true;
    for (const src of srcs) {
      const result = await play(src);
      if (result.stopped) return result;
      allOk = allOk && result.ok;
    }
    return { ok: allOk };
  }

  function say(text) {
    stop();
    if (!speech || typeof Utterance !== 'function') return Promise.resolve({ ok: false });
    return new Promise((resolve) => {
      const utterance = new Utterance(text);
      utterance.rate = 0.8;
      const timer = setTimeout(() => resolve({ ok: false }), timeoutMs);
      utterance.onend = () => { clearTimeout(timer); resolve({ ok: true }); };
      utterance.onerror = () => { clearTimeout(timer); resolve({ ok: false }); };
      speech.speak(utterance);
    });
  }

  return { play, playSequence, say, stop };
}
```

- [ ] **Step 4: Implement `src/audio/visibility.js`**

```js
export function stopWhenHidden(doc, player) {
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) player.stop();
  });
}
```

- [ ] **Step 5: Run tests; confirm they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/audio tests/unit/player.test.js tests/unit/visibility.test.js
git commit -m "feat: add never-rejecting audio player and hide-to-stop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pick-one activity

**Files:**
- Create: `src/activities/pick-one.js`
- Test: `tests/unit/pick-one.test.js`

**Interfaces:**
- Consumes: `el`, `prompt`, a player (`play`, `playSequence`), and a pickOne Task (`prompt`, `choices`, `cheer`, optional `focusImg`).
- Produces: `runPickOne(container, task, { player }) → Promise<{ firstTry: boolean }>`. DOM contract (used by E2E and CSS): root `.activity.pick-one[data-ready="true|false"]`; buttons `.choice[data-choice-id][data-correct]`; replay button `.replay`.

- [ ] **Step 1: Write the failing test `tests/unit/pick-one.test.js`**

```js
import { describe, it, expect, vi } from 'vitest';
import { runPickOne } from '../../src/activities/pick-one.js';
import { prompt } from '../../src/audio/clips.js';
import { fakePlayer, flush, deferred } from '../helpers.js';

const task = {
  prompt: ['p1.mp3', 'p2.mp3'],
  cheer: 'cheer.mp3',
  choices: [
    { id: 'sun', label: 'sun', img: 'assets/img/sun.svg', audio: 'sun.mp3', correct: true },
    { id: 'pig', label: 'pig', img: 'assets/img/pig.svg', audio: 'pig.mp3', correct: false },
  ],
};
const choice = (root, id) => root.querySelector(`[data-choice-id="${id}"]`);

describe('runPickOne', () => {
  it('renders choices and plays the prompt', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    runPickOne(root, task, { player });
    expect(root.querySelectorAll('.choice')).toHaveLength(2);
    expect(choice(root, 'sun').dataset.correct).toBe('true');
    expect(player.playSequence).toHaveBeenCalledWith(['p1.mp3', 'p2.mp3']);
  });

  it('ignores taps while the prompt is playing', async () => {
    const root = document.createElement('div');
    const gate = deferred();
    const player = fakePlayer({ playSequence: vi.fn(() => gate.promise) });
    const done = vi.fn();
    runPickOne(root, task, { player }).then(done);
    expect(root.querySelector('.activity').dataset.ready).toBe('false');
    choice(root, 'pig').click();
    choice(root, 'sun').click();
    await flush();
    expect(done).not.toHaveBeenCalled();
    expect(choice(root, 'pig').classList.contains('wrong')).toBe(false);
    gate.resolve({ ok: true });
    await flush();
    expect(root.querySelector('.activity').dataset.ready).toBe('true');
  });

  it('resolves firstTry=true on an immediate correct answer and plays the cheer', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runPickOne(root, task, { player });
    await flush();
    choice(root, 'sun').click();
    await expect(result).resolves.toEqual({ firstTry: true });
    expect(player.play).toHaveBeenCalledWith('cheer.mp3');
  });

  it('after a wrong answer: greys it, names it, says try again, re-asks, and scores firstTry=false', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runPickOne(root, task, { player });
    await flush();
    choice(root, 'pig').click();
    await flush();
    expect(choice(root, 'pig').disabled).toBe(true);
    expect(choice(root, 'pig').classList.contains('wrong')).toBe(true);
    expect(player.play).toHaveBeenCalledWith('pig.mp3');
    expect(player.play).toHaveBeenCalledWith(prompt('try_again'));
    expect(player.playSequence).toHaveBeenCalledTimes(2);
    choice(root, 'sun').click();
    await expect(result).resolves.toEqual({ firstTry: false });
  });

  it('a double tap on the right answer resolves once and plays one cheer', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const done = vi.fn();
    runPickOne(root, task, { player }).then(done);
    await flush();
    choice(root, 'sun').click();
    choice(root, 'sun').click();
    await flush();
    expect(done).toHaveBeenCalledOnce();
    expect(player.play.mock.calls.filter(([src]) => src === 'cheer.mp3')).toHaveLength(1);
  });

  it('still becomes tappable when prompt audio fails', async () => {
    const root = document.createElement('div');
    const player = fakePlayer({ playSequence: vi.fn(async () => ({ ok: false })) });
    const result = runPickOne(root, task, { player });
    await flush();
    choice(root, 'sun').click();
    await expect(result).resolves.toEqual({ firstTry: true });
  });

  it('replay re-plays the prompt only when ready', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    runPickOne(root, { ...task, focusImg: 'assets/img/cat.svg' }, { player });
    await flush();
    expect(root.querySelector('.focus')).not.toBeNull();
    root.querySelector('.replay').click();
    await flush();
    expect(player.playSequence).toHaveBeenCalledTimes(2);
  });

  it('shows letters as text when choices have no image', async () => {
    const root = document.createElement('div');
    const letters = { ...task, choices: [{ id: 's', label: 's', audio: 's.mp3', correct: true }] };
    runPickOne(root, letters, { player: fakePlayer() });
    expect(root.querySelector('.choice .letter').textContent).toBe('s');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/pick-one.test.js`
Expected: FAIL, because the module was not found.

- [ ] **Step 3: Implement `src/activities/pick-one.js`**

```js
import { el } from '../ui/dom.js';
import { prompt } from '../audio/clips.js';

function choiceFace(choice) {
  return choice.img
    ? el('img', { src: choice.img, alt: '', draggable: 'false' })
    : el('span', { class: 'letter' }, [choice.label]);
}

function renderPickOne(task) {
  const replay = el('button', { class: 'replay', 'aria-label': 'Hear it again' }, ['🔊']);
  const buttons = task.choices.map((choice) => el('button', {
    class: 'choice',
    'aria-label': choice.label,
    dataset: { choiceId: choice.id, correct: String(choice.correct) },
  }, [choiceFace(choice)]));
  const focus = task.focusImg ? el('img', { class: 'focus', src: task.focusImg, alt: '' }) : null;
  const root = el('div', { class: 'activity pick-one', dataset: { ready: 'false' } },
    [replay, focus, el('div', { class: 'choices' }, buttons)]);
  return { root, replay, buttons };
}

export function runPickOne(container, task, { player }) {
  return new Promise((resolve) => {
    const { root, replay, buttons } = renderPickOne(task);
    let ready = false;
    let firstTry = true;
    const setReady = (value) => { ready = value; root.dataset.ready = String(value); };

    const ask = async () => {
      setReady(false);
      await player.playSequence(task.prompt);
      setReady(true);
    };

    const onWrong = async (choice, button) => {
      firstTry = false;
      setReady(false);
      button.classList.add('wrong');
      button.disabled = true;
      if (choice.audio) await player.play(choice.audio);
      await player.play(prompt('try_again'));
      await ask();
    };

    const onRight = async (button) => {
      setReady(false);
      button.classList.add('right');
      await player.play(task.cheer);
      resolve({ firstTry });
    };

    buttons.forEach((button, index) => button.addEventListener('click', () => {
      if (!ready) return;
      const choice = task.choices[index];
      if (choice.correct) onRight(button);
      else onWrong(choice, button);
    }));
    replay.addEventListener('click', () => { if (ready) ask(); });

    container.replaceChildren(root);
    ask();
  });
}
```

- [ ] **Step 4: Run tests; confirm they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/activities/pick-one.js tests/unit/pick-one.test.js
git commit -m "feat: add pick-one activity with listen-first tap locking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Blend and name-spell activities

**Files:**
- Create: `src/activities/blend.js`, `src/activities/name-spell.js`, `src/activities/index.js`
- Test: `tests/unit/blend.test.js`, `tests/unit/name-spell.test.js`

**Interfaces:**
- Consumes: `runPickOne`, `el`, `phoneme`, `word`, `letterName`, `prompt`, `imgPath`, and the player (`play`, `playSequence`, `say`).
- Produces:
  - `runBlend(container, task, { player })`. DOM: root `.activity.blend[data-ready]`, `.tile[data-index]` (gets `.heard`), `.hop` (hidden until all tiles are heard), `.blend-choices` containing a nested `.pick-one`.
  - `runNameSpell(container, task, { player })`. DOM: root `.activity.name-spell[data-ready]`, `.slot` (gets `data-hint` after a miss), `.tile[data-char][data-key]`.
  - `ACTIVITIES = { pickOne, blend, nameSpell }`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/blend.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { runBlend } from '../../src/activities/blend.js';
import { phoneme, word } from '../../src/audio/clips.js';
import { fakePlayer, flush } from '../helpers.js';

const task = {
  word: 'pin',
  letters: ['p', 'i', 'n'],
  cheer: 'cheer.mp3',
  choices: [
    { id: 'pin', label: 'pin', img: 'assets/img/pin.svg', audio: word('pin'), correct: true },
    { id: 'tap', label: 'tap', img: 'assets/img/tap.svg', audio: word('tap'), correct: false },
  ],
};
const tile = (root, i) => root.querySelector(`.tile[data-index="${i}"]`);

describe('runBlend', () => {
  it('only accepts tiles left to right, then reveals hop', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    runBlend(root, task, { player });
    await flush();
    const hop = root.querySelector('.hop');
    tile(root, 2).click();
    await flush();
    expect(tile(root, 2).classList.contains('heard')).toBe(false);
    for (const i of [0, 1, 2]) {
      expect(hop.hidden).toBe(true);
      tile(root, i).click();
      await flush();
    }
    expect(player.play).toHaveBeenCalledWith(phoneme('p'));
    expect(hop.hidden).toBe(false);
  });

  it('hop blends the sounds, says the word, then asks for the picture', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runBlend(root, task, { player });
    await flush();
    for (const i of [0, 1, 2]) { tile(root, i).click(); await flush(); }
    root.querySelector('.hop').click();
    await flush();
    expect(player.playSequence).toHaveBeenCalledWith([phoneme('p'), phoneme('i'), phoneme('n'), word('pin')]);
    const correct = root.querySelector('.pick-one [data-correct="true"]');
    expect(correct.dataset.choiceId).toBe('pin');
    correct.click();
    await expect(result).resolves.toEqual({ firstTry: true });
  });

  it('ignores taps before the intro finishes and a double hop', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    runBlend(root, task, { player });
    tile(root, 0).click();
    expect(tile(root, 0).classList.contains('heard')).toBe(false);
    await flush();
    for (const i of [0, 1, 2]) { tile(root, i).click(); await flush(); }
    const hop = root.querySelector('.hop');
    hop.click();
    hop.click();
    await flush();
    expect(player.playSequence.mock.calls.filter(([srcs]) => srcs.includes(word('pin')))).toHaveLength(1);
  });
});
```

`tests/unit/name-spell.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { runNameSpell } from '../../src/activities/name-spell.js';
import { letterName, prompt } from '../../src/audio/clips.js';
import { fakePlayer, flush } from '../helpers.js';

const anna = {
  name: 'Anna',
  cheer: 'cheer.mp3',
  letters: [{ display: 'A', key: 'a' }, { display: 'n', key: 'n' }, { display: 'n', key: 'n' }, { display: 'a', key: 'a' }],
  tileOrder: [3, 1, 0, 2],
};
const tap = async (root, ch) => {
  root.querySelector(`.tile[data-char="${ch}"]:not([disabled])`).click();
  await flush();
};

describe('runNameSpell', () => {
  it('fills slots in order, handles repeated letters, says the name and cheers', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runNameSpell(root, anna, { player });
    await flush();
    for (const ch of ['A', 'n', 'n', 'a']) await tap(root, ch);
    expect([...root.querySelectorAll('.slot')].map((s) => s.textContent).join('')).toBe('Anna');
    expect(player.play).toHaveBeenCalledWith(letterName('a'));
    expect(player.say).toHaveBeenCalledWith('Anna');
    await expect(result).resolves.toEqual({ firstTry: true });
  });

  it('a wrong letter scores firstTry=false and shows a hint in the next slot', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runNameSpell(root, anna, { player });
    await flush();
    await tap(root, 'n');
    expect(player.play).toHaveBeenCalledWith(prompt('try_again'));
    expect(root.querySelector('.slot').dataset.hint).toBe('A');
    expect(root.querySelector('.slot').textContent).toBe('');
    for (const ch of ['A', 'n', 'n', 'a']) await tap(root, ch);
    await expect(result).resolves.toEqual({ firstTry: false });
  });

  it('is case-sensitive: lower-case a does not fill the capital A slot', async () => {
    const root = document.createElement('div');
    runNameSpell(root, anna, { player: fakePlayer() });
    await flush();
    await tap(root, 'a');
    expect(root.querySelector('.slot').textContent).toBe('');
  });

  it('ignores taps before the intro finishes', () => {
    const root = document.createElement('div');
    runNameSpell(root, anna, { player: fakePlayer() });
    root.querySelector('.tile[data-char="A"]').click();
    expect(root.querySelector('.slot').textContent).toBe('');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/unit/blend.test.js tests/unit/name-spell.test.js`
Expected: FAIL, because the modules were not found.

- [ ] **Step 3: Implement `src/activities/blend.js`**

```js
import { el } from '../ui/dom.js';
import { phoneme, word, prompt, imgPath } from '../audio/clips.js';
import { runPickOne } from './pick-one.js';

function renderBlend(task) {
  const tiles = task.letters.map((letter, index) =>
    el('button', { class: 'tile', 'aria-label': letter, dataset: { index: String(index) } }, [letter]));
  const hop = el('button', { class: 'hop', 'aria-label': 'Hop the sounds together', hidden: '' },
    [el('img', { src: imgPath('seedling'), alt: '' })]);
  const choiceStage = el('div', { class: 'blend-choices' });
  const root = el('div', { class: 'activity blend', dataset: { ready: 'false' } },
    [el('div', { class: 'tiles' }, tiles), hop, choiceStage]);
  return { root, tiles, hop, choiceStage };
}

export function runBlend(container, task, { player }) {
  return new Promise((resolve) => {
    const { root, tiles, hop, choiceStage } = renderBlend(task);
    let ready = false;
    let next = 0;
    const setReady = (value) => { ready = value; root.dataset.ready = String(value); };

    tiles.forEach((tile, index) => tile.addEventListener('click', async () => {
      if (!ready || index !== next) return;
      setReady(false);
      tile.classList.add('heard');
      next = index + 1;
      await player.play(phoneme(task.letters[index]));
      hop.hidden = next < tiles.length;
      setReady(true);
    }));

    hop.addEventListener('click', async () => {
      if (!ready || next < tiles.length) return;
      setReady(false);
      hop.hidden = true;
      await player.playSequence([...task.letters.map(phoneme), word(task.word)]);
      const pickTask = { prompt: [prompt('which_picture')], choices: task.choices, cheer: task.cheer };
      resolve(await runPickOne(choiceStage, pickTask, { player }));
    });

    container.replaceChildren(root);
    player.play(prompt('tap_each_letter')).then(() => setReady(true));
  });
}
```

- [ ] **Step 4: Implement `src/activities/name-spell.js`**

```js
import { el } from '../ui/dom.js';
import { letterName, prompt } from '../audio/clips.js';

function renderNameSpell(task) {
  const slots = task.letters.map(() => el('span', { class: 'slot' }));
  const tiles = task.tileOrder.map((index) => {
    const letter = task.letters[index];
    return el('button', { class: 'tile', 'aria-label': letter.display, dataset: { char: letter.display, key: letter.key } }, [letter.display]);
  });
  const root = el('div', { class: 'activity name-spell', dataset: { ready: 'false' } },
    [el('div', { class: 'slots' }, slots), el('div', { class: 'tiles' }, tiles)]);
  return { root, slots, tiles };
}

export function runNameSpell(container, task, { player }) {
  return new Promise((resolve) => {
    const { root, slots, tiles } = renderNameSpell(task);
    let ready = false;
    let next = 0;
    let firstTry = true;
    const setReady = (value) => { ready = value; root.dataset.ready = String(value); };

    const onWrong = async (tile) => {
      firstTry = false;
      slots[next].dataset.hint = task.letters[next].display;
      tile.classList.add('wobble');
      await player.play(prompt('try_again'));
      tile.classList.remove('wobble');
      setReady(true);
    };

    const onRight = async (tile) => {
      const letter = task.letters[next];
      tile.disabled = true;
      slots[next].textContent = letter.display;
      next += 1;
      await player.play(letterName(letter.key));
      if (next < task.letters.length) { setReady(true); return; }
      await player.say(task.name);
      await player.play(task.cheer);
      resolve({ firstTry });
    };

    tiles.forEach((tile) => tile.addEventListener('click', () => {
      if (!ready || tile.disabled) return;
      setReady(false);
      if (tile.dataset.char === task.letters[next].display) onRight(tile);
      else onWrong(tile);
    }));

    container.replaceChildren(root);
    player.play(prompt('spell_your_name')).then(() => setReady(true));
  });
}
```

- [ ] **Step 5: Implement `src/activities/index.js`**

```js
import { runPickOne } from './pick-one.js';
import { runBlend } from './blend.js';
import { runNameSpell } from './name-spell.js';

export const ACTIVITIES = Object.freeze({ pickOne: runPickOne, blend: runBlend, nameSpell: runNameSpell });
```

- [ ] **Step 6: Run tests; confirm they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/activities tests/unit/blend.test.js tests/unit/name-spell.test.js
git commit -m "feat: add blending and name-spelling activities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Garden, home, done screens and session runner

**Files:**
- Create: `src/ui/long-press.js`, `src/screens/garden.js`, `src/screens/home.js`, `src/screens/done.js`, `src/screens/session.js`
- Test: `tests/unit/long-press.test.js`, `tests/unit/screens.test.js`, `tests/unit/session.test.js`

**Interfaces:**
- Consumes: `letterStatus`, `LETTER_ORDER`, `isMastered`, `imgPath`, `prompt`, `CONFIG.PARENT_HOLD_MS`, `buildTask`, `ACTIVITIES`, `recordAttempt`, `recordSession`.
- Produces:
  - `onLongPress(target, ms, callback)`
  - `renderGarden(progress, { bloomed = [] }) → HTMLElement` (`.garden > .plot[data-letter][data-status]`, `.bloom` on newly bloomed)
  - `renderHome(container, { progress, onPlay, onParent })` (Play button with accessible name "Play"; gear button with accessible name starting "Grown-ups")
  - `newlyBloomed(before, after) → string[]`, `renderDone(container, { before, after, player, onHome }) → Promise` (`.done`, `.home-button`)
  - `runSession({ container, progress, planIds, sessionId, deps: { player, activities? }, save, now, rng }) → Promise<Progress>` (`.session`, `.dots > .dot(.done)`, `.stage`; saves after **every** item)

- [ ] **Step 1: Write the failing tests**

`tests/unit/long-press.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onLongPress } from '../../src/ui/long-press.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('onLongPress', () => {
  it('fires after holding for the full duration', () => {
    const target = document.createElement('button');
    const cb = vi.fn();
    onLongPress(target, 2000, cb);
    target.dispatchEvent(new Event('pointerdown'));
    expect(target.classList.contains('holding')).toBe(true);
    vi.advanceTimersByTime(1999);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledOnce();
  });

  it.each(['pointerup', 'pointerleave', 'pointercancel'])('cancels on %s', (type) => {
    const target = document.createElement('button');
    const cb = vi.fn();
    onLongPress(target, 2000, cb);
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event(type));
    vi.advanceTimersByTime(3000);
    expect(cb).not.toHaveBeenCalled();
    expect(target.classList.contains('holding')).toBe(false);
  });
});
```

`tests/unit/screens.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgress } from '../../src/state/progress.js';
import { renderGarden } from '../../src/screens/garden.js';
import { renderHome } from '../../src/screens/home.js';
import { renderDone, newlyBloomed } from '../../src/screens/done.js';
import { prompt } from '../../src/audio/clips.js';
import { CONFIG } from '../../src/config.js';
import { fakePlayer, withMastered } from '../helpers.js';

describe('renderGarden', () => {
  it('draws one plot per letter with its status', () => {
    const garden = renderGarden(withMastered(undefined, ['ls:s']), { bloomed: ['s'] });
    const plots = [...garden.querySelectorAll('.plot')];
    expect(plots.map((p) => p.dataset.letter)).toEqual(['s', 'a', 't', 'p', 'i', 'n']);
    expect(plots.map((p) => p.dataset.status)).toEqual(['flower', 'sprout', 'seed', 'seed', 'seed', 'seed']);
    expect(plots[0].classList.contains('bloom')).toBe(true);
    expect(plots[2].querySelector('.seed')).not.toBeNull();
  });
});

describe('renderHome', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('Play triggers onPlay once; holding the gear triggers onParent', () => {
    const root = document.createElement('div');
    const onPlay = vi.fn();
    const onParent = vi.fn();
    renderHome(root, { progress: createProgress(), onPlay, onParent });
    const play = root.querySelector('.play');
    play.click();
    play.click();
    expect(onPlay).toHaveBeenCalledOnce();
    root.querySelector('.parent-gear').dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(CONFIG.PARENT_HOLD_MS);
    expect(onParent).toHaveBeenCalledOnce();
  });
});

describe('done screen', () => {
  it('newlyBloomed lists letters mastered during the session', () => {
    expect(newlyBloomed(createProgress(), withMastered(undefined, ['ls:s', 'fs:s']))).toEqual(['s']);
  });

  it('celebrates new flowers and returns home on tap', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const onHome = vi.fn();
    await renderDone(root, { before: createProgress(), after: withMastered(undefined, ['ls:s']), player, onHome });
    expect(player.playSequence).toHaveBeenCalledWith([prompt('new_flower'), prompt('all_done')]);
    expect(root.querySelector('.plot.bloom')).not.toBeNull();
    root.querySelector('.home-button').click();
    expect(player.stop).toHaveBeenCalled();
    expect(onHome).toHaveBeenCalledOnce();
  });

  it('just says all done when nothing bloomed', async () => {
    const player = fakePlayer();
    await renderDone(document.createElement('div'), { before: createProgress(), after: createProgress(), player, onHome: vi.fn() });
    expect(player.playSequence).toHaveBeenCalledWith([prompt('all_done')]);
  });
});
```

`tests/unit/session.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createProgress } from '../../src/state/progress.js';
import { runSession } from '../../src/screens/session.js';
import { fakePlayer, seededRng } from '../helpers.js';

const fakeActivities = (answers) => {
  let i = 0;
  const run = vi.fn(async () => ({ firstTry: answers[i++] }));
  return { pickOne: run, blend: run, nameSpell: run };
};

describe('runSession', () => {
  it('runs every planned item, saving after each one, then records the session', async () => {
    const container = document.createElement('div');
    const saves = [];
    let clock = 100;
    const result = await runSession({
      container,
      progress: createProgress(),
      planIds: ['rhyme:0', 'ls:s', 'fs:s'],
      sessionId: 'sess-1',
      deps: { player: fakePlayer(), activities: fakeActivities([true, false, true]) },
      save: (p) => saves.push(p),
      now: () => (clock += 1),
      rng: seededRng(1),
    });
    expect(saves).toHaveLength(4);
    expect(saves[0].items['rhyme:0'].attempts).toHaveLength(1);
    expect(saves[1].items['ls:s'].attempts[0]).toMatchObject({ firstTry: false, sessionId: 'sess-1' });
    expect(result.sessions).toEqual([{ sessionId: 'sess-1', at: 104, itemCount: 3 }]);
    expect(container.querySelectorAll('.dot.done')).toHaveLength(3);
  });

  it('keeps completed items saved if the session is abandoned mid-way', async () => {
    const saves = [];
    const never = new Promise(() => {});
    let calls = 0;
    const run = vi.fn(() => (calls++ === 0 ? Promise.resolve({ firstTry: true }) : never));
    runSession({
      container: document.createElement('div'),
      progress: createProgress(),
      planIds: ['ls:s', 'ls:a'],
      sessionId: 's',
      deps: { player: fakePlayer(), activities: { pickOne: run, blend: run, nameSpell: run } },
      save: (p) => saves.push(p),
      now: () => 1,
      rng: seededRng(1),
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(saves).toHaveLength(1);
    expect(saves[0].items['ls:s']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/unit/long-press.test.js tests/unit/screens.test.js tests/unit/session.test.js`
Expected: FAIL, because the modules were not found.

- [ ] **Step 3: Implement `src/ui/long-press.js`**

```js
export function onLongPress(target, ms, callback) {
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    target.classList.remove('holding');
  };
  target.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    cancel();
    target.classList.add('holding');
    timer = setTimeout(() => { cancel(); callback(); }, ms);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => target.addEventListener(type, cancel));
  target.addEventListener('contextmenu', (event) => event.preventDefault());
}
```

- [ ] **Step 4: Implement `src/screens/garden.js`**

```js
import { el } from '../ui/dom.js';
import { LETTER_ORDER } from '../curriculum/units.js';
import { letterStatus } from '../curriculum/unlock.js';
import { imgPath } from '../audio/clips.js';

const STATUS_IMAGE = Object.freeze({ sprout: 'seedling', flower: 'tulip', thirsty: 'wilted_flower' });

function plotFace(status) {
  const image = STATUS_IMAGE[status];
  return image ? el('img', { src: imgPath(image), alt: '' }) : el('span', { class: 'seed' });
}

export function renderGarden(progress, { bloomed = [] } = {}) {
  return el('div', { class: 'garden', 'aria-hidden': 'true' }, LETTER_ORDER.map((letter) => {
    const status = letterStatus(progress, letter);
    const bloom = bloomed.includes(letter) ? ' bloom' : '';
    return el('div', { class: `plot ${status}${bloom}`, dataset: { letter, status } },
      [plotFace(status), el('span', { class: 'plot-letter' }, [letter])]);
  }));
}
```

- [ ] **Step 5: Implement `src/screens/home.js`**

```js
import { el } from '../ui/dom.js';
import { imgPath } from '../audio/clips.js';
import { CONFIG } from '../config.js';
import { onLongPress } from '../ui/long-press.js';
import { renderGarden } from './garden.js';

export function renderHome(container, { progress, onPlay, onParent }) {
  const play = el('button', { class: 'play', 'aria-label': 'Play' },
    [el('img', { src: imgPath('seedling'), alt: '' }), el('span', { 'aria-hidden': 'true' }, ['Play'])]);
  play.addEventListener('click', onPlay, { once: true });
  const gear = el('button', { class: 'parent-gear', 'aria-label': 'Grown-ups: press and hold' }, ['⚙']);
  onLongPress(gear, CONFIG.PARENT_HOLD_MS, onParent);
  container.replaceChildren(el('div', { class: 'home' }, [
    gear,
    el('h1', { class: 'title' }, ['Sound Sprouts']),
    renderGarden(progress),
    play,
  ]));
}
```

- [ ] **Step 6: Implement `src/screens/done.js`**

```js
import { el } from '../ui/dom.js';
import { LETTER_ORDER } from '../curriculum/units.js';
import { isMastered } from '../state/progress.js';
import { imgPath, prompt } from '../audio/clips.js';
import { renderGarden } from './garden.js';

export const newlyBloomed = (before, after) => LETTER_ORDER.filter(
  (l) => !isMastered(before, `ls:${l}`) && isMastered(after, `ls:${l}`));

export function renderDone(container, { before, after, player, onHome }) {
  const bloomed = newlyBloomed(before, after);
  const home = el('button', { class: 'home-button', 'aria-label': 'Back to the garden' },
    [el('img', { src: imgPath('house'), alt: '' })]);
  home.addEventListener('click', () => { player.stop(); onHome(); }, { once: true });
  container.replaceChildren(el('div', { class: 'done' }, [renderGarden(after, { bloomed }), home]));
  const clips = bloomed.length ? [prompt('new_flower'), prompt('all_done')] : [prompt('all_done')];
  return player.playSequence(clips);
}
```

- [ ] **Step 7: Implement `src/screens/session.js`**

```js
import { el } from '../ui/dom.js';
import { buildTask } from '../curriculum/tasks.js';
import { ACTIVITIES } from '../activities/index.js';
import { recordAttempt, recordSession } from '../state/progress.js';

function renderShell(container, total) {
  const dots = Array.from({ length: total }, () => el('span', { class: 'dot' }));
  const stage = el('main', { class: 'stage' });
  container.replaceChildren(el('div', { class: 'session' }, [
    el('div', { class: 'dots', 'aria-hidden': 'true' }, dots),
    stage,
  ]));
  return { stage, markDone: (index) => dots[index].classList.add('done') };
}

export async function runSession({ container, progress, planIds, sessionId, deps, save, now = Date.now, rng = Math.random }) {
  const activities = deps.activities ?? ACTIVITIES;
  const shell = renderShell(container, planIds.length);
  let current = progress;
  for (const [index, itemId] of planIds.entries()) {
    const task = buildTask(itemId, { progress: current, rng });
    const { firstTry } = await activities[task.activity](shell.stage, task, deps);
    current = recordAttempt(current, { itemId, firstTry, sessionId, at: now() });
    save(current);
    shell.markDone(index);
  }
  const finished = recordSession(current, { sessionId, at: now(), itemCount: planIds.length });
  save(finished);
  return finished;
}
```

- [ ] **Step 8: Run tests; confirm they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/ui/long-press.js src/screens tests/unit/long-press.test.js tests/unit/screens.test.js tests/unit/session.test.js
git commit -m "feat: add garden, home, done screens and session runner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: App wiring and styles (first playable build)

**Files:**
- Modify: `src/main.js` (full replacement)
- Create: `styles/app.css`

**Interfaces:**
- Consumes: everything above. Parent screens are stubbed with `showHome` until Task 12 replaces `showGate`.
- Produces: a playable app at `http://127.0.0.1:4173`.

- [ ] **Step 1: Replace `src/main.js`**

```js
import { createPlayer } from './audio/player.js';
import { stopWhenHidden } from './audio/visibility.js';
import { prompt } from './audio/clips.js';
import { loadProgress, saveProgress, createMemoryStorage } from './state/storage.js';
import { planSession } from './curriculum/scheduler.js';
import { renderHome } from './screens/home.js';
import { runSession } from './screens/session.js';
import { renderDone } from './screens/done.js';

const root = document.getElementById('app');

function deviceStorage() {
  try {
    const storage = window.localStorage;
    storage.getItem('probe');
    return { storage, available: true };
  } catch {
    return { storage: createMemoryStorage(), available: false };
  }
}

const { storage, available } = deviceStorage();
const loaded = loadProgress(storage);
let state = {
  progress: loaded.progress,
  storageStatus: available ? loaded.status : 'unavailable',
  audioErrors: [],
};

const player = createPlayer({
  onError: (src) => {
    state = { ...state, audioErrors: [...new Set([...state.audioErrors, src])].slice(-20) };
  },
});

function save(progress) {
  const ok = saveProgress(storage, progress);
  state = { ...state, progress, storageStatus: ok ? state.storageStatus : 'unavailable' };
}

function showHome() {
  renderHome(root, { progress: state.progress, onPlay: startSession, onParent: showGate });
}

async function startSession() {
  const before = state.progress;
  const planIds = planSession(before);
  await player.play(prompt('lets_play'));
  const after = await runSession({
    container: root,
    progress: before,
    planIds,
    sessionId: `s${Date.now()}`,
    deps: { player },
    save,
  });
  renderDone(root, { before, after, player, onHome: showHome });
}

function showGate() {
  showHome();
}

stopWhenHidden(document, player);
showHome();
```

`await player.play(...)` is the first thing `startSession` does, so `audio.play()` runs synchronously inside the tap handler. That is what unlocks audio on iOS.

- [ ] **Step 2: Write `styles/app.css`**

```css
@font-face { font-family: 'Andika'; src: url('../assets/fonts/andika-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Andika'; src: url('../assets/fonts/andika-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }

:root {
  --bg: #fff7e0; --ink: #3b3024; --leaf: #5fae63; --leaf-dark: #3f8a44; --sun: #ffd166;
  --soil: #b98b5e; --card: #ffffff; --shadow: #e6d9b8; --danger: #b8423f; --tap: 96px;
  font-family: 'Andika', ui-rounded, system-ui, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); overscroll-behavior: none; }
body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
button { font: inherit; color: inherit; border: none; cursor: pointer; }
img { pointer-events: none; -webkit-user-drag: none; }
.app {
  min-height: 100dvh; display: flex; flex-direction: column;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}

/* Home */
.home { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-around; gap: 24px; position: relative; }
.title { margin: 0; font-size: clamp(2rem, 6vw, 3.5rem); color: var(--leaf-dark); }
.parent-gear { position: absolute; top: 0; right: 0; width: 56px; height: 56px; border-radius: 50%; background: transparent; font-size: 1.5rem; opacity: .35; }
.parent-gear.holding { opacity: 1; background: var(--sun); transition: background 2s; }
.play { display: flex; align-items: center; gap: 16px; min-height: var(--tap); padding: 16px 48px; border-radius: 999px; background: var(--leaf); color: #fff; font-size: 2.5rem; font-weight: 700; box-shadow: 0 8px 0 var(--leaf-dark); }
.play:active { transform: translateY(6px); box-shadow: 0 2px 0 var(--leaf-dark); }
.play img { width: 64px; height: 64px; }

/* Garden */
.garden { display: grid; grid-template-columns: repeat(auto-fit, minmax(88px, 1fr)); gap: 12px; width: min(100%, 720px); }
.plot { aspect-ratio: 1; border-radius: 24px; background: var(--soil); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.plot img { width: 60%; }
.plot .seed { width: 16px; height: 16px; border-radius: 50%; background: #6b4a2b; }
.plot-letter { font-size: 1.75rem; font-weight: 700; color: #fff; }
.plot.seed .plot-letter { opacity: .35; }
.plot.bloom img { animation: bloom 1.2s ease-out both; }
@keyframes bloom { 0% { transform: scale(.2) rotate(-20deg); } 70% { transform: scale(1.2) rotate(6deg); } 100% { transform: scale(1); } }

/* Session */
.session { flex: 1; display: flex; flex-direction: column; gap: 16px; }
.dots { display: flex; justify-content: center; gap: 10px; }
.dot { width: 18px; height: 18px; border-radius: 50%; background: var(--shadow); }
.dot.done { background: var(--leaf); }
.stage { flex: 1; display: flex; }
.activity { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; position: relative; }
.activity[data-ready="false"] > .choices, .activity[data-ready="false"] > .tiles { opacity: .6; transition: opacity .2s; }
.replay { position: absolute; top: 0; left: 0; width: var(--tap); height: var(--tap); border-radius: 50%; background: var(--sun); font-size: 2.5rem; }
.focus { width: min(30vw, 200px); }
.choices { display: flex; flex-wrap: wrap; justify-content: center; gap: clamp(16px, 4vw, 48px); }
.choice { width: clamp(140px, 26vw, 240px); aspect-ratio: 1; border-radius: 32px; background: var(--card); box-shadow: 0 8px 0 var(--shadow); display: grid; place-items: center; transition: opacity .3s, transform .2s; }
.choice img { width: 75%; }
.choice .letter { font-size: clamp(4rem, 12vw, 7rem); font-weight: 700; }
.choice.wrong { opacity: .25; transform: scale(.9); }
.choice.right { background: var(--leaf); animation: pop .4s; }
@keyframes pop { 50% { transform: scale(1.1); } }
.tiles { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
.tile { min-width: var(--tap); height: calc(var(--tap) * 1.3); padding: 0 16px; border-radius: 24px; background: var(--card); box-shadow: 0 8px 0 var(--shadow); font-size: clamp(3rem, 9vw, 5rem); font-weight: 700; }
.tile.heard { background: var(--sun); }
.tile:disabled { opacity: .3; }
.tile.wobble { animation: wobble .4s; }
@keyframes wobble { 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); } }
.hop { width: calc(var(--tap) * 1.4); height: calc(var(--tap) * 1.4); border-radius: 50%; background: var(--leaf); animation: pop 1s infinite; }
.hop img { width: 70%; }
.hop[hidden] { display: none; }
.blend-choices { display: flex; width: 100%; }
.blend-choices:empty { display: none; }
.slots { display: flex; gap: 12px; }
.slot { width: 72px; height: 96px; border-bottom: 6px solid var(--ink); font-size: 4rem; font-weight: 700; display: grid; place-items: center; }
.slot[data-hint]:empty::after { content: attr(data-hint); opacity: .25; }

/* Done */
.done { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 32px; }
.home-button { width: calc(var(--tap) * 1.4); height: calc(var(--tap) * 1.4); border-radius: 50%; background: var(--card); box-shadow: 0 8px 0 var(--shadow); }
.home-button img { width: 70%; }

/* Parent area */
.gate, .dashboard, .credits main { width: min(100%, 720px); margin: 0 auto; -webkit-user-select: text; user-select: text; }
.gate-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.gate-option { min-height: 64px; padding: 16px; border-radius: 16px; background: var(--card); font-size: 2rem; box-shadow: 0 4px 0 var(--shadow); }
.dashboard table { width: 100%; border-collapse: collapse; }
.dashboard th, .dashboard td { padding: 8px; text-align: left; border-bottom: 1px solid var(--shadow); }
.dashboard input { width: 100%; padding: 12px; font: inherit; font-size: 1.25rem; border: 2px solid var(--shadow); border-radius: 12px; }
.dashboard .actions { display: flex; flex-wrap: wrap; gap: 12px; }
.dashboard button { min-height: 48px; padding: 12px 20px; border-radius: 12px; background: var(--leaf); color: #fff; font-weight: 700; }
.dashboard button.danger { background: var(--danger); }
.notice { padding: 12px; background: var(--card); border-left: 6px solid var(--sun); }
.error { min-height: 1.5em; color: var(--danger); }
.link { padding: 12px; background: none; text-decoration: underline; }
.credits { padding: 16px; }

/* Print: mini-book */
.print-only { display: none; }
@media print {
  .app { display: none; }
  .print-only { display: block; }
  .mb-title { text-align: center; }
  .mb-page { height: 45vh; display: flex; flex-direction: column; align-items: center; justify-content: center; break-inside: avoid; border-bottom: 1px dashed #999; }
  .mb-page img { width: 35%; }
  .mb-word, .mb-letter { margin: 0; font-size: 5rem; font-weight: 700; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 3: Play it in the browser at tablet size**

```bash
npm run serve
```

Open `http://127.0.0.1:4173` in the browser pane and resize to 1280×800 and to 800×1280. Play one full session. Check that the garden shows s and a as sprouts, prompts are audible, wrong answers grey out, the dots fill, and the done screen appears. Fix any layout breakage before committing.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass (`main.js` is excluded from coverage).

- [ ] **Step 5: Commit**

```bash
git add src/main.js styles/app.css
git commit -m "feat: wire up playable sessions with tablet styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Parent gate, dashboard and mini-book

**Files:**
- Create: `src/parent/gate.js`, `src/parent/report.js`, `src/parent/dashboard.js`, `src/parent/minibook.js`
- Modify: `src/main.js` (replace `showGate` and add the dashboard)
- Test: `tests/unit/gate.test.js`, `tests/unit/report.test.js`, `tests/unit/dashboard.test.js`, `tests/unit/minibook.test.js`

**Interfaces:**
- Consumes: `letterStatus`, `unlockedLetters`, `isMastered`, `isStruggling`, `validateChildName`, `LETTER_ORDER`, `RHYME_SETS`, `BLEND_WORDS`, `imgPath`, `CONFIG`.
- Produces:
  - `makeQuestion(rng) → { text, answer, options[4] }`, `renderGate(container, { rng, onPass, onCancel })` (`.gate`, `.gate p` contains `What is A + B?`)
  - `STATUS_LABELS`, `firstTryRate(progress, id) → number|null`, `describeItem(id) → string`, `practiceList(progress) → string[]`, `sessionsInLastDays(progress, days, now) → number`, `rhymesMastered(progress) → number`
  - `renderDashboard(container, { state, now, confirmFn, onSaveName, onReset, onPrint, onDone })` (`.dashboard`, `#child-name`, `.notice`)
  - `minibookWords(progress) → string[]`, `renderMinibook(target, progress) → pageCount`

- [ ] **Step 1: Write the failing tests**

`tests/unit/gate.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { makeQuestion, renderGate } from '../../src/parent/gate.js';
import { seededRng } from '../helpers.js';

describe('parent gate', () => {
  it.each([1, 2, 3, 4, 5])('makeQuestion (seed %i) has 4 distinct options including the answer', (seed) => {
    const q = makeQuestion(seededRng(seed));
    const [a, b] = q.text.split(' + ').map(Number);
    expect(q.answer).toBe(a + b);
    expect(new Set(q.options).size).toBe(4);
    expect(q.options).toContain(q.answer);
  });

  it('passes on the right answer and cancels on a wrong one', () => {
    const rng = seededRng(1);
    const q = makeQuestion(seededRng(1));
    const root = document.createElement('div');
    const onPass = vi.fn();
    const onCancel = vi.fn();
    renderGate(root, { rng, onPass, onCancel });
    expect(root.querySelector('.gate p').textContent).toBe(`What is ${q.text}?`);
    const buttons = [...root.querySelectorAll('.gate-option')];
    buttons.find((b) => Number(b.textContent) !== q.answer).click();
    expect(onCancel).toHaveBeenCalledOnce();
    buttons.find((b) => Number(b.textContent) === q.answer).click();
    expect(onPass).toHaveBeenCalledOnce();
  });
});
```

`tests/unit/report.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createProgress, recordAttempt, recordSession } from '../../src/state/progress.js';
import { firstTryRate, describeItem, practiceList, sessionsInLastDays, rhymesMastered } from '../../src/parent/report.js';
import { CONFIG } from '../../src/config.js';
import { withMastered } from '../helpers.js';

describe('report', () => {
  it('firstTryRate is a whole percentage or null', () => {
    const p = [true, false, true].reduce((acc, firstTry, at) => recordAttempt(acc, { itemId: 'ls:s', firstTry, sessionId: 's', at }), createProgress());
    expect(firstTryRate(p, 'ls:s')).toBe(67);
    expect(firstTryRate(p, 'ls:a')).toBeNull();
  });

  it.each([
    ['ls:s', 'Letter sound “s”'],
    ['fs:a', 'First sound “a”'],
    ['blend:pin', 'Blending “pin”'],
    ['rhyme:0', 'Rhyming: cat, hat, bat'],
    ['name', 'Spelling their name'],
    ['weird', 'weird'],
  ])('describeItem(%s)', (id, label) => {
    expect(describeItem(id)).toBe(label);
  });

  it('practiceList lists struggling items', () => {
    const p = [1, 2].reduce((acc, at) => recordAttempt(acc, { itemId: 'fs:s', firstTry: false, sessionId: 's', at }), createProgress());
    expect(practiceList(p)).toEqual(['First sound “s”']);
  });

  it('counts sessions within the window and mastered rhymes', () => {
    const now = 10 * CONFIG.DAY_MS;
    const p = [now - 8 * CONFIG.DAY_MS, now - CONFIG.DAY_MS, now].reduce(
      (acc, at, i) => recordSession(acc, { sessionId: `s${i}`, at, itemCount: 8 }), createProgress());
    expect(sessionsInLastDays(p, 7, now)).toBe(2);
    expect(rhymesMastered(withMastered(undefined, ['rhyme:0', 'rhyme:3']))).toBe(2);
  });
});
```

`tests/unit/dashboard.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createProgress } from '../../src/state/progress.js';
import { renderDashboard } from '../../src/parent/dashboard.js';
import { withMastered } from '../helpers.js';

const baseState = { progress: createProgress(), storageStatus: 'loaded', audioErrors: [] };
const render = (overrides = {}, handlers = {}) => {
  const root = document.createElement('div');
  const h = { onSaveName: vi.fn(), onReset: vi.fn(), onPrint: vi.fn(), onDone: vi.fn(), confirmFn: vi.fn(() => true), ...handlers };
  renderDashboard(root, { state: { ...baseState, ...overrides }, now: () => 0, ...h });
  return { root, h };
};
const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text);

describe('renderDashboard', () => {
  it('shows a row per letter with status', () => {
    const { root } = render({ progress: withMastered(undefined, ['ls:s']) });
    const rows = [...root.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toContain('Mastered');
    expect(rows[1]).toContain('Learning');
    expect(rows[2]).toContain('Not started');
  });

  it('validates the name before saving', () => {
    const { root, h } = render();
    const input = root.querySelector('#child-name');
    input.value = 'Ava2';
    button(root, 'Save name').click();
    expect(h.onSaveName).not.toHaveBeenCalled();
    expect(root.querySelector('.error').textContent).toMatch(/letters/);
    input.value = '  Ava ';
    button(root, 'Save name').click();
    expect(h.onSaveName).toHaveBeenCalledWith('Ava');
  });

  it('only resets after confirmation', () => {
    const declined = render({}, { confirmFn: vi.fn(() => false) });
    button(declined.root, 'Reset progress').click();
    expect(declined.h.onReset).not.toHaveBeenCalled();
    const accepted = render();
    button(accepted.root, 'Reset progress').click();
    expect(accepted.h.onReset).toHaveBeenCalledOnce();
  });

  it.each([
    ['reset', /started fresh/],
    ['unavailable', /can't save/],
  ])('explains storage status %s', (storageStatus, text) => {
    expect(render({ storageStatus }).root.querySelector('.notice').textContent).toMatch(text);
  });

  it('warns about sounds that failed to play', () => {
    const { root } = render({ audioErrors: ['assets/audio/word/sun.mp3'] });
    expect(root.textContent).toMatch(/1 sound/);
  });

  it('wires print and done', () => {
    const { root, h } = render();
    button(root, 'Print a mini-book').click();
    button(root, 'Back to the garden').click();
    expect(h.onPrint).toHaveBeenCalledOnce();
    expect(h.onDone).toHaveBeenCalledOnce();
  });
});
```

`tests/unit/minibook.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createProgress } from '../../src/state/progress.js';
import { minibookWords, renderMinibook } from '../../src/parent/minibook.js';
import { withMastered } from '../helpers.js';

describe('minibook', () => {
  it('uses blend words made only of mastered letters', () => {
    expect(minibookWords(withMastered(undefined, ['ls:s', 'ls:i', 'ls:p']))).toEqual(['sip']);
  });

  it('renders word pages, or letter pages when no words are ready', () => {
    const target = document.createElement('div');
    expect(renderMinibook(target, withMastered(undefined, ['ls:s', 'ls:i', 'ls:p']))).toBe(1);
    expect(target.querySelector('.mb-word').textContent).toBe('sip');
    expect(renderMinibook(target, createProgress())).toBe(2);
    expect([...target.querySelectorAll('.mb-letter')].map((n) => n.textContent)).toEqual(['s', 'a']);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/unit/gate.test.js tests/unit/report.test.js tests/unit/dashboard.test.js tests/unit/minibook.test.js`
Expected: FAIL, because the modules were not found.

- [ ] **Step 3: Implement `src/parent/gate.js`**

```js
import { el } from '../ui/dom.js';
import { shuffle } from '../curriculum/random.js';

export function makeQuestion(rng = Math.random) {
  const a = 3 + Math.floor(rng() * 7);
  const b = 3 + Math.floor(rng() * 7);
  const answer = a + b;
  return { text: `${a} + ${b}`, answer, options: shuffle([answer, answer + 1, answer - 2, answer + 3], rng) };
}

export function renderGate(container, { rng = Math.random, onPass, onCancel }) {
  const question = makeQuestion(rng);
  const options = question.options.map((n) => {
    const button = el('button', { class: 'gate-option' }, [String(n)]);
    button.addEventListener('click', () => (n === question.answer ? onPass() : onCancel()));
    return button;
  });
  const back = el('button', { class: 'link' }, ['Back']);
  back.addEventListener('click', onCancel);
  container.replaceChildren(el('div', { class: 'gate' }, [
    el('h2', {}, ['Grown-ups only']),
    el('p', {}, [`What is ${question.text}?`]),
    el('div', { class: 'gate-options' }, options),
    back,
  ]));
}
```

- [ ] **Step 4: Implement `src/parent/report.js`**

```js
import { CONFIG } from '../config.js';
import { RHYME_SETS } from '../curriculum/units.js';
import { isMastered, isStruggling } from '../state/progress.js';

export const STATUS_LABELS = Object.freeze({
  seed: 'Not started', sprout: 'Learning', flower: 'Mastered', thirsty: 'Needs review',
});

export function firstTryRate(progress, itemId) {
  const attempts = progress.items[itemId]?.attempts ?? [];
  if (attempts.length === 0) return null;
  return Math.round((100 * attempts.filter((a) => a.firstTry).length) / attempts.length);
}

export function describeItem(itemId) {
  const [kind, arg] = itemId.split(':');
  const labels = {
    ls: () => `Letter sound “${arg}”`,
    fs: () => `First sound “${arg}”`,
    blend: () => `Blending “${arg}”`,
    rhyme: () => `Rhyming: ${(RHYME_SETS[Number(arg)] ?? []).join(', ')}`,
    name: () => 'Spelling their name',
  };
  return labels[kind] ? labels[kind]() : itemId;
}

export const practiceList = (progress) =>
  Object.keys(progress.items).filter((id) => isStruggling(progress, id)).map(describeItem);

export const sessionsInLastDays = (progress, days, now) =>
  progress.sessions.filter((s) => s.at >= now - days * CONFIG.DAY_MS).length;

export const rhymesMastered = (progress) =>
  RHYME_SETS.filter((_, i) => isMastered(progress, `rhyme:${i}`)).length;
```

- [ ] **Step 5: Implement `src/parent/dashboard.js`**

```js
import { el } from '../ui/dom.js';
import { CONFIG } from '../config.js';
import { LETTER_ORDER, RHYME_SETS } from '../curriculum/units.js';
import { letterStatus } from '../curriculum/unlock.js';
import { validateChildName } from '../state/name.js';
import { STATUS_LABELS, firstTryRate, practiceList, sessionsInLastDays, rhymesMastered } from './report.js';

const STORAGE_NOTICES = Object.freeze({
  reset: "Saved progress couldn't be read, so Sound Sprouts started fresh.",
  unavailable: "This browser can't save progress (private browsing or storage is full). Progress will be lost when the app closes.",
});

function nameSection(progress, onSaveName) {
  const input = el('input', { id: 'child-name', type: 'text', autocomplete: 'off', maxlength: String(CONFIG.NAME_MAX_LENGTH), value: progress.childName });
  const error = el('p', { class: 'error', role: 'alert' });
  const save = el('button', {}, ['Save name']);
  save.addEventListener('click', () => {
    const result = validateChildName(input.value);
    if (!result.ok) { error.textContent = result.error; return; }
    onSaveName(result.value);
  });
  return el('section', {}, [el('h2', {}, ['Child’s name']), el('label', { for: 'child-name' }, ['Shown only on this tablet']), input, error, save]);
}

function lettersSection(progress) {
  const rows = LETTER_ORDER.map((letter) => {
    const rate = firstTryRate(progress, `ls:${letter}`);
    return el('tr', {}, [
      el('td', {}, [letter]),
      el('td', {}, [STATUS_LABELS[letterStatus(progress, letter)]]),
      el('td', {}, [rate === null ? '—' : `${rate}%`]),
    ]);
  });
  return el('section', {}, [el('h2', {}, ['Letter sounds']), el('table', {}, [
    el('thead', {}, [el('tr', {}, [el('th', {}, ['Letter']), el('th', {}, ['Status']), el('th', {}, ['First-try'])])]),
    el('tbody', {}, rows),
  ])]);
}

function noticesSection(state) {
  const notices = [
    STORAGE_NOTICES[state.storageStatus],
    state.audioErrors.length ? `${state.audioErrors.length} sound${state.audioErrors.length === 1 ? '' : 's'} didn't play. Check the connection, then reload.` : null,
  ].filter(Boolean);
  return notices.map((text) => el('p', { class: 'notice' }, [text]));
}

export function renderDashboard(container, { state, now = Date.now, confirmFn = (m) => window.confirm(m), onSaveName, onReset, onPrint, onDone }) {
  const { progress } = state;
  const practice = practiceList(progress);
  const action = (label, handler, cls = '') => {
    const button = el('button', { class: cls }, [label]);
    button.addEventListener('click', handler);
    return button;
  };
  container.replaceChildren(el('div', { class: 'dashboard' }, [
    el('h1', {}, ['Grown-ups']),
    ...noticesSection(state),
    nameSection(progress, onSaveName),
    lettersSection(progress),
    el('section', {}, [
      el('h2', {}, ['This week']),
      el('p', {}, [`${sessionsInLastDays(progress, 7, now())} sessions in the last 7 days · ${rhymesMastered(progress)} of ${RHYME_SETS.length} rhyme sets mastered`]),
      el('h2', {}, ['Needs practice']),
      el('p', {}, [practice.length ? practice.join(' · ') : 'Nothing right now. Great going!']),
    ]),
    el('div', { class: 'actions' }, [
      action('Print a mini-book', onPrint),
      action('Back to the garden', onDone),
      action('Reset progress', () => { if (confirmFn('Erase all learning progress on this tablet? The name is kept.')) onReset(); }, 'danger'),
    ]),
    el('p', {}, [el('a', { href: 'credits.html' }, ['Credits and licenses'])]),
  ]));
}
```

- [ ] **Step 6: Implement `src/parent/minibook.js`**

```js
import { el } from '../ui/dom.js';
import { BLEND_WORDS } from '../curriculum/units.js';
import { unlockedLetters } from '../curriculum/unlock.js';
import { isMastered } from '../state/progress.js';
import { imgPath } from '../audio/clips.js';

export const minibookWords = (progress) =>
  BLEND_WORDS.filter((w) => [...w].every((ch) => isMastered(progress, `ls:${ch}`)));

const wordPage = (w) => el('section', { class: 'mb-page' }, [el('img', { src: imgPath(w), alt: '' }), el('p', { class: 'mb-word' }, [w])]);
const letterPage = (l) => el('section', { class: 'mb-page' }, [el('p', { class: 'mb-letter' }, [l]), el('p', {}, ['Say the sound, then trace it!'])]);

export function renderMinibook(target, progress) {
  const words = minibookWords(progress);
  const pages = words.length ? words.map(wordPage) : unlockedLetters(progress).map(letterPage);
  target.replaceChildren(el('h1', { class: 'mb-title' }, ['My Sound Sprouts Book']), ...pages);
  return pages.length;
}
```

- [ ] **Step 7: Wire the parent area into `src/main.js`**

Add these imports:

```js
import { createProgress, setChildName } from './state/progress.js';
import { renderGate } from './parent/gate.js';
import { renderDashboard } from './parent/dashboard.js';
import { renderMinibook } from './parent/minibook.js';
```

Replace the `showGate` function with:

```js
function showGate() {
  player.stop();
  renderGate(root, { onPass: showDashboard, onCancel: showHome });
}

function showDashboard() {
  renderDashboard(root, {
    state,
    onSaveName: (name) => { save(setChildName(state.progress, name)); showDashboard(); },
    onReset: () => { save({ ...createProgress(), childName: state.progress.childName }); showDashboard(); },
    onPrint: () => { renderMinibook(document.getElementById('print'), state.progress); window.print(); },
    onDone: showHome,
  });
}
```

- [ ] **Step 8: Run tests and check by hand**

Run: `npm test`. Expected: all pass, coverage ≥ 80%.
Then with `npm run serve`: hold the gear for 2 s, answer the sum, set a name, go back and play. The first activity should be name spelling. Check that "Print a mini-book" shows letter pages in the print preview.

- [ ] **Step 9: Commit**

```bash
git add src/parent src/main.js tests/unit/gate.test.js tests/unit/report.test.js tests/unit/dashboard.test.js tests/unit/minibook.test.js
git commit -m "feat: add parent gate, dashboard and printable mini-book

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Installable offline PWA

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `tools/site-files.mjs`, `tools/gen-precache.mjs`, `tools/build-site.mjs`, `tools/make-icons.mjs`, `precache.js` (generated), `assets/icons/*.png` (generated)
- Modify: `src/main.js` (register the service worker)
- Test: `tests/unit/sw.test.js`

**Interfaces:**
- Produces: `self.PRECACHE = { version, files }` (precache.js); service-worker functions `parseRange(header, size) → { start, end } | null`; npm scripts `precache`, `precache:check`, `build:site`, `icons`.

- [ ] **Step 1: Write the failing test `tests/unit/sw.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadServiceWorker() {
  const listeners = {};
  const context = {
    self: { PRECACHE: { version: 'test', files: [] }, addEventListener: (t, fn) => { listeners[t] = fn; }, location: { origin: 'http://x' } },
    importScripts: () => {},
    caches: {},
    Response: globalThis.Response,
    URL: globalThis.URL,
    Promise,
  };
  vm.runInNewContext(readFileSync('sw.js', 'utf8'), context);
  return { context, listeners };
}

describe('service worker', () => {
  const { context, listeners } = loadServiceWorker();

  it('registers install, activate and fetch handlers', () => {
    expect(Object.keys(listeners).sort()).toEqual(['activate', 'fetch', 'install']);
  });

  it.each([
    ['bytes=0-99', 1000, { start: 0, end: 99 }],
    ['bytes=500-', 1000, { start: 500, end: 999 }],
    ['bytes=-100', 1000, { start: 900, end: 999 }],
    ['bytes=0-5000', 1000, { start: 0, end: 999 }],
    ['bytes=1000-', 1000, null],
    ['bytes=-', 1000, null],
    ['items=0-1', 1000, null],
    [null, 1000, null],
  ])('parseRange(%j, %i)', (header, size, expected) => {
    expect(context.parseRange(header, size)).toEqual(expected);
  });

  it('serves a 206 slice from a cached response', async () => {
    const request = { headers: new Headers({ range: 'bytes=2-4' }) };
    const cached = new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), { headers: { 'Content-Type': 'audio/mpeg' } });
    const res = await context.rangedResponse(request, cached);
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 2-4/6');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([2, 3, 4]);
  });

  it('returns 416 for an unsatisfiable range', async () => {
    const res = await context.rangedResponse({ headers: new Headers({ range: 'bytes=10-' }) }, new Response(new Uint8Array(3)));
    expect(res.status).toBe(416);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/sw.test.js`
Expected: FAIL with ENOENT for `sw.js`.

- [ ] **Step 3: Write `sw.js`**

```js
/* Sound Sprouts service worker: cache-first, with Range support so iOS can play cached audio. */
importScripts('./precache.js');

const CACHE_PREFIX = 'sound-sprouts-';
const CACHE_NAME = `${CACHE_PREFIX}${self.PRECACHE.version}`;

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') return { start: Math.max(0, size - Number(match[2])), end: size - 1 };
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start < size && start <= end ? { start, end } : null;
}

async function rangedResponse(request, response) {
  const buffer = await response.arrayBuffer();
  const range = parseRange(request.headers.get('range'), buffer.byteLength);
  if (!range) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${buffer.byteLength}` } });
  }
  return new Response(buffer.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'audio/mpeg',
      'Content-Range': `bytes ${range.start}-${range.end}/${buffer.byteLength}`,
      'Content-Length': String(range.end - range.start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

async function respond(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (!cached) return fetch(request);
  return request.headers.has('range') ? rangedResponse(request, cached) : cached;
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then((cache) => cache.addAll(self.PRECACHE.files))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(respond(request));
});
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run tests/unit/sw.test.js`
Expected: PASS.

- [ ] **Step 5: Write `tools/site-files.mjs`, `tools/gen-precache.mjs` and `tools/build-site.mjs`**

`tools/site-files.mjs`:

```js
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const APP_ROOTS = Object.freeze(['index.html', 'credits.html', 'manifest.webmanifest', 'styles', 'src', 'assets']);
export const SITE_ENTRIES = Object.freeze([...APP_ROOTS, 'sw.js', 'precache.js']);
const IGNORED = /(^|\/)(\.DS_Store|SOURCES\.md)$/;

const walk = (path) => (statSync(path).isDirectory()
  ? readdirSync(path).sort().flatMap((name) => walk(join(path, name)))
  : [path]);

export const appFiles = () => APP_ROOTS.flatMap(walk).map((f) => f.split('\\').join('/')).filter((f) => !IGNORED.test(f));
```

`tools/gen-precache.mjs`:

```js
// Writes precache.js (file list + content hash). Usage: node tools/gen-precache.mjs [--check]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { appFiles } from './site-files.mjs';

const files = appFiles();
const hash = createHash('sha256');
files.forEach((f) => { hash.update(f); hash.update(readFileSync(f)); });
const manifest = { version: hash.digest('hex').slice(0, 12), files: ['./', ...files.map((f) => `./${f}`)] };
const body = `// Generated by tools/gen-precache.mjs. Do not edit.\nself.PRECACHE = ${JSON.stringify(manifest, null, 2)};\n`;

if (process.argv.includes('--check')) {
  const current = existsSync('precache.js') ? readFileSync('precache.js', 'utf8') : '';
  if (current !== body) {
    process.stderr.write('precache.js is stale. Run: npm run precache\n');
    process.exit(1);
  }
  process.stdout.write('precache.js is up to date\n');
} else {
  writeFileSync('precache.js', body);
  process.stdout.write(`precache.js: ${manifest.files.length} files, version ${manifest.version}\n`);
}
```

`tools/build-site.mjs`:

```js
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { SITE_ENTRIES } from './site-files.mjs';

rmSync('_site', { recursive: true, force: true });
mkdirSync('_site');
SITE_ENTRIES.forEach((entry) => cpSync(entry, `_site/${entry}`, { recursive: true }));
rmSync('_site/assets/audio/SOURCES.md', { force: true });
process.stdout.write('Built _site/\n');
```

- [ ] **Step 6: Write `tools/make-icons.mjs` and `manifest.webmanifest`**

`tools/make-icons.mjs`:

```js
// Renders the OpenMoji seedling onto a cream background as PWA icons, using Playwright's Chromium.
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = Buffer.from(readFileSync('assets/img/seedling.svg')).toString('base64');
const ICONS = [
  { size: 180, file: 'icon-180.png', inset: 0.12 },
  { size: 192, file: 'icon-192.png', inset: 0.12 },
  { size: 512, file: 'icon-512.png', inset: 0.12 },
  { size: 512, file: 'icon-maskable-512.png', inset: 0.25 },
];

mkdirSync('assets/icons', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { size, file, inset } of ICONS) {
    const inner = Math.round(size * (1 - 2 * inset));
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:#fff7e0">
      <img src="data:image/svg+xml;base64,${svg}" style="width:${inner}px;height:${inner}px"></body>`);
    await page.screenshot({ path: `assets/icons/${file}` });
  }
} finally {
  await browser.close();
}
process.stdout.write(`Wrote ${ICONS.length} icons\n`);
```

`manifest.webmanifest`:

```json
{
  "name": "Sound Sprouts",
  "short_name": "Sprouts",
  "description": "A free phonics garden for young readers.",
  "start_url": "./",
  "scope": "./",
  "display": "fullscreen",
  "orientation": "any",
  "background_color": "#fff7e0",
  "theme_color": "#7cc47f",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Add scripts:

```bash
npm pkg set scripts.icons="node tools/make-icons.mjs" scripts.precache="node tools/gen-precache.mjs" scripts.precache:check="node tools/gen-precache.mjs --check" scripts.build:site="node tools/build-site.mjs"
npx playwright install chromium webkit
npm run icons && npm run precache
```

- [ ] **Step 7: Register the service worker in `src/main.js`**

Append to the end of `src/main.js`:

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    state = { ...state, audioErrors: [...state.audioErrors, 'offline mode unavailable'] };
  });
}
```

Then regenerate the precache (main.js changed): `npm run precache`.

- [ ] **Step 8: Verify**

Run: `npm test && npm run precache:check && npm run build:site && ls _site`
Expected: tests pass; "precache.js is up to date"; `_site` contains `index.html sw.js precache.js manifest.webmanifest credits.html styles src assets`.

- [ ] **Step 9: Commit**

```bash
git add sw.js precache.js manifest.webmanifest tools/site-files.mjs tools/gen-precache.mjs tools/build-site.mjs tools/make-icons.mjs assets/icons src/main.js package.json tests/unit/sw.test.js
git commit -m "feat: make Sound Sprouts an installable offline PWA

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: End-to-end tests on Android and iPad profiles

**Files:**
- Create: `playwright.config.js`, `tests/e2e/helpers.js`, `tests/e2e/session.spec.js`, `tests/e2e/parent.spec.js`, `tests/e2e/offline.spec.js`

**Interfaces:**
- Consumes: the DOM contracts from Tasks 8–12 (`.pick-one[data-ready]`, `[data-correct]`, `.blend`, `.tile[data-index]`, `.hop`, `.name-spell`, `.tile[data-char]`, `.dot.done`, `.done`, `.gate p`, `.dashboard`, `.notice`).

- [ ] **Step 1: Write `playwright.config.js`**

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: { command: 'npx http-server . -p 4173 -c-1 --silent', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'android-tablet', use: { ...devices['Galaxy Tab S4 landscape'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
  ],
});
```

- [ ] **Step 2: Write `tests/e2e/helpers.js`**

```js
import { expect } from '@playwright/test';

// Aborting audio makes every clip fail instantly, so sessions run fast; the player must cope (Review Focus 2).
export const blockAudio = (page) => page.route('**/*.mp3', (route) => route.abort());

async function pickCorrect(page) {
  const ready = page.locator('.pick-one[data-ready="true"]');
  await ready.waitFor();
  await ready.locator('[data-correct="true"]').click();
}

async function blendWord(page) {
  const blend = page.locator('.blend');
  const tiles = blend.locator('.tile');
  const count = await tiles.count();
  for (let i = 0; i < count; i += 1) {
    await expect(blend).toHaveAttribute('data-ready', 'true');
    await tiles.nth(i).click();
  }
  await expect(blend).toHaveAttribute('data-ready', 'true');
  await blend.locator('.hop').click();
  await pickCorrect(page);
}

async function spellName(page, name) {
  const spell = page.locator('.name-spell');
  for (const ch of name) {
    await expect(spell).toHaveAttribute('data-ready', 'true');
    await spell.locator(`.tile[data-char="${ch}"]:not([disabled])`).first().click();
  }
}

async function answerCurrent(page, name) {
  const activity = page.locator('.stage > .activity');
  await activity.waitFor();
  const cls = await activity.getAttribute('class');
  if (cls.includes('name-spell')) return spellName(page, name);
  if (cls.includes('blend')) return blendWord(page);
  return pickCorrect(page);
}

export async function playWholeSession(page, { name = '' } = {}) {
  await page.getByRole('button', { name: 'Play' }).click();
  const dots = page.locator('.dot');
  await dots.first().waitFor();
  const total = await dots.count();
  for (let step = 0; step < total; step += 1) {
    await answerCurrent(page, name);
    await expect(page.locator('.dot.done')).toHaveCount(step + 1);
  }
  await expect(page.locator('.done')).toBeVisible();
  return total;
}

export async function openParentDashboard(page) {
  const gear = page.getByRole('button', { name: /Grown-ups/ });
  const box = await gear.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  const question = await page.locator('.gate p').textContent();
  const [, a, b] = /(\d+) \+ (\d+)/.exec(question);
  await page.getByRole('button', { name: String(Number(a) + Number(b)), exact: true }).click();
  await expect(page.locator('.dashboard')).toBeVisible();
}
```

- [ ] **Step 3: Write `tests/e2e/session.spec.js`**

```js
import { test, expect } from '@playwright/test';
import { blockAudio, playWholeSession } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockAudio(page);
  await page.goto('/');
});

test('home shows the garden with two sprouts', async ({ page }) => {
  await expect(page.locator('.plot')).toHaveCount(6);
  await expect(page.locator('.plot[data-status="sprout"]')).toHaveCount(2);
});

test('a full session completes and is saved', async ({ page }) => {
  const total = await playWholeSession(page);
  expect(total).toBe(8);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(saved.sessions).toHaveLength(1);
  await page.getByRole('button', { name: 'Back to the garden' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('choices are big enough for small fingers', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  const choice = page.locator('.choice').first();
  await choice.waitFor();
  const box = await choice.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(96);
  expect(box.height).toBeGreaterThanOrEqual(96);
});

test('progress from a half-finished session survives a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  const ready = page.locator('.pick-one[data-ready="true"]');
  await ready.waitFor();
  await ready.locator('[data-correct="true"]').click();
  await expect(page.locator('.dot.done')).toHaveCount(1);
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(Object.keys(saved.items)).toHaveLength(1);
});

test('the page never scrolls sideways', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await page.locator('.activity').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
```

- [ ] **Step 4: Write `tests/e2e/parent.spec.js`**

```js
import { test, expect } from '@playwright/test';
import { blockAudio, openParentDashboard, playWholeSession } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockAudio(page); });

test('parent sets a name and the next session starts by spelling it', async ({ page }) => {
  await page.goto('/');
  await openParentDashboard(page);
  await page.locator('#child-name').fill('Zoë');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.getByRole('button', { name: 'Back to the garden' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.stage > .activity')).toHaveClass(/name-spell/);
  await page.goto('/');
  await playWholeSession(page, { name: 'Zoë' });
});

test('a wrong gate answer goes back home', async ({ page }) => {
  await page.goto('/');
  const gear = page.getByRole('button', { name: /Grown-ups/ });
  const box = await gear.boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  const question = await page.locator('.gate p').textContent();
  const [, a, b] = /(\d+) \+ (\d+)/.exec(question);
  const wrong = page.locator('.gate-option').filter({ hasNotText: new RegExp(`^${Number(a) + Number(b)}$`) }).first();
  await wrong.click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('corrupted saved data starts fresh and tells the parent', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('sound-sprouts:v1', '{not json');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');
  await expect(page.locator('.plot[data-status="sprout"]')).toHaveCount(2);
  await openParentDashboard(page);
  await expect(page.locator('.notice').first()).toContainText('started fresh');
});
```


- [ ] **Step 5: Write `tests/e2e/offline.spec.js`**

```js
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('works offline after the first visit', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Offline service-worker check runs in Chromium');
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  const audioOk = await page.evaluate(async () => (await fetch('assets/audio/prompt/lets_play.mp3', { headers: { range: 'bytes=0-9' } })).status);
  expect(audioOk).toBe(206);
});
```

- [ ] **Step 6: Run the E2E suite**

Run: `npm run e2e`
Expected: all specs pass on `android-tablet` and `ipad`; the offline spec is skipped on `ipad`. If a selector times out, open the trace (`npx playwright show-trace test-results/**/trace.zip`) and fix the app, not the test, unless the test is wrong.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.js tests/e2e
git commit -m "test: add tablet E2E coverage for sessions, parent area and offline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: GitHub repo, CI deploy and on-device check (USER CHECKPOINT)

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Test and deploy

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run precache:check
      - run: npx playwright install --with-deps chromium webkit
      - run: npm run e2e
        env:
          CI: 'true'
      - run: npm run build:site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Before committing, check each action's latest major version on its GitHub releases page and bump it if a newer one exists.

- [ ] **Step 2: Write `README.md`**

````markdown
# Sound Sprouts 🌱

A free, ad-free phonics garden for young readers. Runs in a tablet browser, works offline, stores progress only on the device.

## Use it
Open the site on the tablet, then **Add to Home screen** (Chrome menu on Android, Share → Add to Home Screen on iPad).
Grown-ups: press and hold the ⚙ in the corner for 2 seconds.

## Develop
```bash
npm install
npm test          # unit tests + coverage
npm run e2e       # Playwright (Android tablet + iPad profiles)
npm run serve     # http://127.0.0.1:4173
npm run precache  # after changing any app file
```

Content tools (`tools/`) rebuild speech (Piper + ffmpeg), pictures (OpenMoji) and fonts. See `assets/audio/SOURCES.md` and `credits.html`.
````

- [ ] **Step 3: Commit locally**

```bash
npm run precache && npm test && npm run precache:check
git add .github README.md precache.js
git commit -m "ci: test and deploy to GitHub Pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: USER CHECKPOINT. Ask before publishing**

Ask the user: "Ready to create a **public** GitHub repo `Spoonman1091/sound-sprouts` and publish to `https://spoonman1091.github.io/sound-sprouts/`? The repo has no personal data; the child's name only lives on the tablet." **Wait for an explicit yes.**

- [ ] **Step 5: Create the repo, enable Pages and push (only after yes)**

```bash
gh repo create Spoonman1091/sound-sprouts --public --source . --remote origin --description "Free phonics garden for young readers"
gh api -X POST repos/Spoonman1091/sound-sprouts/pages -f build_type=workflow
git push -u origin main
gh run watch --exit-status
```

Expected: the workflow passes and the deploy job prints the Pages URL.

- [ ] **Step 6: On-device checklist (with the user)**

Have the user open the URL on the Android tablet and, if available, an iPad:
1. Add it to the home screen; it launches full-screen with the seedling icon.
2. Tap Play: the first prompt is audible (audio unlocked by the tap).
3. Finish a session; the done screen plays.
4. Turn on airplane mode, relaunch from the home screen, and play: audio still works (the Range path on iPad).
5. Lock the screen mid-prompt: audio stops; unlock and tap 🔊 to replay.
6. In the parent area, set her name; the next session starts with name spelling.

Record any failures as follow-up tasks.

---

## Out of scope for slice 1 (next plans)

- Letters beyond s/a/t/p/i/n (m, d, g, o, c, k, …), digraphs, sight words, decodable sentences and stories.
- An in-app recorder for parent-voiced phonemes (only if Task 2 finds no acceptable clip).
- Multiple child profiles; progress export/import between devices.
