// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { request } from 'node:http';
import { createRecorderServer, MAX_UPLOAD_BYTES } from '../../tools/recorder/server.mjs';
import { RECORDING_GROUPS, RECORDING_CLIPS, findClip } from '../../tools/recorder/clips.mjs';
import { selectJobs } from '../../tools/build-audio.mjs';
import { PROMPT_IDS } from '../../src/audio/clips.js';
import { PICTURE_WORDS, SIGHT_WORDS } from '../../src/curriculum/units.js';

let server;
afterEach(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function start(overrides = {}) {
  const deps = {
    readPage: vi.fn(async () => '<!doctype html><title>Recorder</title>'),
    hasClip: vi.fn((clip) => clip.kind === 'phoneme' && clip.id === 's'),
    readClip: vi.fn(async (clip) => (clip.kind === 'phoneme' && clip.id === 's' ? Buffer.from([1, 2, 3]) : null)),
    saveClip: vi.fn(async () => {}),
    ...overrides,
  };
  server = createRecorderServer(deps);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { deps, base: `http://127.0.0.1:${server.address().port}` };
}

describe('recording clips', () => {
  it('groups letter sounds, prompts, sight words, picture words and letter names', () => {
    expect(RECORDING_GROUPS.map((g) => g.kind)).toEqual(['phoneme', 'prompt', 'word', 'word', 'letter']);
    expect(RECORDING_GROUPS[2]).toMatchObject({ title: 'Sight words', optional: false });
    expect(RECORDING_GROUPS[2].clips.map((c) => c.label)).toEqual(['the', 'I', 'a', 'is']);
    const ids = (kind) => RECORDING_CLIPS.filter((c) => c.kind === kind).map((c) => c.id);
    expect(ids('phoneme')).toEqual(['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'e', 'u', 'h', 'r', 'f', 'b', 'l', 'j', 'v', 'w', 'x', 'y', 'z', 'q', 'sh', 'ch', 'th', 'ng', 'ee', 'oo', 'ai']);
    expect(ids('prompt').sort()).toEqual([...PROMPT_IDS].sort());
    expect(ids('word').sort()).toEqual([...PICTURE_WORDS, ...Object.keys(SIGHT_WORDS)].sort());
    expect(ids('letter')).toHaveLength(26);
  });

  it('gives every clip a label and a tip, and looks clips up by kind', () => {
    RECORDING_CLIPS.forEach((c) => {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.tip.length).toBeGreaterThan(10);
    });
    expect(findClip('prompt', 'try_again').label).toBe("Hmm. Let's try again.");
    expect(findClip('phoneme', 'try_again')).toBeNull();
    expect(findClip('phoneme', '../x')).toBeNull();
  });
});

const post = (url, body, headers = {}) => fetch(url, { method: 'POST', body, headers: { 'X-Recorder': '1', ...headers } });

function rawGet(base, path, host) {
  const { port } = new URL(base);
  return new Promise((resolve, reject) => {
    request({ host: '127.0.0.1', port, path, headers: { Host: host } }, (res) => { res.resume(); resolve(res.statusCode); })
      .on('error', reject).end();
  });
}

describe('recorder server', () => {
  it('serves the recorder page', async () => {
    const { base } = await start();
    const res = await fetch(`${base}/`);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('Recorder');
  });

  it('lists groups with whether each clip is recorded', async () => {
    const { base } = await start();
    const groups = await (await fetch(`${base}/clips`)).json();
    const phonemes = groups.find((g) => g.kind === 'phoneme').clips;
    expect(phonemes.find((c) => c.id === 's').recorded).toBe(true);
    expect(phonemes.find((c) => c.id === 'a').recorded).toBe(false);
  });

  it('saves an upload for a known clip', async () => {
    const { base, deps } = await start();
    const res = await post(`${base}/save/prompt/try_again`, new Uint8Array([9, 9]));
    expect(await res.json()).toEqual({ ok: true });
    expect(deps.saveClip).toHaveBeenCalledWith(expect.objectContaining({ kind: 'prompt', id: 'try_again' }), Buffer.from([9, 9]));
  });

  it.each(['phoneme/zzz', 'prompt/s', '..%2Fevil/s', 'phoneme/..%2F..%2Fx', 'phoneme'])('rejects unknown clip %j', async (path) => {
    const { base, deps } = await start();
    const res = await post(`${base}/save/${path}`, new Uint8Array([1]));
    expect(res.status).toBe(404);
    expect(deps.saveClip).not.toHaveBeenCalled();
  });

  it('rejects empty and oversized uploads', async () => {
    const { base, deps } = await start();
    expect((await post(`${base}/save/phoneme/s`, new Uint8Array(0))).status).toBe(400);
    const big = await post(`${base}/save/phoneme/s`, new Uint8Array(MAX_UPLOAD_BYTES + 1));
    expect(big.status).toBe(413);
    expect(deps.saveClip).not.toHaveBeenCalled();
  });

  it('reports a failed conversion without crashing', async () => {
    const { base } = await start({ saveClip: vi.fn(async () => { throw new Error('ffmpeg exploded'); }) });
    const res = await post(`${base}/save/phoneme/s`, new Uint8Array([1]));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'Could not process that recording. Try again.' });
  });

  it('plays back saved clips and 404s missing ones', async () => {
    const { base } = await start();
    const res = await fetch(`${base}/audio/phoneme/s`);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
    expect((await fetch(`${base}/audio/phoneme/a`)).status).toBe(404);
    expect((await fetch(`${base}/audio/phoneme/nope`)).status).toBe(404);
  });

  it('refuses saves without the recorder header (blocks cross-site simple POSTs)', async () => {
    const { base, deps } = await start();
    const res = await fetch(`${base}/save/phoneme/s`, { method: 'POST', body: new Uint8Array([1]) });
    expect(res.status).toBe(403);
    expect(deps.saveClip).not.toHaveBeenCalled();
  });

  it('refuses saves from another origin', async () => {
    const { base, deps } = await start();
    const res = await post(`${base}/save/phoneme/s`, new Uint8Array([1]), { Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(deps.saveClip).not.toHaveBeenCalled();
  });

  it('refuses requests whose Host is not localhost (DNS rebinding)', async () => {
    const { base } = await start();
    expect(await rawGet(base, '/clips', 'evil.example:4174')).toBe(403);
    expect(await rawGet(base, '/clips', 'localhost:4174')).toBe(200);
  });

  it('404s anything else', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/etc/passwd`)).status).toBe(404);
  });
});

describe('build-audio job selection', () => {
  const jobs = [['prompt', 'try_again', 'x'], ['prompt', 'lets_play', 'y'], ['word', 'sun', 'z']];

  it('skips existing clips unless forced', () => {
    const exists = (kind, id) => id === 'sun';
    expect(selectJobs(jobs, { force: false, exists, recorded: [] }).map((j) => j[1])).toEqual(['try_again', 'lets_play']);
    expect(selectJobs(jobs, { force: true, exists, recorded: [] })).toHaveLength(3);
  });

  it('never regenerates a human recording, even when forced', () => {
    const picked = selectJobs(jobs, { force: true, exists: () => true, recorded: ['prompt/try_again'] });
    expect(picked.map((j) => j[1])).toEqual(['lets_play', 'sun']);
  });
});
