const CACHE_NAME = "wedding-cache-v2";
const OFFLINE_URL = "/offline.html";

// Recursos críticos a serem pré-carregados
const STATIC_ASSETS = [
  OFFLINE_URL,
  "/favicon.ico",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Listener para controle programático de skipWaiting vindo do frontend com validação de origem (CodeQL)
self.addEventListener("message", (event) => {
  event.waitUntil((async () => {
    if (event.origin && event.origin !== self.location.origin) return;

    if (!event.source || !event.source.id) return;

    const client = await self.clients.get(event.source.id);
    if (!client || !client.url) return;

    const clientOrigin = new URL(client.url).origin;
    if (clientOrigin !== self.location.origin) return;

    if (event.data && event.data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 1. Navegação (Páginas HTML) -> Network First com fallback Offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      })
    );
    return;
  }

  // 2. Fontes do Google Fonts -> Cache First
  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          return response || fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 3. Assets estáticos do Next.js e arquivos locais (CSS, JS, Imagens, ícones) -> Stale While Revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
     url.pathname.match(/\.(?:js|css|png|jpg|jpeg|svg|gif|ico|woff2)$/))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
});
