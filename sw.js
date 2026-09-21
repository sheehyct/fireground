/* Fireground — offline service worker.
   Bump CACHE when you change any file; the new version installs on the
   next visit with signal and takes over immediately. */
const CACHE = "fireground-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first: on the fireground there is no time to wait for a network
   round-trip that may never come. Refresh the copy in the background when
   there happens to be signal. */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(hit => {
      // No signal and we already have it: serve it and don't attempt the network.
      if (hit && self.navigator && self.navigator.onLine === false) return hit;

      const live = fetch(e.request)
        .then(res => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit || caches.match("./index.html"));

      return hit || live;
    })
  );
});
