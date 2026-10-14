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
