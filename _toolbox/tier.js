/*! 쓰담 도구함 · 티어표 제작 — 2026-09-07 · v1 「잉크 농도 보드」
 *  index.html 「도구함」 탭이 처음 고를 때 받아 window.SseudamTools.tier 로 등록한다({mount(host,api), unmount()}).
 *  무엇이 «흔한 티어표»(S빨강·A주황·B노랑 가로 띠 + 이름 없는 정사각 아이콘)와 다른가 — 설계 근거 = BlogPreview/DESIGN.md §Toolbox
 *    ① 무지개 색띠 대신 포인트 색 «하나»의 농도로 등급을 나타낸다 — 진할수록 강하다. 범례가 필요 없다.
 *    ② 이름 없는 아이콘 나열이 아니라 «초상 타일 + 이름» 카드다. 얼굴을 몰라도 읽힌다.
 *    ③ 티어 안의 순서가 보인다 — 전체 순위 번호(1…N)를 타일 모서리에 찍는다(끌 수 있다).
 *    ④ 티어마다 «한 줄»(왜 이 등급인가)과 보드 바닥의 «기준 스탬프»(패치·날짜·평가 주체)를 둔다 — 검증을 보여 준다.
 *    ⑤ 세로 보드(폭 1000·높이 자동) — 독자 대다수가 모바일이라 가로로 긴 티어표는 폰에서 읽히지 않는다.
 *    ⑥ 액자는 사이트와 같은 이중 베젤(트레이+코어) — 쓰담 산출물이라는 표식. 색은 :root 토큰을 읽어 쓴다.
 *  이미지는 «나중에 게임을 고르면 캐릭터 일러스트 크롭이 꽂히는 자리»다 — 지금은 드롭·붙여넣기·행 버튼으로 손수 넣고,
 *    없으면 이름 첫 글자(모노그램) 타일, 이름도 없으면 점선 빈 슬롯으로 그린다(= 양식).
 *  보드 위에서 직접 끌어 티어·순서를 바꾼다(마우스·펜). 터치는 탭=선택, 이동은 편집 열의 ▲▼·티어 선택(캔버스는 세로 스크롤을 뺏지 않는다).
 *  저장: 내용·디자인은 localStorage(sseudam_tier_v1), 이미지는 모듈 메모리(탭 전환엔 남고 새로고침엔 사라진다). 보드 JSON 저장/불러오기로 옮긴다.
 *  의존성 0. 캔버스는 CSS 변수를 못 쓰므로 마운트 때 :root 토큰을 한 번 읽어 둔다.
 */
