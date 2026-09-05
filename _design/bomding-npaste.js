/*! 봄딩 네이버 붙여넣기 위젯 v2 (bomding-npaste.js) — 2026-09-05
 *  미리보기 본문에서 네이버 스마트에디터용 «생존본»을 자동으로 만들고,
 *  제목·본문·태그 원클릭 복사 + 사진 포함 복사(실험) + 사진마다 [복사]/[받기] 버튼을 한 서랍에 모은다.
 *  ★봄딩 전용(학습격리). 영도 위젯은 각자 정본(yeongdo output-format §4) — 여기서 건드리지 않는다.
 *  정본: ~/.claude/skills/bomding-blog-writer/references/output-format.md §4 (v2 절)
 *  임베드: 미리보기 HTML </body> 앞 한 줄
 *    <script src="https://qtdqtd002-coder.github.io/bomding-blog-preview/_design/bomding-npaste.js" defer></script>
 *  동작: 글에 이미 위젯(#npDrawer)이 있으면 서랍 안을 v2로 바꾸고(작성자 생존본 #copy는 «구 방식»으로 접어 보존),
 *        없으면(07-03 이전 글) 버튼·서랍을 새로 만든다. 네이버로 요청을 보내는 일은 없다 — 클립보드 복사만 한다.
 */
