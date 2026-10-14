// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRecorderServer, MAX_UPLOAD_BYTES } from '../../tools/recorder/server.mjs';
import { RECORDING_CLIPS, findClip } from '../../tools/recorder/clips.mjs';

let server;
afterEach(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function start(overrides = {}) {
  const deps = {
    readPage: vi.fn(async () => '<!doctype html><title>Recorder</title>'),
    hasClip: vi.fn((id) => id === 's'),
    readClip: vi.fn(async (id) => (id === 's' ? Buffer.from([1, 2, 3]) : null)),
    saveClip: vi.fn(async () => {}),
    ...overrides,
  };
  server = createRecorderServer(deps);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { deps, base };
}

describe('recording clips', () => {
  it('covers the six slice-1 sounds, each with a tip', () => {
    expect(RECORDING_CLIPS.map((c) => c.id)).toEqual(['s', 'a', 't', 'p', 'i', 'n']);
    RECORDING_CLIPS.forEach((c) => expect(c.tip.length).toBeGreaterThan(10));
    expect(findClip('t').id).toBe('t');
    expect(findClip('../x')).toBeNull();
  });
});

describe('recorder server', () => {
  it('serves the recorder page', async () => {
    const { base } = await start();
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('Recorder');
  });

  it('lists clips with whether each is recorded', async () => {
    const { base } = await start();
    const clips = await (await fetch(`${base}/clips`)).json();
    expect(clips.find((c) => c.id === 's').recorded).toBe(true);
    expect(clips.find((c) => c.id === 'a').recorded).toBe(false);
  });

  it('saves an upload for a known clip', async () => {
    const { base, deps } = await start();
    const res = await fetch(`${base}/save/a`, { method: 'POST', body: new Uint8Array([9, 9]) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deps.saveClip).toHaveBeenCalledWith('a', Buffer.from([9, 9]));
  });

  it.each(['zzz', '..%2Fevil', ''])('rejects unknown clip id %j', async (id) => {
    const { base, deps } = await start();
    const res = await fetch(`${base}/save/${id}`, { method: 'POST', body: new Uint8Array([1]) });
    expect(res.status).toBe(404);
    expect(deps.saveClip).not.toHaveBeenCalled();
  });

  it('rejects empty and oversized uploads', async () => {
    const { base, deps } = await start();
    expect((await fetch(`${base}/save/s`, { method: 'POST', body: new Uint8Array(0) })).status).toBe(400);
    const big = await fetch(`${base}/save/s`, { method: 'POST', body: new Uint8Array(MAX_UPLOAD_BYTES + 1) });
    expect(big.status).toBe(413);
    expect(deps.saveClip).not.toHaveBeenCalled();
  });

  it('reports a failed conversion without crashing', async () => {
    const { base } = await start({ saveClip: vi.fn(async () => { throw new Error('ffmpeg exploded'); }) });
    const res = await fetch(`${base}/save/s`, { method: 'POST', body: new Uint8Array([1]) });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'Could not process that recording. Try again.' });
  });

  it('plays back saved clips and 404s missing ones', async () => {
    const { base } = await start();
    const res = await fetch(`${base}/audio/s`);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
    expect((await fetch(`${base}/audio/a`)).status).toBe(404);
    expect((await fetch(`${base}/audio/nope`)).status).toBe(404);
  });

  it('404s anything else', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/etc/passwd`)).status).toBe(404);
  });
});
