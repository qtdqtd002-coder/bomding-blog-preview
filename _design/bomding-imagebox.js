/*! 봄딩 이미지함 (imagebox) — 미리보기 좌측 여백에 조사 이미지 모음 + 원클릭 다운로드
 *  ★봄딩 전용(학습격리). 영도·겜더쿠·연봄·하루살이로 전파 금지.
 *  정본: ~/.claude/skills/bomding-blog-writer/references/output-format.md §6
 *  임베드: 미리보기 HTML </body> 앞에 아래 한 줄
 *    <script src="https://qtdqtd002-coder.github.io/bomding-blog-preview/_design/bomding-imagebox.js" defer></script>
 *  수집원: ① 본문 <img> + 주변 메타(.cap/.src/이유 주석)  ② <script type="application/json" id="np-imgkit"> 추가 후보
 *  이미지·링크가 0이면 아무것도 그리지 않는다.
 *  ★뷰어(2026-09-05): 썸네일 클릭 = 새 탭이 아니라 «같은 화면 오버레이 1개».
 *    ← → 로 사진을 넘기고(끝에서 순환), 마음에 드는 사진이 나오면 그 사진 우측 하단 「저장」으로 받는다. Esc 닫기.
 */
(function () {
  "use strict";
  if (window.__bdImagebox) return; window.__bdImagebox = 1;

  var LS = "bd-imagebox-open";
  var PAGE_TITLE = ((document.querySelector("h1.title") || {}).textContent || document.title || "").trim();

  /* ---------- 유틸 ---------- */
  function txt(el) { return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : ""; }
  function safeName(s) { return String(s || "").replace(/[\\\/:*?"<>|]/g, "").replace(/\s+/g, "_"); }
  function slug(s) {
    var v = String(s || "").replace(/[^가-힣A-Za-z0-9]/g, "");
    return v ? v.slice(0, 14) : "출처미상";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return ("0" + n).slice(-2); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  /* ---------- 1. 본문 이미지 수집 ---------- */
  /* 직전 형제 주석에서 "이미지 이유: … / 출처: … / 분류: …" 파싱 */
  function commentMeta(node) {
    var n = node, hop = 0, out = { why: "", srcUrl: "", kind: "" };
    while (n && hop < 6) {
      n = n.previousSibling; hop++;
      if (!n) break;
      if (n.nodeType === 8) {
        var c = n.nodeValue || "";
        if (c.indexOf("이미지 이유") < 0) continue;
        var w = c.match(/이미지 이유\s*:\s*([^\/]*)/); if (w) out.why = w[1].trim();
        var u = c.match(/출처\s*:\s*(https?:\/\/\S+)/); if (u) out.srcUrl = u[1].trim();
        var k = c.match(/분류\s*:\s*([^\/]*)/); if (k) out.kind = k[1].trim();
        break;
      }
      if (n.nodeType === 1) break; /* 다른 엘리먼트를 만나면 중단 */
    }
    return out;
  }
  /* 출처 줄 텍스트 정제: "이미지 출처: ○○ · 네이버 본문엔 …" → "○○" */
  function cleanSrc(s) {
    return String(s || "")
      .replace(/^\s*(?:이미지\s*출처|이미지|출처)\s*[:：]\s*/, "")
      .replace(/\s*[·|]\s*네이버.*$/, "")
      .trim();
  }
  /* 출처 줄 클래스 변이 — 실측: src 286 · src2 6 · src-line 1 (2026-09-02) */
  function isSrcLine(cl) {
    return cl && (cl.contains("src") || cl.contains("src2") || cl.contains("src-line"));
  }
  /* 이미지 블록 다음 형제에서 .cap / 출처 줄 찾기 */
  function afterMeta(block) {
    var n = block, hop = 0, out = { cap: "", srcName: "", srcUrl: "" };
    while (n && hop < 4) {
      n = n.nextElementSibling; hop++;
      if (!n) break;
      var cl = n.classList;
      if (cl && cl.contains("cap") && !out.cap) { out.cap = txt(n); continue; }
      if (isSrcLine(cl) && !out.srcName) {
        var a = n.querySelector("a");
        out.srcName = cleanSrc(a ? txt(a) : txt(n));
        out.srcUrl = a ? a.href : "";
        continue;
      }
      if (n.tagName === "H2" || (cl && (cl.contains("imgwrap") || cl.contains("shot")))) break;
    }
    return out;
  }

  function collectBody() {
    var scope = document.querySelector(".post") || document.body;
    var imgs = Array.prototype.slice.call(scope.querySelectorAll("img"));
    var seen = {}, out = [];
    imgs.forEach(function (img) {
      if (img.closest("#copy") || img.closest("#npDrawer") || img.closest("#bdBox")) return;
      var url = img.currentSrc || img.src;
      if (!url || /^data:/.test(url)) return;
      var w = parseInt(img.getAttribute("width") || img.naturalWidth || 0, 10);
      var h = parseInt(img.getAttribute("height") || img.naturalHeight || 0, 10);
      if (w && h && w < 40 && h < 40) return;          /* 아이콘급 제외 */
      if (seen[url]) return; seen[url] = 1;
      var block = img.closest(".imgwrap, .shot") || img.parentElement;
      var cm = commentMeta(block), am = afterMeta(block);
      out.push({
        url: url,
        alt: img.getAttribute("alt") || "",
        cap: am.cap,
        srcName: am.srcName || "",
        srcUrl: am.srcUrl || cm.srcUrl || "",
        why: cm.why || "",
        kind: cm.kind || "",
        extra: false
      });
    });
    return out;
  }

  /* ---------- 2. 추가 후보(본문 미채택) ---------- */
  function collectKit() {
    var el = document.getElementById("np-imgkit");
    if (!el) return [];
    var arr; try { arr = JSON.parse(el.textContent || "[]"); } catch (e) { return []; }
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (o) { return o && o.url; }).map(function (o) {
      var a = document.createElement("a"); a.href = o.url;   /* 상대경로 → 절대 */
      return {
        url: a.href, alt: o.alt || o.title || "", cap: o.cap || "",
        srcName: o.srcName || o.source || "", srcUrl: o.srcUrl || o.href || "",
        why: o.why || "", kind: o.kind || "", extra: true
      };
    });
  }

  /* ---------- 3. "받을 곳" 링크 (A형 슬롯 / B형 촬영 참고) ---------- */
  function collectLinks() {
    var out = [], seen = {};
    var scope = document.querySelector(".post") || document.body;
    Array.prototype.slice.call(scope.querySelectorAll(".imgsrc, .shoot")).forEach(function (b) {
      if (b.closest("#copy")) return;
      var a = b.querySelector("a"); if (!a || seen[a.href]) return;
      seen[a.href] = 1;
      out.push({ href: a.href, name: txt(a) });
    });
    return out;
  }

  var ITEMS = collectBody().concat(collectKit());
  var LINKS = collectLinks();
  if (!ITEMS.length && !LINKS.length) return;

  /* 파일명: 01_출처슬러그_원본이름.확장자 */
  ITEMS.forEach(function (it, i) {
    var base = "";
    try { base = decodeURIComponent(it.url.split("?")[0].split("/").pop() || ""); }
    catch (e) { base = it.url.split("?")[0].split("/").pop() || ""; }
    if (!base) base = "image.jpg";
    it.file = safeName(pad2(i + 1) + "_" + slug(it.srcName || it.kind) + "_" + base);
    it.label = (it.alt || it.cap || it.why || "이미지 " + (i + 1)).replace(/\s+/g, " ").trim();
  });

  /* ---------- 4. 스타일 ---------- */
  var CSS = [
    '#bdBox,#bdTab{font-family:"Apple SD Gothic Neo","맑은 고딕","Malgun Gothic",sans-serif;box-sizing:border-box;}',
    '#bdBox *,#bdTab *{box-sizing:border-box;}',
    '#bdBox{position:fixed;left:24px;top:24px;bottom:24px;z-index:99000;',
    'width:min(300px,calc((100vw - 760px)/2));display:flex;flex-direction:column;',
    'background:#fff;border:1px solid #f0cddc;border-radius:12px;box-shadow:0 4px 16px rgba(214,62,122,.10);overflow:hidden;}',
    '#bdBox.hide{display:none;}',
    '.bd-h{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:12px 12px 10px;border-bottom:1px solid #f6e2ea;background:#FFF6FA;}',
    '.bd-h .t{font-size:13.5px;font-weight:800;color:#D63E7A;letter-spacing:-.2px;}',
    '.bd-h .n{background:#D63E7A;color:#fff;border-radius:20px;font-size:11.5px;font-weight:800;padding:1px 8px;}',
    '.bd-h .x{margin-left:auto;background:#fff;border:1px solid #f0cddc;border-radius:7px;width:28px;height:28px;',
    'font-size:15px;line-height:1;color:#D63E7A;cursor:pointer;font-weight:800;}',
    '.bd-act{flex:0 0 auto;display:flex;gap:6px;padding:9px 12px;border-bottom:1px solid #f6e2ea;}',
    '.bd-act button{flex:1;background:#D63E7A;color:#fff;border:0;border-radius:7px;padding:8px 6px;',
    'font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;}',
    '.bd-act button.sub{background:#fff;color:#a63a63;border:1px solid #f0cddc;}',
    '.bd-act button:disabled{opacity:.55;cursor:default;}',
    '.bd-list{flex:1 1 auto;overflow-y:auto;padding:10px 10px 14px;}',
    '.bd-it{display:flex;gap:9px;padding:9px;border:1px solid #f2e6eb;border-radius:10px;margin-bottom:8px;background:#fff;}',
    '.bd-it.new{border-color:#f5c9dc;background:#FFF9FC;}',
    '.bd-it .th{flex:0 0 auto;width:64px;height:64px;border-radius:8px;border:1px solid #eee;',
    'background:#fafafa center/cover no-repeat;cursor:pointer;}',
    '.bd-it .bd{flex:1 1 auto;min-width:0;}',
    '.bd-it .lb{font-size:12.5px;line-height:1.45;color:#333;font-weight:700;',
    'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all;}',
    '.bd-it .sc{font-size:12px;line-height:1.4;margin-top:3px;color:#8a8a95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bd-it .sc a{color:#1a73e8;text-decoration:none;}',
    '.bd-it .sc .no{color:#c0392b;}',
    '.bd-it .bt{display:flex;gap:5px;margin-top:6px;}',
    '.bd-it .bt button{background:#fff;border:1px solid #e3d2da;border-radius:6px;padding:4px 8px;',
    'font-size:12.5px;font-weight:700;color:#a63a63;cursor:pointer;font-family:inherit;line-height:1.3;}',
    '.bd-it .bt button.go{background:#D63E7A;border-color:#D63E7A;color:#fff;}',
    '.bd-it .bt button.done{background:#eafaf0;border-color:#b7e6c9;color:#1d6b3e;}',
    '.bd-tagx{display:inline-block;background:#fff0d6;border:1px solid #f0d264;color:#8a6d1f;',
    'border-radius:5px;font-size:11px;font-weight:800;padding:0 5px;margin-left:4px;vertical-align:1px;}',
    '.bd-lk{flex:0 0 auto;border-top:1px solid #f6e2ea;padding:9px 12px 12px;max-height:34%;overflow-y:auto;}',
    '#bdBox.nolist .bd-lk{flex:1 1 auto;max-height:none;border-top:0;}',
    '.bd-lk>b{display:block;font-size:12.5px;color:#8a6d1f;cursor:pointer;user-select:none;}',
    '.bd-lk ul{margin:7px 0 0;padding-left:16px;display:none;}',
    '.bd-lk.on ul{display:block;}',
    '.bd-lk li{font-size:12px;line-height:1.6;color:#777;margin:3px 0;word-break:break-all;}',
    '.bd-lk li a{color:#1a73e8;text-decoration:none;font-weight:700;}',
    '#bdTab{position:fixed;left:0;top:96px;z-index:99000;background:#D63E7A;color:#fff;border:0;',
    'border-radius:0 9px 9px 0;padding:12px 9px;font-size:12.5px;font-weight:800;cursor:pointer;',
    'writing-mode:vertical-rl;letter-spacing:2px;box-shadow:2px 3px 10px rgba(214,62,122,.32);display:none;',
    'font-family:"Apple SD Gothic Neo","맑은 고딕",sans-serif;}',
    '#bdTab.on{display:block;}',
    '@media (max-width:1279px){#bdBox{left:0;top:0;bottom:0;width:min(320px,92vw);border-radius:0;',
    'box-shadow:4px 0 22px rgba(0,0,0,.18);}}',
    /* ── 뷰어(라이트박스) — 새 탭 대신 같은 화면에서 크게 보고 ← → 로 넘긴다 ── */
    'body.bd-lb-lock{overflow:hidden;}',
    '#bdLb{position:fixed;left:0;top:0;right:0;bottom:0;z-index:100010;display:none;',
    'align-items:center;justify-content:center;padding:52px 68px 66px;background:rgba(24,12,18,.88);',
    '-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);}',
    '#bdLb.on{display:flex;}',
    '#bdLb.ld::after{content:"불러오는 중…";position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);',
    'text-align:center;color:#ffd0e2;font-size:13px;font-weight:800;pointer-events:none;}',
    /* 컨트롤은 항상 사진 위 — 좁은 화면에서 사진이 화살표를 덮으면 ‹ 만 사라진다(DOM 순서) */
    '.bd-lb-top{position:absolute;left:0;right:0;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:12px 14px;color:#fff;}',
    '.bd-lb-top .ct{flex:0 0 auto;background:#D63E7A;border-radius:20px;font-size:12px;font-weight:800;padding:3px 10px;}',
    '.bd-lb-top .lb{flex:1 1 auto;min-width:0;font-size:13px;font-weight:700;line-height:1.4;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,.6);}',
    '.bd-lb-top .cl{flex:0 0 auto;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);color:#fff;',
    'border-radius:8px;width:32px;height:32px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;}',
    '.bd-lb-fig{position:relative;margin:0;line-height:0;max-width:100%;max-height:100%;}',
    '.bd-lb-fig img{display:block;max-width:min(1240px,calc(100vw - 150px));max-height:calc(100vh - 128px);',
    'width:auto;height:auto;border-radius:10px;background:#fff;box-shadow:0 12px 44px rgba(0,0,0,.55);}',
    '#bdLb.ld .bd-lb-fig img{opacity:.32;}',
    /* 저장 버튼 = 「보고 있는 그 사진」의 우측 하단(화면 구석이 아니라 이미지 위) — 짧은 사진에선 › 와 겹치므로 화살표보다 위에 둔다.
       ★.bd-lb-fig 에는 z-index 를 주지 말 것 — 주면 스택 컨텍스트가 생겨 이 버튼이 그 안에 갇힌다 */
    '.bd-lb-act{position:absolute;right:12px;bottom:12px;z-index:3;display:flex;gap:6px;line-height:1;}',
    /* 작은 사진은 버튼이 사진을 덮으므로 같은 «우측 하단»을 유지한 채 이미지 바로 밑으로 내린다 */
    '.bd-lb-act.out{right:0;bottom:-44px;}',
    '.bd-lb-act button{background:#D63E7A;color:#fff;border:0;border-radius:8px;padding:9px 15px;font-size:13px;',
    'font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 2px 10px rgba(0,0,0,.45);}',
    '.bd-lb-act button.done{background:#eafaf0;color:#1d6b3e;}',
    '.bd-lb-act button:disabled{opacity:.7;cursor:default;}',
    '#bdLb .nv{position:absolute;top:50%;z-index:2;transform:translateY(-50%);width:44px;height:64px;border-radius:10px;',
    /* 좁은 화면에선 화살표가 «사진 위»에 놓인다 — 밝은 스샷에서도 보이게 어두운 판을 깐다 */
    'background:rgba(26,14,20,.55);border:1px solid rgba(255,255,255,.34);color:#fff;font-size:26px;',
    'font-weight:800;line-height:1;cursor:pointer;font-family:inherit;text-shadow:0 1px 3px rgba(0,0,0,.6);}',
    '#bdLb .nv.pv{left:12px;}#bdLb .nv.nx{right:12px;}',
    '#bdLb .nv:hover,.bd-lb-top .cl:hover{background:rgba(214,62,122,.85);border-color:rgba(255,255,255,.5);}',
    '.bd-lb-foot{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:9px 16px 12px;text-align:center;',
    'color:#e9dde3;font-size:12.5px;line-height:1.5;}',
    '.bd-lb-foot .sr{margin-left:8px;color:#ffc2d8;}',
    '.bd-lb-foot a{color:#8ec5ff;text-decoration:none;font-weight:700;}',
    '.bd-lb-foot .hint{display:block;margin-top:2px;color:#a9989f;font-size:11.5px;}',
    '@media (max-width:900px){#bdLb{padding:48px 8px 60px;}#bdLb .nv{width:38px;height:54px;font-size:22px;}',
    '#bdLb .nv.pv{left:4px;}#bdLb .nv.nx{right:4px;}',
    '.bd-lb-fig img{max-width:calc(100vw - 20px);max-height:calc(100vh - 118px);}}',
    '@media print{#bdBox,#bdTab,#bdLb{display:none !important;}}'
  ].join("");
  var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

  /* ---------- 5. 마크업 ---------- */
  var box = document.createElement("aside");
  box.id = "bdBox";
  if (!ITEMS.length) box.className = "nolist";
  box.innerHTML =
    '<div class="bd-h"><span class="t">' + (ITEMS.length ? "🖼️ 조사 이미지" : "📎 이미지 받을 곳") + "</span>" +
    '<span class="n">' + (ITEMS.length || LINKS.length) + "</span>" +
    '<button class="x" type="button" title="접기">−</button></div>' +
    (ITEMS.length ?
      '<div class="bd-act"><button type="button" data-all>전부 받기</button>' +
      '<button type="button" class="sub" data-txt>출처 .txt</button></div>' : "") +
    (ITEMS.length ? '<div class="bd-list">' + ITEMS.map(function (it, i) {
      return '<div class="bd-it' + (it.extra ? " new" : "") + '" data-i="' + i + '">' +
        '<div class="th" data-open title="크게 보기 (← → 로 넘기기)"></div>' +
        '<div class="bd"><div class="lb">' + esc(it.label) +
        (it.extra ? '<span class="bd-tagx">후보</span>' : "") + '</div>' +
        '<div class="sc">' + (it.srcUrl
          ? '출처: <a href="' + esc(it.srcUrl) + '" target="_blank" rel="noopener">' + esc(it.srcName || "원문 보기") + "</a>"
          : (it.srcName ? "출처: " + esc(it.srcName) : '<span class="no">출처 미표기</span>')) + "</div>" +
        '<div class="bt"><button type="button" class="go" data-dl>받기</button>' +
        '<button type="button" data-cp title="네이버 본문에 Ctrl+V">복사</button></div>' +
        "</div></div>";
    }).join("") + "</div>" : "") +
    (LINKS.length ?
      '<div class="bd-lk' + (ITEMS.length ? "" : " on") + '"><b>📎 직접 받을 곳 ' + LINKS.length + "곳 ▾</b><ul>" +
      LINKS.map(function (l) {
        return '<li><a href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.name || l.href) + "</a></li>";
      }).join("") + "</ul></div>" : "");

  /* 썸네일은 인라인 style 대신 JS로 — URL 안의 따옴표가 속성을 깨뜨리지 않게 */
  Array.prototype.slice.call(box.querySelectorAll(".bd-it .th")).forEach(function (el) {
    var it = ITEMS[+el.parentNode.dataset.i];
    if (it) el.style.backgroundImage = 'url("' + it.url.replace(/["\\]/g, "\\$&") + '")';
  });

  var tab = document.createElement("button");
  tab.id = "bdTab"; tab.type = "button";
  tab.textContent = ITEMS.length ? "🖼️ 이미지 " + ITEMS.length : "📎 받을 곳 " + LINKS.length;

  document.body.appendChild(box);
  document.body.appendChild(tab);

  /* ---------- 6. 열고 닫기 ---------- */
  var narrow = window.matchMedia("(max-width:1279px)");
  function setOpen(on) {
    box.classList.toggle("hide", !on);
    tab.classList.toggle("on", !on);
    try { localStorage.setItem(LS, on ? "1" : "0"); } catch (e) { }
  }
  /* 좁은 화면에선 패널이 본문을 덮으므로 저장값과 무관하게 접고 시작한다 */
  var saved = null; try { saved = localStorage.getItem(LS); } catch (e) { }
  setOpen(narrow.matches ? false : saved !== "0");
  box.querySelector(".bd-h .x").addEventListener("click", function () { setOpen(false); });
  tab.addEventListener("click", function () { setOpen(true); });

  /* ---------- 7. 다운로드 · 복사 ---------- */
  function flash(btn, word) {
    var o = btn.dataset.o || btn.textContent, c = btn.className;
    btn.dataset.o = o;
    btn.textContent = word; btn.className = c + " done";
    setTimeout(function () { btn.textContent = o; btn.className = c; }, 1600);
  }
  function saveBlob(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1200);
  }
  /* btn 의 원래 라벨을 기억해 되돌린다 — 카드는 "받기", 뷰어는 "💾 저장"이라 하드코딩하면 안 된다 */
  function download(it, btn) {
    var lbl = "";
    if (btn) {
      lbl = btn.dataset.o || btn.textContent;
      btn.dataset.o = lbl; btn.disabled = true; btn.textContent = "…";
    }
    return fetch(it.url, { mode: "cors", credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (b) {
        saveBlob(b, it.file);
        if (btn) { btn.disabled = false; btn.textContent = lbl; flash(btn, "저장됨"); }
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = lbl; }
        window.open(it.url, "_blank", "noopener");   /* CORS 막히면 새 탭 → 우클릭 저장(실패 폴백뿐) */
      });
  }
  function toPng(blob) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas");
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext("2d").drawImage(im, 0, 0);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("toBlob")); }, "image/png");
      };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("img")); };
      im.src = u;
    });
  }
  function copyImg(it, btn) {
    if (!navigator.clipboard || !window.ClipboardItem) {
      alert("이 브라우저는 이미지 복사를 지원하지 않아요. '받기'로 저장해 주세요."); return;
    }
    btn.disabled = true; btn.textContent = "…";
    fetch(it.url, { mode: "cors", credentials: "omit" })
      .then(function (r) { return r.blob(); })
      .then(function (b) { return b.type === "image/png" ? b : toPng(b); })
      .then(function (png) { return navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); })
      .then(function () { btn.disabled = false; btn.textContent = "복사"; flash(btn, "복사됨"); })
      .catch(function () {
        btn.disabled = false; btn.textContent = "복사";
        alert("복사가 막혔어요. '받기'로 저장한 뒤 올려주세요.");
      });
  }
  function sourceTxt() {
    var L = [];
    L.push("봄딩 이미지 출처 목록");
    L.push("글: " + PAGE_TITLE);
    L.push("미리보기: " + location.href);
    L.push("받은 날짜: " + todayStr());
    L.push("");
    ITEMS.forEach(function (it, i) {
      L.push("[" + pad2(i + 1) + "] " + it.file + (it.extra ? "  (본문 미채택 후보)" : ""));
      if (it.alt) L.push("     내용 : " + it.alt);
      if (it.cap) L.push("     캡션 : " + it.cap);
      L.push("     출처 : " + (it.srcName || "(표기 없음)"));
      L.push("     URL  : " + (it.srcUrl || "(표기 없음)"));
      if (it.why) L.push("     이유 : " + it.why);
      L.push("     원본 : " + it.url);
      L.push("");
    });
    if (LINKS.length) {
      L.push("── 직접 받을 곳 ──");
      LINKS.forEach(function (l) { L.push("  · " + (l.name || "") + " " + l.href); });
      L.push("");
    }
    L.push("※ 출처 표시는 이용 허락이 아닙니다. 공식·스토어·프레스킷(Tier1) 자료를 우선 쓰고,");
    L.push("   기사 이미지(Tier2)는 인용 범위에서 최소한으로, 개인 블로그 이미지(Tier3)는 쓰지 않습니다.");
    return L.join("\r\n");
  }

  /* ---------- 8. 뷰어(라이트박스) — 탭 1개로 크게 보기 · ← → 이동 · 우측하단 저장 ---------- */
  var lb = null, lbFig = null, lbImg = null, lbCt = null, lbLbl = null,
    lbCap = null, lbSrc = null, lbAct = null, lbSave = null, LB = -1, LBTOK = 0;

  function srcHTML(it) {
    if (it.srcUrl) {
      return '출처: <a href="' + esc(it.srcUrl) + '" target="_blank" rel="noopener">' +
        esc(it.srcName || "원문 보기") + "</a>";
    }
    return it.srcName ? "출처: " + esc(it.srcName) : "출처 미표기";
  }

  function buildLb() {
    lb = document.createElement("div");
    lb.id = "bdLb"; lb.tabIndex = -1;
    lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true");
    lb.innerHTML =
      '<div class="bd-lb-top"><span class="ct"></span><span class="lb"></span>' +
      '<button class="cl" type="button" title="닫기 (Esc)">✕</button></div>' +
      '<button class="nv pv" type="button" title="이전 사진 (←)">‹</button>' +
      '<figure class="bd-lb-fig"><img alt="">' +
      '<div class="bd-lb-act"><button class="dl" type="button" title="이 사진 저장">💾 저장</button></div>' +
      "</figure>" +
      '<button class="nv nx" type="button" title="다음 사진 (→)">›</button>' +
      '<div class="bd-lb-foot"><span class="cap"></span><span class="sr"></span>' +
      '<span class="hint">← → 넘기기 · Esc 닫기 · 마음에 드는 사진은 우측 하단 「저장」</span></div>';
    document.body.appendChild(lb);
    lbFig = lb.querySelector(".bd-lb-fig");
    lbImg = lb.querySelector(".bd-lb-fig img");
    lbCt = lb.querySelector(".bd-lb-top .ct");
    lbLbl = lb.querySelector(".bd-lb-top .lb");
    lbCap = lb.querySelector(".bd-lb-foot .cap");
    lbSrc = lb.querySelector(".bd-lb-foot .sr");
    lbAct = lb.querySelector(".bd-lb-act");
    lbSave = lb.querySelector(".bd-lb-act .dl");
    window.addEventListener("resize", function () {
      if (lb && lb.classList.contains("on")) fitAct();
    });

    lb.addEventListener("click", function (e) {
      if (e.target === lb) { closeLb(); return; }          /* 배경 클릭 = 닫기 */
      if (e.target.closest(".cl")) { closeLb(); return; }
      if (e.target.closest(".nv.pv")) { stepLb(-1); return; }
      if (e.target.closest(".nv.nx")) { stepLb(1); return; }
      if (e.target.closest(".dl")) { download(ITEMS[LB], lbSave); return; }
    });
    document.addEventListener("keydown", onLbKey);
  }

  function showLb() {
    var it = ITEMS[LB]; if (!it) return;
    lbCt.textContent = (LB + 1) + " / " + ITEMS.length;
    lbLbl.textContent = it.label + (it.extra ? "  (본문 미채택 후보)" : "");
    lbCap.textContent = it.cap || it.why || "";
    lbSrc.innerHTML = srcHTML(it);
    lbSave.disabled = false;
    lbSave.textContent = lbSave.dataset.o || "💾 저장";
    lbSave.className = "dl";
    /* 미리 받아 두고 갈아끼운다 — 넘기는 동안 화면이 비지 않게 */
    var tok = ++LBTOK, pre = new Image();
    lb.classList.add("ld");
    pre.onload = pre.onerror = function () {
      if (tok !== LBTOK) return;                            /* 더 최근 요청이 있으면 버린다 */
      lbImg.src = it.url; lbImg.alt = it.alt || it.label || "";
      lb.classList.remove("ld");
      fitAct();
      [LB - 1, LB + 1].forEach(function (j) {               /* 양옆 1장씩 선반입 */
        var n = ITEMS[(j + ITEMS.length) % ITEMS.length];
        if (n && n.url !== it.url) { var p = new Image(); p.src = n.url; }
      });
    };
    pre.src = it.url;
  }

  /* 저장 버튼은 늘 «그 사진의 우측 하단» — 다만 사진이 작으면 사진을 덮으므로 바로 밑으로 내린다 */
  function fitAct() {
    if (!lbImg || !lbAct) return;
    var r = lbImg.getBoundingClientRect();
    lbAct.classList.toggle("out", !(r.width >= 240 && r.height >= 140));
  }

  function stepLb(d) {
    if (!ITEMS.length) return;
    LB = (LB + d + ITEMS.length) % ITEMS.length;            /* 끝에서 순환 */
    showLb();
  }
  function openLb(i) {
    if (!ITEMS.length) return;
    if (!lb) buildLb();
    LB = (i + ITEMS.length) % ITEMS.length;
    lb.classList.add("on");
    document.body.classList.add("bd-lb-lock");
    showLb();
    try { lb.focus(); } catch (e) { }
  }
  function closeLb() {
    if (!lb) return;
    lb.classList.remove("on");
    document.body.classList.remove("bd-lb-lock");
    LBTOK++;                                                /* 진행 중이던 로딩 무효화 */
  }
  function onLbKey(e) {
    if (!lb || !lb.classList.contains("on")) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;          /* Alt+← = 브라우저 뒤로가기 */
    var t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    var k = e.key;
    if (k === "Escape") { closeLb(); }
    else if (k === "ArrowLeft") { stepLb(-1); }
    else if (k === "ArrowRight") { stepLb(1); }
    else if (k === "Home") { LB = 0; showLb(); }
    else if (k === "End") { LB = ITEMS.length - 1; showLb(); }
    else return;
    e.preventDefault();
  }

  box.addEventListener("click", function (e) {
    var lk = e.target.closest(".bd-lk > b");
    if (lk) { lk.parentNode.classList.toggle("on"); return; }
    var row = e.target.closest(".bd-it");
    if (row) {
      var it = ITEMS[+row.dataset.i];
      if (e.target.hasAttribute("data-dl")) { download(it, e.target); return; }
      if (e.target.hasAttribute("data-cp")) { copyImg(it, e.target); return; }
      if (e.target.hasAttribute("data-open")) { openLb(+row.dataset.i); return; }
      return;
    }
    if (e.target.hasAttribute("data-txt")) {
      saveBlob(new Blob(["﻿" + sourceTxt()], { type: "text/plain;charset=utf-8" }),
        safeName((PAGE_TITLE.slice(0, 24) || "봄딩") + "_이미지출처.txt"));
      flash(e.target, "저장됨"); return;
    }
    if (e.target.hasAttribute("data-all")) {
      var btn = e.target; btn.disabled = true;
      var i = 0;
      (function next() {
        if (i >= ITEMS.length) { btn.disabled = false; btn.textContent = "전부 받기"; flash(btn, "완료"); return; }
        var one = ITEMS[i++];
        btn.textContent = "받는 중 " + i + "/" + ITEMS.length;
        download(one, null).then(function () { setTimeout(next, 420); });
      })();
    }
  });
})();
