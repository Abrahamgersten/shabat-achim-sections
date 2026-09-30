/* service worker - בחירת מדורים. Bump VERSION on every deploy so clients pick up the new files. */
const PREFIX = "shabat-achim-sections-"; // every GitHub Pages site of this account shares one origin: only ever touch our own caches
const VERSION = PREFIX + "v6";
const PRECACHE = [
  "./",
  "index.html",
  "css/style.css?v=5",
  "js/data.js?v=5",
  "js/app.js?v=5",
  "manifest.webmanifest",
  "assets/img/logo.webp",
  "apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/favicon-32.png",
  "assets/sections/sec-ma-laasot-20260930-1.webp",
  "assets/sections/sec-misaviv-20260930-1.webp",
  "assets/sections/sec-or-behaskala-20260930-1.webp",
  "assets/sections/sec-tifzoret-20260930-1.webp",
  "assets/sections/sec-yesh-li-musag-20260930-1.webp",
  "assets/sections/section-01.webp",
  "assets/sections/section-02.webp",
  "assets/sections/section-03.webp",
  "assets/sections/section-04.webp",
  "assets/sections/section-06.webp",
  "assets/sections/section-07.webp",
  "assets/sections/section-08.webp",
  "assets/sections/section-09.webp",
  "assets/sections/section-10.webp",
  "assets/sections/section-11.webp",
  "assets/sections/section-12.webp",
  "assets/sections/section-13.webp",
  "assets/sections/section-14.webp",
  "assets/sections/section-15.webp",
  "assets/sections/section-16.webp",
  "assets/sections/section-20.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;               // form submissions go straight to the network
  const url = new URL(req.url);

  // pages: network first, so a new deploy shows up immediately; cache when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put("index.html", copy));
        return res;
      }).catch(() => caches.match("index.html"))
    );
    return;
  }

  // same-origin assets and Google Fonts: cache first, fill the cache as we go
  if (url.origin === self.location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
