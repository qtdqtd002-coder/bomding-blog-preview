/*! 봄딩 이미지함 (imagebox) — 미리보기 좌측 여백에 조사 이미지 모음 + 원클릭 다운로드
 *  ★봄딩 전용(학습격리). 영도·겜더쿠·연봄·하루살이로 전파 금지.
 *  정본: ~/.claude/skills/bomding-blog-writer/references/output-format.md §6
 *  임베드: 미리보기 HTML </body> 앞에 아래 한 줄
 *    <script src="https://qtdqtd002-coder.github.io/bomding-blog-preview/_design/bomding-imagebox.js" defer></script>
 *  수집원: ① 본문 <img> + 주변 메타(.cap/.src/이유 주석)  ② <script type="application/json" id="np-imgkit"> 추가 후보
 *  이미지·링크가 0이면 아무것도 그리지 않는다.
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
    '@media print{#bdBox,#bdTab{display:none !important;}}'
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
        '<div class="th" data-open title="새 탭에서 원본 열기"></div>' +
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
  function download(it, btn) {
    if (btn) { btn.disabled = true; btn.textContent = "…"; }
    return fetch(it.url, { mode: "cors", credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (b) {
        saveBlob(b, it.file);
        if (btn) { btn.disabled = false; btn.textContent = "받기"; flash(btn, "저장됨"); }
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = "받기"; }
        window.open(it.url, "_blank", "noopener");   /* CORS 막히면 새 탭 → 우클릭 저장 */
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

  box.addEventListener("click", function (e) {
    var lk = e.target.closest(".bd-lk > b");
    if (lk) { lk.parentNode.classList.toggle("on"); return; }
    var row = e.target.closest(".bd-it");
    if (row) {
      var it = ITEMS[+row.dataset.i];
      if (e.target.hasAttribute("data-dl")) { download(it, e.target); return; }
      if (e.target.hasAttribute("data-cp")) { copyImg(it, e.target); return; }
      if (e.target.hasAttribute("data-open")) { window.open(it.url, "_blank", "noopener"); return; }
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
