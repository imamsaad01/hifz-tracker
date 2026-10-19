// Hifz Tracker service worker: makes the app open fast and start without a connection.
// - Pages: network first, falling back to the last saved copy when offline.
// - Built files (hashed names, never change): saved after first use.
// - Supabase data and anything on another site: never cached here (always live).
const CACHE = 'hifz-v3';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/pglite|\.wasm$|\.data$/.test(url.pathname)) return;               // large preview-only files
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  if (url.pathname.includes('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
  }
});

// Phone notifications sent by the `push` Edge Function
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Hifz Tracker', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Hifz Tracker', { body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', data: { url: d.url || './' }, tag: d.tag || undefined }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url ? e.notification.data.url : './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope)) { c.focus(); return c.navigate ? c.navigate(target) : undefined; } }
    return self.clients.openWindow(target);
  }));
});
