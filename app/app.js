/* 블로그 컴퍼니 PWA — UI/라우팅 (백엔드 호출은 전부 api.js의 window.BC 경유)
   구조: 화면 레지스트리(NAV) + 해시 라우터(메인=홈 허브, 섹션 뎁스) + 데이터 로더(posts/trend/news/calendar).
   확장: 새 섹션은 VIEWS에 렌더러 1개 + (탭이면) NAV에 1줄 추가로 끝난다. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = (rel) => rel.split('/').map(encodeURIComponent).join('/');
  const ACCENT = { '봄딩': '#E06C49', '영도': '#2F8F7F', '겜더쿠': '#7C5CD1' };
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
    check: '<path d="M20 6 9 17l-5-5"/>'
  };
  const ico = (n, w) => `<svg viewBox="0 0 24 24" width="${w || 24}" height="${w || 24}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;
  const extIco = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  /* ---------- 화면 레지스트리(하단 내비) ---------- */
  const NAV = [
    { id: 'home', label: '홈', icon: 'home' },
    { id: 'posts', label: '발행글', icon: 'doc' },
    { id: 'trend', label: '트렌드', icon: 'trend' },
    { id: 'news', label: '뉴스레터', icon: 'news' },
    { id: 'calendar', label: '캘린더', icon: 'cal' }
  ];
  const SUB = { posts: '봄딩·영도·겜더쿠 발행글', trend: '오늘 뜨는 게임·주제', news: '한·일·미 게임 뉴스', calendar: '출시·업데이트·행사 일정', request: '주제만 적으면 작성→검수→발행', home: '당신의 글쓰기 동료' };
  const TITLE = { home: '쓰담', posts: '발행글', trend: '트렌드', news: '뉴스레터', calendar: '출시 캘린더', request: '새 글 요청' };

  /* ---------- 데이터 (캐시) ---------- */
  const cache = {};
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
    for (const u of urls) { try { const arr = normalizePosts(await loadJSON(u)); if (arr.length) return (cache.posts = arr); } catch (_) {} }
    return (cache.posts = []);
  }
  async function getTrend() { if (cache.trend) return cache.trend; const d = await loadJSON(CFG('TREND_URL', '../_trend/trend.json')); return (cache.trend = (d && d.issues) || []); }
  async function getNews() { if (cache.news) return cache.news; const d = await loadJSON(CFG('NEWS_URL', '../_news/news.json')); return (cache.news = (d && d.issues) || []); }
  async function getCalendar() { if (cache.cal) return cache.cal; const d = await loadJSON(CFG('CALENDAR_URL', '../_calendar/calendar.json')); return (cache.cal = d || { events: [] }); }

  const skeleton = (n) => Array.from({ length: n || 4 }, () => '<div class="skel"></div>').join('');

  /* ================= 뷰 렌더러 ================= */
  const VIEWS = {};

  /* ---- 홈(메인 허브) ---- */
  VIEWS.home = async (root) => {
    root.innerHTML =
      `<section class="hero"><h2>쓰담</h2><p><b style="opacity:.96">당신의 글쓰기 동료</b> — 발행글·트렌드·뉴스레터·출시 캘린더를 한곳에서, 새 글도 여기서 바로 요청해요.</p>
        <span class="stat" id="heroStat">불러오는 중…</span></section>
       <div class="hub" id="hub">${skeleton(4)}</div>`;
    const [posts, trend, news, cal] = await Promise.all([
      getPosts().catch(() => []), getTrend().catch(() => []), getNews().catch(() => []), getCalendar().catch(() => ({ events: [] }))
    ]);
    const stat = $('#heroStat'); if (stat) stat.innerHTML = `${ico('doc', 14)} 발행글 ${posts.length}편`;
    const tIssue = trend[0]; const nIssue = news[0];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming = (cal.events || []).filter((e) => toTs(e.date) >= today.getTime()).length;
    const card = (id, icon, ttl, dsc) =>
      `<button class="hub-card" data-go="${id}"><span class="hub-ic">${ico(icon)}</span>
        <span class="ttl">${esc(ttl)}</span><span class="dsc">${esc(dsc)}</span></button>`;
    $('#hub').innerHTML =
      card('posts', 'doc', '발행글', `봄딩·영도·겜더쿠 ${posts.length}편`) +
      card('trend', 'trend', '트렌드', tIssue ? tIssue.headline : '오늘 뜨는 게임·주제') +
      card('news', 'news', '뉴스레터', nIssue ? `${fmtDay(nIssue.date)} · 한·일·미 소식` : '게임 뉴스 모음') +
      card('calendar', 'cal', '캘린더', upcoming ? `다가오는 일정 ${upcoming}건` : '출시·업데이트·행사') +
      `<button class="hub-card wide cta" data-go="request"><span class="hub-ic">${ico('edit')}</span>
        <span class="tx"><span class="ttl">새 글 요청하기</span><span class="dsc">주제만 적으면 작성→검수→발행까지 자동으로</span></span>
        <span class="go">${ico('chev', 20)}</span></button>`;
    $$('#hub [data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, b.dataset.go === 'request')));
  };

  /* ---- 발행글 ---- */
  let filterAuthor = '__all__';
  VIEWS.posts = async (root) => {
    root.innerHTML = `<div class="sec-h"><span class="t">발행글</span><span class="meta" id="pCount"></span></div><div class="chips" id="chips"></div><div id="postList">${skeleton(5)}</div>`;
    const posts = await getPosts().catch(() => []);
    $('#pCount').textContent = posts.length ? `총 ${posts.length}편` : '';
    if (!posts.length) { $('#postList').innerHTML = '<div class="empty lg">글 목록을 불러오지 못했어요.<br>네트워크 확인 후 다시 시도해주세요.</div>'; $('#chips').innerHTML = ''; return; }
    const authors = Array.from(new Set(posts.map((p) => p.author)));
    const order = ['봄딩', '영도', '겜더쿠'];
    authors.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
    const chip = (key, label, count, color) => `<button class="chip${filterAuthor === key ? ' on' : ''}" data-f="${esc(key)}" style="--ac:${color}">${key !== '__all__' ? '<span class="dot"></span>' : ''}${esc(label)}<span class="n">${count}</span></button>`;
    let ch = chip('__all__', '전체', posts.length, '#4C6FFF');
    authors.forEach((a) => { ch += chip(a, a, posts.filter((p) => p.author === a).length, ac(a)); });
    $('#chips').innerHTML = ch;
    const draw = () => {
      $$('#chips [data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === filterAuthor));
      const list = filterAuthor === '__all__' ? posts : posts.filter((p) => p.author === filterAuthor);
      const base = CFG('SITE_BASE', '..');
      $('#postList').innerHTML = list.length ? list.map((p) => {
        const href = base + '/' + enc(p.rel);
        const edited = p.updated && fmtDay(p.updated) !== fmtDay(p.created);
        const pubBadge = p.published ? `<span class="p-pub">${ico('check', 12)}발행됨</span>` : '';
        return `<a class="post${p.published ? ' pub' : ''}" href="${href}" target="_blank" rel="noopener" style="--ac:${ac(p.author)}">
          <div class="p-top"><span class="who"><span class="dot"></span>${esc(p.author)}</span>${p.cat ? `<span class="cat">${esc(p.cat)}</span>` : ''}${pubBadge}</div>
          <div class="p-title">${esc(p.title)}</div>${p.excerpt ? `<div class="p-ex">${esc(p.excerpt)}</div>` : ''}
          <div class="p-meta">${esc(fmtDay(p.created) || '—')} 등록${edited ? ' · 수정 ' + esc(fmtDay(p.updated)) : ''}<span class="ext">사이트에서 보기 ${extIco}</span></div></a>`;
      }).join('') : '<div class="empty">표시할 글이 없어요.</div>';
    };
    $$('#chips [data-f]').forEach((b) => b.addEventListener('click', () => { filterAuthor = b.dataset.f; draw(); }));
    draw();
  };

  /* ---- 트렌드 ---- */
  VIEWS.trend = async (root) => {
    root.innerHTML = `<div class="sec-h"><span class="t">트렌드</span><span class="meta">지금 쓰면 유입되는 게임·주제</span></div><div id="trendBox">${skeleton(3)}</div>`;
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

  /* ---- 뉴스레터 ---- */
  VIEWS.news = async (root) => {
    root.innerHTML = `<div class="sec-h"><span class="t">뉴스레터</span><span class="meta">한·일·미 게임 소식</span></div><div id="newsBox">${skeleton(4)}</div>`;
    let issues; try { issues = await getNews(); } catch (_) { $('#newsBox').innerHTML = '<div class="empty lg">뉴스레터를 불러오지 못했어요.</div>'; return; }
    if (!issues.length) { $('#newsBox').innerHTML = '<div class="empty lg">아직 뉴스레터가 없어요.</div>'; return; }
    const issue = issues[0];
    const items = Array.isArray(issue.items) ? issue.items : [];
    $('#newsBox').innerHTML =
      `<div class="news-date">${esc(fmtDay(issue.date))}</div>${issue.headline ? `<div class="news-head">${esc(issue.headline)}</div>` : ''}` +
      (items.length ? items.map((n) => {
        const links = Array.isArray(n.links) ? n.links : [];
        const c = String(n.country || '').toUpperCase();
        return `<div class="card"><div class="card-b nitem"><div class="n-top"><span class="flag ${esc(c)}">${esc(c || 'GL')}</span>${n.cat ? `<span class="n-cat">${esc(n.cat)}</span>` : ''}</div>
          <div class="n-title">${esc(n.title)}</div>${n.summary ? `<div class="n-sum">${esc(n.summary)}</div>` : ''}
          ${links.length ? `<div class="n-links">${links.map((l) => `<a class="n-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || '링크')} ${extIco}</a>`).join('')}</div>` : ''}</div></div>`;
      }).join('') : '<div class="empty">이번 호에 항목이 없어요.</div>');
  };

  /* ---- 캘린더 ---- */
  VIEWS.calendar = async (root) => {
    root.innerHTML = `<div class="sec-h"><span class="t">출시 캘린더</span><span class="meta" id="calMeta"></span></div><div id="calBox">${skeleton(4)}</div>`;
    let data; try { data = await getCalendar(); } catch (_) { $('#calBox').innerHTML = '<div class="empty lg">캘린더를 불러오지 못했어요.</div>'; return; }
    const events = (data.events || []).slice().sort((a, b) => toTs(a.date) - toTs(b.date));
    if (!events.length) { $('#calBox').innerHTML = '<div class="empty lg">등록된 일정이 없어요.</div>'; return; }
    if (data.updated) $('#calMeta').textContent = '갱신 ' + fmtDay(data.updated);
    const today = new Date(); today.setHours(0, 0, 0, 0); const tts = today.getTime();
    const upcoming = events.filter((e) => toTs(e.date) >= tts);
    const past = events.filter((e) => toTs(e.date) < tts).reverse();
    const M = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const evHtml = (e) => {
      const dt = new Date(toTs(e.date)); const isToday = toTs(e.date) === tts;
      const metaBits = [e.platform, e.genre, e.publisher].filter(Boolean).map(esc).join(' · ');
      return `<div class="event"><div class="ev-date${isToday ? ' d-today' : ''}"><span class="d">${dt.getDate() || ''}</span><span class="m">${M[dt.getMonth()] || ''}</span></div>
        <div class="ev-body"><div class="ev-top">${e.type ? `<span class="ev-type">${esc(e.type)}</span>` : ''}${isToday ? '<span class="ev-plat" style="color:var(--brand);font-weight:800">오늘</span>' : ''}</div>
          <div class="ev-title">${esc(e.title)}</div>${metaBits ? `<div class="ev-meta">${metaBits}</div>` : ''}${e.note ? `<div class="ev-note">${esc(e.note)}</div>` : ''}
          ${e.link ? `<a class="ev-link" href="${esc(e.link)}" target="_blank" rel="noopener">자세히 ${extIco}</a>` : ''}</div></div>`;
    };
    $('#calBox').innerHTML =
      (upcoming.length ? `<div class="cal-group">다가오는 일정</div>` + upcoming.map(evHtml).join('') : '') +
      (past.length ? `<div class="cal-group">지난 일정</div>` + past.map(evHtml).join('') : '');
  };

  /* ---- 새 글 요청 ---- */
  VIEWS.request = async (root) => {
    const connected = window.BC.PublishRequestService.isConnected();
    root.innerHTML =
      `<div class="livebar"><span class="live-dot"></span><div class="live-tx"><b>요청은 <u>15분에 한 번</u> 자동으로 확인돼요.</b>
        <span>접수된 요청을 차례로 <em>작성 → 검수 → 발행</em>까지 자동 처리합니다. 발행이 끝나면 알림(푸시)으로 알려드려요.</span></div>
        <span class="badge ${connected ? 'ok' : 'warn'}" id="beBadge">${esc(window.BC.PublishRequestService.backendLabel())}</span></div>
       <button class="push-cta" id="pushBtn" type="button" hidden>🔔 발행 알림 받기</button>
       <div class="card"><div class="card-b"><form class="form" id="reqForm" novalidate>
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
           <div class="filehint">외주처가 준 "반드시 포함/제외할 내용" 문서를 올리면 <b>이 요청 글 1건에만</b> 반드시 지킬 규칙으로 반영돼요. (1회용 · docx·xlsx·pdf·txt·hwpx)</div>
         </div>
         <button class="submit" type="submit">발행 요청 보내기</button>
       </form></div></div>
       <div class="sec-h" style="margin-top:6px"><span class="t" style="font-size:17px">내가 보낸 요청</span><span class="meta" id="reqCount"></span></div>
       <div id="reqList"><div class="empty">아직 보낸 요청이 없어요.</div></div>`;
    // 작성자 옵션
    const posts = await getPosts().catch(() => []);
    const known = ['봄딩', '영도', '겜더쿠'];
    const authors = Array.from(new Set(known.concat(posts.map((p) => p.author).filter((a) => a && a !== '(기타)'))));
    $('#fWriter').innerHTML = '<option value="" disabled selected>작성자를 선택하세요</option>' + authors.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    renderRequests();
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
      const topic = $('#fTopic').value.trim(), material = $('#fMaterial').value.trim(), writer = $('#fWriter').value;
      if (!topic) { toast('주제를 입력해주세요.'); $('#fTopic').focus(); return; }
      if (!writer) { toast('희망 작성자를 선택해주세요.'); $('#fWriter').focus(); return; }
      const rec = await window.BC.PublishRequestService.submit({ topic, material, writer, file: pickedFile });
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
    const reqs = window.BC.PublishRequestService.list();
    const box = $('#reqList'); if (!box) return;
    const cnt = $('#reqCount'); if (cnt) cnt.textContent = reqs.length ? `${reqs.length}건` : '';
    if (!reqs.length) { box.innerHTML = '<div class="empty">아직 보낸 요청이 없어요.</div>'; return; }
    const label = { local: '저장됨(로컬)', queued: '대기(전송예정)', submitted: '전송됨', failed: '전송 실패(재시도 필요)' };
    box.innerHTML = reqs.map((r) => `<div class="req"><div class="r-top"><b>${esc(r.topic || '(주제 없음)')}</b><span class="rstat s-${r.status}">${label[r.status] || r.status}</span></div>${r.material ? `<div class="r-sub">소재: ${esc(r.material)}</div>` : ''}${r.fileName ? `<div class="r-sub">📎 ${esc(r.fileName)}</div>` : ''}<div class="r-meta">희망 작성자: ${esc(r.writer || '미지정')} · ${esc(fmtDay(new Date(r.createdAt).toISOString().slice(0, 10)))}</div><button class="r-del" data-id="${esc(r.id)}">삭제</button></div>`).join('');
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
  }
  function boot() {
    build();
    go(currentHashRoute(), false);
    // 스플래시 정리
    setTimeout(() => { const s = $('#splash'); if (s) { s.classList.add('hide'); setTimeout(() => s.remove(), 600); } }, 850);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
