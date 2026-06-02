/* 블로그 컴퍼니 PWA — 서비스워커
   - 앱 셸 캐시(오프라인 기동) + 데이터 네트워크 우선
   - push / notificationclick 골격(2단계 '발행 완료 푸시' 부착 지점)
*/
const CACHE = 'bc-app-v1';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './api.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // 데이터(posts/manifest.json): 네트워크 우선 → 갱신 반영, 실패 시 캐시
  if (/(posts|manifest)\.json/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then((r) => {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 앱 셸(/app/ 내부 동일 출처): 캐시 우선
  if (url.origin === location.origin && url.pathname.includes('/app/')) {
    e.respondWith(caches.match(req).then((c) => c || fetch(req)));
    return;
  }

  // 그 외(글 본문 HTML 등): 네트워크 우선 → 실패 시 캐시
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* ===== 푸시 (2단계 대비 골격) =====
   2단계: 백엔드가 VAPID로 push 전송 → 아래 핸들러가 '발행 완료' 알림을 띄운다. */
self.addEventListener('push', (e) => {
  let data = { title: '블로그 컴퍼니', body: '새 알림이 도착했어요.', url: './' };
  try {
    if (e.data) data = Object.assign(data, e.data.json());
  } catch (_) {
    if (e.data) data.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: data.tag || 'bc-app',
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          if (w.navigate) { try { w.navigate(target); } catch (_) {} }
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