(function () {
  "use strict";
  if (window.__bdNpaste) return; window.__bdNpaste = 1;

  var LS_IMG = "bd-np-img", LS_HEAD = "bd-np-head";
  var CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

  /* ---------- 유틸 ---------- */
  function txt(n) { return n ? (n.textContent || "").replace(/\s+/g, " ").trim() : ""; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u || ""; } }
  function circ(n) { return n >= 1 && n <= 20 ? CIRC.charAt(n - 1) : String(n); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function hasCls(n, c) { return !!(n.classList && n.classList.contains(c)); }
  function matches(n, sel) { try { return n.nodeType === 1 && n.matches(sel); } catch (e) { return false; } }
  function pad2(n) { return ("0" + n).slice(-2); }
  function safeName(s) { return String(s || "").replace(/[\\\/:*?"<>|]/g, "").replace(/\s+/g, "_"); }
  function slug(s) { var v = String(s || "").replace(/[^가-힣A-Za-z0-9]/g, ""); return v ? v.slice(0, 14) : "봄딩"; }
  function nextSib(n, sel) {
    var s = n, hop = 0;
    while (s && hop < 4) { s = s.nextElementSibling; hop++; if (!s) break; if (matches(s, sel)) return s; if (matches(s, "h1,h2,h3,h4,table,ul,ol,.imgwrap,.ss,.imgslot")) break; }
    return null;
  }

  /* ---------- 0. 원문 ---------- */
  var POST = document.querySelector(".post") || document.querySelector(".wrap") || document.body;
  var TITLE = txt(document.querySelector("h1.title")) || (document.title || "").trim();
  var TAGS = (function () {
    var t = document.querySelector(".tags, .tags-line"); var s = txt(t);
    var m = s.match(/#[^\s#,]+/g); return m ? m.join(" ") : s.replace(/^태그\s*[:：]\s*/, "");
  })();

  /* 미리보기 전용(네이버에 안 들어가는) 요소 — 통째로 건너뛴다 */
  var SKIP = ".topbar,.cat,h1.title,.meta,.tags,.pvbar,.sidenote,.chk,.src,.src2,.src-line,.cap,.shoot,.imgsrc,.frame," +
    "script,style,noscript,template,iframe,video,audio,svg,canvas,button,input,select,textarea," +
    "#npBtn,#npBack,#npDrawer,#bdBox,#bdTab,#np-imgkit,.np-old,.np2-wrap";
  var INLINE_KEEP = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", BR: "br", A: "a", S: "s", DEL: "s" };
  var BLOCK_RE = /^(P|DIV|UL|OL|LI|TABLE|H[1-6]|BLOCKQUOTE|SECTION|ARTICLE|ASIDE|FIGURE|FIGCAPTION|HR|DETAILS|SUMMARY|DL|DT|DD|PRE|HEADER|FOOTER|NAV|MAIN|CENTER|FIELDSET)$/;

  /* 인라인 정제: 텍스트 + b/i/u/s/br/a(절대 href)만 남기고 나머지는 벗긴다 */
  function cleanNode(c, into) {
    if (c.nodeType === 3) { into.appendChild(document.createTextNode(c.nodeValue)); return; }
    if (c.nodeType !== 1) return;
    if (matches(c, SKIP)) return;
    var tag = c.tagName;
    if (tag === "IMG") return;
    var keep = INLINE_KEEP[tag];
    if (keep === "br") { into.appendChild(document.createElement("br")); return; }
    if (keep === "a") {
      var href = c.getAttribute("href") || "";
      var u = href ? abs(href) : "";
      /* 미리보기 사이트 내부 링크(같이 보기 등)·앵커·비http 는 링크를 벗기고 글자만 — 네이버에 미리보기 주소가 새지 않게 */
      if (!href || href.charAt(0) === "#" || !/^https?:/i.test(u) || u.indexOf(location.origin + "/") === 0 || /qtdqtd002-coder\.github\.io/i.test(u)) { cleanInline(c, into); return; }
      var a = document.createElement("a"); a.href = u; cleanInline(c, a);
      if (txt(a)) into.appendChild(a); return;
    }
    if (keep) { var k = document.createElement(keep); cleanInline(c, k); into.appendChild(k); return; }
    cleanInline(c, into);   /* span·small·code·sup 등 */
  }
  function cleanInline(node, into) { for (var c = node.firstChild; c; c = c.nextSibling) cleanNode(c, into); }
  function isEmptyBlock(p) { return !txt(p) && !p.querySelector("img"); }

  /* ---------- 1. 본문 → 생존본 빌더 ---------- */
  function Builder() {
    this.out = el("div"); this.cur = null;
    this.photo = 0; this.imgs = 0; this.spots = 0; this.coupang = 0; this.tables = 0; this.btns = 0; this.heads = 0;
    this.items = [];
  }
  Builder.prototype.flush = function () { if (this.cur) { if (!isEmptyBlock(this.cur)) this.out.appendChild(this.cur); this.cur = null; } };
  Builder.prototype.para = function () { if (!this.cur) this.cur = document.createElement("p"); return this.cur; };
  Builder.prototype.block = function (node) { this.flush(); this.out.appendChild(node); };
  Builder.prototype.boldLine = function (node) {
    var p = document.createElement("p"), b = document.createElement("b"); cleanInline(node, b);
    if (txt(b)) { p.appendChild(b); this.block(p); } else this.flush();
  };
  Builder.prototype.heading = function (node) {
    this.flush();
    var src = node;
    var price = node.querySelector && node.querySelector(".price");
    if (price) { src = node.cloneNode(true); var pr = src.querySelector(".price"); pr.parentNode.replaceChild(document.createTextNode(" (" + txt(pr) + ")"), pr); }
    var h = document.createElement("h3"); cleanInline(src, h);
    if (txt(h)) { this.out.appendChild(h); this.heads++; }
  };
  Builder.prototype.metaLinks = function (host, label) {
    var links = host ? [].slice.call(host.querySelectorAll("a[href]")) : [];
    links = links.filter(function (a) { return /^https?:/i.test(abs(a.getAttribute("href") || "")); });
    if (!links.length) return null;
    return el("div", "np2-meta", label + " " + links.map(function (a) {
      return '<a href="' + esc(abs(a.getAttribute("href"))) + '" target="_blank" rel="noopener">' + esc(txt(a) || "링크") + "</a>";
    }).join(" · "));
  };
  Builder.prototype.spot = function (label, meta, kind) {
    this.flush(); var n = ++this.photo; this.spots++;
    var tail = kind === "shoot" ? " — 직접 촬영해서 이 자리에 Ctrl+V" : " — 저장해서 이 자리에 Ctrl+V";
    var wrap = el("div", "np2-spot");
    wrap.appendChild(el("p", "ph", "📷 〔사진 자리 " + n + "〕 " + esc(label) + tail));
    if (meta) wrap.appendChild(meta);
    this.out.appendChild(wrap);
  };
  Builder.prototype.shot = function (ss) {
    var lbl = txt(ss.querySelector(".lbl")) || txt(ss);
    lbl = lbl.replace(/^📷\s*/, "").replace(/^(?:스샷|사진|스크린샷)\s*\d*\s*[:：.]?\s*/, "");
    this.spot(lbl || "스크린샷", this.metaLinks(nextSib(ss, ".shoot"), "비슷한 화면 찾을 곳:"), "shoot");
  };
  Builder.prototype.slot = function (s) {
    var what = s.querySelector(".what");
    var w = what ? what.cloneNode(true) : s.cloneNode(true);
    [].forEach.call(w.querySelectorAll(".num,.frame"), function (x) { x.remove(); });
    var label = txt(w).replace(/^🖼️\s*/, "");
    var meta = this.metaLinks(s.querySelector(".imgsrc") || nextSib(s, ".imgsrc"), "받을 곳:");
    this.spot((hasCls(s, "mini") ? "제품컷 · " : "") + (label || "이미지"), meta, "save");
  };
  Builder.prototype.image = function (img, wrap) {
    this.flush(); var n = ++this.photo; this.imgs++;
    var src = abs(img.getAttribute("src") || "");
    var alt = (img.getAttribute("alt") || "").trim();
    var host = wrap || img;
    var cap = txt(nextSib(host, ".cap"));
    var srcLine = nextSib(host, ".src,.src2,.src-line");
    var srcName = "", srcUrl = "";
    if (srcLine) {
      var a = srcLine.querySelector("a[href]");
      srcName = txt(a) || txt(srcLine).replace(/^\s*(?:이미지\s*출처|이미지|출처)\s*[:：]\s*/, "").replace(/\s*[·|]\s*네이버.*$/, "").trim();
      srcUrl = a ? abs(a.getAttribute("href")) : "";
    }
    var label = alt || cap || ("사진 " + n);
    var base = (src.split("?")[0].split("/").pop() || "image").replace(/%[0-9A-Fa-f]{2}/g, "");
    var it = { n: n, url: src, alt: label, srcName: srcName, srcUrl: srcUrl, file: pad2(n) + "_" + slug(srcName || "봄딩") + "_" + safeName(base) };
    this.items.push(it);
    var fig = el("div", "np2-fig"); fig.setAttribute("data-i", String(this.items.length - 1));
    fig.innerHTML = '<img class="np2-thumb" src="' + esc(src) + '" alt="' + esc(label) + '" loading="lazy">' +
      '<div class="np2-ui"><span class="np2-n">📷 사진 ' + n + "</span>" +
      '<button type="button" data-cp>복사</button><button type="button" data-dl>받기</button>' +
      (srcName ? '<span class="np2-src">출처 ' + (srcUrl ? '<a href="' + esc(srcUrl) + '" target="_blank" rel="noopener">' + esc(srcName) + "</a>" : esc(srcName)) + "</span>" : "") +
      "</div>" +
      '<p class="ph np2-ph">📷 〔사진 자리 ' + n + "〕 " + esc(label) + " — 위 [복사] 누르고 이 자리에 Ctrl+V</p>";
    this.out.appendChild(fig);
  };
  Builder.prototype.table = function (t) {
    this.flush(); this.tables++;
    var nt = document.createElement("table"), groups = [];
    [].forEach.call(t.children, function (g) {
      if (/^(THEAD|TBODY|TFOOT)$/.test(g.tagName)) groups.push(g);
    });
    if (!groups.length) groups = [t];
    groups.forEach(function (g) {
      var ng = g === t ? document.createElement("tbody") : document.createElement(g.tagName.toLowerCase());
      [].forEach.call(g.children, function (tr) {
        if (tr.tagName !== "TR") return;
        var ntr = document.createElement("tr");
        [].forEach.call(tr.children, function (cell) {
          if (cell.tagName !== "TD" && cell.tagName !== "TH") return;
          var nc = document.createElement(cell.tagName.toLowerCase());
          if (cell.colSpan > 1) nc.colSpan = cell.colSpan;
          if (cell.rowSpan > 1) nc.rowSpan = cell.rowSpan;
          cleanInline(cell, nc); ntr.appendChild(nc);
        });
        if (ntr.children.length) ng.appendChild(ntr);
      });
      if (ng.children.length) nt.appendChild(ng);
    });
    if (nt.querySelector("td,th")) this.out.appendChild(nt);
  };
  Builder.prototype.list = function (l) {
    var nl = document.createElement(l.tagName.toLowerCase()), self = this;
    [].forEach.call(l.children, function (li) {
      if (li.tagName !== "LI") return;
      var nli = document.createElement("li");
      for (var c = li.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 1 && (c.tagName === "UL" || c.tagName === "OL")) nli.appendChild(self.list(c));
        else cleanNode(c, nli);
      }
      if (txt(nli)) nl.appendChild(nli);
    });
    return nl;
  };
  Builder.prototype.vrow = function (r) {
    var p = document.createElement("p");
    var c = r.querySelector(".vcase"), k = r.querySelector(".vpick");
    if (c) { var b = document.createElement("b"); b.textContent = txt(c); p.appendChild(b); p.appendChild(document.createTextNode(" — ")); }
    cleanInline(k || r, p);
    if (txt(p)) this.block(p);
  };
  Builder.prototype.walk = function (node) {
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { if (/\S/.test(c.nodeValue)) this.para().appendChild(document.createTextNode(c.nodeValue)); continue; }
      if (c.nodeType !== 1) continue;
      if (matches(c, SKIP)) continue;
      var tag = c.tagName;
      if (tag === "IMG") { this.image(c, null); continue; }
      if (hasCls(c, "imgwrap") || hasCls(c, "shot") || tag === "FIGURE") {
        var im = c.querySelector("img");
        if (im) { this.image(im, c); } else { this.flush(); this.walk(c); this.flush(); }
        continue;
      }
      if (hasCls(c, "ss")) { this.shot(c); continue; }
      if (hasCls(c, "imgslot")) { this.slot(c); continue; }
      if (hasCls(c, "coupang")) {
        this.flush(); var k = ++this.coupang;
        var nm = c.getAttribute("data-coupang") || "";
        if (!nm) { var cc = c.cloneNode(true); [].forEach.call(cc.querySelectorAll("small"), function (x) { x.remove(); }); nm = txt(cc).replace(/^👉\s*/, ""); }
        this.block(el("p", "ph", "👉 〔쿠팡 링크 자리 " + circ(k) + "〕 " + esc(nm) + " — 네이버에서 이 줄에 본인 쿠팡 파트너스 URL 연결"));
        continue;
      }
      if (hasCls(c, "btns")) {
        this.flush(); var self = this;
        [].forEach.call(c.querySelectorAll("a[href]"), function (a) {
          var p = document.createElement("p"); p.appendChild(document.createTextNode("👉 "));
          cleanNode(a, p); if (txt(p).length > 2) { self.out.appendChild(p); self.btns++; }
        });
        continue;
      }
      if (hasCls(c, "notice")) { this.boldLine(c); continue; }
      if (hasCls(c, "gap")) { this.flush(); var pg = document.createElement("p"); pg.className = "ph"; cleanInline(c, pg); if (txt(pg)) this.block(pg); else this.flush(); continue; }
      if (tag === "TABLE") { this.table(c); continue; }
      if (tag === "UL" || tag === "OL") { this.flush(); var nl = this.list(c); if (nl.children.length) this.out.appendChild(nl); continue; }
      if (/^H[1-3]$/.test(tag) || hasCls(c, "sub") || hasCls(c, "sec") || hasCls(c, "pname")) { this.heading(c); continue; }
      if (tag === "H4" || tag === "H5" || tag === "H6" || tag === "SUMMARY" || hasCls(c, "bt") || hasCls(c, "vh") || hasCls(c, "sn-h")) { this.boldLine(c); continue; }
      if (hasCls(c, "vrow")) { this.vrow(c); continue; }
      if (tag === "HR") { this.flush(); continue; }
      if (tag === "BR") { this.para().appendChild(document.createElement("br")); continue; }
      if (tag === "P" || tag === "PRE" || tag === "BLOCKQUOTE" || tag === "LI" || tag === "DT" || tag === "DD" || tag === "FIGCAPTION") {
        if (c.querySelector("img,table,ul,ol,.ss,.imgslot,.coupang,.btns")) { this.flush(); this.walk(c); this.flush(); }
        else { this.flush(); var p = document.createElement("p"); cleanInline(c, p); if (!isEmptyBlock(p)) this.out.appendChild(p); }
        continue;
      }
      if (BLOCK_RE.test(tag)) { this.flush(); this.walk(c); this.flush(); continue; }
      /* 인라인 요소가 블록 자리에 — 안에 블록(이미지·표·목록·문단)이 섞여 있으면 블록으로 걷고, 아니면 현재 문단에 */
      if (c.querySelector && c.querySelector("img,table,ul,ol,p,div,h1,h2,h3,h4")) { this.flush(); this.walk(c); this.flush(); continue; }
      cleanNode(c, this.para());
    }
  };
  Builder.prototype.finish = function () {
    this.flush();
    var out = this.out;
    [].forEach.call(out.querySelectorAll("p"), function (p) {
      /* 앞뒤 <br> 정리 */
      while (p.firstChild && p.firstChild.nodeType === 1 && p.firstChild.tagName === "BR") p.removeChild(p.firstChild);
      while (p.lastChild && p.lastChild.nodeType === 1 && p.lastChild.tagName === "BR") p.removeChild(p.lastChild);
      if (isEmptyBlock(p) && !hasCls(p, "np2-ph")) p.remove();
    });
    return out;
  };

  var B = new Builder();
  try { B.walk(POST); } catch (e) { if (window.console) console.error("[npaste] build", e); }
  var AUTO = B.finish();
  var ITEMS = B.items;
  var STATS = { photos: B.photo, imgs: B.imgs, spots: B.spots, tables: B.tables, coupang: B.coupang, btns: B.btns, heads: B.heads, blocks: AUTO.children.length };

  /* ---------- 2. 복사용 HTML 만들기 ---------- */
  function buildCopyNode(root, imgMode, headMode) {
    var c = root.cloneNode(true);
    [].forEach.call(c.querySelectorAll(".np2-ui,.np2-meta,.np2-thumb"), function (n) { n.remove(); });
    [].forEach.call(c.querySelectorAll(".np2-fig"), function (f) {
      var it = ITEMS[+f.getAttribute("data-i")] || {}; var p = document.createElement("p");
      if (imgMode === "img" && it.url) { var im = document.createElement("img"); im.src = it.url; im.alt = it.alt || ""; p.appendChild(im); }
      else { p.className = "ph"; p.textContent = "📷 〔사진 자리 " + it.n + "〕 " + (it.alt || "") + " — 이 자리에 사진 Ctrl+V"; }
      f.parentNode.replaceChild(p, f);
    });
    [].forEach.call(c.querySelectorAll(".np2-spot"), function (s) { while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s); s.remove(); });
    if (headMode === "quote") {
      [].forEach.call(c.querySelectorAll("h3"), function (h) {
        var q = document.createElement("blockquote"); while (h.firstChild) q.appendChild(h.firstChild); h.parentNode.replaceChild(q, h);
      });
    }
    [].forEach.call(c.querySelectorAll("[class]"), function (n) { if (n.className !== "ph") n.removeAttribute("class"); });
    [].forEach.call(c.querySelectorAll("[data-i],[loading]"), function (n) { n.removeAttribute("data-i"); n.removeAttribute("loading"); });
    return c;
  }
  function richCopy(node) {
    var buf = el("div", "np2-copy np2-buf"); buf.appendChild(node); document.body.appendChild(buf);
    var ok = false;
    try {
      var range = document.createRange(); range.selectNodeContents(buf);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      ok = document.execCommand("copy");
      sel.removeAllRanges();
    } catch (e) { ok = false; }
    var html = buf.innerHTML, plain = buf.innerText || buf.textContent || "";
    buf.remove();
    if (ok) return Promise.resolve(true);
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        return navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" })
        })]).then(function () { return true; }, function () { return false; });
      } catch (e) { }
    }
    return Promise.resolve(false);
  }
  function plainCopy(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(s).then(function () { return true; }, function () { return plainCopyLegacy(s); });
    }
    return Promise.resolve(plainCopyLegacy(s));
  }
  function plainCopyLegacy(s) {
    var ta = document.createElement("textarea"); ta.value = s; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-99999px;top:0;"; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { } ta.remove(); return ok;
  }
  function saveBlob(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1200);
  }
  function toPng(blob) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext("2d").drawImage(im, 0, 0); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("toBlob")); }, "image/png");
      };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("img")); };
      im.src = u;
    });
  }
  function flash(btn, word, keepMs) {
    if (!btn) return;
    if (!btn.getAttribute("data-o")) btn.setAttribute("data-o", btn.textContent);
    btn.textContent = word; btn.classList.add("done"); btn.disabled = false;
    setTimeout(function () { btn.textContent = btn.getAttribute("data-o"); btn.classList.remove("done"); }, keepMs || 1800);
  }
  function copyImg(it, btn) {
    if (!navigator.clipboard || !window.ClipboardItem) { alert("이 브라우저는 이미지 복사를 지원하지 않아요. [받기]로 저장한 뒤 올려주세요."); return; }
    btn.disabled = true; btn.textContent = "…";
    fetch(it.url, { mode: "cors", credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (b) { return b.type === "image/png" ? b : toPng(b); })
      .then(function (png) { return navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); })
      .then(function () { btn.textContent = "복사"; flash(btn, "복사됨 → 네이버에 Ctrl+V", 2600); })
      .catch(function () { btn.disabled = false; btn.textContent = "복사"; alert("복사가 막혔어요(외부 이미지). [받기]로 저장한 뒤 올려주세요."); });
  }
  function download(it, btn) {
    btn.disabled = true; btn.textContent = "…";
    fetch(it.url, { mode: "cors", credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (b) { saveBlob(b, it.file); btn.textContent = "받기"; flash(btn, "저장됨"); })
      .catch(function () { btn.disabled = false; btn.textContent = "받기"; window.open(it.url, "_blank", "noopener"); });
  }

  /* ---------- 3. 서랍 UI ---------- */
  var CSS = "" +
    "#npBtn{position:fixed;top:14px;right:14px;z-index:99998;background:#03c75a;color:#fff;border:0;border-radius:9px;padding:11px 16px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 3px 12px rgba(3,199,90,.4);font-family:'Apple SD Gothic Neo','맑은 고딕','Malgun Gothic',sans-serif;}" +
    "#npBtn:active{transform:translateY(1px);}" +
    "#npBack{position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:99999;display:none;}#npBack.open{display:block;}" +
    "#npDrawer{position:fixed;top:0;right:0;height:100vh;width:min(780px,96vw);background:#eceff3;z-index:100000;display:none;flex-direction:column;box-shadow:-6px 0 24px rgba(0,0,0,.18);font-family:'Apple SD Gothic Neo','맑은 고딕','Malgun Gothic',sans-serif;}" +
    "#npDrawer.open{display:flex;}" +
    ".np2-head{flex:0 0 auto;background:#fff;border-bottom:1px solid #dfe3e8;padding:10px 14px 9px;}" +
    ".np2-title{display:flex;align-items:center;gap:8px;}.np2-t{font-size:15px;font-weight:800;color:#1d6b3e;}" +
    ".np2-x{margin-left:auto;background:#eef0f2;border:0;border-radius:7px;width:32px;height:32px;font-size:16px;cursor:pointer;color:#555;}" +
    ".np2-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:13px;color:#445;}" +
    ".np2-lbl{font-size:12px;color:#889;font-weight:700;}" +
    ".np2-titletxt{flex:1 1 220px;font-weight:700;color:#222;font-size:13.5px;line-height:1.4;}" +
    ".np2-head button{background:#fff;border:1px solid #cfd6dd;border-radius:7px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;color:#234;}" +
    ".np2-head button.np2-main{background:#03c75a;border-color:#03c75a;color:#fff;padding:9px 18px;font-size:14px;}" +
    ".np2-head button.done{background:#1d6b3e;color:#fff;border-color:#1d6b3e;}" +
    ".np2-stat{margin-left:auto;font-size:12px;color:#667;}" +
    ".np2-opts label{display:inline-flex;align-items:center;gap:4px;cursor:pointer;margin-right:4px;}.np2-opts input{margin:0;}" +
    ".np2-sep{width:1px;height:16px;background:#dfe3e8;margin:0 4px;}" +
    ".np2-body{flex:1 1 auto;overflow:auto;padding:14px 14px 40px;}" +
    ".np2-guide{background:#fff8e6;border:1px solid #f0d264;border-radius:8px;padding:10px 14px;font-size:12.5px;line-height:1.75;color:#6b5a2e;margin-bottom:12px;}" +
    ".np2-guide b{color:#8a6d1f;}" +
    ".np2-copy{background:#fff;border:2px dashed #03c75a;border-radius:8px;padding:22px 22px 28px;font-size:15.5px;line-height:1.95;color:#222;font-family:'Apple SD Gothic Neo','맑은 고딕','Malgun Gothic',sans-serif;word-break:keep-all;}" +
    ".np2-copy h3{font-size:17px;font-weight:800;margin:26px 0 10px;color:#111;}" +
    ".np2-copy.np2-quote h3{border-left:4px solid #03c75a;padding-left:10px;color:#1d6b3e;}" +
    ".np2-copy blockquote{margin:24px 0 12px;padding:2px 0 2px 12px;border-left:4px solid #03c75a;font-weight:800;font-size:17px;}" +
    ".np2-copy p{margin:0 0 16px;}.np2-copy ul,.np2-copy ol{margin:0 0 16px;padding-left:22px;}.np2-copy li{margin:5px 0;}.np2-copy b{font-weight:800;}" +
    ".np2-copy a{color:#1a5fb4;}" +
    ".np2-copy table{border-collapse:collapse;width:100%;margin:10px 0 16px;font-size:13.5px;}" +
    ".np2-copy th,.np2-copy td{border:1px solid #cccccc;padding:7px 9px;text-align:center;vertical-align:middle;}.np2-copy th{background:#f2f2f2;font-weight:700;}" +
    ".np2-copy .ph{color:#1a5fb4;font-weight:700;}" +
    ".np2-fig{margin:6px 0 16px;padding:8px;background:#f5f9f6;border:1px solid #cfe8d8;border-radius:8px;}" +
    ".np2-thumb{display:block;max-width:100%;max-height:240px;border-radius:6px;margin:0 auto 6px;background:#fff;}" +
    ".np2-ui{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:#456;line-height:1.5;}" +
    ".np2-ui button{background:#03c75a;color:#fff;border:0;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;}" +
    ".np2-ui button[data-dl]{background:#fff;color:#1d6b3e;border:1px solid #9fd8b6;}.np2-ui button.done{background:#1d6b3e;color:#fff;}" +
    ".np2-n{font-weight:800;color:#1d6b3e;}.np2-src{color:#7a8;}.np2-src a{color:#1a73e8;}" +
    ".np2-meta{font-size:12px;color:#7a8;margin-top:4px;line-height:1.5;}.np2-meta a{color:#1a73e8;}" +
    ".np2-copy .np2-ph{margin:6px 0 0;font-size:13.5px;}.np2-mode-img .np2-ph{display:none;}" +
    ".np2-spot{margin:0 0 14px;padding:8px 10px;background:#f4f7fb;border:1px dashed #b9c6cf;border-radius:8px;}.np2-spot .ph{margin:0;}" +
    ".np-old{margin-top:18px;font-size:13px;color:#667;}.np-old summary{cursor:pointer;font-weight:700;}" +
    ".np-old .np2-oldbox{margin-top:8px;border-color:#bbb;}.np-old button{margin:8px 0 0;background:#fff;border:1px solid #cfd6dd;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer;}" +
    ".np2-buf{position:fixed;left:-99999px;top:0;width:700px;background:#fff;}";

  function ensureWidget() {
    var st = document.createElement("style"); st.id = "np2-css"; st.textContent = CSS; document.head.appendChild(st);
    var btn = document.getElementById("npBtn"), back = document.getElementById("npBack"), drawer = document.getElementById("npDrawer");
    var created = !drawer;
    if (created) {
      btn = el("button"); btn.id = "npBtn"; btn.type = "button"; btn.textContent = "📋 네이버 붙여넣기용 복사";
      back = el("div"); back.id = "npBack";
      drawer = el("div"); drawer.id = "npDrawer"; drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-label", "네이버 붙여넣기용 본문");
      document.body.appendChild(btn); document.body.appendChild(back); document.body.appendChild(drawer);
    }
    var oldCopy = document.getElementById("copy");
    if (oldCopy) oldCopy.parentNode.removeChild(oldCopy);
    drawer.innerHTML = "";
    return { btn: btn, back: back, drawer: drawer, oldCopy: oldCopy, created: created };
  }

  var W = ensureWidget();
  var imgMode = lsGet(LS_IMG, "img"), headMode = lsGet(LS_HEAD, "h3");
  if (!ITEMS.length) imgMode = "text";

  var head = el("div", "np2-head");
  head.innerHTML =
    '<div class="np2-title"><span class="np2-t">📋 네이버 붙여넣기</span><button type="button" class="np2-x" aria-label="닫기">✕</button></div>' +
    '<div class="np2-row"><span class="np2-lbl">제목</span><span class="np2-titletxt">' + esc(TITLE) + '</span><button type="button" data-act="title">제목 복사</button></div>' +
    '<div class="np2-row"><button type="button" class="np2-main" data-act="body">본문 복사</button>' +
    (TAGS ? '<button type="button" data-act="tags">태그 복사</button>' : "") +
    '<span class="np2-stat">' + statLine() + "</span></div>" +
    '<div class="np2-row np2-opts">' +
    (ITEMS.length ? '<span class="np2-lbl">사진</span>' +
      '<label><input type="radio" name="np2img" value="img"' + (imgMode === "img" ? " checked" : "") + '> 사진 포함(실험)</label>' +
      '<label><input type="radio" name="np2img" value="text"' + (imgMode === "text" ? " checked" : "") + '> 자리표시만</label><span class="np2-sep"></span>' : "") +
    '<span class="np2-lbl">소제목</span>' +
    '<label><input type="radio" name="np2head" value="h3"' + (headMode === "h3" ? " checked" : "") + '> 큰 글씨</label>' +
    '<label><input type="radio" name="np2head" value="quote"' + (headMode === "quote" ? " checked" : "") + '> 인용구(실험)</label>' +
    "</div>";

  function statLine() {
    var s = [];
    s.push("사진 " + STATS.photos + "곳" + (STATS.imgs && STATS.spots ? "(" + STATS.imgs + "장 있음·" + STATS.spots + "곳 직접)" : STATS.spots ? "(직접)" : STATS.imgs ? "(있음)" : ""));
    if (STATS.tables) s.push("표 " + STATS.tables);
    if (STATS.coupang) s.push("쿠팡 링크 " + STATS.coupang + "곳");
    if (STATS.btns) s.push("버튼 링크 " + STATS.btns);
    return s.join(" · ");
  }
  function guideHtml() {
    var g = ["<b>①</b> [제목 복사] → 네이버 <b>제목칸</b>에 붙여넣기", "<b>②</b> [본문 복사] → <b>본문</b>에 Ctrl+V"];
    if (ITEMS.length) g.push("<b>③</b> «사진 포함»이면 사진도 같이 들어가요 — 붙인 뒤 오른쪽 <b>라이브러리에 사진이 떴는지</b> 확인. 안 들어온 사진은 아래 사진의 <b>[복사]</b> → 그 자리에 Ctrl+V");
    if (STATS.spots || STATS.coupang) g.push("<b>" + (ITEMS.length ? "④" : "③") + "</b> <b>파란 글씨 줄</b>은 직접 채우기" + (STATS.spots ? "(📷 사진)" : "") + (STATS.coupang ? "(👉 쿠팡 링크)" : ""));
    if (TAGS) g.push("<b>" + (ITEMS.length ? (STATS.spots || STATS.coupang ? "⑤" : "④") : (STATS.spots || STATS.coupang ? "④" : "③")) + "</b> [태그 복사] → 태그칸");
    return g.join("<br>");
  }

  var body = el("div", "np2-body");
  var guide = el("div", "np2-guide", guideHtml());
  var auto = el("div", "np2-copy"); auto.id = "np2Auto";
  auto.appendChild(AUTO);
  body.appendChild(guide); body.appendChild(auto);
  if (W.oldCopy) {
    var det = el("details", "np-old");
    det.innerHTML = "<summary>작성자 생존본(구 방식) — 자동본이 이상할 때 이걸로</summary><button type=\"button\" data-act=\"old\">이 버전 복사</button>";
    W.oldCopy.classList.add("np2-copy", "np2-oldbox");
    det.appendChild(W.oldCopy); body.appendChild(det);
  }
  var wrap = el("div", "np2-wrap"); wrap.style.cssText = "display:contents;";
  W.drawer.appendChild(head); W.drawer.appendChild(body);

  function applyModes() {
    auto.classList.toggle("np2-mode-img", imgMode === "img");
    auto.classList.toggle("np2-quote", headMode === "quote");
  }
  applyModes();

  function open() { W.drawer.classList.add("open"); W.back.classList.add("open"); }
  function close() { W.drawer.classList.remove("open"); W.back.classList.remove("open"); }
  if (W.created) {
    W.btn.addEventListener("click", open); W.back.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }
  head.querySelector(".np2-x").addEventListener("click", close);
  head.addEventListener("change", function (e) {
    var t = e.target; if (!t || t.type !== "radio") return;
    if (t.name === "np2img") { imgMode = t.value; lsSet(LS_IMG, imgMode); }
    if (t.name === "np2head") { headMode = t.value; lsSet(LS_HEAD, headMode); }
    applyModes();
  });
  W.drawer.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "title") { plainCopy(TITLE).then(function (ok) { ok ? flash(b, "✅ 복사됨") : alert("복사가 안 됐어요. 제목을 드래그해서 복사해 주세요."); }); return; }
    if (act === "tags") { plainCopy(TAGS).then(function (ok) { ok ? flash(b, "✅ 복사됨") : alert("복사가 안 됐어요."); }); return; }
    if (act === "body") {
      richCopy(buildCopyNode(AUTO, imgMode, headMode)).then(function (ok) {
        ok ? flash(b, "✅ 복사됨 → 네이버 본문에 Ctrl+V", 3200) : alert("자동 복사가 안 됐어요. 초록 점선 안쪽을 드래그해서 복사(Ctrl+C)해 주세요.");
      });
      return;
    }
    if (act === "old" && W.oldCopy) {
      var c = W.oldCopy.cloneNode(true); c.removeAttribute("id"); c.className = "";
      richCopy(c).then(function (ok) { ok ? flash(b, "✅ 복사됨", 2600) : alert("자동 복사가 안 됐어요. 점선 안쪽을 드래그해서 복사해 주세요."); });
      return;
    }
    var fig = b.closest(".np2-fig");
    if (fig) {
      var it = ITEMS[+fig.getAttribute("data-i")]; if (!it) return;
      if (b.hasAttribute("data-cp")) copyImg(it, b);
      else if (b.hasAttribute("data-dl")) download(it, b);
    }
  });

  /* 검증·디버그용 */
  function htmlText(node) {   /* 태그 경계를 공백으로 — textContent 는 블록·셀이 붙어 나온다 */
    var ta = document.createElement("textarea"); ta.innerHTML = node.innerHTML.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " "); return ta.value;
  }
  window.__np = {
    open: open, close: close, stats: function () { return STATS; }, items: function () { return ITEMS; },
    title: TITLE, tags: TAGS, htmlText: htmlText,
    autoText: function () { return htmlText(AUTO); },
    articleText: function () {
      var c = POST.cloneNode(true); [].forEach.call(c.querySelectorAll(SKIP), function (n) { n.remove(); }); return htmlText(c);
    },
    copyHTML: function (im, hd) { return buildCopyNode(AUTO, im || imgMode, hd || headMode).innerHTML; }
  };
})();
