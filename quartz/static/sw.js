// Service worker — offline shell cache + stale-while-revalidate for HTML.
//
// Strategy:
//   • shell assets (CSS/JS/fonts/icons) → cache-first, namespaced by VERSION
//     so a new deploy invalidates immediately
//   • HTML pages → stale-while-revalidate (instant from cache, refresh in bg)
//   • search/build-time JSON → network-first, never cached (always fresh)
//   • cross-origin requests → bypass entirely
//
// VERSION is bumped automatically by `BuildTime` plugin in `quartz.config.ts`
// (the plugin appends a `?v=<buildTime>` to this file's <script> registration
// URL, but the SW itself uses its own VERSION constant — when the contents
// of this file change at all, browsers register a new SW and call activate).

const VERSION = "sitgmeat-v3"
const SHELL_CACHE = `${VERSION}-shell`
const PAGE_CACHE = `${VERSION}-pages`

// Always-fresh paths — never serve from cache. Add anything time-sensitive.
const NEVER_CACHE = [
  "/static/contentIndex.json",
  "/static/buildTime.json",
  "/static/verseIndex.json",
  "/static/pdfIndex.json",
]

// Pre-cache nothing on install — let the runtime handlers populate caches as
// the user browses. Avoids stale shell entries from a broken deploy.
self.addEventListener("install", (event) => {
  // Activate immediately on first install so we don't have to wait for tab
  // close before the SW becomes active.
  self.skipWaiting()
})

// On activate, prune caches that don't match the current VERSION.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((n) => !n.startsWith(VERSION))
          .map((n) => caches.delete(n)),
      )
      // Take control of all open clients immediately.
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request

  // GET only; ignore POST/PUT/etc.
  if (req.method !== "GET") return

  const url = new URL(req.url)

  // Cross-origin: bypass entirely. Don't try to cache other domains.
  if (url.origin !== self.location.origin) return

  // Always-fresh paths: network-only.
  if (NEVER_CACHE.some((p) => url.pathname === p)) {
    return // let browser handle normally; no caching
  }

  const isShell = /\.(css|js|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/i.test(
    url.pathname,
  )
  const isHTML =
    req.headers.get("accept")?.includes("text/html") ||
    url.pathname === "/" ||
    !url.pathname.includes(".")

  if (isShell) {
    event.respondWith(cacheFirst(req, SHELL_CACHE))
    return
  }

  if (isHTML) {
    event.respondWith(staleWhileRevalidate(req, PAGE_CACHE))
    return
  }
})

// Cache-first: return cached if present, otherwise fetch and cache.
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch (err) {
    // Offline + nothing cached → just propagate the error.
    throw err
  }
}

// Stale-while-revalidate: return cached immediately (if any) and refresh in
// the background. If no cache hit, await the network. If both fail, return a
// minimal offline-fallback page.
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)

  const networkPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone())
      return res
    })
    .catch(() => null)

  return cached || (await networkPromise) || offlineFallback()
}

function offlineFallback() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Offline</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif;
         display: flex; min-height: 100vh; margin: 0;
         align-items: center; justify-content: center;
         background: #fafafa; color: #1d1d1f; padding: 2rem; text-align: center; }
  h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
  p { color: #6b6b70; margin: 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #1c1c1e; color: #f5f5f7; }
    p { color: #8e8e93; }
  }
</style></head>
<body><div><h1>You're offline</h1>
<p>This page hasn't been visited yet, so it isn't in the cache.</p></div></body></html>`,
    { headers: { "Content-Type": "text/html" }, status: 200 },
  )
}
