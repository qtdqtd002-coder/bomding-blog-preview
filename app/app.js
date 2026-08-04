/* 블로그 컴퍼니 PWA — UI/라우팅 (백엔드 호출은 전부 api.js의 window.BC 경유)
   구조: 화면 레지스트리(NAV) + 해시 라우터(메인=홈 허브, 섹션 뎁스) + 데이터 로더(posts/trend/news/calendar).
   확장: 새 섹션은 VIEWS에 렌더러 1개 + (탭이면) NAV에 1줄 추가로 끝난다. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = (rel) => rel.split('/').map(encodeURIComponent).join('/');
  const ACCENT = { '봄딩': '#E06C49', '영도': '#2F8F7F', '겜더쿠': '#7C5CD1', '연봄': '#4A86C5' };
  const ac = (a) => ACCENT[a] || '#4C6FFF';
  const fmtDay = (d) => d ? String(d).split(' ')[0].replace(/-/g, '.') : '';
  const toTs = (d) => { if (!d) return 0; const t = Date.parse(String(d).replace(' ', 'T')); return isNaN(t) ? 0 : t; };
  const CFG = (k, fb) => (window.BC_CONFIG && window.BC_CONFIG[k]) || fb;

  /* ---------- 라인 아이콘셋 (심플·통일) ---------- */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>',
    doc: '<path d="M7 3h7l4 4v14H6V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>',
    news: '<path d="M4 5h13v14a2 2 0 0 0 2-2V8"/><path d="M4 5v14a2 2 0 0 0 2 2h13"/><path d="M7 9h7M7 13h7M7 17h4"/>',
    cal: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    spark: '<path d="M9.9 15.5A2 2 0 0 0 8.5 14L2.4 12.5a.5.5 0 0 1 0-1L8.5 10A2 2 0 0 0 9.9 8.5L11.5 2.4a.5.5 0 0 1 1 0L14 8.5A2 2 0 0 0 15.5 9.9l6.1 1.6a.5.5 0 0 1 0 1L15.5 14a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    dots: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    lockOpen: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'
  };
  const ico = (n, w) => `<svg viewBox="0 0 24 24" width="${w || 24}" height="${w || 24}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;
  const extIco = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  /* ---------- 화면 레지스트리(하단 내비) ---------- */
  const NAV = [
    { id: 'home', label: '홈', icon: 'home' },
    { id: 'posts', label: '글', icon: 'doc' },
    { id: 'trend', label: '트렌드', icon: 'trend' }
  ];
  const SUB = { posts: '확인 대기 글 · 발행·숨김은 아카이브', trend: '오늘 뜨는 게임·주제', request: '주제만 적으면 작성→검수→발행', home: '당신의 글쓰기 동료' };
  const TITLE = { home: '쓰담', posts: '글', trend: '트렌드', request: '새 글 요청' };

  /* 글의 목적(purpose) — 백엔드 PURPOSES / post-purpose-guide.md 정본과 1:1. 값=한글 라벨. */
  const PURPOSE_GROUPS = [
    ['게임', ['사전예약', '출시·첫인상', '업데이트·패치', '게임 정보', '게임 공략', '쿠폰·이벤트', '티어·추천']],
    ['제품(육아·취미)', ['제품 비교·추천', '사용 후기·리뷰']],
  ];
  const PURPOSE_OPTIONS =
    '<option value="" disabled selected>목적을 선택하세요</option>' +
    PURPOSE_GROUPS.map(([g, items]) =>
      `<optgroup label="${g}">` + items.map((p) => `<option value="${p}">${p}</option>`).join('') + '</optgroup>'
    ).join('') +
    '<optgroup label="기타"><option value="기타">기타 (잘 모르겠어요 · 기획팀이 정함)</option></optgroup>';

  /* ---------- 데이터 (캐시) ---------- */
  const cache = {};
  const HIDDEN = new Set();   // 숨김된 rel (백엔드 GET /hidden 으로 채움 · 런타임 토글로 갱신)
  const MPUB = new Set();     // 수동 발행완료된 rel (백엔드 GET /mpub 으로 채움 · 런타임 토글로 갱신)
  // 아카이브 = 발행됨(자동검증·수동) 또는 숨김 처리된 글. 글 목록(작성자별 포함)에선 빼고 '아카이브'에만 모은다.
  const isArchived = (p) => !!p.published || HIDDEN.has(p.rel);
  async function loadJSON(url) {
    const r = await fetch(url + (url.indexOf('?') < 0 ? '?ts=' : '&ts=') + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  function normalizePosts(data) {
    let arr = Array.isArray(data) ? data
      : (data && typeof data === 'object' ? Object.keys(data).map((k) => Object.assign({ rel: k }, (typeof data[k] === 'string' ? { date: data[k] } : data[k] || {}))) : []);
    return arr
      .filter((p) => p && p.rel && !p.rel.split('/').some((s) => s.startsWith('.') || s.startsWith('_')))
      .map((p) => {
        const seg = p.rel.split('/');
        const author = p.author || (seg.length >= 2 ? seg[0] : '(기타)');
        const created = p.created || p.date || '';
        const updated = p.updated || p.date || created;
        return { author, rel: p.rel, title: p.title || (seg.length >= 3 ? seg[2] : seg[seg.length - 1]), cat: p.cat || '', excerpt: p.excerpt || '', created, updated, uts: toTs(updated), published: p.published === true };
      })
      .sort((a, b) => b.uts - a.uts);
  }
  async function getPosts() {
    if (cache.posts) return cache.posts;
    const urls = CFG('DATA_URLS', ['../posts.json', '../manifest.json']);
    let arr = [];
    for (const u of urls) { try { const a = normalizePosts(await loadJSON(u)); if (a.length) { arr = a; break; } } catch (_) {} }
    /* '발행됨'(실제 블로그 게시 확인)을 published.json 으로도 한 번 더 머지 — 사이트(index.html)와 동일.
       posts.json 의 baked 플래그가 빌드 타이밍으로 비어 있어도, 이 런타임 머지로 앱이 자가보정해 딤드+라벨을 단다. */
    try {
      const pub = await loadJSON(CFG('PUBLISHED_URL', '../published.json'));
      const PUBSET = new Set(((pub && pub.publishedRels) || []).map((s) => String(s).trim()));
      if (PUBSET.size) arr = arr.map((p) => (p.published || PUBSET.has(p.rel) ? Object.assign(p, { published: true }) : p));
    } catch (_) {}
    /* autopub = 자동검증 발행(깃·baked) — 보호 대상. 이 시점의 published 가 곧 autopub. */
    arr.forEach((p) => { p.autopub = p.published === true; });
    /* 숨김·수동발행완료(백엔드) 머지 — 사이트와 동일. 실패 시 무시(fail-open). */
    try { const rels = await window.BC.HiddenService.list(); HIDDEN.clear(); rels.forEach((x) => HIDDEN.add(String(x))); } catch (_) {}
    try { const rels = await window.BC.MpubService.list(); MPUB.clear(); rels.forEach((x) => MPUB.add(String(x))); } catch (_) {}
    /* 표시용 발행됨 = 자동 ∪ 수동(백엔드) */
    arr.forEach((p) => { p.published = p.autopub || MPUB.has(p.rel); });
    return (cache.posts = arr);
  }
  async function getTrend() { if (cache.trend) return cache.trend; const d = await loadJSON(CFG('TREND_URL', '../_trend/trend.json')); return (cache.trend = (d && d.issues) || []); }

  const skeleton = (n) => Array.from({ length: n || 4 }, () => '<div class="skel"></div>').join('');

  /* ================= 관리자 모드(GitHub 토큰) — 글 삭제 전용 =================
     사이트(index.html)의 관리자 모듈과 동일 계약. 삭제=Git Data API 단일 커밋(토큰 필요).
     숨기기·발행완료는 토큰 없이 백엔드(HiddenService/MpubService)로 처리한다. */
  const ADMIN = (function () {
    const OWNER = 'qtdqtd002-coder', REPO = 'bomding-blog-preview', BRANCH = 'main';
    const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
    const LSK = 'bc_admin_token';
    let on = false, token = '', who = '', onChange = null;
    const ghIco = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (P[n] || '') + '</svg>';

    const authHdr = (t) => ({ 'Authorization': 'Bearer ' + t, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
    async function gh(path, opts) {
      const url = path.indexOf('http') === 0 ? path : API + path;
      const res = await fetch(url, Object.assign({ headers: authHdr(token) }, opts || {}));
      if (!res.ok) { let m = ''; try { m = (await res.json()).message; } catch (_) {} throw new Error('GitHub ' + res.status + (m ? ': ' + m : '')); }
      return res.status === 204 ? null : res.json();
    }
    async function validate(t) {
      const r = await fetch('https://api.github.com/user', { headers: authHdr(t) });
      if (!r.ok) throw new Error('토큰이 유효하지 않습니다 (HTTP ' + r.status + ').');
      const u = await r.json();
      const rr = await fetch(API, { headers: authHdr(t) });
      if (!rr.ok) throw new Error('이 토큰으로 리포에 접근할 수 없어요 (HTTP ' + rr.status + ').');
      const repo = await rr.json();
      if (repo.permissions && repo.permissions.push === false) throw new Error('이 토큰엔 쓰기(Contents: Read and write) 권한이 없어요.');
      return u.login;
    }
    const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
    async function getFile(p) {
      const r = await gh('/contents/' + encPath(p) + '?ref=' + BRANCH);
      const bin = atob(String(r.content || '').replace(/\s/g, ''));
      return { text: new TextDecoder('utf-8').decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))), sha: r.sha };
    }
    const posts = () => cache.posts || [];
    const relFolder = (rel) => { const i = rel.lastIndexOf('/'); return i < 0 ? '' : rel.slice(0, i); };
    function delScope(rel) { const f = relFolder(rel); const same = posts().filter((x) => relFolder(x.rel) === f); return (f && same.length <= 1) ? { folder: f, whole: true } : { folder: f, whole: false }; }

    async function deletePost(rel, title) {
      const p = posts().find((x) => x.rel === rel);
      if (!p) throw new Error('목록에 없는 글입니다.');
      if (p.published) throw new Error('발행된 글은 삭제할 수 없습니다.');
      const sc = delScope(rel);
      const ref = await gh('/git/ref/heads/' + BRANCH);
      const headSha = ref.object.sha;
      const commit = await gh('/git/commits/' + headSha);
      const baseTree = commit.tree.sha;
      const tree = await gh('/git/trees/' + baseTree + '?recursive=1');
      if (tree.truncated) throw new Error('리포 트리가 너무 커 안전 처리 불가(트리 잘림).');
      let delPaths;
      if (sc.whole) delPaths = tree.tree.filter((t) => t.type === 'blob' && (t.path === rel || t.path.indexOf(sc.folder + '/') === 0)).map((t) => t.path);
      else delPaths = [rel];
      if (!delPaths.length) throw new Error('삭제할 파일을 찾지 못했습니다.');
      let postsArr = JSON.parse((await getFile('posts.json')).text);
      if (!Array.isArray(postsArr)) postsArr = [postsArr];
      postsArr = postsArr.filter((x) => delPaths.indexOf(x.rel) < 0);
      let manObj = JSON.parse((await getFile('manifest.json')).text);
      delPaths.forEach((dp) => { if (Object.prototype.hasOwnProperty.call(manObj, dp)) delete manObj[dp]; });
      const items = delPaths.map((pth) => ({ path: pth, mode: '100644', type: 'blob', sha: null }));
      items.push({ path: 'posts.json', mode: '100644', type: 'blob', content: JSON.stringify(postsArr, null, 2) });
      items.push({ path: 'manifest.json', mode: '100644', type: 'blob', content: JSON.stringify(manObj, null, 2) });
      const newTree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree: items }) });
      const newCommit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: '글 삭제(관리자): ' + title + '\n\nrel: ' + rel, tree: newTree.sha, parents: [headSha] }) });
      await gh('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha }) });
      if (cache.posts) cache.posts = cache.posts.filter((x) => delPaths.indexOf(x.rel) < 0);
      return { count: delPaths.length };
    }
    /* 발행 완료(수동)는 이제 백엔드 MpubService(무토큰·가역)로 처리한다 → pmTogglePublished 참고.
       (옛 깃 published.json 커밋 방식은 토큰이 필요해 제거, 자동검증 발행은 check-published.ps1 가 계속 담당) */

    let _t = null, _tT = 0;
    function toast(msg, kind) {
      if (!_t) { _t = document.createElement('div'); _t.className = 'adm-toast'; document.body.appendChild(_t); }
      _t.textContent = msg; _t.className = 'adm-toast show ' + (kind || '');
      clearTimeout(_tT); _tT = setTimeout(() => { _t.className = 'adm-toast'; }, kind === 'err' ? 6000 : 3400);
    }
    let _chip = null;
    function chip(show) {
      if (show) { if (!_chip) { _chip = document.createElement('div'); _chip.className = 'adm-chip'; _chip.innerHTML = ghIco('lockOpen') + '<span>관리자 모드</span>'; const x = document.createElement('button'); x.textContent = '끄기'; x.addEventListener('click', () => setOff()); _chip.appendChild(x); document.body.appendChild(_chip); } }
      else if (_chip) { _chip.remove(); _chip = null; }
    }
    function setOn(t, login) { on = true; token = t; who = login || ''; try { localStorage.setItem(LSK, t); } catch (_) {} chip(true); if (onChange) onChange(); }
    function setOff() { on = false; token = ''; who = ''; try { localStorage.removeItem(LSK); } catch (_) {} chip(false); if (onChange) onChange(); }
    function requireUnlock(fn) { if (on) { fn(); } else { openModal(fn); } }   // 잠금 풀려 있으면 즉시, 아니면 토큰 인증 후 이어서 실행

    function openModal(onSuccess) {
      const mask = document.createElement('div'); mask.className = 'adm-mask';
      const close = () => mask.remove();
      mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
      const box = document.createElement('div'); box.className = 'adm-box';
      if (on) {
        box.innerHTML = '<h3>' + ghIco('lockOpen') + '관리자 모드 켜짐</h3>' +
          '<p>로그인: <b>' + esc(who || '(확인됨)') + '</b><br>관리자 모드는 이제 <b>글 삭제</b>에만 필요해요. 숨기기·발행 완료는 토큰 없이 누구나 ⋮ 메뉴에서 할 수 있어요. 자동검증 발행글은 보호됩니다.</p>' +
          '<div class="adm-row"><button class="adm-btn danger" id="admLogout">로그아웃</button><button class="adm-btn ghost" id="admClose">닫기</button></div>';
        mask.appendChild(box); document.body.appendChild(mask);
        box.querySelector('#admClose').addEventListener('click', close);
        box.querySelector('#admLogout').addEventListener('click', () => { setOff(); close(); toast('관리자 모드를 껐어요.'); });
        return;
      }
      box.innerHTML = '<h3>' + ghIco('lock') + '관리자 모드 켜기</h3>' +
        '<p>저장소에 쓰기 권한이 있는 <b>GitHub 토큰</b>으로 잠금을 풉니다. (계정 비밀번호가 아니라 토큰)</p>' +
        '<label>GitHub Personal Access Token</label>' +
        '<input id="admTok" type="password" placeholder="github_pat_… 또는 ghp_…" autocomplete="off" spellcheck="false">' +
        '<div class="adm-note">Fine-grained token · Repository access: <b>' + REPO + '</b> · Permissions → <b>Contents: Read and write</b><br>토큰은 이 기기에만 저장되고 깃허브 API로만 직접 호출돼요.</div>' +
        '<div class="adm-msg" id="admMsg"></div>' +
        '<div class="adm-row"><button class="adm-btn primary" id="admGo">켜기</button><button class="adm-btn ghost" id="admCancel">취소</button></div>';
      mask.appendChild(box); document.body.appendChild(mask);
      const tok = box.querySelector('#admTok'), msg = box.querySelector('#admMsg'), goB = box.querySelector('#admGo');
      box.querySelector('#admCancel').addEventListener('click', close);
      tok.focus();
      async function submit() {
        const t = tok.value.trim(); if (!t) { msg.className = 'adm-msg err'; msg.textContent = '토큰을 입력하세요.'; return; }
        goB.disabled = true; msg.className = 'adm-msg'; msg.textContent = '확인 중…';
        try { const login = await validate(t); setOn(t, login); close(); toast('관리자 모드 ON · ' + login, 'ok'); if (typeof onSuccess === 'function') onSuccess(); }
        catch (e) { goB.disabled = false; msg.className = 'adm-msg err'; msg.textContent = (e && e.message) || String(e); }
      }
      goB.addEventListener('click', submit);
      tok.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }
    function restore() {
      let saved = ''; try { saved = localStorage.getItem(LSK) || ''; } catch (_) {}
      if (saved) validate(saved).then((login) => setOn(saved, login)).catch(() => { try { localStorage.removeItem(LSK); } catch (_) {} });
    }
    return { isOn: () => on, openModal, requireUnlock, deletePost, toast, restore, setOnChange: (f) => { onChange = f; } };
  })();

  /* 글 카드 우상단 아이콘 메뉴(관리자) — 공용 fixed 팝업 */
  let _pmPop = null;
  function pmEnsure() {
    if (_pmPop) return _pmPop;
    _pmPop = document.createElement('div'); _pmPop.className = 'post-menu-pop'; _pmPop.hidden = true;
    /* 숨기기/해제·발행완료/취소: 토큰 불필요(누구나). 삭제만: 관리자(GitHub 토큰) 필요. */
    _pmPop.innerHTML = '<button type="button" data-act="hide"></button>' +
                       '<button type="button" data-act="pub"></button>' +
                       '<div class="post-menu-sep"></div>' +
                       '<button type="button" data-act="del">' + ico('trash', 16) + '글 삭제</button>';
    _pmPop.querySelectorAll('[data-act]').forEach((it) => it.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const act = it.dataset.act, rel = _pmPop._rel; _pmPop.hidden = true;
      if (act === 'hide') pmToggleHide(rel);                          // 토큰 불필요
      else if (act === 'pub') pmTogglePublished(rel);                 // 토큰 불필요
      else if (act === 'del') ADMIN.requireUnlock(() => pmDelete(rel));
    }));
    document.body.appendChild(_pmPop);
    return _pmPop;
  }
  function pmClose() { if (_pmPop) _pmPop.hidden = true; }
  function pmOpen(btn, rel) {
    const pop = pmEnsure(); pop._rel = rel; pop.hidden = false;
    const hb = pop.querySelector('[data-act="hide"]'); const isH = HIDDEN.has(rel);   // 현재 숨김 상태로 라벨 결정
    if (hb) hb.innerHTML = ico(isH ? 'eye' : 'eyeOff', 16) + (isH ? '숨김 해제' : '숨기기');
    const pb = pop.querySelector('[data-act="pub"]'); const isM = MPUB.has(rel);       // 수동 발행완료 상태로 라벨 결정
    if (pb) pb.innerHTML = ico(isM ? 'eyeOff' : 'checkCircle', 16) + (isM ? '발행 완료 취소' : '발행 완료');
    // 삭제는 발행됨 글엔 막혀 있으므로, 발행 상태면 삭제 버튼 숨김(취소 후 삭제)
    const card = btn.closest('.post');
    const db = pop.querySelector('[data-act="del"]'); if (db) db.style.display = (card && card.dataset.pub === '1') ? 'none' : '';
    const r = btn.getBoundingClientRect(); const pw = pop.offsetWidth || 150;
    let left = r.right - pw; if (left < 8) left = 8;
    let top = r.bottom + 6; if (top + pop.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - pop.offsetHeight - 6);
    pop.style.top = top + 'px'; pop.style.left = left + 'px';
  }
  document.addEventListener('click', (e) => { if (_pmPop && !_pmPop.hidden && !e.target.closest('.post-menu') && !e.target.closest('.post-menu-pop')) pmClose(); });
  window.addEventListener('scroll', () => pmClose(), true);
  window.addEventListener('resize', () => pmClose());
  async function pmDelete(rel) {
    const p = (cache.posts || []).find((x) => x.rel === rel); const title = (p && p.title) || rel;
    if (!confirm('정말 삭제할까요?\n\n「' + title + '」\n\n글 폴더(본문·이미지 포함)가 깃에서 제거되고 즉시 커밋됩니다.\n사이트/앱 반영까지 1~2분 · 깃 히스토리로 복구 가능.')) return;
    ADMIN.toast('삭제 중…');
    try { const r = await ADMIN.deletePost(rel, title); ADMIN.toast('삭제 완료 (' + r.count + '개 파일 제거) · 반영 1~2분', 'ok'); if (route === 'posts') paint(); }
    catch (e) { ADMIN.toast('삭제 실패: ' + (e && e.message || e), 'err'); }
  }
  // 숨기기/숨김 해제 — 토큰 불필요(누구나). 백엔드에 즉시 반영(모두에게 적용).
  async function pmToggleHide(rel) {
    const p = (cache.posts || []).find((x) => x.rel === rel); const title = (p && p.title) || rel;
    const isH = HIDDEN.has(rel);
    if (!window.BC.HiddenService.isConnected()) { ADMIN.toast('백엔드 미연결 — 숨김은 서버 연결이 필요해요.', 'err'); return; }
    if (!isH && !confirm('이 글을 숨길까요?\n\n「' + title + '」\n\n글 목록에서 빠지고 ‘아카이브’로 이동해요(글은 삭제되지 않고 그대로 보존돼요).\n누구나 아카이브에서 다시 ‘숨김 해제’할 수 있어요 · 즉시 반영.')) return;
    ADMIN.toast(isH ? '숨김 해제 중…' : '숨기는 중…');
    try {
      if (isH) { await window.BC.HiddenService.unhide(rel); HIDDEN.delete(rel); }
      else { await window.BC.HiddenService.hide(rel); HIDDEN.add(rel); }
      ADMIN.toast(isH ? '숨김을 해제했어요 · 모두에게 다시 보여요' : '숨겼어요 · 모두에게 적용됐어요', 'ok');
      if (route === 'posts') paint();
    } catch (e) { ADMIN.toast((isH ? '숨김 해제 실패: ' : '숨김 실패: ') + (e && e.message || e), 'err'); }
  }
  // 발행 완료 / 발행 완료 취소 — 토큰 불필요(누구나). 백엔드에 즉시 반영(모두에게 적용).
  async function pmTogglePublished(rel) {
    const p = (cache.posts || []).find((x) => x.rel === rel); const title = (p && p.title) || rel;
    const isM = MPUB.has(rel);
    if (!window.BC.MpubService.isConnected()) { ADMIN.toast('백엔드 미연결 — 발행완료는 서버 연결이 필요해요.', 'err'); return; }
    if (!isM && !confirm('이 글을 ‘발행 완료’로 표시할까요?\n\n「' + title + '」\n\n글 목록에서 빠지고 ‘아카이브’로 이동해요(‘발행됨’ 라벨).\n누구나 아카이브에서 다시 ‘발행 완료 취소’할 수 있어요 · 즉시 반영.')) return;
    ADMIN.toast(isM ? '발행 완료 취소 중…' : '발행 완료 처리 중…');
    try {
      if (isM) { await window.BC.MpubService.unmark(rel); MPUB.delete(rel); }
      else { await window.BC.MpubService.mark(rel); MPUB.add(rel); }
      if (p) p.published = p.autopub || MPUB.has(rel);   // 표시값 즉시 갱신(로드 후 토글 반영)
      ADMIN.toast(isM ? '발행 완료를 취소했어요 · 모두에게 반영' : '발행 완료로 표시했어요 · 모두에게 반영', 'ok');
      if (route === 'posts') paint();
    } catch (e) { ADMIN.toast((isM ? '발행 완료 취소 실패: ' : '발행 완료 처리 실패: ') + (e && e.message || e), 'err'); }
  }
  // 메뉴 아이콘은 항상 노출(미발행 글). 실제 삭제/발행완료를 누를 때만 토큰 인증을 요구한다.
  function injectPostMenus(root) {
    $$('.post', root).forEach((card) => {
      if (card.dataset.autopub === '1') return;      // 자동검증 발행글만 보호. 수동 발행완료는 메뉴 유지(취소 가능)
      if (card.querySelector('.post-menu')) return;
      const rel = card.dataset.rel; if (!rel) return;
      const wrap = document.createElement('div'); wrap.className = 'post-menu';
      wrap.innerHTML = '<button type="button" class="post-menu-btn" aria-label="글 관리 메뉴">' + ico('dots', 18) + '</button>';
      const btn = wrap.querySelector('.post-menu-btn');
      btn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (_pmPop && !_pmPop.hidden && _pmPop._rel === rel) { pmClose(); return; }
        pmOpen(btn, rel);
      });
      card.appendChild(wrap); card.classList.add('has-mgmt'); if (ADMIN.isOn()) card.classList.add('admin-on');
    });
  }

  /* ================= 뷰 렌더러 ================= */
  const VIEWS = {};

  /* ---- 홈(메인 허브) ---- */
  VIEWS.home = async (root) => {
    root.innerHTML =
      `<section class="hero"><h2>쓰담</h2><p><b style="opacity:.96">당신의 글쓰기 동료</b> — 발행글·트렌드를 한곳에서, 새 글도 여기서 바로 요청해요.</p>
        <span class="stat" id="heroStat">불러오는 중…</span></section>
       <div class="hub" id="hub">${skeleton(4)}</div>`;
    const [posts, trend] = await Promise.all([
      getPosts().catch(() => []), getTrend().catch(() => [])
    ]);
    const stat = $('#heroStat'); if (stat) stat.innerHTML = `${ico('doc', 14)} 글 ${posts.filter((p) => !isArchived(p)).length}편`;
    const tIssue = trend[0];
    const card = (id, icon, ttl, dsc) =>
      `<button class="hub-card" data-go="${id}"><span class="hub-ic">${ico(icon)}</span>
        <span class="ttl">${esc(ttl)}</span><span class="dsc">${esc(dsc)}</span></button>`;
    $('#hub').innerHTML =
      card('posts', 'doc', '글', `확인 대기 ${posts.filter((p) => !isArchived(p)).length}편 · 아카이브 ${posts.filter(isArchived).length}편`) +
      card('trend', 'trend', '트렌드', tIssue ? tIssue.headline : '오늘 뜨는 게임·주제') +
      `<button class="hub-card wide cta" data-go="request"><span class="hub-ic">${ico('edit')}</span>
        <span class="tx"><span class="ttl">새 글 요청하기</span><span class="dsc">주제만 적으면 작성→검수→발행까지 자동으로</span></span>
        <span class="go">${ico('chev', 20)}</span></button>`;
    $$('#hub [data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, b.dataset.go === 'request')));
  };

  /* ---- 글 목록 / 아카이브 ----
     글 목록 = 발행도 숨김도 안 한(아직 확인 안 한) 글만. 아카이브 = 발행됨·숨김 처리한 글 보관함.
     글을 ‘발행 완료’ 또는 ‘숨기기’ 하면 아카이브로 옮겨가고 목록은 바로 새로고침됨(누구나, 토큰 불필요). */
  let filterAuthor = '__all__';
  let archiveMode = false; try { archiveMode = localStorage.getItem('bc_app_archiveMode') === '1'; } catch (_) {}
  let archSub = 'all';   // 아카이브 하위 필터: all | pub | hid
  VIEWS.posts = async (root) => {
    root.innerHTML = `<div class="sec-h"><span class="t" id="pSecT">글 목록</span><span class="meta" id="pCount"></span></div>
      <div class="seg" id="pSeg"></div><div class="chips" id="chips"></div><div class="p-toolbar" id="pToolbar"></div><div id="postList">${skeleton(5)}</div>`;
    const posts = await getPosts().catch(() => []);
    if (!posts.length) { $('#postList').innerHTML = '<div class="empty lg">글 목록을 불러오지 못했어요.<br>네트워크 확인 후 다시 시도해주세요.</div>'; $('#pSeg').innerHTML = ''; $('#chips').innerHTML = ''; $('#pToolbar').innerHTML = ''; return; }
    const order = ['봄딩', '영도', '겜더쿠', '연봄'];
    const base = CFG('SITE_BASE', '..');
    const draw = () => {
      // 세그먼트(글 목록/아카이브)
      const workN = posts.filter((p) => !isArchived(p)).length;
      const archN = posts.filter(isArchived).length;
      const seg = (m, label, n) => `<button class="seg-b${archiveMode === m ? ' on' : ''}" data-seg="${m ? '1' : '0'}">${label}<span class="n">${n}</span></button>`;
      $('#pSeg').innerHTML = seg(false, '글 목록', workN) + seg(true, '아카이브', archN);
      $$('#pSeg [data-seg]').forEach((b) => b.addEventListener('click', () => {
        const m = b.dataset.seg === '1'; if (m === archiveMode) return;
        archiveMode = m; filterAuthor = '__all__'; archSub = 'all';
        try { localStorage.setItem('bc_app_archiveMode', m ? '1' : '0'); } catch (_) {}
        draw();
      }));
      // 현재 세그먼트의 기준 집합
      const baseAll = archiveMode ? posts.filter(isArchived) : posts.filter((p) => !isArchived(p));
      // 작성자 칩(현재 세그먼트 기준 카운트)
      const authors = Array.from(new Set(baseAll.map((p) => p.author)));
      authors.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
      if (filterAuthor !== '__all__' && !authors.includes(filterAuthor)) filterAuthor = '__all__';
      const chip = (key, label, count, color) => `<button class="chip${filterAuthor === key ? ' on' : ''}" data-f="${esc(key)}" style="--ac:${color}">${key !== '__all__' ? '<span class="dot"></span>' : ''}${esc(label)}<span class="n">${count}</span></button>`;
      let ch = chip('__all__', '전체', baseAll.length, '#4C6FFF');
      authors.forEach((a) => { ch += chip(a, a, baseAll.filter((p) => p.author === a).length, ac(a)); });
      $('#chips').innerHTML = ch;
      $$('#chips [data-f]').forEach((b) => b.addEventListener('click', () => { filterAuthor = b.dataset.f; draw(); }));
      // 작성자 필터 적용
      const list = filterAuthor === '__all__' ? baseAll : baseAll.filter((p) => p.author === filterAuthor);
      // 아카이브 하위 필터(전체/발행됨/숨김)
      let visList = list;
      if (archiveMode) {
        const aPub = list.filter((p) => p.published).length;
        const aHid = list.filter((p) => HIDDEN.has(p.rel) && !p.published).length;
        if (archSub === 'pub') visList = list.filter((p) => p.published);
        else if (archSub === 'hid') visList = list.filter((p) => HIDDEN.has(p.rel) && !p.published);
        const sub = (k, label, c) => `<button class="p-toggle${archSub === k ? ' on' : ''}" data-sub="${k}">${ico(k === 'pub' ? 'check' : (k === 'hid' ? 'eyeOff' : 'checkCircle'), 15)}${label} (${c})</button>`;
        $('#pToolbar').innerHTML = sub('all', '전체', aPub + aHid) + sub('pub', '발행됨', aPub) + sub('hid', '숨김', aHid);
        $$('#pToolbar [data-sub]').forEach((b) => b.addEventListener('click', () => { archSub = b.dataset.sub; draw(); }));
      } else {
        $('#pToolbar').innerHTML = '';
      }
      $('#pSecT').textContent = archiveMode ? '아카이브' : '글 목록';
      $('#pCount').textContent = visList.length ? `${visList.length}편` : '';
      $('#postList').innerHTML = visList.length ? visList.map((p) => {
        const href = base + '/' + enc(p.rel);
        const edited = p.updated && fmtDay(p.updated) !== fmtDay(p.created);
        const pubBadge = p.published ? `<span class="p-pub">${ico('check', 12)}발행됨</span>` : '';
        const isHidden = HIDDEN.has(p.rel);
        const hidBadge = isHidden ? `<span class="p-hid">${ico('eyeOff', 12)}숨김</span>` : '';
        return `<a class="post${p.published ? ' pub' : ''}${isHidden ? ' hidden-on' : ''}" href="${href}" target="_blank" rel="noopener" style="--ac:${ac(p.author)}" data-rel="${esc(p.rel)}" data-pub="${p.published ? 1 : 0}" data-autopub="${p.autopub ? 1 : 0}">
          <div class="p-top"><span class="who"><span class="dot"></span>${esc(p.author)}</span>${hidBadge}${p.cat ? `<span class="cat">${esc(p.cat)}</span>` : ''}${pubBadge}</div>
          <div class="p-title">${esc(p.title)}</div>${p.excerpt ? `<div class="p-ex">${esc(p.excerpt)}</div>` : ''}
          <div class="p-meta">${esc(fmtDay(p.created) || '—')} 등록${edited ? ' · 수정 ' + esc(fmtDay(p.updated)) : ''}<span class="ext">사이트에서 보기 ${extIco}</span></div></a>`;
      }).join('') : `<div class="empty">${archiveMode ? '아카이브가 비어 있어요. 글을 ‘발행 완료’ 또는 ‘숨기기’ 하면 여기로 모여요.' : '확인할 글이 없어요. 발행·숨김 처리한 글은 ‘아카이브’에 있어요.'}</div>`;
      injectPostMenus($('#postList'));
    };
    draw();
  };

  /* ---- 트렌드 ---- */
  VIEWS.trend = async (root) => {
    root.innerHTML = `<div class="sec-h"><span class="t">트렌드</span><span class="meta">데이터 분석실 · 작성자별 약점 처방 + 트렌드</span></div><div id="trendBox">${skeleton(3)}</div>`;
    let issues; try { issues = await getTrend(); } catch (_) { $('#trendBox').innerHTML = '<div class="empty lg">트렌드를 불러오지 못했어요.</div>'; return; }
    if (!issues.length) { $('#trendBox').innerHTML = '<div class="empty lg">아직 트렌드 브리핑이 없어요.</div>'; return; }
    $('#trendBox').innerHTML = issues.map((it) => {
      const w = it.writer || '';
      const picks = Array.isArray(it.picks) ? it.picks : [];
      return `<div class="card trend"><div class="t-h"><span class="t-writer" style="--ac:${ac(w)}">${esc(w || '트렌드')}</span><span class="t-date">${esc(fmtDay(it.date))}</span></div>
        ${it.headline ? `<div class="t-head">${esc(it.headline)}</div>` : ''}${it.lead ? `<div class="t-lead">${esc(it.lead)}</div>` : ''}
        ${picks.length ? `<ol class="picks">${picks.map((p, i) => `<li><span class="pick-n">${i + 1}</span><span class="pick-tx">${esc(p)}</span></li>`).join('')}</ol>` : ''}</div>`;
    }).join('');
  };

  /* ---- 새 글 요청 ---- */
  VIEWS.request = async (root) => {
    const connected = window.BC.PublishRequestService.isConnected();
    root.innerHTML =
      `<div id="maintBanner"></div>` +
      `<div class="livebar"><span class="live-dot"></span><div class="live-tx"><b>요청은 <u>15분에 한 번</u> 자동으로 확인돼요.</b>
        <span>접수된 요청을 차례로 <em>작성 → 검수 → 발행</em>까지 자동 처리합니다. 발행이 끝나면 알림(푸시)으로 알려드려요.</span></div>
        <span class="badge ${connected ? 'ok' : 'warn'}" id="beBadge">${esc(window.BC.PublishRequestService.backendLabel())}</span></div>
       <button class="push-cta" id="pushBtn" type="button" hidden>🔔 발행 알림 받기</button>
       <div class="card"><div class="card-b"><form class="form" id="reqForm" novalidate>
         <div class="field"><label for="fPurpose">글의 목적 <span class="req-star">*</span></label><select id="fPurpose">${PURPOSE_OPTIONS}</select>
           <div class="filehint">목적을 고르면 그 목적에 꼭 들어갈 정보(일정·쿠폰·공략 출처 등)를 챙겨 품질이 고르게 나와요. 모르겠으면 ‘기타’를 고르면 기획팀이 정해드려요.</div></div>
         <div class="field"><label for="fTopic">주제 <span class="req-star">*</span></label><input id="fTopic" type="text" placeholder="예: 메이크 드라마 MAD 초반 리롤 정리" autocomplete="off"></div>
         <div class="field"><label for="fMaterial">소재 / 참고 <span class="opt">선택</span></label><textarea id="fMaterial" placeholder="포함했으면 하는 내용·소재·참고 링크 등"></textarea></div>
         <div class="field"><label for="fWriter">희망 작성자 <span class="req-star">*</span></label><select id="fWriter"></select></div>
         <div class="field"><label>참고 문서 첨부 <span class="opt">선택</span></label>
           <div class="filerow">
             <label class="filebtn" for="fFile">📎 파일 선택</label>
             <input id="fFile" type="file" accept=".docx,.xlsx,.pdf,.txt,.hwpx,application/pdf,text/plain" hidden>
             <span id="fFileName" class="filename">선택된 파일 없음</span>
             <button type="button" id="fFileClear" class="fileclear" hidden>지우기</button>
           </div>
           <ol class="filehint filehint-list">
             <li>외주처가 준 "반드시 포함/제외할 내용" 문서를 올리면 <b>이 요청 글 1건에만</b> 규칙으로 반영돼요.</li>
             <li>다른 글·작성 규칙엔 영향 없는 <b>1회용</b>이에요.</li>
             <li>지원 형식: docx · xlsx · pdf · txt · hwpx</li>
           </ol>
         </div>
         <button class="submit" type="submit">발행 요청 보내기</button>
       </form></div></div>
       <div class="sec-h" style="margin-top:6px"><span class="t" style="font-size:17px">내가 보낸 요청</span><span class="meta" id="reqCount"></span></div>
       <div id="reqList"><div class="empty">아직 보낸 요청이 없어요.</div></div>`;
    // 작성자 옵션
    const posts = await getPosts().catch(() => []);
    const known = ['봄딩', '영도', '겜더쿠', '연봄'];
    const authors = Array.from(new Set(known.concat(posts.map((p) => p.author).filter((a) => a && a !== '(기타)'))));
    $('#fWriter').innerHTML = '<option value="" disabled selected>작성자를 선택하세요</option>' + authors.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    renderRequests();
    // 뷰 진입 시 1회 백엔드 상태 동기화 → 발행중/접수됨 라벨 갱신 + 발행 완료분 제거
    window.BC.PublishRequestService.syncStatuses().then((c) => { if (c) renderRequests(); }).catch(() => {});
    // 점검 중이면 상단 배너(스킬 점검 → 발행 일시 중단). 실패/미연결이면 표시 안 함.
    window.BC.PublishRequestService.maintenance().then((m) => {
      const el = $('#maintBanner'); if (!el) return;
      el.innerHTML = (m && m.active)
        ? `<div class="maint-banner" role="status"><span class="mi">🔧</span><div><b>점검 중 — 발행 일시 중단</b><span>스킬 점검 중이라 글 발행을 잠시 멈췄어요. 요청은 정상 접수되며, 점검이 끝나면 차례로 자동 발행됩니다.</span></div></div>`
        : '';
    }).catch(() => {});
    renderPush();
    // 첨부 파일 선택
    let pickedFile = null;
    const fFile = $('#fFile'), fName = $('#fFileName'), fClear = $('#fFileClear');
    fFile.addEventListener('change', () => {
      pickedFile = fFile.files && fFile.files[0] || null;
      if (pickedFile && pickedFile.size > 10 * 1024 * 1024) { toast('파일이 너무 커요 (최대 10MB).'); pickedFile = null; fFile.value = ''; }
      fName.textContent = pickedFile ? pickedFile.name : '선택된 파일 없음'; fClear.hidden = !pickedFile;
    });
    fClear.addEventListener('click', () => { pickedFile = null; fFile.value = ''; fName.textContent = '선택된 파일 없음'; fClear.hidden = true; });
    $('#pushBtn').addEventListener('click', async () => {
      const btn = $('#pushBtn'); if (!btn || btn.disabled) return;
      btn.disabled = true; btn.textContent = '알림 권한 요청 중…';
      const sub = await window.BC.PushService.subscribe().catch(() => null);
      if (sub) toast('알림을 켰어요. 발행이 끝나면 알려드릴게요.');
      else toast('알림이 켜지지 않았어요. 브라우저/기기 설정에서 이 사이트의 알림을 허용해주세요.');
      renderPush();
    });
    $('#reqForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const purpose = $('#fPurpose').value, topic = $('#fTopic').value.trim(), material = $('#fMaterial').value.trim(), writer = $('#fWriter').value;
      if (!purpose) { toast('글의 목적을 선택해주세요.'); $('#fPurpose').focus(); return; }
      if (!topic) { toast('주제를 입력해주세요.'); $('#fTopic').focus(); return; }
      if (!writer) { toast('희망 작성자를 선택해주세요.'); $('#fWriter').focus(); return; }
      const rec = await window.BC.PublishRequestService.submit({ purpose, topic, material, writer, file: pickedFile });
      $('#reqForm').reset();
      pickedFile = null; fName.textContent = '선택된 파일 없음'; fClear.hidden = true;
      renderRequests();
      toast(rec.status === 'submitted' ? '발행 요청을 보냈어요.'
        : rec.status === 'failed' ? '전송에 실패했어요. 잠시 후 다시 시도해주세요.'
        : '요청을 이 기기에 저장했어요 (백엔드 연결 시 자동 전송).');
    });
  };
  async function renderPush() {
    const btn = $('#pushBtn'); if (!btn) return;
    const P = window.BC.PushService;
    const st = await P.status().catch(() => 'unsupported');
    if (st === 'unconfigured') { btn.hidden = true; return; }   // 백엔드 미연결: 버튼 숨김
    btn.hidden = false;
    if (st === 'unsupported') { btn.disabled = true; btn.classList.remove('on'); btn.textContent = '이 브라우저는 알림을 지원하지 않아요'; return; }
    if (st === 'subscribed') { btn.disabled = true; btn.classList.add('on'); btn.textContent = '🔔 발행 알림 켜짐'; return; }
    btn.disabled = false; btn.classList.remove('on'); btn.textContent = '🔔 발행 알림 받기';
  }
  function renderRequests() {
    const reqs = window.BC.PublishRequestService.list().filter((r) => r.status !== 'published'); // 발행 완료분은 숨김(요청 #1)
    const box = $('#reqList'); if (!box) return;
    const cnt = $('#reqCount'); if (cnt) cnt.textContent = reqs.length ? `${reqs.length}건` : '';
    if (!reqs.length) { box.innerHTML = '<div class="empty">아직 보낸 요청이 없어요.</div>'; return; }
    const label = { local: '저장됨(로컬)', queued: '대기(전송예정)', submitted: '접수됨', received: '접수됨', processing: '발행중', published: '발행됨', failed: '전송 실패(재시도 필요)', skipped: '건너뜀' };
    box.innerHTML = reqs.map((r) => `<div class="req"><div class="r-top"><b>${esc(r.topic || '(주제 없음)')}</b><span class="rstat s-${r.status}">${label[r.status] || r.status}</span></div>${r.material ? `<div class="r-sub">소재: ${esc(r.material)}</div>` : ''}${r.fileName ? `<div class="r-sub">📎 ${esc(r.fileName)}</div>` : ''}<div class="r-meta">${r.purpose ? `목적: ${esc(r.purpose)} · ` : ''}희망 작성자: ${esc(r.writer || '미지정')} · ${esc(fmtDay(new Date(r.createdAt).toISOString().slice(0, 10)))}</div><button class="r-del" data-id="${esc(r.id)}">삭제</button></div>`).join('');
    $$('.r-del', box).forEach((b) => b.addEventListener('click', () => { window.BC.PublishRequestService.remove(b.dataset.id); renderRequests(); }));
  }

  /* ================= 라우터 (메인=홈, 섹션 뎁스) ================= */
  let route = 'home', lastTab = 'home';
  function go(r, push) {
    if (!VIEWS[r]) r = 'home';
    route = r;
    if (NAV.some((n) => n.id === r)) lastTab = r;
    const url = '#/' + r;
    if (push) { try { history.pushState({ r }, '', url); } catch (_) {} }
    else { try { history.replaceState({ r }, '', url); } catch (_) {} }
    paint();
  }
  async function paint() {
    // 앱바
    $('#abTitle').textContent = TITLE[route] || '블로그 컴퍼니';
    $('#abSub').textContent = SUB[route] || '';
    $('#backBtn').hidden = (route === lastTab) && NAV.some((n) => n.id === route);
    $('#abLogo').style.display = $('#backBtn').hidden ? '' : 'none';
    // 내비/FAB
    $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.go === route));
    $('#fab').classList.toggle('hide', route === 'request');
    // 본문
    const root = $('#view'); root.scrollTop = 0; window.scrollTo(0, 0);
    try { await VIEWS[route](root); } catch (e) { root.innerHTML = '<div class="empty lg">화면을 불러오지 못했어요.</div>'; console.warn(e); }
    root.focus({ preventScroll: true });
  }
  function currentHashRoute() { const m = (location.hash || '').match(/#\/([a-z]+)/); return m && VIEWS[m[1]] ? m[1] : 'home'; }

  /* ---------- 토스트 ---------- */
  let toastT;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }

  /* ---------- 서비스워커 ---------- */
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 등록 실패', e)));

  /* ---------- 부팅 ---------- */
  function build() {
    // 하단 내비 구성(레지스트리)
    $('#tabbar').innerHTML = NAV.map((n) => `<button data-go="${n.id}" aria-label="${esc(n.label)}">${ico(n.icon, 23)}<span>${esc(n.label)}</span></button>`).join('');
    $$('#tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, false)));
    $('#fab').addEventListener('click', () => go('request', true));
    $('#backBtn').addEventListener('click', () => history.back());
    window.addEventListener('popstate', () => { route = currentHashRoute(); if (NAV.some((n) => n.id === route)) lastTab = route; paint(); });
    // 관리자 모드(잠금 버튼) — 토큰 잠금 해제 시 글 카드 메뉴(삭제/발행완료) 노출
    const lockBtn = $('#lockBtn');
    const updateLock = () => { if (!lockBtn) return; const on = ADMIN.isOn(); lockBtn.classList.toggle('on', on); lockBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${on ? P.lockOpen : P.lock}</svg>`; };
    if (lockBtn) lockBtn.addEventListener('click', () => ADMIN.openModal());
    ADMIN.setOnChange(() => { updateLock(); if (route === 'posts') paint(); });
    ADMIN.restore();
  }
  function boot() {
    build();
    go(currentHashRoute(), false);
    // 스플래시 정리
    setTimeout(() => { const s = $('#splash'); if (s) { s.classList.add('hide'); setTimeout(() => s.remove(), 600); } }, 850);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
