/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `app-${version}`;
// Static assets to pre-cache on install
const PRECACHE = [...build, ...files];

// Sections that get offline support (network-first documents).
const SECTIONS = ['/drinks/', '/stats/'];

// Always network, never cached: APIs, SSE streams, and the print-gated camera.
const NETWORK_ONLY = [
  '/drinks/api/',
  '/drinks/admin/',
  '/stats/api/',
  '/stats/printer/snapshot',
  '/stats/printer/webrtc'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isStream = request.headers.get('accept')?.includes('text/event-stream') ?? false;

  if (NETWORK_ONLY.some((prefix) => url.pathname.startsWith(prefix)) || isStream) {
    e.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', { status: 503, headers: { 'content-type': 'application/json' } }))
    );
    return;
  }

  // Immutable build assets are content-hashed: cache-first.
  if (url.pathname.startsWith('/_app/immutable/')) {
    e.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
    return;
  }

  if (!SECTIONS.some((prefix) => url.pathname === prefix.slice(0, -1) || url.pathname.startsWith(prefix))) {
    return;
  }

  // Section pages: network-first, cache fallback
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? new Response('Offline', { status: 503 })))
  );
});
