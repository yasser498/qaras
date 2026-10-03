const CACHE = "qaras-visit-v15";
const PRINT_PAGES = Array.from({ length: 17 }, (_, index) => `assets/print-pages/page-${String(index + 1).padStart(2, "0")}.png`);
const CORE = ["./", "index.html", "styles.css", "app.js", "criteria-data.js", "manifest.webmanifest", "favicon.svg", "assets/ministry-logo.jpeg", "assets/footer-bar.png", ...PRINT_PAGES];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE))));
self.addEventListener("activate", (event) => event.waitUntil(Promise.all([
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  })));
});
