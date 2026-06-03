/* 쓰담 사이트(루트) — 서비스워커
   목적: ① 사이트를 설치형 PWA로(installability) ② 오프라인 최소 동작 ③ 발행 완료 웹푸시 수신.
   원칙: 네트워크 우선(stale 캐시로 라이브 사이트가 옛 내용으로 굳는 사고 방지). 캐시는 오프라인 폴백 용도.
   ※ /app/ 경로는 app/sw.js(더 좁은 스코프)가 제어하므로 여기선 관여하지 않는다. */
const CACHE = 'sseudam-site-v1';
const SHELL = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
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
  if (url.origin !== location.origin) return;          // 외부 출처는 건드리지 않음
  if (url.pathname.includes('/app/')) return;          // 앱 셸은 app/sw.js 담당

  // 페이지 이동(네비게이션): 네트워크 우선 → 오프라인이면 캐시된 index 로 폴백
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => {
        const cp = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp));
        return r;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // 그 외 동일 출처 GET(데이터 json·css·아이콘 등): 네트워크 우선 → 실패 시 캐시
  e.respondWith(
    fetch(req).then((r) => {
      if (r && r.ok && r.type === 'basic') { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req))
  );
});

/* ===== 발행 완료 웹푸시 ===== (백엔드 push 페이로드 계약: { title, body, url, tag }) */
self.addEventListener('push', (e) => {
  let data = { title: '쓰담', body: '새 알림이 도착했어요.', url: './' };
  try { if (e.data) data = Object.assign(data, e.data.json()); }
  catch (_) { if (e.data) data.body = e.data.text(); }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'app/icons/icon-192.png',
      badge: 'app/icons/icon-192.png',
      tag: data.tag || 'sseudam',
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
        if ('focus' in w) { if (w.navigate) { try { w.navigate(target); } catch (_) {} } return w.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
