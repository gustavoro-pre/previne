/* Guarda o portal e os módulos no aparelho para abrir sem internet. Os dados ficam no cache do Firestore. */
const V = 'previne-v33';
const SHELL = ['./logo.js', './', './index.html', './fb.js', './firebase-config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './ferramentas/', './ferramentas/index.html', './treinamentos/', './treinamentos/index.html', './treinamentos/trein.js', './indicadores/', './indicadores/index.html', './indicadores/ind.js', './alocacao/', './alocacao/index.html', './alocacao/aloc.js', './admissao/', './admissao/index.html', './admissao/adm.js', './admissao/comum.js', './documentos/', './documentos/index.html', './documentos/doc.js'];
const LIBS = /^https:\/\/(www\.gstatic\.com\/firebasejs|cdn\.jsdelivr\.net\/npm|fonts\.(googleapis|gstatic)\.com)\//;
const MODS = ['ferramentas', 'treinamentos', 'indicadores', 'alocacao', 'admissao', 'documentos', 'aluno'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
/* notificações: o servidor manda só dados (title, body, url) e o app mostra */
self.addEventListener('push', e => {
  let d = {}; try { const j = e.data ? e.data.json() : {}; d = Object.assign({}, j.notification || {}, j.data || j); } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'PREVINE', { body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', tag: d.tag || 'previne', renotify: true, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = new URL((e.notification.data || {}).url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => x.url.startsWith(self.registration.scope)); if (c) { c.navigate(url).catch(() => {}); return c.focus(); } return self.clients.openWindow(url); }));
});
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    const mod = MODS.find(m => u.pathname.includes('/' + m + '/'));
    const rq = r.mode === 'navigate' ? r : new Request(r, { cache: 'no-cache' });
    e.respondWith(fetch(rq).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match(r.mode === 'navigate' && mod ? './' + mod + '/index.html' : './index.html'))));
  } else if (LIBS.test(r.url)) {
    e.respondWith(caches.match(r).then(m => { const f = fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => m); return m || f; }));
  }
});