(function(){
"use strict";
window.SseudamTools=window.SseudamTools||{};
if(window.SseudamTools.tier)return;

var W=1000, LS='sseudam_tier_v1';
/* 포인트 색 — 썸네일 도구와 같은 6색(봄딩 3 · 영도 3) + 기타(팔레트) */
var SWATCHES=[
  {id:'bd-rose',  c:'#C93C7C', n:'로즈', g:'봄딩'},
  {id:'bd-pink',  c:'#F58AB4', n:'핑크', g:'봄딩'},
  {id:'bd-plum',  c:'#2E2038', n:'플럼', g:'봄딩'},
  {id:'yd-green', c:'#15A05A', n:'그린', g:'영도'},
  {id:'yd-mint',  c:'#14B8A6', n:'민트', g:'영도'},
  {id:'yd-teal',  c:'#0F7C86', n:'틸',   g:'영도'}
];
/* 티어 단계 프리셋 — 글자·라벨만 바꾼다(항목은 자리 순서대로 남고, 줄어든 티어의 항목은 마지막 티어로 내려간다) */
var PRESETS=[
  {id:'s5', n:'S~D 5단계', t:[['S','최상위'],['A','강력'],['B','무난'],['C','아쉬움'],['D','비추천']], seed:[3,4,4,3,2]},
  {id:'s4', n:'S~C 4단계', t:[['S','최상위'],['A','강력'],['B','무난'],['C','아쉬움']], seed:[3,4,4,3]},
  {id:'g3', n:'1~3군',     t:[['1군','필수'],['2군','추천'],['3군','대체']], seed:[4,4,4]}
];
var COLS=[3,4,5,6], MAX_TIERS=7, MAX_ITEMS=200;
var UID=0;
function uid(){ return 'i'+(++UID); }

/* ── 상태: 탭을 떠났다 와도 남는다(모듈 메모리). 이미지는 IMG(메모리)에만. ── */
var ST={ title:'', sub:'', stamp:'', sign:'봄딩', tiers:[], accent:'bd-rose', accentHex:'#C93C7C', cols:4, rank:true, names:true, shape:'square' };
var IMG={};        /* id → {img,w,h,url} */
var sel=null;      /* 선택된 항목 id */
function mkTier(letter,label,note){ return {id:uid(),letter:letter||'',label:label||'',note:note||'',items:[]}; }
function mkItem(name){ return {id:uid(),name:name||''}; }
function str(v,max){ return typeof v==='string'?v.slice(0,max):''; }
function has(list,id){ return list.some(function(x){ return x.id===id; }); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function defaultBoard(){
  var p=PRESETS[0];
  ST.title=''; ST.sub=''; ST.stamp=''; ST.sign='봄딩';
  ST.tiers=p.t.map(function(d,i){ var tr=mkTier(d[0],d[1]); for(var k=0;k<p.seed[i];k++)tr.items.push(mkItem('')); return tr; });
}
/* 저장본·JSON 파일 → 상태. 검증해서 받는다(모르는 값은 기본값). withDesign=false 면 내용만(되돌리기용) */
function restoreData(sv,withDesign){
  var b=(sv&&sv.board)||{}, seen={};
  ST.title=str(b.title,40); ST.sub=str(b.sub,50); ST.stamp=str(b.stamp,50); ST.sign=str(b.sign,12);
  var tiers=[];
  (Array.isArray(b.tiers)?b.tiers:[]).slice(0,MAX_TIERS).forEach(function(t){
    if(!t||typeof t!=='object')return;
    var tr=mkTier(str(t.letter,3),str(t.label,8),str(t.note,30));
    if(typeof t.id==='string'&&/^i\d+$/.test(t.id)&&!seen[t.id]){ tr.id=t.id; seen[t.id]=1; }
    (Array.isArray(t.items)?t.items:[]).slice(0,MAX_ITEMS).forEach(function(it){
      if(!it||typeof it!=='object')return;
      var x=mkItem(str(it.name,14));
      if(typeof it.id==='string'&&/^i\d+$/.test(it.id)&&!seen[it.id]){ x.id=it.id; seen[it.id]=1; }
      tr.items.push(x);
    });
    tiers.push(tr);
  });
  Object.keys(seen).forEach(function(id){ var n=parseInt(id.slice(1),10); if(n>UID)UID=n; });
  if(tiers.length)ST.tiers=tiers;
  if(withDesign&&sv&&sv.design&&typeof sv.design==='object'){
    var d=sv.design;
    if(d.accent==='custom'||has(SWATCHES,d.accent))ST.accent=d.accent;
    if(/^#[0-9a-f]{6}$/i.test(d.accentHex||''))ST.accentHex=d.accentHex;
    if(COLS.indexOf(d.cols)>=0)ST.cols=d.cols;
    if(typeof d.rank==='boolean')ST.rank=d.rank;
    if(typeof d.names==='boolean')ST.names=d.names;
    if(d.shape==='square'||d.shape==='circle')ST.shape=d.shape;
  }
  if(sel&&!findItem(sel))sel=null;
}
function data(){
  return {app:'sseudam-tier',v:1,
    board:{title:ST.title,sub:ST.sub,stamp:ST.stamp,sign:ST.sign,
      tiers:ST.tiers.map(function(t){ return {id:t.id,letter:t.letter,label:t.label,note:t.note,items:t.items.map(function(i){ return {id:i.id,name:i.name}; })}; })},
    design:{accent:ST.accent,accentHex:ST.accentHex,cols:ST.cols,rank:ST.rank,names:ST.names,shape:ST.shape}};
}
try{ var sv0=JSON.parse(localStorage.getItem(LS)||'null'); if(sv0&&sv0.v===1)restoreData(sv0,true); }catch(e){}
if(!ST.tiers.length)defaultBoard();
var saveT=0;
function save(){ clearTimeout(saveT); saveT=setTimeout(function(){ try{ localStorage.setItem(LS,JSON.stringify(data())); }catch(e){} },250); }
/* 되돌리기(토스트 액션) — 내용 스냅샷 한 장. 이미지는 id 로 이어지므로 되살아난 항목의 그림도 돌아온다 */
function snapshot(){ return JSON.stringify(data()); }
function restore(snap){ try{ restoreData(JSON.parse(snap),false); }catch(e){ return; } renderAll(); save(); }
function findItem(id){
  for(var ti=0;ti<ST.tiers.length;ti++){ var t=ST.tiers[ti]; for(var i=0;i<t.items.length;i++)if(t.items[i].id===id)return {ti:ti,i:i,item:t.items[i],tier:t}; }
  return null;
}
function countItems(){ var n=0; ST.tiers.forEach(function(t){ n+=t.items.length; }); return n; }

/* ── 부품 ── */
var api=null, root=null, main=null, mctx=null, raf=0, mounted=false, LAY=null, HIT=[], drag=null, hover=null, onPaste=null, fontsReady=false;
function $(id){ return root?root.querySelector('#'+id):null; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var IC={
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2.4"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  up:'<path d="m18 15-6-6-6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  imgOff:'<path d="M10.4 3H19a2 2 0 0 1 2 2v8.6"/><path d="M21 21H5a2 2 0 0 1-2-2V5"/><path d="m21 15-5-5-3.5 3.5"/><path d="M2 2l20 20"/>',
  pipette:'<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  file:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  broom:'<path d="M3 21h18"/><path d="M5 21 9 9l6-6 6 6-12 12"/><path d="m9 9 6 6"/>'
};
function ic(n){ return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(IC[n]||'')+'</svg>'; }

/* :root 토큰 — 캔버스에서 쓰려고 한 번 읽는다(없으면 v5 기본값) */
var T={};
function readTokens(){
  var cs=getComputedStyle(document.documentElement);
  function tk(n,d){ var v=(cs.getPropertyValue(n)||'').trim(); return v||d; }
  T.ink=tk('--ink','#0E1114'); T.ink2=tk('--ink-2','#494F57'); T.ink3=tk('--ink-3','#5F666F'); T.ink4=tk('--ink-4','#6C737C');
  T.surface='#FFFFFF'; T.surface2=tk('--surface-2','#F6F7F9'); T.surface3=tk('--surface-3','#EFF1F4');
  T.tray=tk('--tray','#E5E7EB'); T.tray2=tk('--tray-2','#DFE2E6');
  T.hair=tk('--hair','rgba(14,17,20,.07)'); T.hair2=tk('--hair-2','rgba(14,17,20,.13)'); T.hair3=tk('--hair-3','rgba(14,17,20,.22)');
}
readTokens();

var CSS=
'.tier{display:grid;grid-template-columns:minmax(300px,420px) minmax(0,1fr);grid-template-rows:auto 1fr;grid-template-areas:"stage ctl" "act ctl"}'+
'.tier-stage{grid-area:stage;padding:18px 18px 4px;min-width:0}'+
'.tier-ctl{grid-area:ctl;padding:4px 18px 10px;min-width:0;border-left:1px solid var(--hair)}'+
'.tier-cv{position:relative;border-radius:14px}'+
'.tier-cv canvas{display:block;width:100%;height:auto;touch-action:pan-y;cursor:default;border-radius:12px}'+   /* pan-y: 긴 보드 위에서도 페이지가 세로로 흐른다. 끌기는 마우스·펜 */
'.tier-cv canvas.grab{cursor:grab}.tier-cv canvas.drag{cursor:grabbing}.tier-cv canvas.add{cursor:pointer}'+
'.tier-cv canvas:focus-visible{outline:2px solid var(--ink);outline-offset:2px}'+
'.tier-cv.over{outline:2px solid var(--ink);outline-offset:4px}'+
'.tier-chk{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;min-width:0}'+
'.tier-chk li{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;line-height:1.45;color:var(--ink-2);white-space:nowrap;word-break:keep-all}'+
'.tier-chk li .ic{width:14px;height:14px;flex:none;color:var(--ink-3)}'+
'.tier-chk li.bad{color:var(--alert)}.tier-chk li.bad .ic{color:var(--alert)}'+
'.tier-chk li b{font-weight:600;color:inherit}'+
'.tier-sec{padding:12px 0 14px;border-top:1px solid var(--hair)}.tier-sec:first-child{border-top:0;padding-top:14px}'+
'.tier-st{font-size:13.5px;font-weight:700;letter-spacing:-.025em;margin-bottom:10px;display:flex;align-items:center;gap:8px}'+
'.tier-st .d{font-size:12.5px;font-weight:500;color:var(--ink-3)}'+
'.tier-lbl{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12.5px;font-weight:600;color:var(--ink-2);margin:10px 0 5px}'+
'.tier-lbl:first-of-type{margin-top:0}'+
'.tier-lbl .o{font-weight:500;color:var(--ink-3)}'+
'.tier-cnt{font-size:12.5px;font-weight:500;color:var(--ink-3)}.tier-cnt.bad{color:var(--alert);font-weight:600}'+
'.tier-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 10px}'+
'.tier-2 .tier-lbl{margin-top:10px}'+
'.tier-chips{display:flex;flex-wrap:wrap;gap:6px}'+   /* 칩은 사이트 기본(.chip 32px·13px) 그대로 — 30px 별도 스케일은 게이트 🟡(09-07) */
/* 티어 행 = 농도 점 · 글자 · 라벨 · 한 줄 · 삭제. 행 간격 8 = 삭제 버튼 히트존(28+12) 세로 피치 40 → 겹침 0 */
'.tier-rows{display:flex;flex-direction:column;gap:8px;margin-top:10px}'+
'.tier-row{display:grid;grid-template-columns:12px 46px 74px minmax(0,1fr) 28px;gap:6px;align-items:center}'+
'.tier-dot{width:12px;height:12px;border-radius:4px;background:var(--c);box-shadow:inset 0 0 0 1px rgba(14,17,20,.12);flex:none}'+
'.tier-in{height:32px;padding:0 9px;border:0;outline:0;border-radius:9px;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);font:inherit;font-size:13px;letter-spacing:-.02em;color:var(--ink);min-width:0;width:100%;'+
  'transition:box-shadow var(--t-fast) var(--e),background var(--t-fast) var(--e)}'+
'.tier-in:focus{box-shadow:0 0 0 2px var(--ink);background:var(--surface)}'+   /* 포커스 링 전역 2px 잉크(09-06 사용자 지시) */
'.tier-in::placeholder{color:var(--ink-3)}'+
'.tier-in-l{font-weight:700;text-align:center;padding:0 4px}'+
'.tier-ib{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--ink-3);position:relative;'+
  'transition:background var(--t-fast) var(--e),color var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.tier-ib::after{content:"";position:absolute;inset:-6px}'+   /* 보이는 건 28, 누르는 자리는 40 */
'.tier-ib .ic{width:14px;height:14px}'+
'.tier-ib:hover{background:var(--surface-2);color:var(--ink)}.tier-ib:active{transform:scale(.9)}'+
'.tier-ib:disabled{opacity:.3;cursor:default;transform:none;background:none}'+
'.tier-add{margin-top:10px}'+
/* 항목 */
'.tier-new{display:grid;grid-template-columns:66px minmax(0,1fr) auto;gap:6px;align-items:center}'+
'.tier-sel{height:32px;padding:0 22px 0 8px;border:0;outline:0;border-radius:9px;background-color:var(--surface-2);box-shadow:0 0 0 1px var(--hair);font:inherit;font-size:12.5px;font-weight:600;color:var(--ink);'+
  'appearance:none;-webkit-appearance:none;cursor:pointer;min-width:0;width:100%;'+
  'background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23767D87\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'m6 9 6 6 6-6\'/></svg>");'+
  'background-repeat:no-repeat;background-position:right 7px center;transition:box-shadow var(--t-fast) var(--e),background-color var(--t-fast) var(--e)}'+
'.tier-sel:focus{box-shadow:0 0 0 2px var(--ink);background-color:var(--surface)}'+
'.tier-list{display:flex;flex-direction:column;gap:4px;margin-top:6px}'+
'.tier-gh{display:flex;align-items:center;gap:7px;margin:10px 0 3px;font-size:12.5px;font-weight:700;color:var(--ink-2);letter-spacing:-.02em}'+
'.tier-gh:first-child{margin-top:8px}'+
'.tier-gh .tier-dot{width:10px;height:10px;border-radius:3px}'+
'.tier-gh .o{font-weight:500;color:var(--ink-3)}'+
'.tier-gh .n{margin-left:auto;font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:500;color:var(--ink-3);font-size:12.5px;font-variant-numeric:tabular-nums}'+
'.tier-it{display:grid;grid-template-columns:32px minmax(0,1fr) 62px auto;gap:4px;align-items:center;padding:2px;border-radius:10px;'+
  'transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e)}'+
/* 아이콘 버튼 무리 — 간격 12 = 히트존(28+6+6=40)끼리 정확히 맞닿고 겹치지 않는다(4px 이면 8px 겹쳐 up 안쪽 1px 클릭이 down 으로 갔다 — 게이트 🟡 09-07) */
'.tier-ibs{display:inline-flex;align-items:center;gap:12px;padding-left:2px}'+
'.tier-it.sel{background:var(--surface-2);box-shadow:0 0 0 1px var(--hair-2)}'+
'.tier-it .tier-in{background:var(--surface);box-shadow:0 0 0 1px var(--hair)}.tier-it .tier-in:focus{box-shadow:0 0 0 2px var(--ink)}'+
'.tier-it .tier-sel{background-color:var(--surface)}'+
'.tier-th{width:32px;height:32px;border-radius:9px;overflow:hidden;display:grid;place-items:center;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);color:var(--ink-3);font-size:13px;font-weight:700;'+
  'transition:box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.tier-th img{width:100%;height:100%;object-fit:cover;display:block}'+
'.tier-th .ic{width:14px;height:14px}'+
'.tier-th:hover{box-shadow:0 0 0 2px var(--ink)}.tier-th:active{transform:scale(.94)}'+
'.tier-th.circle{border-radius:50%}'+
'.tier-empty{padding:12px 4px 4px;font-size:12.5px;color:var(--ink-3)}'+
/* 색 — 그룹 라벨 + 원 스와치 + 「기타」(팔레트) + 농도 띠 */
'.tier-crow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:34px}'+
'.tier-sgp{display:inline-flex;align-items:center;gap:7px}'+
'.tier-sg{font-size:12.5px;font-weight:600;color:var(--ink-3);margin:0 1px 0 4px}.tier-sgp:first-child .tier-sg{margin-left:0}'+
'.tier-sw{width:28px;height:28px;border-radius:50%;background:var(--c);flex:none;position:relative;box-shadow:inset 0 0 0 1px rgba(14,17,20,.14);'+
  'transition:transform var(--t-fast) var(--e-out),box-shadow var(--t-fast) var(--e)}'+
'.tier-sw::after{content:"";position:absolute;inset:-7px}'+
'.tier-sw:hover{transform:scale(1.08)}'+
'.tier-sw.on{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink)}'+
'.tier-sw:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.tier-sw.custom{background:conic-gradient(from 200deg,#C93C7C,#E3B75E,#15A05A,#0F7C86,#7C5BC7,#C93C7C);display:grid;place-items:center;color:#fff}'+
'.tier-sw.custom .ic{width:13px;height:13px;stroke-width:2;filter:drop-shadow(0 0 1px rgba(0,0,0,.6))}'+
'.tier-sw.custom.has{background:var(--cc)}'+
'.tier-swn{flex-basis:100%;margin-top:2px;font-size:12.5px;color:var(--ink-2);font-weight:600}'+
'.tier-swn .num{font-weight:500;color:var(--ink-3);margin-left:4px}'+
'.tier-pick{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}'+
'.tier-ramp{display:flex;gap:4px;margin-top:8px}'+
'.tier-ramp span{flex:1;height:10px;border-radius:3px;background:var(--c);box-shadow:inset 0 0 0 1px rgba(14,17,20,.08)}'+
/* 내보내기 — 캔버스 아래(설정 열이 길어도 CTA 가 안 밀리게, 썸네일 도구와 같은 자리) */
'.tier-act{grid-area:act;display:flex;flex-direction:column;gap:10px;margin:14px 18px 0;padding:14px 0 18px;border-top:1px solid var(--hair)}'+
'.tier-act-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'+
'.tier-act .cta{margin-left:auto}'+
'.tier-act .ghost .ic,.tier-act .cta .ic{width:14px;height:14px}'+
'.tier-fn{flex:1 1 120px;min-width:0;font-size:12.5px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'@media (max-width:860px){'+
  '.tier{grid-template-columns:1fr;grid-template-rows:auto auto auto;grid-template-areas:"stage" "ctl" "act"}'+
  '.tier-stage{padding:14px 14px 4px;border-bottom:1px solid var(--hair)}.tier-ctl{padding:0 14px 14px;border-left:0}'+
  '.tier-act{margin:0 14px;padding:14px 0 14px}.tier-act .cta{margin-left:0;width:100%;justify-content:space-between}'+
'}';

/* ── 색 유틸 ── */
function hexRGB(hex){ var n=parseInt(hex.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
function lum(hex){ var c=hexRGB(hex).map(function(v){ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; }
/* 흰 바탕에 a 만큼 얹은 색 — «농도». 알파가 아니라 실색으로 만들어 글자색 판단(luminance)까지 같은 값으로 한다 */
function blend(hex,a){ var c=hexRGB(hex); function m(v){ var s=Math.round(v*a+255*(1-a)).toString(16); return s.length<2?'0'+s:s; } return '#'+m(c[0])+m(c[1])+m(c[2]); }
function tierAlpha(i,n){ return n<=1?1:1-(i/(n-1))*.86; }   /* 1.0 → 0.14 등간 */
function accentHex(){ if(ST.accent==='custom')return ST.accentHex; for(var i=0;i<SWATCHES.length;i++)if(SWATCHES[i].id===ST.accent)return SWATCHES[i].c; return SWATCHES[0].c; }
function accentName(){ if(ST.accent==='custom')return {n:'기타',g:'',hex:ST.accentHex}; for(var i=0;i<SWATCHES.length;i++)if(SWATCHES[i].id===ST.accent)return {n:SWATCHES[i].n,g:SWATCHES[i].g,hex:SWATCHES[i].c}; return {n:'',g:'',hex:''}; }
function safeName(s){ return String(s||'').replace(/[\\\/:*?"<>|]/g,'').replace(/\s+/g,'_').slice(0,40); }
function fileName(){ return (safeName(ST.title)||'티어표')+'_1000x'+(LAY?LAY.H:0)+'.png'; }

/* ── 치수(캔버스 px) ── */
var M={tray:10,rTray:28,padX:36,padT:34,padB:30,plW:112,plR:20,gapPl:26,gapX:18,gapY:22,bandT:24,bandB:24,nameGap:10,plMin:150,titleFs:44,titleLh:54,subFs:24};
var FAM='"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
var MONO='"JetBrains Mono",ui-monospace,Consolas,monospace';
function F(w,px,mono){ return w+' '+px+'px '+(mono?MONO:FAM); }
function tileSize(){ var iw=W-2*M.tray-2*M.padX-M.plW-M.gapPl; return Math.floor((iw-(ST.cols-1)*M.gapX)/ST.cols); }
function nameFs(t){ return clamp(Math.round(t*.19),26,40); }
function rrect(ctx,x,y,w,h,r){ r=Math.max(0,Math.min(r,w/2,h/2)); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function shapePath(ctx,x,y,s,r){ if(ST.shape==='circle'){ ctx.beginPath(); ctx.arc(x+s/2,y+s/2,s/2,0,Math.PI*2); ctx.closePath(); } else rrect(ctx,x,y,s,s,r); }
function tileR(s){ return ST.shape==='circle'?s/2:Math.round(s*.14); }
function ell(ctx,s,maxW){ if(ctx.measureText(s).width<=maxW)return s; var a=Array.from(s); while(a.length>1){ a.pop(); var t=a.join('')+'…'; if(ctx.measureText(t).width<=maxW)return t; } return '…'; }
/* 어절 단위 줄바꿈(keep-all), 어절이 너무 길면 글자 단위. maxLines 넘치면 마지막 줄을 …으로 */
function wrap(ctx,s,maxW,maxLines){
  var words=s.split(/\s+/).filter(Boolean), lines=[], cur='';
  function push(){ if(cur){ lines.push(cur); cur=''; } }
  words.forEach(function(w){
    var t=cur?cur+' '+w:w;
    if(ctx.measureText(t).width<=maxW){ cur=t; return; }
    push();
    if(ctx.measureText(w).width<=maxW){ cur=w; return; }
    var buf=''; Array.from(w).forEach(function(ch){ if(ctx.measureText(buf+ch).width<=maxW)buf+=ch; else { lines.push(buf); buf=ch; } }); cur=buf;
  });
  push();
  if(!lines.length)lines=[''];
  if(lines.length>maxLines){ lines=lines.slice(0,maxLines); lines[maxLines-1]=ell(ctx,lines[maxLines-1]+'…',maxW); }
  return lines;
}
function letterFs(ctx,s,maxW){ var a=Array.from(s).length, fs=a<=1?62:(a===2?50:40); for(;fs>24;fs-=2){ ctx.font=F(800,fs); ctx.letterSpacing=(-fs*.03)+'px'; if(ctx.measureText(s).width<=maxW)break; } return fs; }

/* 배치 — 먼저 재고(layout) 나중에 그린다(draw). 메인·내보내기가 같은 함수를 쓴다 */
function layout(ctx){
  var tile=tileSize(), nfs=nameFs(tile), rowH=tile+(ST.names?M.nameGap+Math.round(nfs*1.25):0);
  var x0=M.tray+M.padX, innerW=W-2*(M.tray+M.padX), y=M.tray+M.padT;
  var title=(ST.title||'').trim()||'티어표', sub=(ST.sub||'').trim();
  ctx.font=F(800,M.titleFs); ctx.letterSpacing=(-M.titleFs*.03)+'px';
  var lines=wrap(ctx,title,innerW,2);
  var hd={y:y,lines:lines,sub:sub};
  y+=lines.length*M.titleLh; if(sub)y+=8+Math.round(M.subFs*1.3); y+=22;
  hd.h=y-hd.y;
  var bands=[], rank=0;
  ST.tiers.forEach(function(t,ti){
    var by=y+1, cy=by+M.bandT, itemsX=x0+M.plW+M.gapPl, itemsW=innerW-M.plW-M.gapPl;
    var note=(t.note||'').trim(), noteH=note?40:0;
    var rows=Math.max(1,Math.ceil(t.items.length/ST.cols)), tilesY=cy+noteH;
    var blockH=t.items.length?rows*rowH+(rows-1)*M.gapY:tile;
    var contentH=Math.max(noteH+blockH,M.plMin);
    var tiles=t.items.map(function(it,i){ var r=Math.floor(i/ST.cols), c=i%ST.cols; return {id:it.id,ti:ti,i:i,x:itemsX+c*(tile+M.gapX),y:tilesY+r*(rowH+M.gapY),w:tile,h:tile,rank:++rank}; });
    bands.push({ti:ti,y:by,h:M.bandT+contentH+M.bandB,pl:{x:x0,y:cy,w:M.plW,h:contentH},note:note,noteY:cy,itemsX:itemsX,itemsW:itemsW,tilesY:tilesY,tiles:tiles,rowH:rowH,tile:tile});
    y=by+M.bandT+contentH+M.bandB;
  });
  var stamp=(ST.stamp||'').trim(), sign=(ST.sign||'').trim(), ft=null;
  if(stamp||sign){ ft={y:y,stamp:stamp,sign:sign,h:64}; y+=ft.h; }
  y+=M.padB+M.tray;
  return {H:Math.max(Math.round(y),320),tile:tile,nfs:nfs,rowH:rowH,x0:x0,innerW:innerW,hd:hd,bands:bands,ft:ft};
}
function drawEmptySlot(ctx,x,y,s){
  var r=tileR(s); ctx.save();
  ctx.setLineDash([12,9]); ctx.strokeStyle=T.hair3; ctx.lineWidth=2.5; shapePath(ctx,x+1.25,y+1.25,s-2.5,Math.max(0,r-1)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle=T.ink4; ctx.lineWidth=3; ctx.lineCap='round'; var c=s/2, l=s*.1;
  ctx.beginPath(); ctx.moveTo(x+c-l,y+c); ctx.lineTo(x+c+l,y+c); ctx.moveTo(x+c,y+c-l); ctx.lineTo(x+c,y+c+l); ctx.stroke();
  ctx.restore();
}
/* 타일 = 그림(cover 크롭) / 모노그램(이름 첫 글자) / 빈 슬롯(점선) + 순위 배지 + 이름 */
function drawTile(ctx,tl,it,L,a,acc,selected){
  var x=tl.x, y=tl.y, s=tl.w, r=tileR(s), im=IMG[it.id], name=(it.name||'').trim();
  ctx.save();
  if(im){
    ctx.save(); shapePath(ctx,x,y,s,r); ctx.clip();
    var k=Math.max(s/im.w,s/im.h), dw=im.w*k, dh=im.h*k;
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    try{ ctx.drawImage(im.img,x+(s-dw)/2,y+(s-dh)/2,dw,dh); }catch(e){}
    ctx.restore();
    ctx.strokeStyle=blend(acc,Math.max(.22,a)); ctx.lineWidth=4; shapePath(ctx,x+2,y+2,s-4,Math.max(0,r-2)); ctx.stroke();
  }else if(name){
    ctx.fillStyle=T.surface2; shapePath(ctx,x,y,s,r); ctx.fill();
    ctx.strokeStyle=T.hair2; ctx.lineWidth=1.5; shapePath(ctx,x+.75,y+.75,s-1.5,Math.max(0,r-.75)); ctx.stroke();
    ctx.fillStyle=T.ink3; ctx.font=F(700,Math.round(s*.36)); ctx.letterSpacing='0px'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(Array.from(name)[0],x+s/2,y+s/2+s*.02);
    ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  }else drawEmptySlot(ctx,x,y,s);
  if(ST.rank){
    var br=clamp(Math.round(s*.12),15,24), bx=x+br+Math.round(s*.05), by=y+br+Math.round(s*.05);
    ctx.fillStyle=T.ink; ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#FFFFFF'; ctx.font=F(600,Math.round(br*1.05),true); ctx.letterSpacing='0px'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(String(tl.rank),bx,by+1); ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  }
  if(ST.names&&name){
    ctx.fillStyle=T.ink; ctx.font=F(700,L.nfs); ctx.letterSpacing=(-L.nfs*.02)+'px'; ctx.textAlign='center';
    ctx.fillText(ell(ctx,name,s+12),x+s/2,y+s+M.nameGap+Math.round(L.nfs*.95)); ctx.textAlign='left';
  }
  if(selected){   /* 화면에만 — 내보내기엔 없다 */
    ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=8; shapePath(ctx,x-4,y-4,s+8,r+4); ctx.stroke();
    ctx.strokeStyle=T.ink; ctx.lineWidth=4; shapePath(ctx,x-4,y-4,s+8,r+4); ctx.stroke();
  }
  ctx.restore();
}
function drawGhost(ctx,d,L,acc){
  var f=findItem(d.id); if(!f)return;
  var s=L.tile, tl={x:d.px-d.dx,y:d.py-d.dy,w:s,h:s,rank:d.rank,i:0};
  ctx.save(); ctx.globalAlpha=.94;
  ctx.shadowColor='rgba(14,17,20,.3)'; ctx.shadowBlur=34; ctx.shadowOffsetY=14;
  ctx.fillStyle='#FFFFFF'; shapePath(ctx,tl.x,tl.y,s,tileR(s)); ctx.fill();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  drawTile(ctx,tl,f.item,L,tierAlpha(f.ti,ST.tiers.length),acc,false);
  ctx.restore();
}
function draw(ctx,L,o){
  o=o||{};
  var acc=accentHex(), n=ST.tiers.length;
  ctx.save(); ctx.clearRect(0,0,W,L.H);
  /* 트레이 → 코어(이중 베젤, 동심 반경) */
  var g=ctx.createLinearGradient(0,0,0,L.H); g.addColorStop(0,T.tray); g.addColorStop(1,T.tray2);
  ctx.fillStyle=g; rrect(ctx,0,0,W,L.H,M.rTray); ctx.fill();
  ctx.strokeStyle=T.hair; ctx.lineWidth=1; rrect(ctx,.5,.5,W-1,L.H-1,M.rTray); ctx.stroke();
  ctx.fillStyle=T.surface; rrect(ctx,M.tray,M.tray,W-2*M.tray,L.H-2*M.tray,M.rTray-M.tray); ctx.fill();
  /* 머리 */
  ctx.fillStyle=T.ink; ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  ctx.font=F(800,M.titleFs); ctx.letterSpacing=(-M.titleFs*.03)+'px';
  var ty=L.hd.y+Math.round(M.titleFs*.9);
  L.hd.lines.forEach(function(s,i){ ctx.fillText(s,L.x0,ty+i*M.titleLh); });
  if(L.hd.sub){ ctx.font=F(500,M.subFs); ctx.letterSpacing=(-M.subFs*.02)+'px'; ctx.fillStyle=T.ink3; ctx.fillText(ell(ctx,L.hd.sub,L.innerW),L.x0,ty+(L.hd.lines.length-1)*M.titleLh+8+Math.round(M.subFs*1.25)); }
  /* 티어 띠 */
  L.bands.forEach(function(b){
    var t=ST.tiers[b.ti], a=tierAlpha(b.ti,n), fill=blend(acc,a), lc=lum(fill)<.42?'#FFFFFF':T.ink;
    ctx.fillStyle=T.hair2; ctx.fillRect(L.x0,b.y-1,L.innerW,1);
    ctx.fillStyle=fill; rrect(ctx,b.pl.x,b.pl.y,b.pl.w,b.pl.h,M.plR); ctx.fill();
    if(a<.35){ ctx.strokeStyle=T.hair2; ctx.lineWidth=1.5; rrect(ctx,b.pl.x+.75,b.pl.y+.75,b.pl.w-1.5,b.pl.h-1.5,M.plR); ctx.stroke(); }
    var letter=(t.letter||'').trim()||'?', lfs=letterFs(ctx,letter,b.pl.w-18);
    ctx.fillStyle=lc; ctx.textAlign='center'; ctx.font=F(800,lfs); ctx.letterSpacing=(-lfs*.03)+'px';
    var cx=b.pl.x+b.pl.w/2, ly=b.pl.y+22+Math.round(lfs*.82);
    ctx.fillText(letter,cx,ly);
    var label=(t.label||'').trim();
    if(label){ ctx.font=F(600,22); ctx.letterSpacing='-0.4px'; ctx.globalAlpha=.92; ctx.fillText(ell(ctx,label,b.pl.w-16),cx,ly+34); ctx.globalAlpha=1; }
    ctx.font=F(600,20,true); ctx.letterSpacing='0px'; ctx.globalAlpha=.72; ctx.fillText(String(t.items.length),cx,b.pl.y+b.pl.h-18); ctx.globalAlpha=1;
    ctx.textAlign='left';
    if(b.note){ ctx.fillStyle=T.ink2; ctx.font=F(600,24); ctx.letterSpacing='-0.5px'; ctx.fillText(ell(ctx,b.note,b.itemsW),b.itemsX,b.noteY+26); }
    b.tiles.forEach(function(tl){
      var it=t.items[tl.i], ghost=o.drag&&o.drag.moved&&o.drag.id===it.id;
      ctx.globalAlpha=ghost?.35:1;
      drawTile(ctx,tl,it,L,a,acc,!o.export&&o.sel===it.id&&!ghost);
      ctx.globalAlpha=1;
    });
    if(!t.items.length)drawEmptySlot(ctx,b.itemsX,b.tilesY,b.tile);
  });
  /* 바닥 — 기준 스탬프 · 서명 */
  if(L.ft){
    ctx.fillStyle=T.hair2; ctx.fillRect(L.x0,L.ft.y,L.innerW,1);
    var fy=L.ft.y+20+24;
    if(L.ft.stamp){ ctx.fillStyle=T.ink3; ctx.font=F(500,23); ctx.letterSpacing='-0.3px'; ctx.textAlign='left'; ctx.fillText(ell(ctx,L.ft.stamp,L.innerW*.62),L.x0,fy); }
    if(L.ft.sign){
      ctx.font=F(700,24); ctx.letterSpacing='-0.5px'; ctx.textAlign='right'; ctx.fillStyle=T.ink;
      var sw=ctx.measureText(L.ft.sign).width; ctx.fillText(L.ft.sign,L.x0+L.innerW,fy);
      ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(L.x0+L.innerW-sw-16,fy-8,6,0,Math.PI*2); ctx.fill(); ctx.textAlign='left';
    }
  }
  if(o.drag&&o.drag.moved&&o.drag.target){ var mk=o.drag.target.mk; ctx.fillStyle=T.ink; rrect(ctx,mk.x,mk.y,5,mk.h,2.5); ctx.fill(); }
  if(o.drag&&o.drag.moved)drawGhost(ctx,o.drag,L,acc);
  ctx.restore();
}

/* ── 렌더 파이프 ── */
function paint(){
  if(!mounted||!main)return;
  LAY=layout(mctx);
  if(main.height!==LAY.H)main.height=LAY.H;
  draw(mctx,LAY,{sel:sel,drag:drag});
  HIT=[]; LAY.bands.forEach(function(b){ b.tiles.forEach(function(t){ HIT.push(t); }); });
  checks();
  var fn=$('tiFn'); if(fn)fn.textContent=fileName();
}
function schedule(){ if(raf)return; raf=requestAnimationFrame(function(){ raf=0; paint(); }); }
function exportCanvas(){ var c=document.createElement('canvas'); c.width=W; var x=c.getContext('2d'); var L=layout(x); c.height=L.H; draw(x,L,{export:true}); return c; }
function toBlob(){ return new Promise(function(res){ exportCanvas().toBlob(function(b){ res(b); },'image/png'); }); }
/* 검사 — 폰 표시 크기는 «1000px 그림이 네이버 모바일 본문(≈350px)에 놓일 때» 기준(1000→350 = ×0.35) */
function checks(){
  var ul=$('tiChk'); if(!ul||!LAY)return;
  var n=0, noImg=0, noName=0;
  ST.tiers.forEach(function(t){ t.items.forEach(function(i){ n++; if(!IMG[i.id])noImg++; if(!(i.name||'').trim())noName++; }); });
  var rows=[{ok:n>0,t:'항목 <b>'+n+'</b> · 티어 <b>'+ST.tiers.length+'</b>'}];
  if(n)rows.push(noImg?{ok:false,t:'이미지 없는 항목 <b>'+noImg+'</b>'+(noImg===n?' · 양식 상태':'')}:{ok:true,t:'이미지 전부 있음'});
  if(noName)rows.push({ok:false,t:'빈 슬롯 <b>'+noName+'</b>'});
  if(ST.names){ var ph=Math.round(LAY.nfs*.35*10)/10; rows.push({ok:ph>=10,t:'폰에서 이름 ≈ <b>'+ph+'px</b>'+(ph<10?' · 한 줄 수를 줄이세요':'')}); }
  rows.push({ok:LAY.H<=3200,t:'<b>1000×'+LAY.H+'</b>'+(LAY.H>3200?' · 길어요, 나눠 올리기':'')});
  ul.innerHTML=rows.map(function(r){ return '<li class="'+(r.ok?'':'bad')+'">'+ic(r.ok?'check':'alert')+'<span>'+r.t+'</span></li>'; }).join('');
}

/* ── 이미지 ── */
function setImageURL(id,url,keepUrl){
  return new Promise(function(res,rej){
    var im=new Image(); im.decoding='async';
    im.onload=function(){
      var old=IMG[id]; if(old&&old.url&&old.blob)try{ URL.revokeObjectURL(old.url); }catch(e){}
      IMG[id]={img:im,w:im.naturalWidth,h:im.naturalHeight,url:url,blob:!!keepUrl};
      renderList(); schedule(); res(im);
    };
    im.onerror=function(){ if(keepUrl)try{ URL.revokeObjectURL(url); }catch(e){} rej(new Error('img')); };
    im.src=url;
  });
}
function setImageFile(id,f){
  if(!f||!/^image\//.test(f.type)){ if(api)api.toast('이미지 파일만 넣을 수 있어요',{kind:'err'}); return Promise.reject(new Error('type')); }
  return setImageURL(id,URL.createObjectURL(f),true).catch(function(){ if(api)api.toast('이미지를 읽지 못했어요',{kind:'err'}); });
}
function clearImage(id){ var im=IMG[id]; if(!im)return; if(im.blob)try{ URL.revokeObjectURL(im.url); }catch(e){} delete IMG[id]; renderList(); schedule(); }
function fileBase(f){ return String(f&&f.name||'').replace(/\.[a-z0-9]+$/i,'').replace(/[_\-]+/g,' ').trim().slice(0,14); }
/* 파일 여러 개 → 첫 파일은 «그 자리»(타일 위면 그 항목·아니면 새 항목), 나머지는 같은 티어에 새 항목으로 이어 붙인다 */
function takeFiles(files,ti,idx,onTileId){
  var list=Array.prototype.slice.call(files||[]).filter(function(f){ return /^image\//.test(f.type); });
  var json=Array.prototype.slice.call(files||[]).filter(function(f){ return /json$/i.test(f.type)||/\.json$/i.test(f.name); })[0];
  if(json){ loadJsonFile(json); return; }
  if(!list.length){ if(api)api.toast('이미지 파일만 넣을 수 있어요',{kind:'err'}); return; }
  if(countItems()+list.length-(onTileId?1:0)>MAX_ITEMS){ if(api)api.toast('항목은 최대 '+MAX_ITEMS+'개까지예요',{kind:'err'}); return; }
  var tier=ST.tiers[clamp(ti,0,ST.tiers.length-1)], at=idx;
  if(onTileId){ setImageFile(onTileId,list[0]); var f0=findItem(onTileId); at=f0?f0.i+1:tier.items.length; list=list.slice(1); tier=f0?f0.tier:tier; }
  if(at==null||at>tier.items.length)at=tier.items.length;
  var ids=[];
  list.forEach(function(f,k){ var it=mkItem(fileBase(f)); tier.items.splice(at+k,0,it); ids.push([it.id,f]); });
  if(ids.length){ sel=ids[ids.length-1][0]; renderAll(); save(); ids.forEach(function(p){ setImageFile(p[0],p[1]); }); }
}

/* ── 편집(내용) ── */
function addNames(ti,text){
  var names=String(text||'').split(/[,\n、]/).map(function(s){ return s.trim().slice(0,14); });
  if(names.length>1)names=names.filter(Boolean);
  if(!names.length)names=[''];
  if(countItems()+names.length>MAX_ITEMS){ api.toast('항목은 최대 '+MAX_ITEMS+'개까지예요',{kind:'err'}); return []; }
  var tier=ST.tiers[clamp(ti,0,ST.tiers.length-1)], ids=[];
  names.forEach(function(nm){ var it=mkItem(nm); tier.items.push(it); ids.push(it.id); });
  sel=ids[ids.length-1]; renderAll(); save();
  return ids;
}
function moveItem(id,ti,idx){
  var f=findItem(id); if(!f)return false;
  ti=clamp(ti,0,ST.tiers.length-1);
  var target=ST.tiers[ti];
  if(idx==null||idx>target.items.length)idx=target.items.length;
  if(f.ti===ti&&idx>f.i)idx-=1;
  if(f.ti===ti&&idx===f.i)return false;
  f.tier.items.splice(f.i,1); target.items.splice(idx,0,f.item);
  return true;
}
function removeItem(id){
  var f=findItem(id); if(!f)return;
  var snap=snapshot();
  f.tier.items.splice(f.i,1); if(sel===id)sel=null;
  renderAll(); save();
  api.toast((f.item.name||'빈 슬롯')+' 삭제',{action:'되돌리기',onAction:function(){ restore(snap); }});
}
function addTier(){
  if(ST.tiers.length>=MAX_TIERS){ api.toast('티어는 최대 '+MAX_TIERS+'단계예요',{kind:'err'}); return; }
  var used=ST.tiers.map(function(t){ return t.letter; }), pick='';
  ['S','A','B','C','D','E','F'].forEach(function(l){ if(!pick&&used.indexOf(l)<0)pick=l; });
  ST.tiers.push(mkTier(pick||'', '', ''));
  renderAll(); save();
  var rows=root.querySelectorAll('.tier-row'); var last=rows[rows.length-1]; if(last){ var inp=last.querySelector('.tier-in-l'); if(inp)inp.focus(); }
}
function removeTier(tid){
  if(ST.tiers.length<=1){ api.toast('티어는 하나는 있어야 해요',{kind:'err'}); return; }
  var ti=-1; ST.tiers.forEach(function(t,i){ if(t.id===tid)ti=i; }); if(ti<0)return;
  var snap=snapshot(), t=ST.tiers[ti], dest=ST.tiers[ti>0?ti-1:1];
  dest.items=dest.items.concat(t.items);
  ST.tiers.splice(ti,1);
  renderAll(); save();
  api.toast((t.letter||'티어')+' 삭제 · 항목은 '+(dest.letter||'옆 티어')+'로',{action:'되돌리기',onAction:function(){ restore(snap); }});
}
function applyPreset(p){
  var snap=snapshot(), old=ST.tiers, fresh=countItems()===0||old.every(function(t){ return t.items.every(function(i){ return !(i.name||'').trim()&&!IMG[i.id]; }); });
  var nt=p.t.map(function(d,i){ var tr=old[i]||mkTier(); tr.letter=d[0]; tr.label=d[1]; if(fresh){ tr.note=''; tr.items=[]; for(var k=0;k<p.seed[i];k++)tr.items.push(mkItem('')); } return tr; });
  if(!fresh)for(var i=nt.length;i<old.length;i++)nt[nt.length-1].items=nt[nt.length-1].items.concat(old[i].items);
  ST.tiers=nt; if(sel&&!findItem(sel))sel=null;
  renderAll(); save();
  api.toast(p.n+' 적용',{action:'되돌리기',onAction:function(){ restore(snap); }});
}
function clearBoard(){
  var snap=snapshot();
  Object.keys(IMG).forEach(function(id){ var im=IMG[id]; if(im.blob)try{ URL.revokeObjectURL(im.url); }catch(e){} });
  IMG={}; sel=null; defaultBoard();
  renderAll(); save();
  api.toast('보드를 비웠어요',{action:'되돌리기',onAction:function(){ restore(snap); }});
}
function loadJsonFile(f){
  var rd=new FileReader();
  rd.onload=function(){
    var d=null; try{ d=JSON.parse(String(rd.result||'')); }catch(e){}
    if(!d||d.app!=='sseudam-tier'||!d.board){ api.toast('쓰담 티어표 JSON 이 아니에요',{kind:'err'}); return; }
    var snap=snapshot(); restoreData(d,true); renderAll(); save();
    api.toast((ST.title||'티어표')+' 불러옴',{action:'되돌리기',onAction:function(){ restore(snap); }});
  };
  rd.onerror=function(){ api.toast('파일을 읽지 못했어요',{kind:'err'}); };
  rd.readAsText(f);
}

/* ── 마크업 ── */
function swatchHtml(){
  var groups={}, order=[];
  SWATCHES.forEach(function(s){ if(!groups[s.g]){ groups[s.g]=[]; order.push(s.g); } groups[s.g].push(s); });
  return order.map(function(g){
    return '<span class="tier-sgp"><span class="tier-sg">'+esc(g)+'</span>'+groups[g].map(function(s){
      return '<button type="button" class="tier-sw'+(ST.accent===s.id?' on':'')+'" data-c="'+s.id+'" style="--c:'+s.c+'" aria-label="'+esc(g+' '+s.n)+'" aria-pressed="'+(ST.accent===s.id)+'" title="'+esc(s.n)+'"></button>';
    }).join('')+'</span>';
  }).join('')+
  '<span class="tier-sgp"><button type="button" class="tier-sw custom'+(ST.accent==='custom'?' on has':'')+'" data-c="custom" style="--cc:'+ST.accentHex+'" aria-label="기타 색 (팔레트)" aria-pressed="'+(ST.accent==='custom')+'" title="기타">'+ic('pipette')+'</button></span>'+
  '<input type="color" class="tier-pick" id="tiPick" value="'+ST.accentHex+'" aria-label="포인트 색 팔레트" tabindex="-1">';
}
function chip(id,txt,on,extra){ return '<button type="button" class="chip'+(on?' on':'')+'" data-v="'+esc(id)+'" aria-pressed="'+(on?'true':'false')+'"'+(extra||'')+'>'+txt+'</button>'; }
function html(){
  return '<div class="tier">'+
    '<section class="tier-stage" aria-label="티어 보드">'+
      '<div class="tier-cv" id="tiCv"><canvas id="tiCanvas" width="'+W+'" height="600" tabindex="0" aria-label="티어 보드 · 항목을 끌어 티어와 순서를 바꿔요"></canvas></div>'+
      '<input type="file" id="tiFile" accept="image/*" multiple hidden>'+
      '<input type="file" id="tiJsonFile" accept="application/json,.json" hidden>'+
      '<ul class="tier-chk" id="tiChk" aria-live="polite"></ul>'+
    '</section>'+
    '<section class="tier-ctl" aria-label="설정">'+
      '<div class="tier-sec"><div class="tier-st">보드</div>'+
        '<label class="tier-lbl" for="tiTitle"><span>제목</span><span class="tier-cnt num" id="tiTitleCnt"></span></label>'+
        '<input class="f-i" id="tiTitle" maxlength="40" placeholder="예: 메이플 전직업 티어표" autocomplete="off" value="'+esc(ST.title)+'">'+
        '<label class="tier-lbl" for="tiSub"><span>부제</span><span class="o">비우면 안 그려요</span></label>'+
        '<input class="f-i" id="tiSub" maxlength="50" placeholder="예: 2026년 9월 · 보스 딜 기준" autocomplete="off" value="'+esc(ST.sub)+'">'+
        '<div class="tier-2">'+
          '<div><label class="tier-lbl" for="tiStamp"><span>기준</span></label><input class="f-i" id="tiStamp" maxlength="50" placeholder="예: v1.2 패치 · 9.7 기준" autocomplete="off" value="'+esc(ST.stamp)+'"></div>'+
          '<div><label class="tier-lbl" for="tiSign"><span>서명</span></label><input class="f-i" id="tiSign" maxlength="12" placeholder="예: 봄딩" autocomplete="off" value="'+esc(ST.sign)+'"></div>'+
        '</div>'+
      '</div>'+
      '<div class="tier-sec"><div class="tier-st">티어<span class="d" id="tiTd"></span></div>'+
        '<div class="tier-chips" id="tiPresets" role="group" aria-label="티어 단계 프리셋">'+PRESETS.map(function(p){ return chip(p.id,esc(p.n),false); }).join('')+'</div>'+
        '<div class="tier-rows" id="tiRows"></div>'+
        '<button type="button" class="ghost tier-add" id="tiTierAdd">'+ic('plus')+'티어 추가</button>'+
      '</div>'+
      '<div class="tier-sec"><div class="tier-st">항목<span class="d" id="tiIc"></span></div>'+
        '<div class="tier-new"><select class="tier-sel" id="tiNewT" aria-label="넣을 티어"></select>'+
          '<input class="tier-in" id="tiNew" maxlength="120" placeholder="이름 · 쉼표로 여러 개" autocomplete="off" aria-label="추가할 항목 이름">'+
          '<button type="button" class="ghost" id="tiAdd">'+ic('plus')+'추가</button></div>'+
        '<div class="tier-list" id="tiList"></div>'+
      '</div>'+
      '<div class="tier-sec"><div class="tier-st">디자인</div>'+
        '<div class="tier-lbl"><span>포인트 색</span></div>'+
        '<div class="tier-crow" id="tiSws" role="group" aria-label="포인트 색">'+swatchHtml()+'<span class="tier-swn" id="tiSwn"></span></div>'+
        '<div class="tier-ramp" id="tiRamp" aria-hidden="true"></div>'+
        '<div class="tier-lbl"><span>한 줄에</span></div>'+
        '<div class="tier-chips" id="tiCols" role="group" aria-label="한 줄 항목 수">'+COLS.map(function(c){ return chip(String(c),c+'개',ST.cols===c); }).join('')+'</div>'+
        '<div class="tier-lbl"><span>표시</span></div>'+
        '<div class="tier-chips" id="tiOpts" role="group" aria-label="표시 요소">'+chip('rank','순위 번호',ST.rank)+chip('names','이름',ST.names)+'</div>'+
        '<div class="tier-lbl"><span>타일</span></div>'+
        '<div class="tier-chips" id="tiShape" role="group" aria-label="타일 모양">'+chip('square','둥근 사각',ST.shape==='square')+chip('circle','원',ST.shape==='circle')+'</div>'+
      '</div>'+
    '</section>'+
    '<section class="tier-act" aria-label="내보내기">'+
      '<div class="tier-act-r"><button type="button" class="ghost" id="tiCopy">'+ic('copy')+'클립보드 복사</button>'+
        '<button type="button" class="ghost" id="tiJson">'+ic('file')+'보드 JSON</button>'+
        '<button type="button" class="ghost" id="tiLoad">'+ic('upload')+'불러오기</button>'+
        '<button type="button" class="ghost" id="tiClear">'+ic('broom')+'비우기</button></div>'+
      '<div class="tier-act-r"><div class="tier-fn num" id="tiFn"></div>'+
        '<button type="button" class="cta" id="tiSave"><span>PNG 저장</span><span class="knob">'+ic('download')+'</span></button></div>'+
    '</section>'+
  '</div>';
}
/* 셀렉트는 글자만(«S») — 62px 칸에 «S · 최상위»를 넣으면 «S · 최싱»으로 잘린다. 라벨은 바로 위 그룹 머리에 있다 */
function tierOpts(cur){ return ST.tiers.map(function(t,i){ return '<option value="'+i+'"'+(i===cur?' selected':'')+'>'+esc(t.letter||'?')+'</option>'; }).join(''); }
function renderTiers(){
  var box=$('tiRows'); if(!box)return;
  var n=ST.tiers.length, acc=accentHex();
  box.innerHTML=ST.tiers.map(function(t,i){
    return '<div class="tier-row" data-tid="'+t.id+'">'+
      '<span class="tier-dot" style="--c:'+blend(acc,tierAlpha(i,n))+'"></span>'+
      '<input class="tier-in tier-in-l" data-f="letter" maxlength="3" value="'+esc(t.letter)+'" placeholder="S" aria-label="티어 '+(i+1)+' 글자">'+
      '<input class="tier-in" data-f="label" maxlength="8" value="'+esc(t.label)+'" placeholder="라벨" aria-label="티어 '+(i+1)+' 라벨">'+
      '<input class="tier-in" data-f="note" maxlength="30" value="'+esc(t.note)+'" placeholder="한 줄 · 비우면 안 그려요" aria-label="티어 '+(i+1)+' 한 줄">'+
      '<button type="button" class="tier-ib" data-act="tierDel" aria-label="티어 '+(i+1)+' 삭제"'+(n<=1?' disabled':'')+'>'+ic('x')+'</button>'+
    '</div>';
  }).join('');
  $('tiTd').textContent=n+'단계';
  var ramp=$('tiRamp'); if(ramp)ramp.innerHTML=ST.tiers.map(function(t,i){ return '<span style="--c:'+blend(acc,tierAlpha(i,n))+'"></span>'; }).join('');
  var selT=$('tiNewT'); if(selT){ var v=parseInt(selT.value,10); if(!(v>=0&&v<n))v=0; selT.innerHTML=tierOpts(v); }
  var add=$('tiTierAdd'); if(add)add.disabled=n>=MAX_TIERS;
}
function renderList(){
  var box=$('tiList'); if(!box)return;
  var h='', total=0, n=ST.tiers.length, acc=accentHex();
  ST.tiers.forEach(function(t,ti){
    h+='<div class="tier-gh"><span class="tier-dot" style="--c:'+blend(acc,tierAlpha(ti,n))+'"></span>'+esc(t.letter||'?')+(t.label?'<span class="o">'+esc(t.label)+'</span>':'')+'<span class="n">'+t.items.length+'</span></div>';
    t.items.forEach(function(it,i){
      total++;
      var im=IMG[it.id], name=(it.name||'').trim();
      h+='<div class="tier-it'+(im?' has-img':'')+(sel===it.id?' sel':'')+'" data-id="'+it.id+'">'+
        '<button type="button" class="tier-th'+(ST.shape==='circle'?' circle':'')+'" data-act="img" aria-label="'+esc(name||'빈 슬롯')+' 이미지 '+(im?'바꾸기':'넣기')+'">'+(im?'<img src="'+esc(im.url)+'" alt="">':(name?esc(Array.from(name)[0]):ic('image')))+'</button>'+
        '<input class="tier-in" data-f="name" value="'+esc(it.name)+'" maxlength="14" placeholder="이름" aria-label="항목 이름">'+
        '<select class="tier-sel" data-f="tier" aria-label="티어">'+tierOpts(ti)+'</select>'+
        '<span class="tier-ibs">'+
        '<button type="button" class="tier-ib" data-act="up" aria-label="위로"'+(ti===0&&i===0?' disabled':'')+'>'+ic('up')+'</button>'+
        '<button type="button" class="tier-ib" data-act="down" aria-label="아래로"'+(ti===n-1&&i===t.items.length-1?' disabled':'')+'>'+ic('down')+'</button>'+
        (im?'<button type="button" class="tier-ib" data-act="imgDel" aria-label="이미지 지우기">'+ic('imgOff')+'</button>':'')+
        '<button type="button" class="tier-ib" data-act="del" aria-label="항목 삭제">'+ic('x')+'</button>'+
        '</span>'+
      '</div>';
    });
  });
  box.innerHTML=h||'<div class="tier-empty">항목이 없어요</div>';
  var ic0=$('tiIc'); if(ic0)ic0.textContent=total+'개';
}
function syncDesign(){
  if(!root)return;
  var a=accentName();
  $('tiSwn').innerHTML=esc(a.g?a.g+' · '+a.n:a.n)+'<span class="num">'+esc(String(a.hex).toUpperCase())+'</span>';
  root.querySelectorAll('#tiSws .tier-sw').forEach(function(b){ var on=b.dataset.c===ST.accent; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  var cs=root.querySelector('#tiSws .custom'); if(cs){ cs.style.setProperty('--cc',ST.accentHex); cs.classList.toggle('has',ST.accent==='custom'); }
  root.querySelectorAll('#tiCols .chip').forEach(function(b){ var on=parseInt(b.dataset.v,10)===ST.cols; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  root.querySelectorAll('#tiOpts .chip').forEach(function(b){ var on=b.dataset.v==='rank'?ST.rank:ST.names; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  root.querySelectorAll('#tiShape .chip').forEach(function(b){ var on=b.dataset.v===ST.shape; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  root.querySelectorAll('.tier-th').forEach(function(b){ b.classList.toggle('circle',ST.shape==='circle'); });
}
function syncBoardInputs(){
  var ids={tiTitle:'title',tiSub:'sub',tiStamp:'stamp',tiSign:'sign'};
  Object.keys(ids).forEach(function(id){ var e=$(id); if(e&&e.value!==ST[ids[id]])e.value=ST[ids[id]]; });
  var c=$('tiTitleCnt'); if(c){ var l=Array.from(ST.title||'').length; c.textContent=l?l+'/40':''; }
}
function renderAll(){ syncBoardInputs(); renderTiers(); renderList(); syncDesign(); schedule(); }
function selectItem(id,scroll){
  sel=id;
  root.querySelectorAll('.tier-it').forEach(function(r){ r.classList.toggle('sel',r.dataset.id===sel); });
  schedule();
  if(scroll&&sel){ var row=root.querySelector('.tier-it[data-id="'+sel+'"]'); if(row&&row.scrollIntoView)row.scrollIntoView({block:'nearest'}); }
}

/* ── 캔버스 상호작용: 끌어 옮기기(마우스·펜) · 탭=선택 · 파일 드롭 ── */
function canvasPt(e){ var r=main.getBoundingClientRect(), k=W/(r.width||1); return {x:(e.clientX-r.left)*k,y:(e.clientY-r.top)*k}; }
function tileAt(p){ for(var i=HIT.length-1;i>=0;i--){ var t=HIT[i]; if(p.x>=t.x&&p.x<=t.x+t.w&&p.y>=t.y&&p.y<=t.y+t.h)return t; } return null; }
function bandAt(py){ if(!LAY)return null; for(var i=0;i<LAY.bands.length;i++){ var b=LAY.bands[i]; if(py<b.y+b.h)return b; } return LAY.bands[LAY.bands.length-1]||null; }
/* 항목 0개 티어의 점선 자리 — «+» 는 누르면 그 티어에 슬롯이 하나 생긴다(개별 빈 슬롯의 «+» 와 같은 그림이라 눌러도 안 되면 헷갈린다 — 게이트 🟡 09-07) */
function emptyAt(p){ if(!LAY)return null; for(var i=0;i<LAY.bands.length;i++){ var b=LAY.bands[i]; if(b.tiles.length)continue; if(p.x>=b.itemsX&&p.x<=b.itemsX+b.tile&&p.y>=b.tilesY&&p.y<=b.tilesY+b.tile)return b; } return null; }
/* 놓을 자리 — 띠(y) → 줄(y) → 그 줄에서 중심이 포인터 오른쪽에 있는 첫 타일 앞. 없으면 줄 끝 */
function dropTarget(px,py){
  var b=bandAt(py); if(!b)return null;
  var idx, mk;
  if(!b.tiles.length){ idx=0; mk={x:b.itemsX-11.5,y:b.tilesY,h:b.tile}; }
  else{
    var rows=Math.ceil(b.tiles.length/ST.cols), row=clamp(Math.floor((py-b.tilesY)/(b.rowH+M.gapY)),0,rows-1);
    var rt=b.tiles.filter(function(t){ return Math.floor(t.i/ST.cols)===row; }), hit=null;
    for(var k=0;k<rt.length;k++){ if(px<rt[k].x+rt[k].w/2){ hit=rt[k]; break; } }
    if(hit){ idx=hit.i; mk={x:hit.x-M.gapX/2-2.5,y:hit.y,h:hit.h}; }
    else{ var last=rt[rt.length-1]; idx=last.i+1; mk={x:last.x+last.w+M.gapX/2-2.5,y:last.y,h:last.h}; }
  }
  return {ti:b.ti,idx:idx,mk:mk};
}
function bindCanvas(){
  var cv=$('tiCv');
  var pendingAdd=null;
  main.addEventListener('pointerdown',function(e){
    if(e.button!==0&&e.pointerType==='mouse')return;
    var p=canvasPt(e), t=tileAt(p);
    if(!t){ var eb=emptyAt(p); pendingAdd=eb?{ti:eb.ti,sx:e.clientX,sy:e.clientY}:null; if(sel&&!eb)selectItem(null); return; }
    drag={id:t.id,ti:t.ti,i:t.i,rank:t.rank,sx:e.clientX,sy:e.clientY,dx:p.x-t.x,dy:p.y-t.y,px:p.x,py:p.y,moved:false,target:null,touch:e.pointerType==='touch'};
    if(!drag.touch){ try{ main.setPointerCapture(e.pointerId); }catch(x){} }
  });
  main.addEventListener('pointerup',function(e){
    if(!pendingAdd)return;
    var pa=pendingAdd; pendingAdd=null;
    if(Math.abs(e.clientX-pa.sx)+Math.abs(e.clientY-pa.sy)>8)return;
    var p=canvasPt(e), eb=emptyAt(p); if(eb&&eb.ti===pa.ti)addNames(pa.ti,'');
  });
  main.addEventListener('pointermove',function(e){
    var p=canvasPt(e);
    if(!drag){ var t=tileAt(p); main.classList.toggle('grab',!!t); main.classList.toggle('add',!t&&!!emptyAt(p)); return; }
    if(drag.touch)return;   /* 터치는 세로 스크롤에 양보 — 이동은 편집 열 ▲▼·티어 선택 */
    if(!drag.moved&&Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)<6)return;
    drag.moved=true; main.classList.add('drag');
    drag.px=p.x; drag.py=p.y; drag.target=dropTarget(p.x,p.y);
    schedule();
  });
  function up(e){
    if(!drag)return;
    var d=drag; drag=null; main.classList.remove('drag');
    if(d.moved&&d.target){ if(moveItem(d.id,d.target.ti,d.target.idx)){ selectItem(d.id); renderList(); save(); } }
    else if(!d.moved){ selectItem(sel===d.id?null:d.id,true); }
    schedule();
  }
  main.addEventListener('pointerup',up); main.addEventListener('pointercancel',up);
  main.addEventListener('keydown',function(e){ if(e.key==='Escape'&&sel){ e.preventDefault(); selectItem(null); } });
  /* 파일 드롭 — 타일 위면 그 항목의 그림, 띠 위면 그 티어에 새 항목, 설정 열 위면 선택 항목(없으면 «넣을 티어») */
  var box=root.querySelector('.tier');
  ['dragenter','dragover'].forEach(function(t){ box.addEventListener(t,function(e){ if(!e.dataTransfer)return; e.preventDefault(); e.dataTransfer.dropEffect='copy'; cv.classList.add('over'); }); });
  box.addEventListener('dragleave',function(e){ if(!box.contains(e.relatedTarget))cv.classList.remove('over'); });
  box.addEventListener('drop',function(e){
    e.preventDefault(); cv.classList.remove('over');
    var files=e.dataTransfer&&e.dataTransfer.files; if(!files||!files.length)return;
    if(main.contains(e.target)){
      var p=canvasPt(e), t=tileAt(p);
      if(t)takeFiles(files,t.ti,null,t.id);
      else{ var tg=dropTarget(p.x,p.y); takeFiles(files,tg?tg.ti:0,tg?tg.idx:null,null); }
    }else if(sel&&findItem(sel)){ var f=findItem(sel); takeFiles(files,f.ti,null,sel); }
    else takeFiles(files,newTierIdx(),null,null);
  });
}
function newTierIdx(){ var s=$('tiNewT'); var v=s?parseInt(s.value,10):0; return (v>=0&&v<ST.tiers.length)?v:0; }

/* ── 편집 열 ── */
function bindEditor(){
  var file=$('tiFile'), fileFor=null;
  function pickFor(id){ fileFor=id; file.value=''; file.click(); }
  file.addEventListener('change',function(){
    var fs=file.files; if(!fs||!fs.length)return;
    if(fileFor&&findItem(fileFor)){ var f=findItem(fileFor); takeFiles(fs,f.ti,null,fileFor); }
    else takeFiles(fs,newTierIdx(),null,null);
    fileFor=null;
  });
  /* 보드 문구 */
  [['tiTitle','title'],['tiSub','sub'],['tiStamp','stamp'],['tiSign','sign']].forEach(function(p){
    $(p[0]).addEventListener('input',function(){ ST[p[1]]=this.value; if(p[1]==='title')syncBoardInputs(); save(); schedule(); });
  });
  /* 티어 프리셋 · 행 */
  $('tiPresets').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b)return; var p=PRESETS.filter(function(x){ return x.id===b.dataset.v; })[0]; if(p)applyPreset(p); });
  $('tiTierAdd').addEventListener('click',addTier);
  var rows=$('tiRows');
  rows.addEventListener('input',function(e){
    var inp=e.target.closest('.tier-in'); var row=e.target.closest('.tier-row'); if(!inp||!row)return;
    var t=ST.tiers.filter(function(x){ return x.id===row.dataset.tid; })[0]; if(!t)return;
    t[inp.dataset.f]=inp.value; save(); schedule();
    if(inp.dataset.f!=='note'){ var sT=$('tiNewT'), v=sT.value; sT.innerHTML=tierOpts(parseInt(v,10)||0); renderList(); }
  });
  rows.addEventListener('click',function(e){ var b=e.target.closest('[data-act="tierDel"]'); if(!b)return; var row=b.closest('.tier-row'); removeTier(row.dataset.tid); });
  /* 항목 추가 */
  function add(){ var inp=$('tiNew'); var ids=addNames(newTierIdx(),inp.value); if(ids.length){ inp.value=''; inp.focus(); } }
  $('tiAdd').addEventListener('click',add);
  $('tiNew').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); add(); } });
  /* 항목 행 */
  var list=$('tiList');
  list.addEventListener('input',function(e){
    var inp=e.target.closest('.tier-in[data-f="name"]'); var row=e.target.closest('.tier-it'); if(!inp||!row)return;
    var f=findItem(row.dataset.id); if(!f)return;
    f.item.name=inp.value; save(); schedule();
    if(!IMG[f.item.id]){ var th=row.querySelector('.tier-th'); var nm=inp.value.trim(); th.innerHTML=nm?esc(Array.from(nm)[0]):ic('image'); }
  });
  list.addEventListener('change',function(e){
    var s=e.target.closest('.tier-sel[data-f="tier"]'); var row=e.target.closest('.tier-it'); if(!s||!row)return;
    var id=row.dataset.id;
    if(moveItem(id,parseInt(s.value,10),null)){ sel=id; renderList(); save(); schedule(); focusRow(id,'.tier-sel'); }
  });
  list.addEventListener('focusin',function(e){ var row=e.target.closest('.tier-it'); if(row&&row.dataset.id!==sel)selectItem(row.dataset.id); });
  list.addEventListener('click',function(e){
    var b=e.target.closest('[data-act]'); var row=e.target.closest('.tier-it'); if(!b||!row)return;
    var id=row.dataset.id, f=findItem(id); if(!f)return;
    var act=b.dataset.act;
    if(act==='img'){ selectItem(id); pickFor(id); return; }
    if(act==='imgDel'){ clearImage(id); focusRow(id,'[data-act="img"]'); return; }
    if(act==='del'){ removeItem(id); return; }
    if(act==='up'){
      if(f.i>0)moveItem(id,f.ti,f.i-1); else if(f.ti>0)moveItem(id,f.ti-1,null); else return;
      sel=id; renderList(); save(); schedule(); focusRow(id,'[data-act="up"]');
    }
    if(act==='down'){
      if(f.i<f.tier.items.length-1)moveItem(id,f.ti,f.i+2); else if(f.ti<ST.tiers.length-1)moveItem(id,f.ti+1,0); else return;
      sel=id; renderList(); save(); schedule(); focusRow(id,'[data-act="down"]');
    }
  });
  function focusRow(id,q){ var row=root.querySelector('.tier-it[data-id="'+id+'"]'); if(!row)return; var b=row.querySelector(q); if(b&&!b.disabled)b.focus(); else row.querySelector('.tier-in').focus(); if(row.scrollIntoView)row.scrollIntoView({block:'nearest'}); }
  /* 디자인 */
  var sws=$('tiSws'), pick=$('tiPick');
  sws.addEventListener('click',function(e){
    var b=e.target.closest('.tier-sw'); if(!b)return;
    if(b.dataset.c==='custom'){ ST.accent='custom'; pick.value=ST.accentHex; save(); syncDesign(); renderTiers(); renderList(); schedule(); pick.click(); return; }
    ST.accent=b.dataset.c; save(); syncDesign(); renderTiers(); renderList(); schedule();
  });
  pick.addEventListener('input',function(){ ST.accent='custom'; ST.accentHex=this.value; save(); syncDesign(); renderTiers(); renderList(); schedule(); });
  $('tiCols').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b)return; var c=parseInt(b.dataset.v,10); if(COLS.indexOf(c)<0)return; ST.cols=c; save(); syncDesign(); schedule(); });
  $('tiOpts').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b)return; if(b.dataset.v==='rank')ST.rank=!ST.rank; else ST.names=!ST.names; save(); syncDesign(); schedule(); });
  $('tiShape').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b)return; ST.shape=b.dataset.v==='circle'?'circle':'square'; save(); syncDesign(); schedule(); });
  /* 내보내기 */
  $('tiSave').addEventListener('click',savePng);
  $('tiCopy').addEventListener('click',copyPng);
  $('tiJson').addEventListener('click',saveJson);
  $('tiLoad').addEventListener('click',function(){ var j=$('tiJsonFile'); j.value=''; j.click(); });
  $('tiJsonFile').addEventListener('change',function(){ if(this.files&&this.files[0])loadJsonFile(this.files[0]); });
  $('tiClear').addEventListener('click',clearBoard);
}
function savePng(){
  toBlob().then(function(b){
    if(!b){ api.toast('PNG를 만들지 못했어요',{kind:'err'}); return; }
    var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fileName();
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(a.href); },4000);
    api.toast(fileName()+' · '+Math.round(b.size/1024)+'KB 저장');
  });
}
function copyPng(){
  if(!(navigator.clipboard&&window.ClipboardItem)){ api.toast('이 브라우저는 이미지 클립보드 복사를 지원하지 않아요 · PNG 저장을 쓰세요',{kind:'err'}); return; }
  toBlob().then(function(b){ return navigator.clipboard.write([new ClipboardItem({'image/png':b})]); })
    .then(function(){ api.toast('클립보드에 복사했어요 · 에디터에 붙여넣기'); })
    .catch(function(){ api.toast('클립보드 복사가 막혔어요 · PNG 저장을 쓰세요',{kind:'err'}); });
}
function saveJson(){
  var b=new Blob([JSON.stringify(data(),null,1)],{type:'application/json'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=(safeName(ST.title)||'티어표')+'_board.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); },4000);
  api.toast(a.download+' 저장 · 이미지는 담기지 않아요');
}

/* ── 수명 ── */
function loadFonts(){
  if(!(document.fonts&&document.fonts.load))return Promise.resolve();
  var t=(ST.title||'티어표')+'가나다 SABCD 0123';
  return Promise.all([document.fonts.load('800 44px "Pretendard Variable"',t),document.fonts.load('700 32px "Pretendard Variable"',t),document.fonts.load('600 20px "JetBrains Mono"','0123456789')]).then(function(){ fontsReady=true; }).catch(function(){});
}
function mount(host,a){
  api=a; root=host; mounted=true; readTokens();
  if(!document.getElementById('tierCss')){ var st=document.createElement('style'); st.id='tierCss'; st.textContent=CSS; document.head.appendChild(st); }
  host.innerHTML=html();
  main=$('tiCanvas'); mctx=main.getContext('2d');
  bindCanvas(); bindEditor();
  onPaste=function(e){
    var items=(e.clipboardData&&e.clipboardData.items)||[];
    for(var i=0;i<items.length;i++){
      if(items[i].kind==='file'&&/^image\//.test(items[i].type)){
        e.preventDefault(); var f=items[i].getAsFile();
        if(sel&&findItem(sel)){ var fi=findItem(sel); takeFiles([f],fi.ti,null,sel); } else takeFiles([f],newTierIdx(),null,null);
        return;
      }
    }
  };
  document.addEventListener('paste',onPaste);
  renderAll(); paint();
  loadFonts().then(function(){ if(mounted)schedule(); });
}
function unmount(){
  mounted=false; if(raf){ cancelAnimationFrame(raf); raf=0; }
  if(onPaste){ document.removeEventListener('paste',onPaste); onPaste=null; }
  drag=null; root=null; main=null; mctx=null; HIT=[];
}

window.SseudamTools.tier={
  mount:mount, unmount:unmount,
  /* 헤드리스 검증용 — 사용자 UI 와 무관 */
  __test:{
    state:function(){ var d=data(); d.sel=sel; d.images=Object.keys(IMG).length; d.fonts=fontsReady; return d; },
    setBoard:function(d){ restoreData(d,true); renderAll(); save(); },
    addItem:function(ti,name){ return addNames(ti,name); },
    move:function(id,ti,idx){ var ok=moveItem(id,ti,idx); if(ok){ renderList(); save(); paint(); } return ok; },
    select:function(id){ selectItem(id,true); },
    hits:function(){ return HIT.map(function(t){ return {id:t.id,ti:t.ti,i:t.i,x:t.x,y:t.y,w:t.w,h:t.h,rank:t.rank}; }); },
    layout:function(){ return LAY?{H:LAY.H,tile:LAY.tile,nfs:LAY.nfs,bands:LAY.bands.map(function(b){ return {ti:b.ti,y:b.y,h:b.h,tiles:b.tiles.length}; })}:null; },
    dropTarget:function(x,y){ return dropTarget(x,y); },
    setImageURL:function(id,url){ return setImageURL(id,url,false); },
    fileName:fileName, paint:function(){ paint(); return LAY&&LAY.H; },
    blob:function(){ return toBlob().then(function(b){ return b?{size:b.size,type:b.type}:null; }); },
    dataURL:function(){ return exportCanvas().toDataURL('image/png'); },
    presets:PRESETS.map(function(p){ return p.id; }), reset:function(){ IMG={}; sel=null; defaultBoard(); renderAll(); save(); }
  }
};
})();
