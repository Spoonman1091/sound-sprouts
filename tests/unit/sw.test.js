// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadServiceWorker(caches = {}) {
  const listeners = {};
  const context = {
    self: {
      PRECACHE: { version: 'test', files: ['./', './index.html'] },
      addEventListener: (t, fn) => { listeners[t] = fn; },
      location: { origin: 'http://x' },
      skipWaiting: () => Promise.resolve(),
    },
    importScripts: () => {},
    caches,
    Request: class { constructor(url, init = {}) { this.url = url; this.cache = init.cache ?? 'default'; } },
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
    const result = context.parseRange(header, size);
    expect(result === null ? null : { ...result }).toEqual(expected);
  });

  it('serves a 206 slice from a cached response', async () => {
    const request = { headers: new Headers({ range: 'bytes=2-4' }) };
    const cached = new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), { headers: { 'Content-Type': 'audio/mpeg' } });
    const res = await context.rangedResponse(request, cached);
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 2-4/6');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([2, 3, 4]);
  });

  it('install bypasses the HTTP cache so a new version never stores stale files', async () => {
    const added = [];
    const fakeCaches = { open: async () => ({ addAll: async (reqs) => { added.push(...reqs); } }) };
    const sw = loadServiceWorker(fakeCaches);
    let waited;
    sw.listeners.install({ waitUntil: (p) => { waited = p; } });
    await waited;
    expect(added.map((r) => [r.url, r.cache])).toEqual([['./', 'reload'], ['./index.html', 'reload']]);
  });

  it('returns 416 for an unsatisfiable range', async () => {
    const res = await context.rangedResponse({ headers: new Headers({ range: 'bytes=10-' }) }, new Response(new Uint8Array(3)));
    expect(res.status).toBe(416);
  });
});
