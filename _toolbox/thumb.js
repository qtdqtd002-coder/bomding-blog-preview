/*! 쓰담 도구함 · 썸네일 (봄딩 · 정사각 1000) — 2026-09-06
 *  index.html 「도구함」 탭이 처음 고를 때 받아 window.SseudamTools.thumb 로 등록한다({mount(host,api), unmount()}).
 *  규격 정본 = 봄딩 썸네일 표준 v1(2026-09-05, 쓰담/docs/…/썸네일표준/apply-thumb-standard.py 를 그대로 이식):
 *    캔버스 1000×1000 · 게임명 1줄 6자 이내 권장 · 글자 높이 캔버스의 16.5% · 바깥 안전여백 4% · 테두리 없음
 *    표준(밴드) = 44% 부터 밴드, 62% 아래는 거의 불투명(238→252) · 게임명 top 66.5% · 로즈 밑줄(글자폭의 34%)
 *    부제는 «넣지 않는다»가 표준 — 90px 에서 5px 가 되어 읽히지 않는다. 꼭 넣을 때만 켠다(끄면 표준과 동일).
 *  프리셋 5 = 밴드(표준)·플라크·틴트·스트라이프·크림. 다섯 다 글자 높이·안전여백·테두리 없음은 같다(구조만 다름).
 *  미리보기 = 봄딩 블로그 실측 배치(PC 프롤로그 966px: 메인 목록 큰 카드 183×185 + 목록 90×90 + 이미지목록 8열 90×90 /
 *            m.blog 390px: 사진 목록 3열 33.3% 정사각 — m_main.css 실측 규칙)에 «실제 픽셀 크기»로 얹는다.
 *  색·글꼴·반경은 사이트 토큰(:root)과 시안 A(크림&로즈) 팔레트만 쓴다. 의존성 0.
 */
