const CACHE = "outsideclass-v17";
const pages = ["/", "/learn", "/notebook", "/guides", "/updates", "/activity"];
const assets = [
  "/learn",
  "/notebook",
  "/guides",
  "/updates",
  "/activity",
  "/updates.xml",
  "/",
  "/style.css",
  "/app.js",
  "/samples.js",
  "/safety.js",
  "/photos.js",
  "/diagrams.js",
  "/learning.js",
  "/profile.js",
  "/feed.js",
  "/notebook-tools.js",
  "/outsideclass-logo.png",
];
self.addEventListener("install", (e) =>
  // All page routes use the same app shell. Fetch it once on first visit.
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll(
          assets.filter((path) => !pages.includes(path) || path === "/"),
        ),
      ),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("outsideclass-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !assets.includes(url.pathname)
  )
    return;
  e.respondWith(
    (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(e.request, { signal: controller.signal });
        if (response.ok) {
          // Store canonical paths: favicon version queries must work offline too.
          // A full cache must never prevent an otherwise successful online visit.
          try {
            const cache = await caches.open(CACHE);
            await cache.put(url.pathname, response.clone());
          } catch {}
          return response;
        }
        return (await cached(url.pathname)) || response;
      } catch {
        return (
          (await cached(url.pathname)) ||
          new Response(
            "This page is not available offline. Reconnect and visit it once first.",
            {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            },
          )
        );
      } finally {
        clearTimeout(timeout);
      }
    })(),
  );
});
async function cached(path) {
  try {
    const cache = await caches.open(CACHE);
    return (
      (await cache.match(path)) ||
      (pages.includes(path) ? await cache.match("/") : undefined)
    );
  } catch {
    return undefined;
  }
}
