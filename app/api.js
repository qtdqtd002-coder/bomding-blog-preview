/* ============================================================
   블로그 컴퍼니 PWA — 백엔드 연동 인터페이스 (★2단계 전환 지점)
   ------------------------------------------------------------
   지금(1단계): 백엔드 미연결 → 새 글 요청은 localStorage에 저장, 푸시는 미구독.
   2단계: 아래 BC_CONFIG 두 값만 채우면 UI 수정 없이 자동 전환된다.
     ① PUBLISH_API_BASE_URL : 발행요청 API 주소.
        계약(네이티브 앱과 동일): POST {base}/requests  (본문=요청 JSON)
                                 GET  {base}/requests  (목록)
     ② VAPID_PUBLIC_KEY      : 웹 푸시 구독용 서버 공개키(Base64URL).
   ============================================================ */
window.BC_CONFIG = {
  // 2단계 백엔드 연결됨 (GCP e2-micro + Caddy 자동 HTTPS).
  // ⚠ VM 외부 IP가 임시면 재시작 시 이 주소가 바뀐다 → 고정 IP 예약 권장.
  PUBLISH_API_BASE_URL: 'https://34.139.184.70.sslip.io',
  VAPID_PUBLIC_KEY: 'BFrapX1Q23mY2kAu_qnq8izG-lYCzsKvqF92QRscaK9b3ZBhvsGn-n0CQ7HkOlPYBNrdZqL6OsZFUpbrZ2ZsEN8',
  DATA_URLS: ['../posts.json', '../manifest.json'], // 글 목록 소스(신→구 폴백)
  TREND_URL: '../_trend/trend.json',       // 트렌드 브리핑
  NEWS_URL: '../_news/news.json',          // 뉴스레터
  CALENDAR_URL: '../_calendar/calendar.json', // 출시 캘린더
  SITE_BASE: '..',              // 글 본문 기준 경로(리포 루트)
  SITE_URL: '../'               // '사이트로 이동' 대상 = 블로그 컴퍼니 발행 사이트
};

(function () {
  const LS_KEY = 'bc_requests_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (_) { return []; } };
  const save = (a) => { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch (_) {} };
  const base = () => (window.BC_CONFIG.PUBLISH_API_BASE_URL || '').replace(/\/$/, '');

  /* 발행요청 서비스 — UI는 오직 이 객체만 호출한다(구현 교체해도 UI 불변) */
  const PublishRequestService = {
    isConnected() { return !!window.BC_CONFIG.PUBLISH_API_BASE_URL; },
    backendLabel() { return this.isConnected() ? '백엔드 연결됨' : '백엔드 미연결 (로컬 저장)'; },
    list() { return load().sort((a, b) => b.createdAt - a.createdAt); },

    async submit(req) {
      const rec = Object.assign(
        { id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), createdAt: Date.now(), status: 'local' },
        req
      );
      if (this.isConnected()) {
        try {
          const res = await fetch(base() + '/requests', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req)
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const body = await res.json().catch(() => ({}));
          rec.status = 'submitted'; rec.serverId = body.id || null;
        } catch (err) {
          rec.status = 'queued'; rec.error = String((err && err.message) || err); // 오프라인/실패 → 큐
        }
      }
      const all = load(); all.push(rec); save(all);
      return rec;
    },

    remove(id) { save(load().filter((r) => r.id !== id)); },

    // 2단계: 미전송(local/queued) 항목 재전송
    async flushQueue() {
      if (!this.isConnected()) return 0;
      let n = 0; const all = load();
      for (const r of all) {
        if (r.status === 'queued' || r.status === 'local') {
          try {
            const res = await fetch(base() + '/requests', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ topic: r.topic, material: r.material, writer: r.writer })
            });
            if (res.ok) { r.status = 'submitted'; n++; }
          } catch (_) {}
        }
      }
      save(all);
      return n;
    }
  };

  /* 웹 푸시 서비스 — 2단계에서 VAPID 키만 채우면 구독 가능 */
  const PushService = {
    supported() { return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window); },
    isConfigured() { return !!window.BC_CONFIG.VAPID_PUBLIC_KEY; },
    async status() {
      if (!this.supported()) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) return 'subscribed';
      return this.isConfigured() ? 'ready' : 'unconfigured';
    },
    async subscribe() {
      if (!this.supported() || !this.isConfigured()) return null;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(window.BC_CONFIG.VAPID_PUBLIC_KEY)
      });
      // 2단계: 구독 객체(JSON)를 백엔드에 등록 → 발행 완료 시 이 구독으로 푸시가 온다.
      if (base()) {
        try {
          await fetch(base() + '/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub) // PushSubscription → {endpoint, keys, expirationTime}
          });
        } catch (_) { /* 등록 실패는 조용히 무시(다음 구독 시 재시도) */ }
      }
      return sub;
    }
  };

  function urlB64ToUint8(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(s);
    return Uint8Array.from(Array.prototype.map.call(raw, (c) => c.charCodeAt(0)));
  }

  window.BC = { PublishRequestService, PushService };
})();