(function(){
"use strict";
window.SseudamTools=window.SseudamTools||{};
if(window.SseudamTools.thumb)return;

var BASE=(function(){ var s=document.currentScript, u=(s&&s.src)||'_toolbox/thumb.js'; return u.replace(/\?.*$/,'').replace(/[^\/]*$/,''); })();
var ASSET=BASE+'thumb/';
var SIZE=1000;
/* 표준 v1 상수 — apply-thumb-standard.py 와 같은 값 */
var STD={ nameH:.165, nameMaxW:.84, safe:.04, bandTop:.44, bandKnee:.62, kneeA:238, maxA:252, nameY:.665, band:[22,13,28] };
var C={ plum:'#2E2038', deep:'#C93C7C', rose:'#F58AB4', cream:'#FAF7F9', ink:'#241A2C' };
var SWATCHES=[
  {id:'rose', c:'#F58AB4', n:'로즈'}, {id:'deep', c:'#C93C7C', n:'딥 로즈'}, {id:'lav', c:'#B79BF0', n:'라벤더'},
  {id:'mint', c:'#6FD4B8', n:'민트'}, {id:'gold', c:'#E3B75E', n:'골드'}
];
var PRESETS=[
  {id:'band',   n:'밴드',     d:'표준 · 하단 밴드'},
  {id:'plaque', n:'플라크',   d:'플럼 판 위 게임명'},
  {id:'tint',   n:'틴트',     d:'전체 톤 · 가운데'},
  {id:'stripe', n:'스트라이프', d:'하단 단색 띠'},
  {id:'cream',  n:'크림',     d:'밝은 하단 판'}
];
var FONTS=[
  {id:'pretendard', n:'Pretendard 굵게', fam:'"Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif', w:'800', ls:-0.02},
  {id:'malgun',     n:'맑은 고딕 굵게',   fam:'"Malgun Gothic","맑은 고딕","Pretendard Variable",sans-serif', w:'bold', ls:0}
];
var LS='sseudam_thumb_v1';

/* ── 상태: 탭을 떠났다 와도 남는다(모듈 메모리). 이미지는 저장하지 않고 설정만 localStorage. ── */
var ST={ img:null, iw:0, ih:0, srcName:'', zoom:1, px:0, py:0,
         preset:'band', accent:'rose', font:'pretendard', name:'', sub:'', subOn:false, title:'' };
try{ var sv=JSON.parse(localStorage.getItem(LS)||'null');
  if(sv){ ['preset','accent','font'].forEach(function(k){ if(sv[k])ST[k]=sv[k]; }); ST.subOn=!!sv.subOn; } }catch(e){}
function savePrefs(){ try{ localStorage.setItem(LS,JSON.stringify({preset:ST.preset,accent:ST.accent,font:ST.font,subOn:ST.subOn})); }catch(e){} }

/* ── 부품 ── */
var api=null, root=null, main=null, mctx=null, els={}, raf=0, tileT=0, mounted=false, ph=null, fontsReady=false;
function $(id){ return root?root.querySelector('#'+id):null; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var IC={
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2.4"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  center:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
};
function ic(n){ return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(IC[n]||'')+'</svg>'; }

var CSS=
'.th{display:grid;grid-template-columns:minmax(300px,400px) minmax(0,1fr)}'+
'.th-stage{padding:18px;border-right:1px solid var(--hair);min-width:0}'+
'.th-ctl{padding:4px 18px 18px;min-width:0}'+
'.th-cv{position:relative;border-radius:14px;overflow:hidden;background:var(--surface-3);box-shadow:0 0 0 1px var(--hair)}'+
'.th-cv canvas{display:block;width:100%;aspect-ratio:1/1;touch-action:none}'+
'.th.has-img .th-cv canvas{cursor:grab}.th.has-img .th-cv canvas.drag{cursor:grabbing}'+
'.th-cv canvas:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}'+
'.th-dz{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;'+
  'padding:18px;cursor:pointer;background:rgba(255,255,255,.42);'+
  'transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e)}'+
'.th-dz::after{content:"";position:absolute;inset:14px;border:1.5px dashed var(--hair-3);border-radius:12px;pointer-events:none;transition:border-color var(--t-fast) var(--e)}'+
'.th-dz:hover,.th-dz.over{background:rgba(255,255,255,.58)}.th-dz:hover::after,.th-dz.over::after{border-color:var(--ink)}'+
'.th-dz-in{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:16px 22px 15px;border-radius:14px;'+
  'background:var(--surface);box-shadow:0 0 0 1px var(--hair),var(--sh-rest)}'+   /* 글자는 불투명 흰 판 위 — 반투명 오버레이 위에선 캡션 대비가 2.87:1 이었다(게이트 09-06) */

'.th-dz.over::after{border-style:solid;border-width:2px}'+
'.th-dz:focus-visible{outline:2px solid var(--ink);outline-offset:-4px}'+
'.th-dz[hidden]{display:none}'+
'.th-dz .ic{width:22px;height:22px;color:var(--ink-3);margin-bottom:6px;transition:transform var(--t) var(--e-out),color var(--t-fast) var(--e)}'+
'.th-dz:hover .ic,.th-dz.over .ic{transform:translateY(-2px);color:var(--ink)}'+
'.th-dz b{font-size:13.5px;font-weight:600;letter-spacing:-.02em;color:var(--ink)}'+
'.th-dz span{font-size:12.5px;color:var(--ink-3)}'+   /* 흰 판 위 ink-3 = 4.8:1 */
'.th-adj{display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap}'+
'.th-adj[hidden]{display:none}'+
'.th-adj label{font-size:12.5px;font-weight:600;color:var(--ink-2)}'+
'.th-adj input[type=range]{flex:1 1 90px;min-width:70px;accent-color:var(--ink);height:28px;margin:0}'+
'.th-zv{font-size:12.5px;color:var(--ink-3);min-width:44px}'+
'.th-adj .ghost{height:32px;padding:0 12px}'+
'.th-minis{display:flex;gap:14px;align-items:flex-start;margin-top:16px;padding-top:14px;border-top:1px solid var(--hair)}'+
'.th-minis figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}'+
'.th-minis canvas{display:block;border-radius:4px;background:var(--surface-3);box-shadow:0 0 0 1px var(--hair)}'+
'.th-minis figcaption{font-size:12.5px;color:var(--ink-3);white-space:nowrap}'+
'.th-chk{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;min-width:0}'+
'.th-chk li{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;line-height:1.45;color:var(--ink-2);white-space:nowrap;word-break:keep-all}'+
'.th-chk li .ic{width:14px;height:14px;flex:none;color:var(--ink-3)}'+
'.th-chk li.bad{color:var(--alert)}.th-chk li.bad .ic{color:var(--alert)}'+
'.th-chk li b{font-weight:600;color:inherit}'+
'.th-sec{padding:16px 0 18px;border-top:1px solid var(--hair)}.th-sec:first-child{border-top:0;padding-top:14px}'+
'.th-st{font-size:13.5px;font-weight:700;letter-spacing:-.025em;margin-bottom:10px;display:flex;align-items:center;gap:8px}'+
'.th-st .d{font-size:12.5px;font-weight:500;color:var(--ink-3)}'+
'.th-presets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}'+
'.th-preset{display:flex;flex-direction:column;align-items:center;gap:7px;padding:8px 4px 7px;border-radius:12px;'+
  'transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.th-preset canvas{display:block;width:100%;max-width:74px;aspect-ratio:1/1;border-radius:8px;background:var(--surface-3);box-shadow:0 0 0 1px var(--hair);'+
  'transition:box-shadow var(--t-fast) var(--e)}'+
'.th-preset b{font-size:12.5px;font-weight:600;letter-spacing:-.02em;color:var(--ink-2);white-space:nowrap}'+
'.th-preset:hover{background:var(--surface-2)}.th-preset:hover b{color:var(--ink)}'+
'.th-preset:active{transform:scale(.97)}'+
'.th-preset.on{background:var(--surface-2);box-shadow:0 0 0 1px var(--hair-2)}'+
'.th-preset.on canvas{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink)}'+
'.th-preset.on b{color:var(--ink)}'+
'.th-lbl{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12.5px;font-weight:600;color:var(--ink-2);margin:12px 0 6px}'+
'.th-lbl:first-of-type{margin-top:0}'+
'.th-lbl .o{font-weight:500;color:var(--ink-3)}'+
'.th-cnt{font-size:12.5px;font-weight:500;color:var(--ink-3)}.th-cnt.bad{color:var(--alert);font-weight:600}'+
'.th-row{display:flex;align-items:center;gap:8px;margin-top:12px}'+
'.th-row .f-i{flex:1;min-width:0}'+
'.th-row .f-i[hidden]{display:none}'+
'.th-two{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px}'+
'.th-sws{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:34px}'+
'.th-swn{flex-basis:100%;margin-top:2px}'+
'.th-sw{width:28px;height:28px;border-radius:50%;background:var(--c);flex:none;position:relative;'+
  'box-shadow:inset 0 0 0 1px rgba(14,17,20,.14);transition:transform var(--t-fast) var(--e-out),box-shadow var(--t-fast) var(--e)}'+
'.th-sw::after{content:"";position:absolute;inset:-7px}'+   /* 보이는 원은 28px, 누르는 자리는 42px */
'.th-sw:hover{transform:scale(1.08)}'+
'.th-sw.on{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink)}'+
'.th-sw:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.th-swn{font-size:12.5px;color:var(--ink-2);font-weight:600}'+
'.th-act{display:flex;flex-direction:column;gap:10px;padding-bottom:6px}'+
'.th-act-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'+
'.th-act .cta{margin-left:auto}'+
'.th-act .ghost .ic,.th-act .cta .ic{width:14px;height:14px}'+
'.th-act button:disabled{opacity:.42;cursor:default;transform:none}'+
'.th-fn{flex:1 1 120px;min-width:0;font-size:12.5px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.th-pv-hs{word-break:keep-all}'+
/* ── 미리보기 모달 ── */
'.th-pv{background:var(--surface-2)}'+
'.th-pv-bar{display:flex;align-items:center;gap:6px;padding:12px 16px;border-bottom:1px solid var(--hair);background:var(--surface);position:sticky;top:0;z-index:2}'+
'.th-pv-bar .chip{height:32px}'+
'.th-pv-n{margin-left:auto;font-size:12.5px;color:var(--ink-3);white-space:nowrap}'+
'.th-pv-pane{padding:18px}.th-pv-pane[hidden]{display:none}'+
'.th-fitw{overflow:hidden;margin:0 auto;contain:inline-size}'+   /* 966px 고정폭 자식이 모달의 최소 폭을 밀어내지 않게(모바일에서 판이 966 으로 벌어지던 원인) */

'.th-fit{width:max-content;transform-origin:0 0;box-shadow:0 0 0 1px var(--hair),var(--sh-rest);border-radius:6px;overflow:hidden}'+   /* width:max-content — 래퍼 폭(축소 후 폭)이 아니라 966/390 자연 폭으로 놓고 scale 한다(없으면 래퍼 폭으로 잘린 뒤 또 축소됨) */

/* PC 프롤로그 — 네이버 실측(966px 2단 · 사이드바 190 · 목록 글꼴 돋움 9pt 고정 · 제목색 #2E2038 · 강조색 #C93C7C) */
'.th-pc{width:966px;background:#fff;color:#000;font:12px/1.5 Dotum,"돋움",Gulim,"Malgun Gothic",sans-serif;letter-spacing:0;text-align:left}'+
'.th-pc img{display:block}'+
'.th-pc .bn{width:966px;height:360px}'+
'.th-pc .mn{display:flex;align-items:center;height:39px;padding:0 10px;border-bottom:1px solid #E7DFE9;font-weight:bold;font-size:12px;color:#2E2038}'+
'.th-pc .mn span{padding:0 11px;border-left:1px solid #E1DCE4;line-height:12px}.th-pc .mn span:first-child{border-left:0;color:#C93C7C}'+
'.th-pc .bd{display:grid;grid-template-columns:190px minmax(0,1fr)}'+
'.th-pc .sb{padding:14px 14px 20px;border-right:1px solid #EFEAF1}'+
'.th-pc .sb img{width:161px;height:161px}'+
'.th-pc .sb .nm{margin:10px 0 1px;font-weight:bold;font-size:13px;color:#2E2038}.th-pc .sb .id{font-size:11px;color:#8A8391}'+
'.th-pc .sb .it{margin-top:9px;font-size:11px;line-height:1.6;color:#4A3B57;word-break:keep-all}'+
'.th-pc .sb .sr{margin-top:12px;height:26px;border:1px solid #D6CADB;border-radius:3px;background:#fff}'+
'.th-pc .mc{padding:16px 16px 22px;min-width:0}'+
'.th-pc .top{display:grid;grid-template-columns:183px 183px minmax(0,1fr);gap:0 16px}'+
'.th-pc .big img{width:183px;height:185px;object-fit:cover}'+
'.th-pc .t{font-weight:bold;color:#2E2038;font-size:12px;line-height:1.45;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'+
'.th-pc .t i{font-style:normal;color:#C93C7C;font-weight:bold;margin-left:3px}'+
'.th-pc .big .t{margin-top:8px}'+
'.th-pc .s{font-size:11px;line-height:1.5;color:#333;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'+
'.th-pc .d{font-size:11px;color:#8A8391;margin-top:5px}'+
'.th-pc .lst{display:flex;flex-direction:column;gap:14px;min-width:0}'+
'.th-pc .li{display:grid;grid-template-columns:minmax(0,1fr) 90px;gap:0 10px;align-items:start}'+
'.th-pc .li img{width:90px;height:90px;object-fit:cover}'+
'.th-pc .li .t{-webkit-line-clamp:2}'+
'.th-pc .sec{margin-top:22px;padding-top:14px;border-top:1px solid #E7DFE9}'+
'.th-pc .sec h4{margin:0 0 9px;font-size:12px;font-weight:bold;color:#2E2038}'+
'.th-pc .gr{display:grid;grid-template-columns:repeat(8,90px);gap:1px 0;width:720px}'+
'.th-pc .gr img{width:90px;height:90px;object-fit:cover}'+
/* m.blog 390 — 커버 430 · 40% 딤 · 프로필 68 원형 · 사진 목록 3열 33.3%(margin 1px · 정사각) — m_main.css 규칙 그대로 */
'.th-mo{width:390px;background:#fff;color:#111;font:13px/1.5 -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;text-align:left}'+
'.th-mo .cv{position:relative;height:430px;background:#3a2a3d url('+ASSET+'mcover_390x430.webp) center/cover no-repeat}'+
'.th-mo .cv::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.4)}'+
'.th-mo .cv .in{position:absolute;left:20px;right:20px;bottom:22px;z-index:1;color:#fff}'+
'.th-mo .cv .ct{font-size:12px;opacity:.92}.th-mo .cv h3{margin:4px 0 14px;font-size:24px;font-weight:800;letter-spacing:-.02em}'+
'.th-mo .pf{display:flex;align-items:center;gap:10px}.th-mo .pf img{width:68px;height:68px;border-radius:50%;object-fit:cover}'+
'.th-mo .pf b{display:block;font-size:15px}.th-mo .pf span{display:block;font-size:11.5px;opacity:.9;margin-top:2px}'+
'.th-mo .btn{margin-top:14px;height:40px;border-radius:6px;background:#03C75A;color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}'+
'.th-mo .it{padding:16px 20px;font-size:13px;line-height:1.55;color:#333;word-break:keep-all;border-bottom:8px solid #F5F5F7}'+
'.th-mo .it b{display:block;font-size:15px;color:#111;margin-bottom:6px}'+
'.th-mo .tb{display:flex;gap:18px;padding:13px 20px 11px;font-size:14px;font-weight:700;color:#999;border-bottom:1px solid #EEE}.th-mo .tb .on{color:#111}'+
'.th-mo .pg{display:flex;flex-wrap:wrap;padding:2px 0 8px}'+
'.th-mo .pg a{display:block;width:33.3333%}'+
'.th-mo .pg span{display:block;position:relative;margin:1px;padding-top:100%;overflow:hidden;background:#F1F1F3}'+
'.th-mo .pg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}'+
'@media (max-width:860px){'+
  '.th{grid-template-columns:1fr}.th-stage{border-right:0;border-bottom:1px solid var(--hair);padding:14px}'+
  '.th-ctl{padding:0 14px 14px}.th-two{grid-template-columns:1fr;gap:0}.th-two>div+div{margin-top:14px}'+
  '.th-presets{gap:4px}.th-act .cta{margin-left:0;width:100%;justify-content:space-between}'+
  '.th-minis{flex-wrap:wrap}'+
'}';

/* ── 유틸 ── */
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function lum(hex){ var n=parseInt(hex.slice(1),16), r=(n>>16&255)/255, g=(n>>8&255)/255, b=(n&255)/255;
  function f(c){ return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4); } return .2126*f(r)+.7152*f(g)+.0722*f(b); }
function swatch(){ for(var i=0;i<SWATCHES.length;i++)if(SWATCHES[i].id===ST.accent)return SWATCHES[i]; return SWATCHES[0]; }
function font(){ for(var i=0;i<FONTS.length;i++)if(FONTS[i].id===ST.font)return FONTS[i]; return FONTS[0]; }
function fontStr(px){ var f=font(); return f.w+' '+px+'px '+f.fam; }
function safeName(s){ return String(s||'').replace(/[\\\/:*?"<>|]/g,'').replace(/\s+/g,'_').slice(0,40); }
function fileName(){ return (safeName(ST.name)||'썸네일')+'_1000.png'; }

/* 이미지가 없을 때의 자리 그림 — 프리셋이 어떻게 생겼는지 이미지 없이도 보이게(플럼→로즈, 아무 사진도 흉내내지 않는다) */
function placeholder(){
  if(ph)return ph;
  var c=document.createElement('canvas'); c.width=SIZE; c.height=SIZE; var x=c.getContext('2d');
  var g=x.createLinearGradient(0,0,SIZE,SIZE); g.addColorStop(0,'#3A2A48'); g.addColorStop(.55,'#6A3E66'); g.addColorStop(1,'#C6708F');
  x.fillStyle=g; x.fillRect(0,0,SIZE,SIZE);
  var r=x.createRadialGradient(640,340,20,640,340,520); r.addColorStop(0,'rgba(255,255,255,.22)'); r.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=r; x.fillRect(0,0,SIZE,SIZE);
  ph=c; return ph;
}

/* ── 그리기 ──
   opts={preset,accent,font,name,sub,subOn} 를 받아 ctx(1000×1000) 에 그린다. 메인·프리셋 타일·미리보기가 같은 함수를 쓴다. */
function geom(){
  var src=ST.img||placeholder(), iw=ST.img?ST.iw:SIZE, ih=ST.img?ST.ih:SIZE;
  var base=SIZE/Math.min(iw,ih), s=base*(ST.img?ST.zoom:1);
  var dw=iw*s, dh=ih*s, mx=Math.max(0,(dw-SIZE)/2), my=Math.max(0,(dh-SIZE)/2);
  var px=clamp(ST.px,-mx,mx), py=clamp(ST.py,-my,my);
  return {src:src,x:(SIZE-dw)/2+px,y:(SIZE-dh)/2+py,w:dw,h:dh,mx:mx,my:my};
}
function fitFont(ctx,text,maxW,fs,ls){
  var f=font();
  for(;fs>40;fs-=2){
    ctx.font=fontStr(fs); ctx.letterSpacing=(ls*fs)+'px';
    if(ctx.measureText(text).width<=maxW)break;
  }
  ctx.font=fontStr(fs); ctx.letterSpacing=(f.ls*fs)+'px';
  return fs;
}
function draw(ctx,o){
  var g=geom(), name=(o.name||'').trim()||'게임명', sub=o.subOn?(o.sub||'').trim():'', sw=o.sw||swatch(), fnt=font();
  ctx.save(); ctx.clearRect(0,0,SIZE,SIZE);
  ctx.fillStyle='#160D1C'; ctx.fillRect(0,0,SIZE,SIZE);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  try{ ctx.drawImage(g.src,g.x,g.y,g.w,g.h); }catch(e){}
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  var fs=Math.round(SIZE*STD.nameH), ls=fnt.ls, subFs=Math.round(SIZE*.052), safe=SIZE*STD.safe;
  function text(str,x,y,color,align,size){
    ctx.font=fontStr(size); ctx.letterSpacing=(ls*size)+'px'; ctx.fillStyle=color; ctx.textAlign=align||'left'; ctx.fillText(str,x,y);
  }
  function measure(str,size){ ctx.font=fontStr(size); ctx.letterSpacing=(ls*size)+'px'; return ctx.measureText(str); }
  var m, tw, asc, x, top, base;
  if(o.preset==='band'){
    /* 표준 — 파이썬 적용기와 같은 알파 곡선(위는 부드럽게, knee 아래는 거의 불투명) */
    var top0=Math.round(SIZE*STD.bandTop), knee=Math.round(SIZE*STD.bandKnee), b=STD.band;
    for(var y=top0;y<SIZE;y++){
      var a=y<knee?STD.kneeA*Math.pow((y-top0)/(knee-top0),1.35):STD.kneeA+(STD.maxA-STD.kneeA)*(y-knee)/(SIZE-knee);
      ctx.fillStyle='rgba('+b[0]+','+b[1]+','+b[2]+','+(Math.min(a,STD.maxA)/255).toFixed(4)+')'; ctx.fillRect(0,y,SIZE,1);
    }
    fs=fitFont(ctx,name,SIZE*STD.nameMaxW,fs,ls); m=measure(name,fs); tw=m.width; asc=m.actualBoundingBoxAscent||fs*.8;
    top=SIZE*STD.nameY; x=(SIZE-tw)/2; base=top+asc;
    text(name,x,base,'#FFFFFF','left',fs);
    var lw=Math.max(2,Math.round(SIZE*.011)), ly=top+fs*1.26;
    ctx.fillStyle=sw.c; ctx.fillRect(SIZE/2-tw*.17,ly,tw*.34,lw);
    if(sub){ var sm=measure(sub,subFs); text(sub,(SIZE-sm.width)/2,top-26,'rgba(255,255,255,.86)','left',subFs); }
  }else if(o.preset==='plaque'){
    fs=fitFont(ctx,name,SIZE*.80,fs,ls); m=measure(name,fs); tw=m.width; asc=m.actualBoundingBoxAscent||fs*.8;
    var desc=m.actualBoundingBoxDescent||fs*.12, padX=52, padT=40, padB=44, barH=9, gap1=22, gap2=16;
    var subH=sub?subFs+gap2:0, glyph=asc+desc;
    var pw=Math.min(SIZE-2*safe,tw+2*padX), phh=padT+barH+gap1+subH+glyph+padB;
    var px0=safe, py0=SIZE-safe-phh;
    ctx.fillStyle='rgba(46,32,56,.96)'; rrect(ctx,px0,py0,pw,phh,30); ctx.fill();
    ctx.fillStyle=sw.c; ctx.fillRect(px0+padX,py0+padT,64,barH);
    var ty=py0+padT+barH+gap1;
    if(sub){ text(sub,px0+padX,ty+subFs*.86,'rgba(255,255,255,.78)','left',subFs); ty+=subFs+gap2; }
    text(name,px0+padX,ty+asc,'#FFFFFF','left',fs);
  }else if(o.preset==='tint'){
    ctx.fillStyle='rgba(46,32,56,.5)'; ctx.fillRect(0,0,SIZE,SIZE);
    var vg=ctx.createLinearGradient(0,0,0,SIZE); vg.addColorStop(0,'rgba(22,13,28,.18)'); vg.addColorStop(.5,'rgba(22,13,28,0)'); vg.addColorStop(1,'rgba(22,13,28,.42)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,SIZE,SIZE);
    fs=fitFont(ctx,name,SIZE*STD.nameMaxW,fs,ls); m=measure(name,fs); tw=m.width; asc=m.actualBoundingBoxAscent||fs*.8;
    var gh=asc+(m.actualBoundingBoxDescent||fs*.12), cy=SIZE*.5;
    base=cy-gh/2+asc; x=(SIZE-tw)/2;
    text(name,x,base,'#FFFFFF','left',fs);
    var lw2=Math.max(2,Math.round(SIZE*.011)), ly2=base+fs*.34;
    ctx.fillStyle=sw.c; ctx.fillRect(SIZE/2-tw*.17,ly2,tw*.34,lw2);
    if(sub){ var sm2=measure(sub,subFs); text(sub,(SIZE-sm2.width)/2,ly2+lw2+subFs*1.05,'rgba(255,255,255,.88)','left',subFs); }
  }else if(o.preset==='stripe'){
    var dark=lum(sw.c)<.25, fg=dark?'#FFFFFF':C.plum, fgS=dark?'rgba(255,255,255,.82)':'rgba(46,32,56,.72)';   /* 로즈(#F58AB4, L≈.41)에 흰 글자는 2.3:1 — 밝은 띠엔 플럼 글자 */
    var sh=Math.round(SIZE*.26)+(sub?subFs+18:0), sy=SIZE-sh;
    ctx.fillStyle=sw.c; ctx.fillRect(0,sy,SIZE,sh);
    fs=fitFont(ctx,name,SIZE*STD.nameMaxW,fs,ls); m=measure(name,fs); tw=m.width; asc=m.actualBoundingBoxAscent||fs*.8;
    var gh2=asc+(m.actualBoundingBoxDescent||fs*.12);
    var blockH=gh2+(sub?subFs+18:0), by=sy+(sh-blockH)/2;
    if(sub){ var sm3=measure(sub,subFs); text(sub,(SIZE-sm3.width)/2,by+subFs*.86,fgS,'left',subFs); by+=subFs+18; }
    text(name,(SIZE-tw)/2,by+asc,fg,'left',fs);
  }else{ /* cream */
    var ph2=Math.round(SIZE*.30)+(sub?subFs+14:0), py2=SIZE-ph2;
    ctx.fillStyle=C.cream; ctx.fillRect(0,py2,SIZE,ph2);
    ctx.fillStyle='rgba(46,32,56,.08)'; ctx.fillRect(0,py2,SIZE,2);
    fs=fitFont(ctx,name,SIZE*.88,fs,ls); m=measure(name,fs); tw=m.width; asc=m.actualBoundingBoxAscent||fs*.8;
    var gh3=asc+(m.actualBoundingBoxDescent||fs*.12), lw3=Math.max(2,Math.round(SIZE*.011));
    var blk=gh3+18+lw3+(sub?subFs+14:0), ty3=py2+(ph2-blk)/2, x3=SIZE*.06;
    if(sub){ text(sub,x3,ty3+subFs*.86,'rgba(46,32,56,.66)','left',subFs); ty3+=subFs+14; }
    text(name,x3,ty3+asc,C.plum,'left',fs);
    ctx.fillStyle=lum(sw.c)>.55?C.deep:sw.c; ctx.fillRect(x3,ty3+gh3+18,Math.max(80,tw*.34),lw3);
  }
  ctx.restore();
}
function rrect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function cur(){ return {preset:ST.preset,name:ST.name,sub:ST.sub,subOn:ST.subOn}; }

/* 단계 축소 — 1000→90 을 한 번에 줄이면 글자가 뭉개진다. 절반씩 내려 Lanczos 에 가깝게. */
var tmpA=document.createElement('canvas'), tmpB=document.createElement('canvas');
function downscale(src,dst,dw,dh){
  var sw=src.width, sh=src.height, from=src, w=sw, h=sh, i=0;
  while(w/2>dw&&h/2>dh){
    var t=(i%2)?tmpB:tmpA; var nw=Math.round(w/2), nh=Math.round(h/2);
    t.width=nw; t.height=nh; var tx=t.getContext('2d'); tx.imageSmoothingQuality='high'; tx.clearRect(0,0,nw,nh); tx.drawImage(from,0,0,w,h,0,0,nw,nh);
    from=t; w=nw; h=nh; i++;
  }
  var dx=dst.getContext('2d'); dx.imageSmoothingQuality='high'; dx.clearRect(0,0,dst.width,dst.height); dx.drawImage(from,0,0,w,h,0,0,dw,dh);
}

/* ── 렌더 파이프 ── */
function paint(){
  if(!mounted||!main)return;
  draw(mctx,cur());
  var m183=$('thMini183'), m90=$('thMini90');
  if(m183)downscale(main,m183,183,185);
  if(m90)downscale(main,m90,90,90);
  checks();
}
function schedule(){ if(raf)return; raf=requestAnimationFrame(function(){ raf=0; paint(); }); }
var tileCv=document.createElement('canvas'); tileCv.width=SIZE; tileCv.height=SIZE;
function paintTiles(){
  clearTimeout(tileT);
  tileT=setTimeout(function(){
    if(!mounted)return;
    var tx=tileCv.getContext('2d');
    PRESETS.forEach(function(p){
      var c=root.querySelector('.th-preset[data-p="'+p.id+'"] canvas'); if(!c)return;
      draw(tx,{preset:p.id,name:ST.name,sub:ST.sub,subOn:ST.subOn});
      downscale(tileCv,c,c.width,c.height);
    });
  },140);
}
function checks(){
  var ul=$('thChk'); if(!ul)return;
  var n=(ST.name||'').trim(), rows=[];
  if(ST.img){
    var small=Math.min(ST.iw,ST.ih)<SIZE;
    rows.push({ok:!small,t:'원본 <b>'+ST.iw+'×'+ST.ih+'</b>'+(small?' · 1000 미만이라 확대됨':'')});
  }else rows.push({ok:false,t:'이미지 없음'});
  rows.push({ok:n.length>0&&n.length<=6,t:n?'타이틀 <b>'+n.length+'자</b>'+(n.length>6?' · 6자 넘어 90px에서 작아짐':''):'타이틀 없음'});
  rows.push(ST.subOn?{ok:false,t:'부제 있음 · 90px에서 읽히지 않음'}:{ok:true,t:'부제 없음 · 표준'});
  ul.innerHTML=rows.map(function(r){ return '<li class="'+(r.ok?'':'bad')+'">'+ic(r.ok?'check':'alert')+'<span>'+r.t+'</span></li>'; }).join('');
}
function refreshAll(){ schedule(); paintTiles(); }

/* ── 이미지 등록 ── */
function loadFile(f){
  if(!f||!/^image\//.test(f.type)){ api.toast('이미지 파일만 등록할 수 있어요',{kind:'err'}); return; }
  var url=URL.createObjectURL(f);
  loadURL(url,f.name).then(function(){ URL.revokeObjectURL(url); },function(){ URL.revokeObjectURL(url); api.toast('이미지를 읽지 못했어요',{kind:'err'}); });
}
function loadURL(url,nm){
  return new Promise(function(res,rej){
    var im=new Image(); im.decoding='async';
    im.onload=function(){
      ST.img=im; ST.iw=im.naturalWidth; ST.ih=im.naturalHeight; ST.srcName=nm||''; ST.zoom=1; ST.px=0; ST.py=0;
      syncImageUI(); refreshAll(); res(im);
    };
    im.onerror=function(){ rej(new Error('img')); };
    im.src=url;
  });
}
function syncImageUI(){
  if(!root)return;
  var has=!!ST.img;
  root.querySelector('.th').classList.toggle('has-img',has);
  var dz=$('thDz'); if(dz)dz.hidden=has;
  var adj=$('thAdj'); if(adj)adj.hidden=!has;
  var z=$('thZoom'); if(z){ z.value=ST.zoom; $('thZv').textContent=ST.zoom.toFixed(2)+'×'; }
  ['thSave','thCopy','thPreview'].forEach(function(id){ var b=$(id); if(b)b.disabled=!has; });
  var fn=$('thFn'); if(fn)fn.textContent=has?fileName():'';
}

/* ── 내보내기 ── */
function toBlob(){ return new Promise(function(res){ main.toBlob(function(b){ res(b); },'image/png'); }); }
function save(){
  if(!ST.img)return;
  toBlob().then(function(b){
    if(!b){ api.toast('PNG를 만들지 못했어요',{kind:'err'}); return; }
    var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fileName();
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(a.href); },4000);
    api.toast(fileName()+' · '+Math.round(b.size/1024)+'KB 저장');
  });
}
function copyPng(){
  if(!ST.img)return;
  if(!(navigator.clipboard&&window.ClipboardItem)){ api.toast('이 브라우저는 이미지 클립보드 복사를 지원하지 않아요 · PNG 저장을 쓰세요',{kind:'err'}); return; }
  toBlob().then(function(b){
    var item=new ClipboardItem({'image/png':b});
    return navigator.clipboard.write([item]);
  }).then(function(){ api.toast('클립보드에 복사했어요 · 네이버 에디터에 붙여넣기'); })
    .catch(function(){ api.toast('클립보드 복사가 막혔어요 · PNG 저장을 쓰세요',{kind:'err'}); });
}

/* ── 미리보기(봄딩 블로그 실측 배치) ── */
/* 이웃 글 = 실제 봄딩 글(logNo 순 b0~b4)과 그 글의 표준 썸네일 — 제목·그림이 1:1 로 맞는다 */
var NB=[
  {f:'b0_183.webp', t:'포켓몬고 아머드 뮤츠 메가 피날레 레이드 공략 이로치 여부 카운터 추천', c:2, d:'2시간 전'},
  {f:'b1_183.webp', t:'롤토체스 18시즌 신비의숲 챔피언 코스트별 티어 지금 뭘 올려야 할까', c:1, d:'8시간 전'},
  {f:'b2_183.webp', t:'롤토체스아이템조합표 시즌18 완성템 36개 만드는법', c:3, d:'13시간 전'},
  {f:'b3_183.webp', t:'아기 홈캠 추천, 전용 베이비캠 vs 스마트홈캠 4종 비교', c:1, d:'18시간 전'},
  {f:'b4_183.webp', t:'롤토체스 시즌18 신비의숲 협곡야수·개화·날렵이 특성 활성화 단계 정리', c:2, d:'1일 전'}
];
function pvTitle(){ var t=(ST.title||'').trim(); if(t)return t; return ((ST.name||'').trim()||'게임명')+(ST.subOn&&(ST.sub||'').trim()?' '+ST.sub.trim():''); }
function pcMock(url){
  var t=esc(pvTitle()), n=function(i){ return ASSET+'n'+(i<10?'0'+i:i)+'_90.webp'; };
  var grid='<img src="'+url+'" alt="새 썸네일 90×90">';
  for(var i=1;i<=15;i++)grid+='<img src="'+n(i)+'" alt="">';
  return '<div class="th-pc">'+
    '<img class="bn" src="'+ASSET+'banner_966x360.webp" alt="봄딩 타이틀 배너 966×360">'+
    '<div class="mn"><span>prologue</span><span>blog</span><span>게임</span><span>게임일지</span><span>육아일상</span><span>애니</span></div>'+
    '<div class="bd"><div class="sb"><img src="'+ASSET+'profile_161.webp" alt="프로필">'+
      '<div class="nm">봄딩</div><div class="id">bomding</div>'+
      '<div class="it">게임 리뷰·공략 4,700편. 직접 해 보고 씁니다. 2026년 9월 네이버 메이트(게임) · 육아 기록도 함께.</div><div class="sr"></div></div>'+
    '<div class="mc"><div class="top">'+
      '<div class="big"><img src="'+url+'" alt="새 썸네일 183×185"><div class="t">'+t+'<i>[0]</i></div><div class="d">방금 전</div></div>'+
      '<div class="big"><img src="'+ASSET+NB[0].f+'" alt=""><div class="t">'+esc(NB[0].t)+'<i>['+NB[0].c+']</i></div><div class="d">'+NB[0].d+'</div></div>'+
      '<div class="lst">'+[1,2,3].map(function(i){ var b=NB[i];
        return '<div class="li"><div><div class="t">'+esc(b.t)+'<i>['+b.c+']</i></div><div class="s">'+esc(b.t)+' …</div><div class="d">'+b.d+'</div></div>'+
          '<img src="'+ASSET+b.f+'" alt=""></div>'; }).join('')+
      '</div></div>'+
      '<div class="sec"><h4>- 게임</h4><div class="gr">'+grid+'</div></div>'+
    '</div></div></div>';
}
function moMock(url){
  var g='<a><span><img src="'+url+'" alt="새 썸네일 · 3열 정사각"></span></a>';
  for(var i=0;i<5;i++)g+='<a><span><img src="'+ASSET+NB[i].f+'" alt=""></span></a>';
  return '<div class="th-mo"><div class="cv"><div class="in"><div class="ct">오늘 5,288 · 전체 15,859,971</div><h3>봄딩</h3>'+
    '<div class="pf"><img src="'+ASSET+'profile_161.webp" alt=""><div><b>봄딩</b><span>게임 · 8,494명의 이웃</span></div></div>'+
    '<div class="btn">+ 이웃추가</div></div></div>'+
    '<div class="it"><b>소개</b>게임 리뷰·공략 4,700편. 직접 해 보고 씁니다. 2026년 9월 네이버 메이트(게임) · 육아 기록도 함께.</div>'+
    '<div class="tb"><span>글</span><span class="on">사진</span></div>'+
    '<div class="pg">'+g+'</div></div>';
}
var pvRs=null;
function openPreview(btn){
  if(!ST.img)return;
  var url=main.toDataURL('image/png');
  var html='<div class="mdl-h"><span class="mdl-hic">'+ic('eye')+'</span><div><div class="mdl-ht">봄딩 블로그에서 보이는 모습</div>'+
      '<div class="mdl-hs th-pv-hs">실제 픽셀 크기 · PC 966px · 모바일 390px</div></div>'+
      '<button type="button" class="mdl-x" data-close aria-label="닫기">'+ic('x')+'</button></div>'+
    '<div class="mdl-b th-pv"><div class="th-pv-bar" role="tablist">'+
      '<button type="button" class="chip on" role="tab" aria-selected="true" data-pv="pc">PC 프롤로그</button>'+
      '<button type="button" class="chip" role="tab" aria-selected="false" data-pv="mo">모바일</button>'+
      '<span class="th-pv-n">'+esc(fileName())+'</span></div>'+
    '<div class="th-pv-pane" data-pane="pc"><div class="th-fitw"><div class="th-fit">'+pcMock(url)+'</div></div></div>'+
    '<div class="th-pv-pane" data-pane="mo" hidden><div class="th-fitw"><div class="th-fit">'+moMock(url)+'</div></div></div></div>';
  var back=api.openModal(html,btn,'봄딩 블로그 미리보기','wide');
  function fit(){
    Array.prototype.forEach.call(back.querySelectorAll('.th-pv-pane'),function(p){
      if(p.hidden)return;
      var w=p.querySelector('.th-fitw'), f=p.querySelector('.th-fit'), inner=f.firstElementChild;
      var nat=inner.offsetWidth, avail=p.clientWidth-36, k=Math.min(1,avail/nat);
      f.style.transform='scale('+k+')'; w.style.width=Math.round(nat*k)+'px'; w.style.height=Math.round(f.offsetHeight*k)+'px';
    });
  }
  back.querySelectorAll('[data-pv]').forEach(function(b){
    b.addEventListener('click',function(){
      back.querySelectorAll('[data-pv]').forEach(function(x){ var on=x===b; x.classList.toggle('on',on); x.setAttribute('aria-selected',on?'true':'false'); });
      back.querySelectorAll('.th-pv-pane').forEach(function(p){ p.hidden=p.dataset.pane!==b.dataset.pv; });
      fit();
    });
  });
  if(pvRs)window.removeEventListener('resize',pvRs);
  pvRs=function(){ if(!document.body.contains(back)){ window.removeEventListener('resize',pvRs); pvRs=null; return; } fit(); };
  window.addEventListener('resize',pvRs);
  fit(); setTimeout(fit,60);
  back.querySelectorAll('img').forEach(function(im){ if(!im.complete)im.addEventListener('load',fit,{once:true}); });
}

/* ── 마운트 ── */
function html(){
  var sw=swatch();
  return '<div class="th" id="th">'+
    '<section class="th-stage" aria-label="캔버스">'+
      '<div class="th-cv" id="thCv">'+
        '<canvas id="thCanvas" width="'+SIZE+'" height="'+SIZE+'" role="img" aria-label="썸네일 미리보기 1000×1000" tabindex="0"></canvas>'+
        '<div class="th-dz" id="thDz" role="button" tabindex="0" aria-label="이미지 등록"><div class="th-dz-in">'+ic('upload')+'<b>이미지를 놓거나 클릭</b><span>PNG · JPG · WebP · Ctrl+V 붙여넣기</span></div></div>'+
        '<input type="file" id="thFile" accept="image/*" hidden>'+
      '</div>'+
      '<div class="th-adj" id="thAdj" hidden>'+
        '<label for="thZoom">확대</label><input type="range" id="thZoom" min="1" max="3" step="0.01" value="1" aria-label="확대 배율">'+
        '<span class="th-zv num" id="thZv">1.00×</span>'+
        '<button type="button" class="ghost" id="thCenter">'+ic('center')+'가운데</button>'+
        '<button type="button" class="ghost" id="thReplace">'+ic('upload')+'이미지 바꾸기</button>'+
      '</div>'+
      '<div class="th-minis">'+
        '<figure><canvas id="thMini183" width="183" height="185" aria-label="메인 목록 크기 미리보기"></canvas><figcaption>메인 목록 183</figcaption></figure>'+
        '<figure><canvas id="thMini90" width="90" height="90" aria-label="프롤로그 크기 미리보기"></canvas><figcaption>프롤로그 90</figcaption></figure>'+
      '</div>'+
      '<ul class="th-chk" id="thChk" aria-live="polite"></ul>'+
    '</section>'+
    '<section class="th-ctl" aria-label="설정">'+
      '<div class="th-sec"><div class="th-st">디자인<span class="d" id="thPd"></span></div><div class="th-presets" id="thPresets" role="group" aria-label="디자인 프리셋">'+
        PRESETS.map(function(p){ return '<button type="button" class="th-preset'+(p.id===ST.preset?' on':'')+'" data-p="'+p.id+'" aria-pressed="'+(p.id===ST.preset)+'" title="'+esc(p.d)+'">'+
          '<canvas width="74" height="74" aria-hidden="true"></canvas><b>'+esc(p.n)+'</b></button>'; }).join('')+
      '</div></div>'+
      '<div class="th-sec">'+
        '<div class="th-st">문구</div>'+
        '<label class="th-lbl" for="thName"><span>타이틀 · 게임명</span><span class="th-cnt num" id="thNameCnt">0/6</span></label>'+
        '<input class="f-i" id="thName" maxlength="14" placeholder="예: 메이플키우기" autocomplete="off" value="'+esc(ST.name)+'">'+
        '<div class="th-row"><button type="button" class="chip'+(ST.subOn?' on':'')+'" id="thSubOn" aria-pressed="'+ST.subOn+'"><span class="dot"></span>부제</button>'+
          '<input class="f-i" id="thSub" maxlength="16" placeholder="예: 핑크빈 업데이트" autocomplete="off" aria-label="부제" value="'+esc(ST.sub)+'"'+(ST.subOn?'':' hidden')+'></div>'+
        '<div class="f-hint warn" id="thSubHint"'+(ST.subOn?'':' hidden')+'>'+ic('alert')+'<span>90px 프롤로그에서는 부제가 읽히지 않아요 · 표준은 부제 없음</span></div>'+
        '<label class="th-lbl" for="thTitle"><span>글 제목</span><span class="o">미리보기용</span></label>'+
        '<input class="f-i" id="thTitle" maxlength="80" placeholder="비우면 타이틀·부제로 채워요" autocomplete="off" value="'+esc(ST.title)+'">'+
      '</div>'+
      '<div class="th-sec th-two">'+
        '<div><div class="th-st">포인트 색</div><div class="th-sws" id="thSws" role="group" aria-label="포인트 색">'+
          SWATCHES.map(function(s){ return '<button type="button" class="th-sw'+(s.id===ST.accent?' on':'')+'" data-c="'+s.id+'" style="--c:'+s.c+'" aria-label="'+esc(s.n)+'" aria-pressed="'+(s.id===ST.accent)+'" title="'+esc(s.n)+' '+s.c+'"></button>'; }).join('')+
          '<span class="th-swn" id="thSwn">'+esc(sw.n)+'</span></div></div>'+
        '<div><label class="th-st" for="thFont">글꼴</label><select class="f-i" id="thFont">'+
          FONTS.map(function(f){ return '<option value="'+f.id+'"'+(f.id===ST.font?' selected':'')+'>'+esc(f.n)+'</option>'; }).join('')+'</select></div>'+
      '</div>'+
      '<div class="th-sec th-act">'+
        '<div class="th-act-r"><button type="button" class="ghost" id="thPreview">'+ic('eye')+'블로그 미리보기</button>'+
        '<button type="button" class="ghost" id="thCopy">'+ic('copy')+'클립보드 복사</button></div>'+
        '<div class="th-act-r"><div class="th-fn num" id="thFn"></div>'+
        '<button type="button" class="cta" id="thSave"><span>PNG 저장</span><span class="knob">'+ic('download')+'</span></button></div>'+
      '</div>'+
    '</section>'+
  '</div>';
}
var onPaste=null, onKey=null, drag=null;
function mount(host,a){
  api=a; root=host; mounted=true;
  if(!document.getElementById('thCss')){ var st=document.createElement('style'); st.id='thCss'; st.textContent=CSS; document.head.appendChild(st); }
  host.innerHTML=html();
  main=$('thCanvas'); mctx=main.getContext('2d');
  var dz=$('thDz'), file=$('thFile'), th=host.querySelector('.th');
  function pick(){ file.value=''; file.click(); }
  dz.addEventListener('click',pick);
  dz.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pick(); } });
  $('thReplace').addEventListener('click',pick);
  file.addEventListener('change',function(){ if(file.files&&file.files[0])loadFile(file.files[0]); });
  /* 드롭 — 도구 판 전체에서 받는다(캔버스 위든 설정 위든). 페이지 기본동작(파일 열림)은 판 안에서만 막는다 */
  ['dragenter','dragover'].forEach(function(t){ th.addEventListener(t,function(e){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; dz.classList.add('over'); }); });
  th.addEventListener('dragleave',function(e){ if(!th.contains(e.relatedTarget))dz.classList.remove('over'); });
  th.addEventListener('drop',function(e){ e.preventDefault(); dz.classList.remove('over');
    var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f)loadFile(f); });
  onPaste=function(e){
    var items=(e.clipboardData&&e.clipboardData.items)||[]; for(var i=0;i<items.length;i++){
      if(items[i].kind==='file'&&/^image\//.test(items[i].type)){ e.preventDefault(); loadFile(items[i].getAsFile()); return; } }
  };
  document.addEventListener('paste',onPaste);
  /* 이동 — 드래그(포인터)와 키보드(화살표, Shift=크게) */
  main.addEventListener('pointerdown',function(e){
    if(!ST.img)return; drag={x:e.clientX,y:e.clientY,px:ST.px,py:ST.py}; main.setPointerCapture(e.pointerId); main.classList.add('drag');
  });
  main.addEventListener('pointermove',function(e){
    if(!drag)return; var k=SIZE/main.clientWidth, g=geom();
    ST.px=clamp(drag.px+(e.clientX-drag.x)*k,-g.mx,g.mx); ST.py=clamp(drag.py+(e.clientY-drag.y)*k,-g.my,g.my); schedule();
  });
  function up(){ if(!drag)return; drag=null; main.classList.remove('drag'); paintTiles(); }
  main.addEventListener('pointerup',up); main.addEventListener('pointercancel',up);
  main.addEventListener('wheel',function(e){ if(!ST.img)return; e.preventDefault(); setZoom(ST.zoom*(e.deltaY<0?1.06:1/1.06)); },{passive:false});
  main.addEventListener('keydown',function(e){
    if(!ST.img)return; var step=e.shiftKey?60:12, g=geom(), h=true;
    if(e.key==='ArrowLeft')ST.px=clamp(ST.px+step,-g.mx,g.mx); else if(e.key==='ArrowRight')ST.px=clamp(ST.px-step,-g.mx,g.mx);
    else if(e.key==='ArrowUp')ST.py=clamp(ST.py+step,-g.my,g.my); else if(e.key==='ArrowDown')ST.py=clamp(ST.py-step,-g.my,g.my);
    else if(e.key==='+'||e.key==='=')setZoom(ST.zoom*1.06); else if(e.key==='-')setZoom(ST.zoom/1.06); else h=false;
    if(h){ e.preventDefault(); schedule(); paintTiles(); }
  });
  function setZoom(z){ ST.zoom=clamp(z,1,3); var g=geom(); ST.px=clamp(ST.px,-g.mx,g.mx); ST.py=clamp(ST.py,-g.my,g.my);
    $('thZoom').value=ST.zoom; $('thZv').textContent=ST.zoom.toFixed(2)+'×'; schedule(); paintTiles(); }
  $('thZoom').addEventListener('input',function(){ setZoom(parseFloat(this.value)||1); });
  $('thCenter').addEventListener('click',function(){ ST.px=0; ST.py=0; setZoom(1); });
  /* 프리셋·문구·색·글꼴 */
  $('thPresets').addEventListener('click',function(e){
    var b=e.target.closest('.th-preset'); if(!b)return; ST.preset=b.dataset.p; savePrefs();
    host.querySelectorAll('.th-preset').forEach(function(x){ var on=x===b; x.classList.toggle('on',on); x.setAttribute('aria-pressed',on?'true':'false'); });
    presetDesc(); schedule();
  });
  function presetDesc(){ var p=PRESETS.filter(function(x){ return x.id===ST.preset; })[0]; $('thPd').textContent=p?p.d:''; }
  presetDesc();
  var nameEl=$('thName'), cnt=$('thNameCnt');
  function syncCnt(){ var n=(ST.name||'').trim().length; cnt.textContent=n+'/6'; cnt.classList.toggle('bad',n>6); var fn=$('thFn'); if(fn&&ST.img)fn.textContent=fileName(); }
  nameEl.addEventListener('input',function(){ ST.name=this.value; syncCnt(); refreshAll(); });
  syncCnt();
  var subOn=$('thSubOn'), subEl=$('thSub'), subHint=$('thSubHint');
  subOn.addEventListener('click',function(){
    ST.subOn=!ST.subOn; savePrefs(); subOn.classList.toggle('on',ST.subOn); subOn.setAttribute('aria-pressed',ST.subOn?'true':'false');
    subEl.hidden=!ST.subOn; subHint.hidden=!ST.subOn; if(ST.subOn)subEl.focus(); refreshAll();
  });
  subEl.addEventListener('input',function(){ ST.sub=this.value; refreshAll(); });
  $('thTitle').addEventListener('input',function(){ ST.title=this.value; });
  $('thSws').addEventListener('click',function(e){
    var b=e.target.closest('.th-sw'); if(!b)return; ST.accent=b.dataset.c; savePrefs();
    host.querySelectorAll('.th-sw').forEach(function(x){ var on=x===b; x.classList.toggle('on',on); x.setAttribute('aria-pressed',on?'true':'false'); });
    $('thSwn').textContent=swatch().n; refreshAll();
  });
  $('thFont').addEventListener('change',function(){ ST.font=this.value; savePrefs(); loadFonts().then(refreshAll); refreshAll(); });
  $('thSave').addEventListener('click',save);
  $('thCopy').addEventListener('click',copyPng);
  $('thPreview').addEventListener('click',function(){ openPreview(this); });
  syncImageUI(); refreshAll();
  loadFonts().then(function(){ if(mounted)refreshAll(); });
}
function loadFonts(){
  if(!(document.fonts&&document.fonts.load))return Promise.resolve();
  var f=font(), t=(ST.name||'게임명')+(ST.sub||'')+'가나다';
  return Promise.all([document.fonts.load(f.w+' 165px '+f.fam,t),document.fonts.load(f.w+' 52px '+f.fam,t)]).then(function(){ fontsReady=true; }).catch(function(){});
}
function unmount(){
  mounted=false; if(raf){ cancelAnimationFrame(raf); raf=0; } clearTimeout(tileT);
  if(onPaste){ document.removeEventListener('paste',onPaste); onPaste=null; }
  if(pvRs){ window.removeEventListener('resize',pvRs); pvRs=null; }
  drag=null; root=null; main=null; mctx=null;
}

window.SseudamTools.thumb={
  mount:mount, unmount:unmount,
  /* 헤드리스 검증용 — 사용자 UI 와 무관 */
  __test:{ setImageURL:function(u,n){ return loadURL(u,n||'test'); }, state:function(){ return {img:!!ST.img,iw:ST.iw,ih:ST.ih,zoom:ST.zoom,px:ST.px,py:ST.py,preset:ST.preset,accent:ST.accent,font:ST.font,name:ST.name,sub:ST.sub,subOn:ST.subOn,fonts:fontsReady}; },
           paint:paint, fileName:fileName }
};
})();
