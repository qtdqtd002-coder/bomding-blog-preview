/* 블로그 컴퍼니 PWA — UI 로직 (백엔드 호출은 전부 api.js의 window.BC 경유) */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = (rel) => rel.split('/').map(encodeURIComponent).join('/');
  const ACCENT = { '봄딩': '#E06C49', '영도': '#2F8F7F', '겜더쿠': '#7C5CD1' };
  const ac = (a) => ACCENT[a] || '#4F46E5';
  const fmtDay = (d) => d ? String(d).split(' ')[0].replace(/-/g, '.') : '';
  const toTs = (d) => { if (!d) return 0; const t = Date.parse(String(d).replace(' ', 'T')); return isNaN(t) ? 0 : t; };

  let POSTS = [], filterAuthor = '__all__', tab = 'list';
  let deferredPrompt = null;

  /* ---------- 서비스워커 등록 ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 등록 실패', e));
    });
  }

  /* ---------- 설치 프롬프트 ---------- */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.__bcInstallable = true; // 검수용 플래그
    const btn = $('#installBtn');
    if (btn) btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    window.__bcInstalled = true;
    const btn = $('#installBtn'); if (btn) btn.hidden = true;
    toast('앱이 설치됐어요.');
  });
  function bindInstall() {
    const btn = $('#installBtn');
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) { toast('이미 설치됐거나, 브라우저 메뉴의 "홈 화면에 추가"를 눌러주세요.'); return; }
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null; btn.hidden = true;
    });
  }

  /* ---------- 데이터 로드(글 목록) ---------- */
  function normalize(data) {
    let arr = [];
    if (Array.isArray(data)) {
      arr = data;
    } else if (data && typeof data === 'object') { // 구 manifest.json (객체)
      arr = Object.keys(data).map((k) => {
        const v = (typeof data[k] === 'string') ? { date: data[k] } : (data[k] || {});
        return Object.assign({ rel: k }, v);
      });
    }
    return arr
      .filter((p) => p && p.rel && !p.rel.split('/').some((s) => s.startsWith('.') || s.startsWith('_')))
      .map((p) => {
        const seg = p.rel.split('/');
        const author = p.author || (seg.length >= 2 ? seg[0] : '(기타)');
        const created = p.created || p.date || '';
        const updated = p.updated || p.date || created;
        return {
          author, rel: p.rel,
          title: p.title || (seg.length >= 3 ? seg[2] : seg[seg.length - 1]),
          cat: p.cat || '', created, updated, uts: toTs(updated)
        };
      })
      .sort((a, b) => b.uts - a.uts);
  }

  async function loadPosts() {
    const urls = (window.BC_CONFIG.DATA_URLS || ['../posts.json', '../manifest.json']);
    for (const u of urls) {
      try {
        const r = await fetch(u + '?ts=' + Date.now());
        if (!r.ok) continue;
        const d = await r.json();
        const arr = normalize(d);
        if (arr.length) return arr;
      } catch (_) {}
    }
    return [];
  }

  /* ---------- 렌더: 글 목록 ---------- */
  function renderFilters() {
    const authors = Array.from(new Set(POSTS.map((p) => p.author)));
    const order = ['봄딩', '영도', '겜더쿠'];
    authors.sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const chip = (key, label, count, color) =>
      `<button class="chip${filterAuthor === key ? ' on' : ''}" data-f="${esc(key)}" style="--ac:${color}">` +
      `${key !== '__all__' ? '<span class="dot"></span>' : ''}${esc(label)}<span class="n">${count}</span></button>`;
    let h = chip('__all__', '전체', POSTS.length, '#4F46E5');
    authors.forEach((a) => { h += chip(a, a, POSTS.filter((p) => p.author === a).length, ac(a)); });
    const el = $('#filters'); el.innerHTML = h;
    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      filterAuthor = b.dataset.f; renderList();
    }));
  }

  function renderList() {
    $('#filters').querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === filterAuthor));
    const list = filterAuthor === '__all__' ? POSTS : POSTS.filter((p) => p.author === filterAuthor);
    const box = $('#postList');
    if (!list.length) { box.innerHTML = '<div class="empty">표시할 글이 없어요.</div>'; return; }
    box.innerHTML = list.map((p) => {
      const href = (window.BC_CONFIG.SITE_BASE || '..') + '/' + enc(p.rel);
      const edited = p.updated && fmtDay(p.updated) !== fmtDay(p.created);
      return `<a class="post" href="${href}" target="_blank" rel="noopener" style="--ac:${ac(p.author)}">` +
        `<div class="p-top"><span class="who"><span class="dot"></span>${esc(p.author)}</span>` +
        (p.cat ? `<span class="cat">${esc(p.cat)}</span>` : '') + `</div>` +
        `<div class="p-title">${esc(p.title)}</div>` +
        `<div class="p-meta">${esc(fmtDay(p.created) || '—')} 등록${edited ? ' · 수정 ' + esc(fmtDay(p.updated)) : ''}</div>` +
        `</a>`;
    }).join('');
  }

  /* ---------- 새 글 요청 폼 ---------- */
  function renderBackendBadge() {
    const el = $('#backendBadge');
    const connected = window.BC.PublishRequestService.isConnected();
    el.textContent = window.BC.PublishRequestService.backendLabel();
    el.className = 'badge ' + (connected ? 'ok' : 'warn');
  }

  function renderRequests() {
    const reqs = window.BC.PublishRequestService.list();
    const box = $('#reqList');
    const cnt = $('#reqCount'); if (cnt) cnt.textContent = reqs.length ? `${reqs.length}건` : '';
    if (!reqs.length) { box.innerHTML = '<div class="empty">아직 보낸 요청이 없어요.</div>'; return; }
    const label = { local: '저장됨(로컬)', queued: '대기(전송예정)', submitted: '전송됨' };
    box.innerHTML = reqs.map((r) =>
      `<div class="req">` +
      `<div class="r-top"><b>${esc(r.topic || '(주제 없음)')}</b><span class="rstat s-${r.status}">${label[r.status] || r.status}</span></div>` +
      (r.material ? `<div class="r-sub">소재: ${esc(r.material)}</div>` : '') +
      `<div class="r-meta">희망 작성자: ${esc(r.writer || '미지정')} · ${esc(fmtDay(new Date(r.createdAt).toISOString().slice(0, 10)))}</div>` +
      `<button class="r-del" data-id="${esc(r.id)}">삭제</button>` +
      `</div>`
    ).join('');
    box.querySelectorAll('.r-del').forEach((b) => b.addEventListener('click', () => {
      window.BC.PublishRequestService.remove(b.dataset.id); renderRequests();
    }));
  }

  function bindForm() {
    $('#reqForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const topic = $('#fTopic').value.trim();
      const material = $('#fMaterial').value.trim();
      const writer = $('#fWriter').value;
      if (!topic) { toast('주제를 입력해주세요.'); $('#fTopic').focus(); return; }
      if (!writer) { toast('희망 작성자를 선택해주세요.'); $('#fWriter').focus(); return; }
      const rec = await window.BC.PublishRequestService.submit({ topic, material, writer });
      $('#reqForm').reset();
      renderRequests();
      toast(rec.status === 'submitted' ? '발행 요청을 보냈어요.' : '요청을 이 기기에 저장했어요 (백엔드 연결 시 자동 전송).');
    });
  }

  /* ---------- 탭 ---------- */
  function setTab(t) {
    tab = t;
    $('#view-list').hidden = (t !== 'list');
    $('#view-req').hidden = (t !== 'req');
    document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  }
  function bindTabs() {
    document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  }

  /* ---------- 토스트 ---------- */
  let toastT;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- 작성자 옵션(폼) ---------- */
  function fillWriterOptions() {
    const sel = $('#fWriter');
    const known = ['봄딩', '영도', '겜더쿠'];
    const fromPosts = Array.from(new Set(POSTS.map((p) => p.author))).filter((a) => a && a !== '(기타)');
    const authors = Array.from(new Set(known.concat(fromPosts)));
    sel.innerHTML = '<option value="" disabled selected>작성자를 선택하세요</option>' + authors.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  }

  /* ---------- 부팅 ---------- */
  async function boot() {
    bindInstall(); bindTabs(); bindForm();
    renderBackendBadge(); renderRequests();
    setTab('list');
    POSTS = await loadPosts();
    const lc = $('#listCount');
    if (!POSTS.length) {
      $('#postList').innerHTML = '<div class="empty">글 목록을 불러오지 못했어요.<br>네트워크 확인 후 다시 시도해주세요.</div>';
      if (lc) lc.textContent = '불러오지 못함';
    } else {
      renderFilters(); renderList();
      if (lc) lc.textContent = `총 ${POSTS.length}개`;
    }
    fillWriterOptions();
    // 푸시 상태 표시(2단계 대비)
    try {
      const st = await window.BC.PushService.status();
      const pe = $('#pushState');
      const map = { unsupported: '미지원', unconfigured: '미연결(2단계)', ready: '구독 가능', subscribed: '구독중' };
      if (pe) pe.textContent = '푸시: ' + (map[st] || st);
    } catch (_) {}
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
