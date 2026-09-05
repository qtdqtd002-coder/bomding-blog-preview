/*! bomding-npaste.js — 호환용 1줄 로더(2026-09-05). 실체는 naver-npaste.js(봄딩·영도 공용 캐논).
 *  봄딩 기존 283편이 이 파일명으로 include 하고 있어 재주입 없이 캐논을 따라가게 한다. 새 글은 naver-npaste.js 를 직접 include.
 */
(function () {
  if (window.__bdNpaste || document.getElementById("np2-src")) return;
  var s = document.createElement("script"); s.id = "np2-src";
  s.src = "https://qtdqtd002-coder.github.io/bomding-blog-preview/_design/naver-npaste.js";
  document.head.appendChild(s);
})();
