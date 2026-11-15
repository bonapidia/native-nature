// Native Nature service worker: keeps the site and your saved area working offline.
const VERSION = "nn-v1";
const SHELL = `${VERSION}-shell`, DATA = `${VERSION}-data`, IMG = `${VERSION}-img`, TILES = `${VERSION}-tiles`;
const SHELL_FILES = [
  "/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
];
const LIMITS = { [IMG]: 1500, [TILES]: 2500, [DATA]: 800 };

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.allSettled(SHELL_FILES.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// iNaturalist data is saved without the date filter, so "flowering in the last 30 days"
// saved yesterday still opens offline today.
function dataKey(url) {
  const u = new URL(url);
  u.searchParams.delete("d1");
  u.searchParams.sort();
  return u.toString();
}
async function trim(name) {
  const c = await caches.open(name), keys = await c.keys(), max = LIMITS[name];
  if (max && keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => c.delete(k)));
}
async function networkFirst(req, cacheName, key = req) {
  const c = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) { c.put(key, res.clone()).then(() => trim(cacheName)); }
    return res;
  } catch (err) {
    const hit = await c.match(key);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") c.put(req.url, res.clone()).then(() => trim(cacheName));
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // Photo ID and Yard Planner always need the internet
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, SHELL, "/index.html"));
  } else if (url.origin === location.origin) {
    e.respondWith(networkFirst(req, SHELL));
  } else if (url.hostname === "api.inaturalist.org" || url.hostname.endsWith("open-meteo.com")) {
    e.respondWith(networkFirst(req, DATA, dataKey(req.url)));
  } else if (/inaturalist/.test(url.hostname) || url.hostname.endsWith("amazonaws.com")) {
    e.respondWith(cacheFirst(req, IMG)); // species photos
  } else if (url.hostname === "server.arcgisonline.com") {
    e.respondWith(cacheFirst(req, TILES)); // map tiles
  } else if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, SHELL));
  }
});
