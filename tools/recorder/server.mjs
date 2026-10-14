// Local-only recorder: serves recorder.html and saves takes as trimmed, normalised MP3s.
// Usage: npm run record  →  http://localhost:4174
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync, writeFileSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { RECORDING_GROUPS, findClip } from './clips.mjs';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PORT = 4174;
const AUDIO_DIR = 'assets/audio';
export const RECORDED_MANIFEST = 'tools/recorder/recorded.json';
// Trim only true silence (-55 dB) so soft endings like the "s" in "grows" survive, then add a short natural tail.
const CLEAN_FILTER = [
  'highpass=f=80',
  'silenceremove=start_periods=1:start_threshold=-50dB', 'afade=t=in:d=0.01', 'areverse',
  'silenceremove=start_periods=1:start_threshold=-55dB', 'afade=t=in:d=0.04', 'areverse',
  'loudnorm=I=-16',
  'apad=pad_dur=0.25',
].join(',');

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    req.on('end', () => resolve(size > limit ? null : Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleSave(req, res, clip, deps) {
  const body = await readBody(req, MAX_UPLOAD_BYTES);
  if (body === null) return send(res, 413, { ok: false, error: 'Recording is too long.' });
  if (body.length === 0) return send(res, 400, { ok: false, error: 'Recording was empty.' });
  try {
    await deps.saveClip(clip, body);
    return send(res, 200, { ok: true });
  } catch (error) {
    process.stderr.write(`Saving ${clip.kind}/${clip.id} failed: ${error.message}\n`);
    return send(res, 500, { ok: false, error: 'Could not process that recording. Try again.' });
  }
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const hostnameOf = (value) => {
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return '';
  }
};

// Only our own page may talk to us: blocks DNS rebinding (Host) and cross-site writes (Origin + custom header,
// which forces a CORS preflight that this server never approves).
function isTrusted(req) {
  if (!LOCAL_HOSTNAMES.has(hostnameOf(req.headers.host ?? ''))) return false;
  const { origin } = req.headers;
  if (origin && !LOCAL_HOSTNAMES.has(hostnameOf(origin.replace(/^https?:\/\//, '')))) return false;
  return req.method !== 'POST' || req.headers['x-recorder'] === '1';
}

async function route(req, res, deps) {
  if (!isTrusted(req)) return send(res, 403, { ok: false, error: 'Forbidden.' });
  const [, action = '', rawKind = '', rawId = ''] = new URL(req.url, 'http://localhost').pathname.split('/');
  const clip = findClip(decodeURIComponent(rawKind), decodeURIComponent(rawId));
  if (req.method === 'GET' && action === '' && rawKind === '') return send(res, 200, await deps.readPage(), 'text/html; charset=utf-8');
  if (req.method === 'GET' && action === 'clips') {
    return send(res, 200, RECORDING_GROUPS.map((group) => ({
      ...group,
      clips: group.clips.map((c) => ({ ...c, kind: group.kind, recorded: deps.hasClip({ ...c, kind: group.kind }) })),
    })));
  }
  if (req.method === 'GET' && action === 'audio' && clip) {
    const audio = await deps.readClip(clip);
    return audio ? send(res, 200, audio, 'audio/mpeg') : send(res, 404, { ok: false, error: 'Not recorded yet.' });
  }
  if (req.method === 'POST' && action === 'save' && clip) return handleSave(req, res, clip, deps);
  return send(res, 404, { ok: false, error: 'Not found.' });
}

export function createRecorderServer(deps) {
  return createServer((req, res) => {
    route(req, res, deps).catch((error) => {
      process.stderr.write(`Recorder error: ${error.message}\n`);
      send(res, 500, { ok: false, error: 'Something went wrong.' });
    });
  });
}

const clipPath = (clip) => `${AUDIO_DIR}/${clip.kind}/${clip.id}.mp3`;

export function readRecorded(path = RECORDED_MANIFEST) {
  try {
    const list = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function markRecorded(clip) {
  const key = `${clip.kind}/${clip.id}`;
  const list = readRecorded();
  if (!list.includes(key)) writeFileSync(RECORDED_MANIFEST, `${JSON.stringify([...list, key].sort(), null, 2)}\n`);
}

// Cleans a raw take (any browser format) into a levelled MP3 at outPath.
export function processTake(input, outPath) {
  const dir = mkdtempSync(join(tmpdir(), 'sound-sprouts-'));
  try {
    const raw = join(dir, 'take');
    writeFileSync(raw, input);
    const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-protocol_whitelist', 'file', '-i', raw, '-af', CLEAN_FILTER, '-ac', '1', '-ar', '44100', '-b:a', '96k', outPath], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'ffmpeg failed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function convertToMp3(clip, input) {
  const dir = mkdtempSync(join(tmpdir(), 'sound-sprouts-'));
  try {
    const mp3 = join(dir, 'clip.mp3');
    processTake(input, mp3);
    mkdirSync(`${AUDIO_DIR}/${clip.kind}`, { recursive: true });
    copyFileSync(mp3, clipPath(clip));
    markRecorded(clip);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const isRecorded = (clip) => readRecorded().includes(`${clip.kind}/${clip.id}`);

const realDeps = {
  readPage: () => readFile(new URL('./recorder.html', import.meta.url), 'utf8'),
  hasClip: (clip) => isRecorded(clip) && existsSync(clipPath(clip)),
  readClip: async (clip) => (existsSync(clipPath(clip)) ? readFile(clipPath(clip)) : null),
  saveClip: async (clip, buffer) => convertToMp3(clip, buffer),
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  createRecorderServer(realDeps).listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`Recorder running at http://localhost:${PORT}  (Ctrl+C to stop)\n`);
  });
}
