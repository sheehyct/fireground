/* Fireground — offline service worker.
   Bump CACHE when you change any file; the new version installs on the
   next visit with signal and takes over immediately. */
const CACHE = "fireground-v2";

/* Without these the app is useless offline — install fails loudly if they 404. */
const CRITICAL = [
  "./",
  "./index.html"
];

/* Nice to have. A 404 here must NOT abort the install (cache.addAll is
   all-or-nothing, which is how a single missing icon silently kills offline). */
const OPTIONAL = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-192.png",
  "./maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CRITICAL);                       // must succeed
    await Promise.allSettled(OPTIONAL.map(u => c.add(u)));  // best effort
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const hit = await caches.match(e.request);

    // No signal and we already have it: serve it, don't chase the network.
    if (hit && self.navigator && self.navigator.onLine === false) return hit;

    const live = fetch(e.request).then(res => {
      if (res && res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(async () => hit || (await caches.match("./index.html")));

    return hit || live;
  })());
});
