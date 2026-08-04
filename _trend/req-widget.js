/* ============================================================
   브리핑 전문(_trend/<작성자>/<날짜>.html) 발행 요청 위젯
   ------------------------------------------------------------
   '오늘 쓸 글 추천'(.tabs .pick) 각 추천에 [발행 요청]·[복사] 버튼을 주입한다.
   누르면 그 추천의 목적(.purp)·주제(.ptitle)·소재(.pwhy+.pwhen+참고링크)를
   백엔드 큐(POST {API}/requests)로 그대로 보내 기획팀이 바로 작성에 들어간다.
   - DOM 텍스트에서 읽으므로 픽마다 데이터 중복 불필요(레거시 브리핑에도 동작).
   - 사이트/PWA api.js·index.html 의 요청 계약과 1:1 동일.
   ⚠ API 주소가 바뀌면 index.html REQ_CFG·app/api.js BC_CONFIG 와 함께 이 값을 갱신.
   ============================================================ */
(function () {
  if (window.__reqWidgetLoaded) return; window.__reqWidgetLoaded = true;
  var API = 'https://34.139.184.70.sslip.io';
  var PURPOSES = ['사전예약', '출시·첫인상', '업데이트·패치', '게임 정보', '게임 공략', '쿠폰·이벤트', '티어·추천', '제품 비교·추천', '사용 후기·리뷰'];
  var WRITERS = ['봄딩', '영도', '겜더쿠', '연봄'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

  // .purp 라벨 → post-purpose-guide 정본 라벨로 정규화(아니면 기타 → 백엔드도 기타 처리).
  function normPurpose(raw) {
    if (PURPOSES.indexOf(raw) >= 0) return raw;
    var s = raw || '';
    if (/사전(예약|등록)/.test(s)) return '사전예약';
    if (/첫인상|신작|출시|데뷔|신캐/.test(s)) return '출시·첫인상';
    if (/쿠폰|이벤트/.test(s)) return '쿠폰·이벤트';
    if (/티어|빌드|리세|추천/.test(s)) return '티어·추천';
    if (/공략|허브|총정리|세팅|조합/.test(s)) return '게임 공략';
    if (/업데이트|패치|업뎃|미리보기|프리뷰/.test(s)) return '업데이트·패치';
    if (/기어|제품|마우스|키보드|비교|구매/.test(s)) return '제품 비교·추천';
    if (/후기|리뷰/.test(s)) return '사용 후기·리뷰';
    if (/정보|e스포츠|소식|행사/.test(s)) return '게임 정보';
    return '기타';
  }

  function detectWriter() {
    var t = (document.title || '') + ' ' + (document.body ? document.body.textContent.slice(0, 200) : '');
    for (var i = 0; i < WRITERS.length; i++) if (t.indexOf(WRITERS[i]) >= 0) return WRITERS[i];
    return '';
  }

  // .pick → {purpose, topic, material, writer}
  function pickToReq(pick, writer) {
    var purposeRaw = txt(pick.querySelector('.purp'));
    var when = txt(pick.querySelector('.pwhen'));
    var topic = txt(pick.querySelector('.ptitle'));
    var whyEl = pick.querySelector('.pwhy');
    var why = txt(whyEl);
    var urls = [];
    if (whyEl) Array.prototype.forEach.call(whyEl.querySelectorAll('a[href]'), function (a) { var u = a.getAttribute('href'); if (u && urls.indexOf(u) < 0) urls.push(u); });
    var material = (when ? '[' + when + '] ' : '') + why + (urls.length ? ' · 참고: ' + urls.join(' , ') : '');
    return { purpose: normPurpose(purposeRaw), topic: topic, material: material.trim(), writer: writer };
  }

  function block(req) {
    return '[목적] ' + req.purpose + '\n[작성자] ' + (req.writer || '미지정') + '\n[주제] ' + req.topic + '\n[소재/참고메모] ' + (req.material || '(없음)');
  }

  async function submit(btn, req) {
    if (!confirm('이 추천을 기획팀에 새 글로 요청할까요?\n\n' + block(req) + '\n\n접수되면 작성 → 검수 → 발행이 진행돼요. 진행 상황은 쓰담 사이트 ‘작업 큐’에서 볼 수 있어요.')) return;
    var act = btn.parentNode; Array.prototype.forEach.call(act.querySelectorAll('button'), function (b) { b.disabled = true; });
    var old = btn.innerHTML; btn.innerHTML = '요청 중…';
    try {
      var res = await fetch(API + '/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: req.purpose, topic: req.topic, material: req.material, writer: req.writer, source: 'briefing' })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      btn.innerHTML = '✓ 요청됨'; btn.classList.add('done');
    } catch (e) {
      Array.prototype.forEach.call(act.querySelectorAll('button'), function (b) { b.disabled = false; });
      btn.innerHTML = old; alert('요청 전송에 실패했어요: ' + ((e && e.message) || e));
    }
  }

  async function copy(req) {
    try { await navigator.clipboard.writeText(block(req)); flash('요청 양식을 복사했어요.'); }
    catch (e) {
      // 폴백: 임시 textarea
      try { var ta = document.createElement('textarea'); ta.value = block(req); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); flash('요청 양식을 복사했어요.'); }
      catch (e2) { alert('복사에 실패했어요.'); }
    }
  }

  var flashEl = null, flashT = null;
  function flash(msg) {
    if (!flashEl) { flashEl = document.createElement('div'); flashEl.className = 'rw-flash'; flashEl.setAttribute('role', 'status'); flashEl.setAttribute('aria-live', 'polite'); document.body.appendChild(flashEl); }
    flashEl.textContent = msg; flashEl.classList.add('show');
    clearTimeout(flashT); flashT = setTimeout(function () { flashEl.classList.remove('show'); }, 2400);
  }

  function injectStyle() {
    var css = ''
      + '.rw-act{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;}'
      + '.rw-btn{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;'
      + 'border-radius:9px;border:1px solid transparent;padding:7px 12px;line-height:1;transition:filter .12s,background .12s,opacity .12s;}'
      + '.rw-req{color:#fff;background:#5A4FE6;}'
      + '.rw-req:hover{filter:brightness(1.08);}'
      + '.rw-req.done{background:#1b9e6f;}'
      + '.rw-copy{color:#555;background:#eef0f5;border-color:#e2e5ec;}'
      + '.rw-copy:hover{color:#111;}'
      + '.rw-btn:disabled{opacity:.55;cursor:default;}'
      + '.rw-flash{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);z-index:9999;'
      + 'background:#15171c;color:#fff;font-size:13px;font-weight:600;padding:11px 18px;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.3);'
      + 'opacity:0;visibility:hidden;transition:opacity .2s,transform .2s,visibility .2s;}'
      + '.rw-flash.show{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0);}'
      + '@media(prefers-color-scheme:dark){.rw-copy{color:#cbd2dd;background:#222831;border-color:#333a45;}.rw-copy:hover{color:#fff;}.rw-flash{background:#e8eaef;color:#15171c;}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }

  function init() {
    var picks = document.querySelectorAll('.tabs .pick');
    if (!picks.length) return;
    injectStyle();
    var writer = detectWriter();
    Array.prototype.forEach.call(picks, function (pick) {
      if (pick.querySelector('.rw-act')) return;
      var req = pickToReq(pick, writer);
      if (!req.topic) return; // 주제 없으면 건너뜀
      var act = document.createElement('div'); act.className = 'rw-act';
      var bReq = document.createElement('button'); bReq.type = 'button'; bReq.className = 'rw-btn rw-req'; bReq.innerHTML = '✈ 발행 요청';
      bReq.title = '이 추천을 기획팀에 새 글로 요청';
      bReq.addEventListener('click', function () { submit(bReq, pickToReq(pick, writer)); });
      var bCopy = document.createElement('button'); bCopy.type = 'button'; bCopy.className = 'rw-btn rw-copy'; bCopy.innerHTML = '⧉ 복사';
      bCopy.title = '목적·주제·소재 양식 복사';
      bCopy.addEventListener('click', function () { copy(pickToReq(pick, writer)); });
      act.appendChild(bReq); act.appendChild(bCopy);
      pick.appendChild(act);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
