const CACHE_NAME = "altosfm-shell-v11"; // súbelo cada vez que publiques cambios
const APP_SHELL = [
  "./", "./index.html", "./style.css", "./app.js", "./lvbp.js",
  "./manifest.json", "./logo.png", "./icon-192.png", "./icon-512.png", "./cover-altos.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Red primero (siempre lo más nuevo); la caché solo si no hay internet.
// El stream de audio es de otro origen, así que nunca pasa por aquí.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
  );
});
