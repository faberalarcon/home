/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `drink-hub-${version}`;
// Static assets to pre-cache on install
const PRECACHE = [...build, ...files];

function scoped(path: string) {
  return `/drinks${path}`;
}

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

  // SSE and API: always network, never cache
  if (url.pathname.startsWith(scoped('/api/')) || url.pathname.startsWith(scoped('/admin/'))) {
    e.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', { status: 503, headers: { 'content-type': 'application/json' } }))
    );
    return;
  }

  // Immutable build assets: cache-first
  if (url.pathname.startsWith(scoped('/_app/immutable/'))) {
    e.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
    return;
  }

  if (!url.pathname.startsWith('/drinks/')) return;

  // Drink Hub pages: network-first, cache fallback
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
