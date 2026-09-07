/*! 쓰담 도구함 · 티어표 제작 — v2 「작성자 전용 보드」 2026-09-07 (v1 「잉크 농도 보드」 09-07 오전 → 같은 날 사용자 피드백 10건 반영)
 *  index.html 「도구함」 탭이 처음 고를 때 받아 window.SseudamTools.tier 로 등록한다({mount(host,api), unmount()}). 설계 근거 = BlogPreview/DESIGN.md §Toolbox
 *  v2 에서 바뀐 것(사용자 피드백 순서대로)
 *    ① 도구함 목록은 index.html 이 ≥1620px 에서 왼쪽 여백의 sticky 레일로 내보내고, 도구 판은 1080 전폭.
 *    ② 보드 안 요소는 세로 가운데 정렬(플라크 글자·라벨, 타일 블록, 제목 띠).
 *    ③ «봄딩 디자인 / 영도 디자인» 2종 — 색만 바꾸는 리스킨이 아니라 서체(나눔스퀘어 / Pretendard)·제목 띠(플럼 판+로즈 밑줄 / 틸 띠+민트 룰)·
 *       모서리(부드럽게 / 또렷하게)·서명 글리프(하트 / 사각)·바탕 온도를 각 작성자 블로그 정본(봄딩 output-format §2-0 나눔스퀘어·썸네일 표준 v1 플럼/로즈/핑크 /
 *       영도 output-format §1-4 그린·민트 + 사이트 정체성색 틸)에서 가져온다. ★영도 서체만 예외 — 정본 스켈레톤은 화면용 Apple SD Gothic Neo·맑은 고딕인데
 *       이미지에 굽기엔 Windows 맑은 고딕 Bold 가 거칠어 사이트 서체 Pretendard 를 쓴다(의도된 선택). 봄딩 포인트 3색은 인포그래픽 정본(#EC5C92 계열)이 아니라
 *       썸네일 도구와 같은 «라이브 블로그 CSS 실측색»(.pcol3 #C93C7C 등) — 도구함 안 일관성을 우선했다.
 *    ④ 보드 폭 = 네이버 PC 본문 이미지 실폭 693px(09-07 봄딩·영도 실제 글 헤드리스 실측: #post-area 773 · .se-section 693 · 이미지 693) — 논리 693 으로 그리고 2배(1386)로 내보낸다.
 *    ⑤ 순위 번호·플라크 개수 표기 삭제.  ⑥ 포인트 색 = 디자인별 3색 + 팔레트 + 헥스 입력 · 타일 모양 5(둥근 사각·원·스쿼클·육각·세로 카드).
 *    ⑦ 작업대 구조 — 판이 뷰포트 높이에 맞고(왼쪽 보드·오른쪽 편집 열이 각자 스크롤), 내보내기는 보드 아래 고정 줄. 항목이 늘어도 화면이 길어지지 않는다.
 *    ⑧ 리소스 묶음 — _toolbox/tier/res/<게임>/manifest.json(+512² webp, _tools/tier-res.mjs 가 생성). «리소스 불러오기» 서랍에서 클릭=선택 티어에 추가, 끌어서 보드에 놓기.
 *       리소스로 넣은 항목은 res 참조가 저장돼 새로고침에도 그림이 남는다(손수 넣은 그림은 메모리만).
 *    ⑨ 티어 프리셋 삭제 — 기본 S·A·B·C 4단계.  ⑩ 부제 삭제 — 제목(게임 이름)은 가운데 정렬 «제목 띠»로 따로 둔다.
 *  v2.2(09-07 4차 지시 «봄딩·영도 프로필을 다른 포즈로 시그니처처럼»): 바닥 오른쪽에 **작성자 시그니처 스티커**(디자인별 1장 · 높이 96 · 구분선 위로 34 걸침).
 *    자산 = tier/sig/<design>.webp — 각 작성자 아바타를 -Ref 로 나노바나나 생성(봄딩=클립보드+윙크 / 영도=팔짱+설명, 축하 스플래시 포즈와 겹치지 않게) 후 배경 키잉.
 *    「시그니처」 칩으로 끄고 켠다(기본 켬). 못 받으면 조용히 안 그리고 서명 텍스트만 남는다.
 *  v1 에서 유지: 농도=등급(포인트 색 하나를 1.0→0.14 로 옅혀 플라크를 채움), 초상 타일+이름, 티어별 한 줄, 바닥 기준 스탬프·서명, 캔버스에서 끌어 이동,
 *    빈 슬롯(점선)=양식, 되돌리기 토스트, JSON 저장/불러오기. 의존성 0. 캔버스는 :root 토큰·디자인 팔레트를 실색으로 쓴다.
 */
(function(){
"use strict";
window.SseudamTools=window.SseudamTools||{};
if(window.SseudamTools.tier)return;

var W=693, EXPORT_SCALE=2, LS='sseudam_tier_v2', LS_V1='sseudam_tier_v1';
var BASE=(function(){ var s=document.currentScript, u=(s&&s.src)||'_toolbox/tier.js'; return u.replace(/\?.*$/,'').replace(/[^\/]*$/,''); })();
var RES_BASE=BASE+'tier/res/';
var SIG_BASE=BASE+'tier/sig/';   /* 작성자 시그니처 스티커(봄딩·영도 전용 포즈, 나노바나나 -Ref 생성 → 배경 키잉) */
var NANUM_CSS=BASE.replace(/_toolbox\/$/,'')+'_design/nanumsquare.css';
var MAX_TIERS=7, MAX_ITEMS=200, COLS=[3,4,5,6];
/* 디자인 2종 — 각 작성자 블로그 정본에서 가져온 값(봄딩: 썸네일 표준 v1 플럼·로즈·핑크 + 인포그래픽 핑크 / 영도: output-format §1-4 그린·민트 + 사이트 정체성색 틸) */
var DESIGNS={
  bomding:{ id:'bomding', n:'봄딩', dot:'#C93C7C', fam:'"NanumSquare","나눔스퀘어","Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif', wTitle:'800', wName:'700',
    accent:'#C93C7C', sw:[{id:'rose',c:'#C93C7C',n:'로즈'},{id:'pink',c:'#F58AB4',n:'핑크'},{id:'plum',c:'#2E2038',n:'플럼'}],
    ink:'#2E2038', inkDeep:'#17101E', ink2:'#5E5068', ink3:'#8C8194', paper:'#FFFBFC', tray:'#F6E1EA', tray2:'#F0D3DF', hair:'rgba(46,32,56,.10)', hair2:'rgba(46,32,56,.14)', hair3:'rgba(46,32,56,.24)', slot:'#F8F1F4', tileTint:'#F9E4EC',
    titleFill:'#2E2038', titleInk:'#FFFFFF', titleRule:'#F58AB4', rTitle:16, rPlaque:16, rTile:.18, glyph:'heart', sep:'dash', sig:'bomding.webp' },
  yeongdo:{ id:'yeongdo', n:'영도', dot:'#0F7C86', fam:'"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif', wTitle:'800', wName:'700',
    accent:'#15A05A', sw:[{id:'green',c:'#15A05A',n:'그린'},{id:'mint',c:'#14B8A6',n:'민트'},{id:'teal',c:'#0F7C86',n:'틸'}],
    ink:'#0E1114', ink2:'#3F4A52', ink3:'#6B7680', paper:'#FFFFFF', tray:'#E4ECEE', tray2:'#DCE6E9', hair:'rgba(14,17,20,.08)', hair2:'rgba(14,17,20,.13)', hair3:'rgba(14,17,20,.22)', slot:'#F3F6F7', tileTint:'#E3EEEA',
    titleFill:'#0F7C86', titleInk:'#FFFFFF', titleRule:'#14B8A6', rTitle:10, rPlaque:8, rTile:.12, glyph:'square', sep:'line', sig:'yeongdo.webp' }
};
var SHAPES=[{id:'round',n:'둥근 사각'},{id:'circle',n:'원'},{id:'squircle',n:'스쿼클'},{id:'hex',n:'육각'},{id:'card',n:'세로 카드'}];
var UID=0;
function uid(){ return 'i'+(++UID); }

/* ── 상태 ── */
var ST={ title:'', stamp:'', sign:'', design:'bomding', accent:'auto', accentHex:'#C93C7C', cols:4, shape:'round', sig:true, tiers:[] };
var SIG={};   /* 디자인 id → Image (마운트·디자인 전환 때 받는다. 실패하면 조용히 안 그린다) */
var IMG={};          /* id → {img,w,h,url,blob,res} */
var sel=null;
function mkTier(letter,label,note){ return {id:uid(),letter:letter||'',label:label||'',note:note||'',items:[]}; }
function mkItem(name,res){ var it={id:uid(),name:name||''}; if(res)it.res=res; return it; }
function str(v,max){ return typeof v==='string'?v.slice(0,max):''; }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function design(){ return DESIGNS[ST.design]||DESIGNS.bomding; }
function defaultBoard(){
  ST.title=''; ST.stamp=''; ST.sign='';
  var d=[['S','최상위',3],['A','강력',4],['B','무난',4],['C','아쉬움',3]];
  ST.tiers=d.map(function(x){ var t=mkTier(x[0],x[1]); for(var k=0;k<x[2];k++)t.items.push(mkItem('')); return t; });
}
function restoreData(sv,withDesign){
  var b=(sv&&sv.board)||{}, seen={};
  ST.title=str(b.title,30); ST.stamp=str(b.stamp,40); ST.sign=str(b.sign,12);
  var tiers=[];
  (Array.isArray(b.tiers)?b.tiers:[]).slice(0,MAX_TIERS).forEach(function(t){
    if(!t||typeof t!=='object')return;
    var tr=mkTier(str(t.letter,3),str(t.label,8),str(t.note,30));
    if(typeof t.id==='string'&&/^i\d+$/.test(t.id)&&!seen[t.id]){ tr.id=t.id; seen[t.id]=1; }
    (Array.isArray(t.items)?t.items:[]).slice(0,MAX_ITEMS).forEach(function(it){
      if(!it||typeof it!=='object')return;
      var res=null; if(it.res&&typeof it.res==='object'&&/^[a-z0-9-]+$/.test(it.res.b||'')&&/^[A-Za-z0-9_-]+$/.test(it.res.c||''))res={b:it.res.b,c:it.res.c};
      var x=mkItem(str(it.name,20),res);
      if(typeof it.id==='string'&&/^i\d+$/.test(it.id)&&!seen[it.id]){ x.id=it.id; seen[it.id]=1; }
      tr.items.push(x);
    });
    tiers.push(tr);
  });
  Object.keys(seen).forEach(function(id){ var n=parseInt(id.slice(1),10); if(n>UID)UID=n; });
  if(tiers.length)ST.tiers=tiers;
  if(withDesign&&sv&&sv.design&&typeof sv.design==='object'){
    var d=sv.design;
    if(DESIGNS[d.design])ST.design=d.design;
    if(d.accent==='auto'||d.accent==='custom'||design().sw.some(function(s){ return s.id===d.accent; }))ST.accent=d.accent;
    if(/^#[0-9a-f]{6}$/i.test(d.accentHex||''))ST.accentHex=d.accentHex;
    if(COLS.indexOf(d.cols)>=0)ST.cols=d.cols;
    if(SHAPES.some(function(s){ return s.id===d.shape; }))ST.shape=d.shape;
    if(typeof d.sig==='boolean')ST.sig=d.sig;
  }
  if(sel&&!findItem(sel))sel=null;
}
function data(){
  return {app:'sseudam-tier',v:2,
    board:{title:ST.title,stamp:ST.stamp,sign:ST.sign,
      tiers:ST.tiers.map(function(t){ return {id:t.id,letter:t.letter,label:t.label,note:t.note,items:t.items.map(function(i){ var o={id:i.id,name:i.name}; if(i.res)o.res=i.res; return o; })}; })},
    design:{design:ST.design,accent:ST.accent,accentHex:ST.accentHex,cols:ST.cols,shape:ST.shape,sig:ST.sig}};
}
try{
  var sv0=JSON.parse(localStorage.getItem(LS)||'null');
  if(sv0&&sv0.v===2)restoreData(sv0,true);
  else{ var sv1=JSON.parse(localStorage.getItem(LS_V1)||'null'); if(sv1&&sv1.v===1)restoreData(sv1,false); }   /* v1 보드(제목·티어·항목)만 이어받는다 */
}catch(e){}
if(!ST.tiers.length)defaultBoard();
var saveT=0;
function save(){ clearTimeout(saveT); saveT=setTimeout(function(){ try{ localStorage.setItem(LS,JSON.stringify(data())); }catch(e){} },250); }
function snapshot(){ return JSON.stringify(data()); }
function restore(snap){ try{ restoreData(JSON.parse(snap),false); }catch(e){ return; } loadResImages(); renderAll(); save(); }
function findItem(id){
  for(var ti=0;ti<ST.tiers.length;ti++){ var t=ST.tiers[ti]; for(var i=0;i<t.items.length;i++)if(t.items[i].id===id)return {ti:ti,i:i,item:t.items[i],tier:t}; }
  return null;
}
function countItems(){ var n=0; ST.tiers.forEach(function(t){ n+=t.items.length; }); return n; }

/* ── 부품 ── */
var api=null, root=null, main=null, mctx=null, raf=0, mounted=false, LAY=null, HIT=[], drag=null, onPaste=null, onDocMove=null, onDocUp=null, fontsReady={}, T={};
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
  back:'<path d="m15 18-6-6 6-6"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  imgOff:'<path d="M10.4 3H19a2 2 0 0 1 2 2v8.6"/><path d="M21 21H5a2 2 0 0 1-2-2V5"/><path d="m21 15-5-5-3.5 3.5"/><path d="M2 2l20 20"/>',
  pipette:'<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  file:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  broom:'<path d="M3 21h18"/><path d="M5 21 9 9l6-6 6 6-12 12"/><path d="m9 9 6 6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers:'<path d="m12 2 8.5 4.9-8.5 4.9L3.5 6.9z"/><path d="m3.5 12 8.5 4.9 8.5-4.9"/><path d="m3.5 17 8.5 4.9 8.5-4.9"/>'
};
function ic(n){ return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(IC[n]||'')+'</svg>'; }
function readTokens(){
  var cs=getComputedStyle(document.documentElement);
  function tk(n,d){ var v=(cs.getPropertyValue(n)||'').trim(); return v||d; }
  T.ink=tk('--ink','#0E1114'); T.ink3=tk('--ink-3','#5F666F'); T.alert=tk('--alert','#C4362A');
}
readTokens();

var CSS=
/* 작업대: 왼쪽 보드(스크롤) + 오른쪽 편집 열(스크롤), 보드 아래 고정 내보내기 줄. 판 높이 = 뷰포트에 맞춤(항목이 늘어도 페이지가 길어지지 않는다) */
'.tier{display:grid;grid-template-columns:minmax(0,1fr) 400px;grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"stage ctl" "act ctl";height:calc(100dvh - 214px);min-height:600px}'+   /* 넓은 작업 영역(1920 → 판 1326): 편집 열 400 · 보드 실제 크기 693 + 여유. 1400 이하는 340 */
'@media (max-width:1400px){.tier{grid-template-columns:minmax(0,1fr) 340px}}'+
'.tier-stage{grid-area:stage;overflow:auto;overscroll-behavior:contain;padding:18px 16px 16px;min-width:0;background:var(--surface-2)}'+
'.tier-cv{position:relative;width:min(100%,693px);margin:0 auto;border-radius:16px}'+
'.tier-cv canvas{display:block;width:100%;height:auto;touch-action:pan-y;cursor:default;border-radius:14px;box-shadow:0 0 0 1px var(--hair),var(--sh-rest)}'+
'.tier-cv canvas.grab{cursor:grab}.tier-cv canvas.drag{cursor:grabbing}.tier-cv canvas.add{cursor:pointer}'+
'.tier-cv canvas:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.tier-cv.over canvas{box-shadow:0 0 0 2px var(--ink),var(--sh-lift)}'+
'.tier-ctl{grid-area:ctl;overflow:auto;overscroll-behavior:contain;min-width:0;border-left:1px solid var(--hair);padding:6px 18px 18px;position:relative}'+
'.tier-act{grid-area:act;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 24px;border-top:1px solid var(--hair);background:var(--surface)}'+
'.tier-act .cta{margin-left:auto}'+
'.tier-act .ghost .ic,.tier-act .cta .ic{width:14px;height:14px}'+
'.tier-chk{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;min-width:0;flex:1 1 260px}'+
'.tier-chk li{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;line-height:1.4;color:var(--ink-2);white-space:nowrap;word-break:keep-all}'+
'.tier-chk li .ic{width:13px;height:13px;flex:none;color:var(--ink-3)}'+
'.tier-chk li.bad{color:var(--alert)}.tier-chk li.bad .ic{color:var(--alert)}'+
'.tier-chk li b{font-weight:600;color:inherit}'+
'.tier-sec{padding:12px 0 14px;border-top:1px solid var(--hair)}.tier-sec:first-child{border-top:0;padding-top:12px}'+
'.tier-st{font-size:13.5px;font-weight:700;letter-spacing:-.025em;margin-bottom:10px;display:flex;align-items:center;gap:8px}'+
'.tier-st .d{font-size:12.5px;font-weight:500;color:var(--ink-3)}'+
'.tier-st .sp{margin-left:auto}'+
'.tier-lbl{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12.5px;font-weight:600;color:var(--ink-2);margin:10px 0 5px}'+
'.tier-lbl:first-of-type{margin-top:0}'+
'.tier-lbl .o{font-weight:500;color:var(--ink-3)}'+
'.tier-cnt{font-size:12.5px;font-weight:500;color:var(--ink-3)}.tier-cnt.bad{color:var(--alert);font-weight:600}'+
'.tier-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 10px}'+
'.tier-2 .tier-lbl{margin-top:10px}'+
'.tier-chips{display:flex;flex-wrap:wrap;gap:6px}'+
'.tier-chips .chip .dot{width:8px;height:8px}'+
'.tier .chip .n{font-size:12.5px}'+   /* 사이트 칩 숫자는 11.5 — 도구 안 라벨 하한 12.5 를 지킨다 */
/* 티어 행 */
'.tier-rows{display:flex;flex-direction:column;gap:8px}'+
'.tier-row{display:grid;grid-template-columns:12px 46px 74px minmax(0,1fr) 28px;gap:6px;align-items:center}'+
'.tier-dot{width:12px;height:12px;border-radius:4px;background:var(--c);box-shadow:inset 0 0 0 1px rgba(14,17,20,.12);flex:none}'+
'.tier-in{height:32px;padding:0 9px;border:0;outline:0;border-radius:9px;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);font:inherit;font-size:13px;letter-spacing:-.02em;color:var(--ink);min-width:0;width:100%;'+
  'transition:box-shadow var(--t-fast) var(--e),background var(--t-fast) var(--e)}'+
'.tier-in:focus{box-shadow:0 0 0 2px var(--ink);background:var(--surface)}'+
'.tier-in::placeholder{color:var(--ink-3)}'+
'.tier-in-l{font-weight:700;text-align:center;padding:0 4px}'+
'.tier-in-hex{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12.5px;width:92px;text-transform:uppercase}'+
'.tier-in-hex.bad{box-shadow:0 0 0 2px var(--alert)}'+
'.tier-ib{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--ink-3);position:relative;'+
  'transition:background var(--t-fast) var(--e),color var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.tier-ib::after{content:"";position:absolute;inset:-6px}'+
'.tier-ib .ic{width:14px;height:14px}'+
'.tier-ib:hover{background:var(--surface-2);color:var(--ink)}.tier-ib:active{transform:scale(.9)}'+
'.tier-ib:disabled{opacity:.3;cursor:default;transform:none;background:none}'+
'.tier-add{margin-top:10px}'+
/* 항목 */
'.tier-new{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:6px;align-items:center;margin-top:4px}'+
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
'.tier-it{display:grid;grid-template-columns:32px minmax(0,1fr) 58px auto;gap:4px;align-items:center;padding:2px;border-radius:10px;'+
  'transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e)}'+
'.tier-ibs{display:inline-flex;align-items:center;gap:12px;padding-left:2px}'+
'.tier-it.sel{background:var(--surface-2);box-shadow:0 0 0 1px var(--hair-2)}'+
'.tier-it .tier-in{background:var(--surface);box-shadow:0 0 0 1px var(--hair)}.tier-it .tier-in:focus{box-shadow:0 0 0 2px var(--ink)}'+
'.tier-it .tier-sel{background-color:var(--surface)}'+
'.tier-th{width:32px;height:32px;border-radius:9px;overflow:visible;display:grid;place-items:center;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);color:var(--ink-3);font-size:13px;font-weight:700;position:relative;'+
  'transition:box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.tier-th::after{content:"";position:absolute;inset:-4px 0 -4px -8px}'+   /* 히트존 40×40 — 오른쪽(이름 입력)으로는 안 넓힌다(게이트 🟡 09-07) */
'.tier-th img{border-radius:9px}'+
'.tier-th img{width:100%;height:100%;object-fit:cover;display:block}'+
'.tier-th .ic{width:14px;height:14px}'+
'.tier-th:hover{box-shadow:0 0 0 2px var(--ink)}.tier-th:active{transform:scale(.94)}'+
'.tier-empty{padding:12px 4px 4px;font-size:12.5px;color:var(--ink-3)}'+
/* 색 */
'.tier-crow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:34px}'+
'.tier-sw{width:28px;height:28px;border-radius:50%;background:var(--c);flex:none;position:relative;box-shadow:inset 0 0 0 1px rgba(14,17,20,.14);'+
  'transition:transform var(--t-fast) var(--e-out),box-shadow var(--t-fast) var(--e)}'+
'.tier-sw::after{content:"";position:absolute;inset:-7px}'+
'.tier-sw:hover{transform:scale(1.08)}'+
'.tier-sw.on{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink)}'+
'.tier-sw:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.tier-sw.custom{background:conic-gradient(from 200deg,#C93C7C,#E3B75E,#15A05A,#0F7C86,#7C5BC7,#C93C7C);display:grid;place-items:center;color:#fff}'+
'.tier-sw.custom .ic{width:13px;height:13px;stroke-width:2;filter:drop-shadow(0 0 1px rgba(0,0,0,.6))}'+
'.tier-sw.custom.has{background:var(--cc)}'+
'.tier-swn{flex-basis:100%;margin-top:2px;font-size:12.5px;color:var(--ink-2);font-weight:600;display:flex;align-items:center;gap:8px}'+
'.tier-swn .num{font-weight:500;color:var(--ink-3)}'+
'.tier-pick{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}'+
'.tier-ramp{display:flex;gap:4px;margin-top:8px}'+
'.tier-ramp span{flex:1;height:10px;border-radius:3px;background:var(--c);box-shadow:inset 0 0 0 1px rgba(14,17,20,.08)}'+
/* 리소스 서랍 — 편집 열을 통째로 덮는다 */
'.tier-res{position:absolute;inset:0;background:var(--surface);display:flex;flex-direction:column;z-index:2}'+
'.tier-res[hidden]{display:none}'+
'.tier-res-h{display:flex;align-items:center;gap:8px;padding:12px 18px 10px;border-bottom:1px solid var(--hair);flex-wrap:wrap}'+
'.tier-res-h b{font-size:13.5px;font-weight:700;letter-spacing:-.025em}'+
'.tier-res-h .sp{margin-left:auto}'+
'.tier-res-f{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--hair)}'+
'.tier-res-f .tier-sel{width:auto;min-width:150px}'+
'.tier-res-g{overflow:auto;overscroll-behavior:contain;padding:12px 18px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;align-content:start;flex:1 1 auto}'+
'.tier-rc{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 4px 7px;border-radius:12px;text-align:left;touch-action:none;user-select:none;-webkit-user-select:none;'+
  'transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.tier-rc img{width:64px;height:64px;border-radius:14px;object-fit:cover;display:block;background:var(--surface-3);box-shadow:0 0 0 1px var(--hair);pointer-events:none}'+
'.tier-rc b{font-size:12.5px;font-weight:600;letter-spacing:-.02em;color:var(--ink);text-align:center;line-height:1.3;word-break:keep-all;max-width:100%;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'+   /* 긴 이름(«바삭튼튼 소아과 의사 우유맛 쿠키»)도 잘리지 않게 3줄 */
'.tier-rc i{font-style:normal;font-size:12.5px;font-weight:600;color:var(--ink-3);font-family:"JetBrains Mono",ui-monospace,monospace}'+
'.tier-rc:hover{background:var(--surface-2)}.tier-rc:active{transform:scale(.97)}'+
'.tier-rc.used{opacity:.45}'+
'.tier-rc:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}'+
'.tier-res-empty{padding:26px 18px;font-size:12.5px;color:var(--ink-3);line-height:1.6}'+
'.tier-ghost{position:fixed;z-index:80;pointer-events:none;width:72px;height:72px;border-radius:16px;overflow:hidden;box-shadow:0 0 0 2px var(--surface),var(--sh-float);transform:translate(-50%,-50%) scale(1.02)}'+
'.tier-ghost img{width:100%;height:100%;object-fit:cover;display:block}'+
'@media (max-width:1180px){.tier{grid-template-columns:minmax(0,1fr) 340px}}'+
'@media (max-width:860px){'+
  '.tier{grid-template-columns:1fr;grid-template-rows:auto auto auto;grid-template-areas:"stage" "act" "ctl";height:auto;min-height:0}'+
  '.tier-stage{overflow:visible;padding:14px 14px 12px}.tier-ctl{overflow:visible;border-left:0;border-top:1px solid var(--hair);padding:0 14px 14px}'+
  '.tier-act{padding:12px 14px}.tier-act .cta{margin-left:0;width:100%;justify-content:space-between}'+
  '.tier-res{position:static;min-height:420px}.tier-res-g{max-height:60vh}'+
'}';

/* ── 색·글꼴 유틸 ── */
function hexRGB(hex){ var n=parseInt(hex.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
function lum(hex){ var c=hexRGB(hex).map(function(v){ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; }
function blendOn(hex,a,base){ var c=hexRGB(hex), b=hexRGB(base||'#FFFFFF'); function m(i){ var s=Math.round(c[i]*a+b[i]*(1-a)).toString(16); return s.length<2?'0'+s:s; } return '#'+m(0)+m(1)+m(2); }
function tierAlpha(i,n){ return n<=1?1:1-(i/(n-1))*.86; }   /* 1.0 → 0.14 등간 */
function contrast(a,b){ var la=lum(a), lb=lum(b); return (Math.max(la,lb)+.05)/(Math.min(la,lb)+.05); }
/* 플라크 글자색 — 흰색 → 디자인 잉크 → 진한 잉크 → 검정 순으로 «4.5:1 을 넘는 첫 후보»(흰·검정 중 하나는 어떤 밝기에서도 4.5 를 넘어 항상 해가 있다).
   고정 임계값(휘도 .42)은 두 번째 티어에서 흰 글자 3.05:1(봄딩)·2.36:1(영도)을 냈고(게이트 🔴 09-07), 흰·잉크 둘 중 큰 쪽만 고르면 봄딩 7단계 A(#D1578E)가 3.96 에 걸렸다 */
function plaqueText(fill,d){
  var c=['#FFFFFF',d.ink,d.inkDeep||d.ink,'#000000'], best=c[0], bc=0;
  for(var i=0;i<c.length;i++){ var v=contrast(fill,c[i]); if(v>=4.5)return c[i]; if(v>bc){ bc=v; best=c[i]; } }
  return best;
}
function accentHex(){ var d=design(); if(ST.accent==='custom')return ST.accentHex; if(ST.accent==='auto')return d.accent; for(var i=0;i<d.sw.length;i++)if(d.sw[i].id===ST.accent)return d.sw[i].c; return d.accent; }
function accentName(){ var d=design(); if(ST.accent==='custom')return {n:'기타',hex:ST.accentHex}; if(ST.accent==='auto')return {n:d.n+' 기본',hex:d.accent}; for(var i=0;i<d.sw.length;i++)if(d.sw[i].id===ST.accent)return {n:d.sw[i].n,hex:d.sw[i].c}; return {n:'',hex:d.accent}; }
function signText(){ return (ST.sign||'').trim()||design().n; }
/* 시그니처 이미지 — 받아 놨고 켜져 있을 때만. 못 받으면 조용히 없는 셈(보드는 그대로 완성) */
function sigImg(){ var d=design(); if(!ST.sig||!d.sig)return null; var im=SIG[d.id]; return (im&&im.complete&&im.naturalWidth)?im:null; }
function loadSig(){
  var d=design(); if(!d.sig||SIG[d.id])return;
  var im=new Image(); im.decoding='async';
  im.onload=function(){ if(mounted)schedule(); };
  im.onerror=function(){ delete SIG[d.id]; };
  SIG[d.id]=im; im.src=SIG_BASE+d.sig;
}
function safeName(s){ return String(s||'').replace(/[\\\/:*?"<>|]/g,'').replace(/\s+/g,'_').slice(0,40); }
function fileName(){ return (safeName(ST.title)||'티어표')+'_티어표.png'; }
function F(w,px,fam){ return w+' '+px+'px '+(fam||design().fam); }

/* ── 치수(논리 px, 폭 693) ── */
var M={tray:6,rTray:20,padX:18,padT:16,padB:14,plW:60,gapPl:12,gapX:10,gapY:12,bandT:12,bandB:12,nameGap:7,plMin:92,titleH:56,titleGap:14,titleFs:25,
       sigH:96,sigLift:34,sigBox:70};   /* 시그니처: 높이 96 · 구분선 위로 34 걸침 · 바닥 영역 70(96−34=62 이 안에 든다) */
function tileW(){ var iw=W-2*M.tray-2*M.padX-M.plW-M.gapPl; return Math.floor((iw-(ST.cols-1)*M.gapX)/ST.cols); }
function tileH(w){ return ST.shape==='card'?Math.round(w*1.28):w; }
function nameFs(t){ return clamp(Math.round(t*.14),12,19); }   /* 4열(135) → 19px → 폰(×0.52) 9.9px */
function rrect(ctx,x,y,w,h,r){ r=Math.max(0,Math.min(r,w/2,h/2)); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
/* 타일 모양 5 — 같은 상자(x,y,w,h) 안에 그린다 */
function shapePath(ctx,x,y,w,h){
  var s=ST.shape, d=design();
  if(s==='circle'){ ctx.beginPath(); ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); ctx.closePath(); return; }
  if(s==='squircle'){ /* 초타원 n=4 */
    var cx=x+w/2, cy=y+h/2, a=w/2, b=h/2, n=4, N=72; ctx.beginPath();
    for(var i=0;i<=N;i++){ var t=i/N*Math.PI*2, c=Math.cos(t), sn=Math.sin(t);
      var px=cx+a*Math.sign(c)*Math.pow(Math.abs(c),2/n), py=cy+b*Math.sign(sn)*Math.pow(Math.abs(sn),2/n);
      if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py); }
    ctx.closePath(); return; }
  if(s==='hex'){ /* 뾰족 위 육각 — 높이 h 에 맞추고 폭은 h*0.866 로 가운데 */
    var hw=Math.min(w,h*.8660254)/2, hh=h/2, cx2=x+w/2, cy2=y+h/2; ctx.beginPath();
    ctx.moveTo(cx2,cy2-hh); ctx.lineTo(cx2+hw,cy2-hh/2); ctx.lineTo(cx2+hw,cy2+hh/2); ctx.lineTo(cx2,cy2+hh); ctx.lineTo(cx2-hw,cy2+hh/2); ctx.lineTo(cx2-hw,cy2-hh/2); ctx.closePath(); return; }
  rrect(ctx,x,y,w,h,Math.round(w*(s==='card'?.14:d.rTile)));
}
function ell(ctx,s,maxW){ if(ctx.measureText(s).width<=maxW)return s; var a=Array.from(s); while(a.length>1){ a.pop(); var t=a.join('')+'…'; if(ctx.measureText(t).width<=maxW)return t; } return '…'; }
function fitFs(ctx,s,maxW,fs,min,w,fam){ for(;fs>min;fs-=1){ ctx.font=F(w,fs,fam); ctx.letterSpacing=(-fs*.025)+'px'; if(ctx.measureText(s).width<=maxW)break; } ctx.font=F(w,fs,fam); ctx.letterSpacing=(-fs*.025)+'px'; return fs; }
/* 이름은 2줄까지 — 어절 경계 우선, 없으면 글자 단위. 2줄째가 넘치면 … (09-07 사용자: «텍스트가 잘린다») */
function nameLines(ctx,name,maxW){
  if(ctx.measureText(name).width<=maxW)return [name];
  var words=name.split(' ');
  if(words.length>1){ for(var k=words.length-1;k>=1;k--){ var a=words.slice(0,k).join(' '), b=words.slice(k).join(' '); if(ctx.measureText(a).width<=maxW)return [a,ell(ctx,b,maxW)]; } }
  var arr=Array.from(name), first='';
  for(var i=0;i<arr.length;i++){ if(ctx.measureText(first+arr[i]).width<=maxW)first+=arr[i]; else break; }
  if(!first)first=arr[0]||'';
  var rest=arr.slice(Array.from(first).length).join('');
  return rest?[first,ell(ctx,rest,maxW)]:[first];
}

/* 배치 — 먼저 재고(layout) 나중에 그린다(draw). 화면·내보내기가 같은 함수를 쓴다 */
function layout(ctx){
  var d=design(), tw=tileW(), th=tileH(tw), nfs=nameFs(tw), nlh=Math.round(nfs*1.2);
  var x0=M.tray+M.padX, innerW=W-2*(M.tray+M.padX), y=M.tray+M.padT;
  ctx.font=F(d.wName,nfs); ctx.letterSpacing=(-nfs*.02)+'px';
  var title=(ST.title||'').trim()||'게임 이름';
  var hd={y:y,h:M.titleH,title:title}; y+=M.titleH+M.titleGap;
  var bands=[], n=ST.tiers.length;
  ST.tiers.forEach(function(t,ti){
    var by=y, note=(t.note||'').trim(), noteH=note?22:0;
    var itemsX=x0+M.plW+M.gapPl, itemsW=innerW-M.plW-M.gapPl;
    var rows=Math.max(1,Math.ceil(t.items.length/ST.cols));
    /* 이름 줄 수는 띠 단위로 통일(격자) — 한 항목이라도 2줄이면 그 띠의 모든 줄이 2줄 높이 */
    var lines=t.items.map(function(it){ var nm=(it.name||'').trim(); return nm?nameLines(ctx,nm,tw-2):[]; });   /* 이름 폭 = 타일 폭 — 이웃 이름과 최소 간격(gapX) 보장, 넘치면 2줄 */
    var maxL=Math.max(1,Math.max.apply(null,lines.map(function(l){ return l.length; }).concat([1])));
    var rowH=th+M.nameGap+maxL*nlh;
    var blockH=t.items.length?rows*rowH+(rows-1)*M.gapY:th;
    var contentH=Math.max(noteH+blockH,M.plMin);
    var cy=by+M.bandT, off=Math.round((contentH-noteH-blockH)/2), tilesY=cy+noteH+off;   /* 타일 블록을 플라크 높이 안에서 세로 가운데 */
    var tiles=t.items.map(function(it,i){ var r=Math.floor(i/ST.cols), c=i%ST.cols; return {id:it.id,ti:ti,i:i,x:itemsX+c*(tw+M.gapX),y:tilesY+r*(rowH+M.gapY),w:tw,h:th,lines:lines[i]}; });
    bands.push({ti:ti,y:by,h:M.bandT+contentH+M.bandB,pl:{x:x0,y:cy,w:M.plW,h:contentH},note:note,noteY:cy+off,itemsX:itemsX,itemsW:itemsW,tilesY:tilesY,tiles:tiles,rowH:rowH,tw:tw,th:th,last:ti===n-1});
    y=by+M.bandT+contentH+M.bandB;
  });
  /* 바닥 — 기준 스탬프 · 서명 · 작성자 시그니처 스티커(오른쪽 끝, 구분선 위로 걸친다) */
  var stamp=(ST.stamp||'').trim(), sign=signText(), sg=sigImg();
  var ft={y:y,stamp:stamp,sign:sign,h:sg?M.sigBox:40,sig:null};
  if(sg){ var sh=M.sigH, sw=Math.round(sh*(sg.naturalWidth/sg.naturalHeight)); ft.sig={img:sg,w:sw,h:sh,x:x0+innerW-sw,y:y-M.sigLift}; }
  y+=ft.h+M.padB+M.tray;
  return {H:Math.max(Math.round(y),240),tw:tw,th:th,nfs:nfs,nlh:nlh,x0:x0,innerW:innerW,hd:hd,bands:bands,ft:ft};
}
function drawEmptySlot(ctx,x,y,w,h){
  var d=design(); ctx.save();
  ctx.fillStyle=d.slot; shapePath(ctx,x,y,w,h); ctx.fill();
  ctx.setLineDash([7,5]); ctx.strokeStyle=d.hair3; ctx.lineWidth=1.5; shapePath(ctx,x+1,y+1,w-2,h-2); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle=d.ink3; ctx.lineWidth=2; ctx.lineCap='round'; var cx=x+w/2, cy=y+h/2, l=Math.min(w,h)*.1;
  ctx.beginPath(); ctx.moveTo(cx-l,cy); ctx.lineTo(cx+l,cy); ctx.moveTo(cx,cy-l); ctx.lineTo(cx,cy+l); ctx.stroke();
  ctx.restore();
}
function drawTile(ctx,tl,it,L,a,acc,selected){
  var d=design(), x=tl.x, y=tl.y, w=tl.w, h=tl.h, im=IMG[it.id], name=(it.name||'').trim();
  ctx.save();
  if(im&&im.img){
    ctx.save(); shapePath(ctx,x,y,w,h); ctx.clip();
    var k=Math.max(w/im.w,h/im.h), dw=im.w*k, dh=im.h*k;
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    /* 투명 배경 스프라이트가 «타일에 안 맞아» 보이지 않게 — 타일 전체를 디자인 틴트의 방사 바탕으로 채운 뒤 그림을 얹는다 */
    var bg=ctx.createRadialGradient(x+w/2,y+h*.42,w*.08,x+w/2,y+h/2,w*.78); bg.addColorStop(0,'#FFFFFF'); bg.addColorStop(1,d.tileTint||d.slot);
    ctx.fillStyle=bg; ctx.fillRect(x,y,w,h);
    try{ ctx.drawImage(im.img,x+(w-dw)/2,y+(h-dh)/2,dw,dh); }catch(e){}
    ctx.restore();
    ctx.strokeStyle=blendOn(acc,Math.max(.25,a)); ctx.lineWidth=2.5; shapePath(ctx,x+1.25,y+1.25,w-2.5,h-2.5); ctx.stroke();
  }else if(name){
    ctx.fillStyle=d.slot; shapePath(ctx,x,y,w,h); ctx.fill();
    ctx.strokeStyle=d.hair2; ctx.lineWidth=1; shapePath(ctx,x+.5,y+.5,w-1,h-1); ctx.stroke();
    ctx.fillStyle=d.ink3; ctx.font=F(d.wTitle,Math.round(Math.min(w,h)*.36)); ctx.letterSpacing='0px'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(Array.from(name)[0],x+w/2,y+h/2+h*.02); ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  }else drawEmptySlot(ctx,x,y,w,h);
  if(name){
    ctx.fillStyle=d.ink; ctx.font=F(d.wName,L.nfs); ctx.letterSpacing=(-L.nfs*.02)+'px'; ctx.textAlign='center';
    var ls=tl.lines&&tl.lines.length?tl.lines:nameLines(ctx,name,w-2);
    ls.forEach(function(s,li){ ctx.fillText(s,x+w/2,y+h+M.nameGap+Math.round(L.nfs*.95)+li*L.nlh); });
    ctx.textAlign='left';
  }
  if(selected){ ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=6; shapePath(ctx,x-3,y-3,w+6,h+6); ctx.stroke(); ctx.strokeStyle=T.ink; ctx.lineWidth=3; shapePath(ctx,x-3,y-3,w+6,h+6); ctx.stroke(); }
  ctx.restore();
}
function drawGhost(ctx,dg,L,acc){
  var f=findItem(dg.id); if(!f)return;
  var tl={x:dg.px-dg.dx,y:dg.py-dg.dy,w:L.tw,h:L.th};
  ctx.save(); ctx.globalAlpha=.94; ctx.shadowColor='rgba(14,17,20,.3)'; ctx.shadowBlur=24; ctx.shadowOffsetY=10;
  ctx.fillStyle='#FFFFFF'; shapePath(ctx,tl.x,tl.y,tl.w,tl.h); ctx.fill();
  ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  drawTile(ctx,tl,f.item,L,tierAlpha(f.ti,ST.tiers.length),acc,false);
  ctx.restore();
}
function heart(ctx,cx,cy,s){ ctx.beginPath(); ctx.moveTo(cx,cy+s*.35); ctx.bezierCurveTo(cx-s*.5,cy-s*.05,cx-s*.42,cy-s*.5,cx,cy-s*.22); ctx.bezierCurveTo(cx+s*.42,cy-s*.5,cx+s*.5,cy-s*.05,cx,cy+s*.35); ctx.closePath(); }
function draw(ctx,L,o){
  o=o||{};
  var d=design(), acc=accentHex(), n=ST.tiers.length;
  ctx.save(); ctx.clearRect(0,0,W,L.H);
  /* 트레이 → 코어 */
  var g=ctx.createLinearGradient(0,0,0,L.H); g.addColorStop(0,d.tray); g.addColorStop(1,d.tray2);
  ctx.fillStyle=g; rrect(ctx,0,0,W,L.H,M.rTray); ctx.fill();
  ctx.strokeStyle=d.hair; ctx.lineWidth=1; rrect(ctx,.5,.5,W-1,L.H-1,M.rTray); ctx.stroke();
  ctx.fillStyle=d.paper; rrect(ctx,M.tray,M.tray,W-2*M.tray,L.H-2*M.tray,M.rTray-M.tray); ctx.fill();
  /* 제목 띠 — 가운데 정렬, 작성자 처리 */
  var hd=L.hd;
  ctx.fillStyle=d.titleFill; rrect(ctx,L.x0,hd.y,L.innerW,hd.h,d.rTitle); ctx.fill();
  var tfs=fitFs(ctx,hd.title,L.innerW-56,M.titleFs,15,d.wTitle);
  ctx.fillStyle=d.titleInk; ctx.textAlign='center'; ctx.textBaseline='middle';
  var tcy=hd.y+hd.h/2-(d.glyph==='heart'?3:0);
  ctx.fillText(hd.title,L.x0+L.innerW/2,tcy);
  var twd=ctx.measureText(hd.title).width;
  if(d.glyph==='heart'){ ctx.fillStyle=d.titleRule; var rw=Math.max(36,Math.round(twd*.34)); rrect(ctx,L.x0+L.innerW/2-rw/2,tcy+Math.round(tfs*.62),rw,3,1.5); ctx.fill(); }
  else{ ctx.fillStyle=d.titleRule; ctx.fillRect(L.x0,hd.y+hd.h-3,L.innerW,3); }
  ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  /* 티어 띠 */
  L.bands.forEach(function(b,bi){
    var t=ST.tiers[b.ti], a=tierAlpha(b.ti,n), fill=blendOn(acc,a,d.paper), lc=plaqueText(fill,d);
    if(bi>0){ ctx.save(); ctx.strokeStyle=d.hair2; ctx.lineWidth=1; if(d.sep==='dash')ctx.setLineDash([3,5]); ctx.beginPath(); ctx.moveTo(L.x0,b.y+.5); ctx.lineTo(L.x0+L.innerW,b.y+.5); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle=fill; rrect(ctx,b.pl.x,b.pl.y,b.pl.w,b.pl.h,d.rPlaque); ctx.fill();
    if(a<.35){ ctx.strokeStyle=d.hair2; ctx.lineWidth=1; rrect(ctx,b.pl.x+.5,b.pl.y+.5,b.pl.w-1,b.pl.h-1,d.rPlaque); ctx.stroke(); }
    var letter=(t.letter||'').trim()||'?', label=(t.label||'').trim(), al=Array.from(letter).length;
    var lfs=fitFs(ctx,letter,b.pl.w-10,al<=1?30:(al===2?24:19),12,d.wTitle);
    var lblFs=12, blockH=Math.round(lfs*.9)+(label?4+lblFs:0), ty=b.pl.y+(b.pl.h-blockH)/2;   /* 글자+라벨 묶음을 플라크 세로 가운데 */
    ctx.fillStyle=lc; ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.font=F(d.wTitle,lfs); ctx.letterSpacing=(-lfs*.03)+'px';
    ctx.fillText(letter,b.pl.x+b.pl.w/2,ty+Math.round(lfs*.82));
    if(label){ ctx.font=F(d.wName,lblFs); ctx.letterSpacing='-0.2px'; ctx.fillText(ell(ctx,label,b.pl.w-8),b.pl.x+b.pl.w/2,ty+Math.round(lfs*.9)+4+Math.round(lblFs*.9)); }   /* 라벨도 불투명 — 12px 라 대비를 깎지 않는다 */
    ctx.textAlign='left';
    if(b.note){ ctx.fillStyle=d.ink2; ctx.font=F(d.wName,13); ctx.letterSpacing='-0.2px'; ctx.fillText(ell(ctx,b.note,b.itemsW),b.itemsX,b.noteY+14); }
    b.tiles.forEach(function(tl){
      var it=t.items[tl.i], ghost=o.drag&&o.drag.moved&&o.drag.id===it.id;
      ctx.globalAlpha=ghost?.35:1; drawTile(ctx,tl,it,L,a,acc,!o.export&&o.sel===it.id&&!ghost); ctx.globalAlpha=1;
    });
    if(!t.items.length)drawEmptySlot(ctx,b.itemsX,b.tilesY,b.tw,b.th);
  });
  /* 바닥 — 기준 스탬프 · 서명 · 시그니처 스티커 */
  var ft=L.ft;
  ctx.save(); ctx.strokeStyle=d.hair2; ctx.lineWidth=1; if(d.sep==='dash')ctx.setLineDash([3,5]); ctx.beginPath(); ctx.moveTo(L.x0,ft.y+.5); ctx.lineTo(L.x0+L.innerW,ft.y+.5); ctx.stroke(); ctx.restore();
  var fy=ft.y+(ft.sig?46:26), right=L.x0+L.innerW-(ft.sig?ft.sig.w+12:0);
  if(ft.stamp){ ctx.fillStyle=d.ink3; ctx.font=F('500',12.5); ctx.letterSpacing='-0.1px'; ctx.textAlign='left'; ctx.fillText(ell(ctx,ft.stamp,right-L.x0-100),L.x0,fy); }
  ctx.font=F(d.wTitle,14); ctx.letterSpacing='-0.3px'; ctx.textAlign='right'; ctx.fillStyle=d.ink;
  var sw=ctx.measureText(ft.sign).width; ctx.fillText(ft.sign,right,fy);
  ctx.fillStyle=acc;
  if(d.glyph==='heart'){ heart(ctx,right-sw-14,fy-5,12); ctx.fill(); }
  else{ rrect(ctx,right-sw-18,fy-11,9,9,2); ctx.fill(); }
  ctx.textAlign='left';
  if(ft.sig){ try{ ctx.drawImage(ft.sig.img,ft.sig.x,ft.sig.y,ft.sig.w,ft.sig.h); }catch(e){} }
  if(o.drag&&o.drag.moved&&o.drag.target){ var mk=o.drag.target.mk; ctx.fillStyle=T.ink; rrect(ctx,mk.x,mk.y,4,mk.h,2); ctx.fill(); }
  if(o.drag&&o.drag.moved&&o.drag.id)drawGhost(ctx,o.drag,L,acc);
  ctx.restore();
}

/* ── 렌더 파이프(화면 = 2배 해상도로 그리고 CSS 로 줄인다 → 693 표시에서도 또렷) ── */
var DPR=2;
function paint(){
  if(!mounted||!main)return;
  mctx.setTransform(1,0,0,1,0,0);
  LAY=layout(mctx);
  var pw=W*DPR, ph=LAY.H*DPR;
  if(main.width!==pw||main.height!==ph){ main.width=pw; main.height=ph; }
  mctx.setTransform(DPR,0,0,DPR,0,0);
  draw(mctx,LAY,{sel:sel,drag:drag});
  HIT=[]; LAY.bands.forEach(function(b){ b.tiles.forEach(function(t){ HIT.push(t); }); });
  checks();
  var fn=$('tiFn'); if(fn)fn.textContent=fileName()+' · '+(W*EXPORT_SCALE)+'×'+(LAY.H*EXPORT_SCALE);
}
function schedule(){ if(raf)return; raf=requestAnimationFrame(function(){ raf=0; paint(); }); }
function exportCanvas(){ var c=document.createElement('canvas'); var x=c.getContext('2d'); var L=layout(x); c.width=W*EXPORT_SCALE; c.height=L.H*EXPORT_SCALE; x.setTransform(EXPORT_SCALE,0,0,EXPORT_SCALE,0,0); draw(x,L,{export:true}); return c; }
function toBlob(){ return new Promise(function(res){ exportCanvas().toBlob(function(b){ res(b); },'image/png'); }); }
/* 검사 — 폰 표시 크기는 «693px 그림이 네이버 모바일 본문(≈360px)에 놓일 때» 기준(×0.52) */
function checks(){
  var ul=$('tiChk'); if(!ul||!LAY)return;
  var n=0, noImg=0, noName=0;
  ST.tiers.forEach(function(t){ t.items.forEach(function(i){ n++; if(!IMG[i.id]||!IMG[i.id].img)noImg++; if(!(i.name||'').trim())noName++; }); });
  var rows=[{ok:n>0,t:'항목 <b>'+n+'</b> · 티어 <b>'+ST.tiers.length+'</b>'}];
  if(n&&noImg)rows.push({ok:false,t:'그림 없음 <b>'+noImg+'</b>'+(noImg===n?' · 양식':'')});
  if(noName)rows.push({ok:false,t:'빈 슬롯 <b>'+noName+'</b>'});
  var ph=Math.round(LAY.nfs*.52*10)/10; rows.push({ok:ph>=9.5,t:'폰 이름 ≈ <b>'+ph+'px</b>'+(ph<9.5?' · 한 줄 수 줄이기':'')});
  rows.push({ok:LAY.H<=2200,t:'<b>693×'+LAY.H+'</b>'+(LAY.H>2200?' · 길어요, 나눠 올리기':'')});
  ul.innerHTML=rows.map(function(r){ return '<li class="'+(r.ok?'':'bad')+'">'+ic(r.ok?'check':'alert')+'<span>'+r.t+'</span></li>'; }).join('');
}

/* ── 이미지 ── */
function setImageURL(id,url,keepUrl,res){
  return new Promise(function(resolve,reject){
    var im=new Image(); im.decoding='async';
    im.onload=function(){
      var old=IMG[id]; if(old&&old.url&&old.blob)try{ URL.revokeObjectURL(old.url); }catch(e){}
      IMG[id]={img:im,w:im.naturalWidth,h:im.naturalHeight,url:url,blob:!!keepUrl,res:res||null};
      renderList(); schedule(); resolve(im);
    };
    im.onerror=function(){ if(keepUrl)try{ URL.revokeObjectURL(url); }catch(e){} reject(new Error('img')); };
    im.src=url;
  });
}
function setImageFile(id,f){
  if(!f||!/^image\//.test(f.type)){ if(api)api.toast('이미지 파일만 넣을 수 있어요',{kind:'err'}); return Promise.reject(new Error('type')); }
  var it=findItem(id); if(it&&it.item.res)delete it.item.res;   /* 손수 넣은 그림이 리소스 참조를 대체한다 */
  return setImageURL(id,URL.createObjectURL(f),true).then(function(){ save(); }).catch(function(){ if(api)api.toast('이미지를 읽지 못했어요',{kind:'err'}); });
}
function clearImage(id){ var im=IMG[id]; var it=findItem(id); if(it&&it.item.res){ delete it.item.res; save(); } if(!im)return; if(im.blob)try{ URL.revokeObjectURL(im.url); }catch(e){} delete IMG[id]; renderList(); schedule(); }
function fileBase(f){ return String(f&&f.name||'').replace(/\.[a-z0-9]+$/i,'').replace(/[_\-]+/g,' ').trim().slice(0,20); }
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
/* 리소스 참조가 있는 항목의 그림을 묶음에서 읽는다(불러오기·새로고침·되돌리기 뒤) */
function loadResImages(){
  ST.tiers.forEach(function(t){ t.items.forEach(function(it){
    if(!it.res)return; var im=IMG[it.id]; if(im&&im.res&&im.res.b===it.res.b&&im.res.c===it.res.c)return;
    resBundle(it.res.b).then(function(b){ var ch=b&&b.map[it.res.c]; if(ch)setImageURL(it.id,RES_BASE+b.id+'/'+ch.file,false,{b:it.res.b,c:it.res.c}); }).catch(function(){});
  }); });
}

/* ── 편집(내용) ── */
function addNames(ti,text){
  var names=String(text||'').split(/[,\n、]/).map(function(s){ return s.trim().slice(0,20); });
  if(names.length>1)names=names.filter(Boolean);
  if(!names.length)names=[''];
  if(countItems()+names.length>MAX_ITEMS){ api.toast('항목은 최대 '+MAX_ITEMS+'개까지예요',{kind:'err'}); return []; }
  var tier=ST.tiers[clamp(ti,0,ST.tiers.length-1)], ids=[];
  names.forEach(function(nm){ var it=mkItem(nm); tier.items.push(it); ids.push(it.id); });
  sel=ids[ids.length-1]; renderAll(); save();
  return ids;
}
function addRes(bundleId,cid,ti,idx){
  var b=RES.cache[bundleId]; var ch=b&&b.map[cid]; if(!ch)return null;
  if(countItems()+1>MAX_ITEMS){ api.toast('항목은 최대 '+MAX_ITEMS+'개까지예요',{kind:'err'}); return null; }
  var tier=ST.tiers[clamp(ti,0,ST.tiers.length-1)], it=mkItem(ch.name.slice(0,20),{b:bundleId,c:cid});
  if(idx==null||idx>tier.items.length)idx=tier.items.length;
  tier.items.splice(idx,0,it); sel=it.id; renderAll(); save();
  setImageURL(it.id,RES_BASE+bundleId+'/'+ch.file,false,{b:bundleId,c:cid}).catch(function(){ api.toast(ch.name+' 그림을 읽지 못했어요',{kind:'err'}); });
  return it.id;
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
  ST.tiers.push(mkTier(pick||'','',''));
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
    var snap=snapshot(); restoreData(d,true); loadResImages(); renderAll(); save();
    api.toast((ST.title||'티어표')+' 불러옴',{action:'되돌리기',onAction:function(){ restore(snap); }});
  };
  rd.onerror=function(){ api.toast('파일을 읽지 못했어요',{kind:'err'}); };
  rd.readAsText(f);
}

/* ── 리소스 묶음 ── */
var RES={index:null,cache:{},open:false,bundle:'',filter:'',pending:null};
function resIndex(){
  if(RES.index)return Promise.resolve(RES.index);
  if(RES.pending)return RES.pending;
  RES.pending=fetch(RES_BASE+'index.json',{cache:'no-cache'}).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); })
    .then(function(j){ RES.index=(j&&Array.isArray(j.bundles))?j.bundles.filter(function(b){ return b&&/^[a-z0-9-]+$/.test(b.id||''); }):[]; RES.pending=null; return RES.index; })
    .catch(function(e){ RES.pending=null; throw e; });
  return RES.pending;
}
function resBundle(id){
  if(!/^[a-z0-9-]+$/.test(id||''))return Promise.reject(new Error('id'));
  if(RES.cache[id])return Promise.resolve(RES.cache[id]);
  return fetch(RES_BASE+id+'/manifest.json',{cache:'no-cache'}).then(function(r){ if(!r.ok)throw new Error(r.status); return r.json(); }).then(function(m){
    var chars=(m&&Array.isArray(m.characters)?m.characters:[]).filter(function(c){ return c&&/^[A-Za-z0-9_-]+$/.test(c.id||'')&&/^[A-Za-z0-9_.-]+$/.test(c.file||''); });
    var map={}; chars.forEach(function(c){ map[c.id]=c; });
    var rar=[]; chars.forEach(function(c){ if(c.rarity&&rar.indexOf(c.rarity)<0)rar.push(c.rarity); });
    RES.cache[id]={id:id,game:m.game||id,updated:m.updated||'',source:m.source||null,chars:chars,map:map,rarities:rar};
    return RES.cache[id];
  });
}
function usedRes(){ var u={}; ST.tiers.forEach(function(t){ t.items.forEach(function(i){ if(i.res)u[i.res.b+'/'+i.res.c]=1; }); }); return u; }
function openRes(){
  var box=$('tiRes'); if(!box)return; RES.open=true; box.hidden=false;
  var g=$('tiResG'); g.innerHTML='<div class="tier-res-empty">리소스 목록을 읽는 중</div>';
  resIndex().then(function(list){
    if(!list.length){ g.innerHTML='<div class="tier-res-empty">리소스 묶음이 없어요 · _tools/tier-res.mjs 로 만든 뒤 <b>_toolbox/tier/res/index.json</b> 에 등록</div>'; $('tiResB').innerHTML=''; return; }
    if(!RES.bundle||!list.some(function(b){ return b.id===RES.bundle; }))RES.bundle=list[0].id;
    $('tiResB').innerHTML=list.map(function(b){ return '<option value="'+esc(b.id)+'"'+(b.id===RES.bundle?' selected':'')+'>'+esc(b.game)+(b.count?' · '+b.count:'')+'</option>'; }).join('');
    return loadResGrid();
  }).catch(function(){ g.innerHTML='<div class="tier-res-empty">리소스 목록을 읽지 못했어요</div>'; });
  var back=$('tiResBack'); if(back)back.focus();
}
function closeRes(){ var box=$('tiRes'); if(!box)return; RES.open=false; box.hidden=true; var b=$('tiResOpen'); if(b)b.focus(); }
function loadResGrid(){
  var g=$('tiResG'); if(!g)return;
  g.innerHTML='<div class="tier-res-empty">읽는 중</div>';
  return resBundle(RES.bundle).then(function(b){
    if(!RES.open)return;
    var chips=$('tiResF'); var rar=b.rarities;
    chips.innerHTML=(rar.length>1?['<button type="button" class="chip'+(RES.filter===''?' on':'')+'" data-r="" aria-pressed="'+(RES.filter==='')+'">전체 <span class="n">'+b.chars.length+'</span></button>'].concat(rar.map(function(r){ var c=b.chars.filter(function(x){ return x.rarity===r; }).length; return '<button type="button" class="chip'+(RES.filter===r?' on':'')+'" data-r="'+esc(r)+'" aria-pressed="'+(RES.filter===r)+'">'+esc(r)+' <span class="n">'+c+'</span></button>'; })).join(''):'');
    if(RES.filter&&rar.indexOf(RES.filter)<0)RES.filter='';
    var used=usedRes(), shown=b.chars.filter(function(c){ return !RES.filter||c.rarity===RES.filter; });
    g.innerHTML=shown.length?shown.map(function(c){
      var k=b.id+'/'+c.id;
      return '<button type="button" class="tier-rc'+(used[k]?' used':'')+'" data-b="'+esc(b.id)+'" data-c="'+esc(c.id)+'" aria-label="'+esc(c.name+(c.rarity?' · '+c.rarity:'')+(used[k]?' · 보드에 있음':''))+'">'+
        '<img src="'+esc(RES_BASE+b.id+'/'+c.file)+'" alt="" loading="lazy" draggable="false"><b>'+esc(c.name)+'</b>'+(c.rarity?'<i>'+esc(c.rarity)+'</i>':'')+'</button>';
    }).join(''):'<div class="tier-res-empty">해당 희귀도 리소스가 없어요</div>';
    var meta=$('tiResM'); if(meta)meta.textContent=(b.updated?b.updated+' 기준':'')+(shown.length!==b.chars.length?' · '+shown.length+'/'+b.chars.length:'');
  }).catch(function(){ g.innerHTML='<div class="tier-res-empty">묶음을 읽지 못했어요</div>'; });
}
/* 서랍 카드 → 보드로 끌기(포인터). 놓는 자리 = 캔버스 위면 그 자리, 아니면 «넣을 티어» 끝 */
var rdrag=null, ghostEl=null;
function bindResDrag(){
  var g=$('tiResG');
  g.addEventListener('pointerdown',function(e){
    var b=e.target.closest('.tier-rc'); if(!b||(e.button!==0&&e.pointerType==='mouse'))return;
    rdrag={b:b.dataset.b,c:b.dataset.c,sx:e.clientX,sy:e.clientY,moved:false,src:b.querySelector('img').src,pid:e.pointerId};
    try{ b.setPointerCapture(e.pointerId); }catch(x){}
  });
  onDocMove=function(e){
    if(!rdrag)return;
    if(!rdrag.moved){ if(Math.abs(e.clientX-rdrag.sx)+Math.abs(e.clientY-rdrag.sy)<7)return; rdrag.moved=true;
      ghostEl=document.createElement('div'); ghostEl.className='tier-ghost'; ghostEl.innerHTML='<img src="'+esc(rdrag.src)+'" alt="">'; document.body.appendChild(ghostEl); }
    ghostEl.style.left=e.clientX+'px'; ghostEl.style.top=e.clientY+'px';
    var p=cvPtFromClient(e.clientX,e.clientY), over=!!p;
    drag=over?{id:null,moved:true,target:dropTarget(p.x,p.y),px:p.x,py:p.y}:null;
    var cv=$('tiCv'); if(cv)cv.classList.toggle('over',over);
    schedule();
  };
  onDocUp=function(e){
    if(!rdrag)return;
    var d=rdrag; rdrag=null;
    if(ghostEl){ ghostEl.remove(); ghostEl=null; }
    var cv=$('tiCv'); if(cv)cv.classList.remove('over');
    drag=null;
    if(!d.moved)return;   /* 클릭은 click 핸들러가 처리 */
    var p=cvPtFromClient(e.clientX,e.clientY);
    if(p){ var tg=dropTarget(p.x,p.y); addRes(d.b,d.c,tg?tg.ti:0,tg?tg.idx:null); }
    else schedule();
    loadResGrid();
  };
  document.addEventListener('pointermove',onDocMove);
  document.addEventListener('pointerup',onDocUp);
  document.addEventListener('pointercancel',onDocUp);
  g.addEventListener('click',function(e){
    var b=e.target.closest('.tier-rc'); if(!b)return;
    if(rdrag&&rdrag.moved)return;
    var f=sel&&findItem(sel), ti=f?f.ti:newTierIdx();
    var id=addRes(b.dataset.b,b.dataset.c,ti,null);
    if(id){ api.toast(RES.cache[b.dataset.b].map[b.dataset.c].name+' → '+(ST.tiers[ti].letter||'티어')); loadResGrid(); }
  });
}

/* ── 마크업 ── */
function swatchHtml(){
  var d=design();
  return d.sw.map(function(s){ return '<button type="button" class="tier-sw'+(ST.accent===s.id?' on':'')+'" data-c="'+s.id+'" style="--c:'+s.c+'" aria-label="'+esc(d.n+' '+s.n)+'" aria-pressed="'+(ST.accent===s.id)+'" title="'+esc(s.n)+'"></button>'; }).join('')+
    '<button type="button" class="tier-sw custom'+(ST.accent==='custom'?' on has':'')+'" data-c="custom" style="--cc:'+ST.accentHex+'" aria-label="기타 색 (팔레트)" aria-pressed="'+(ST.accent==='custom')+'" title="팔레트">'+ic('pipette')+'</button>'+
    '<input class="tier-in tier-in-hex" id="tiHex" maxlength="7" value="'+esc(accentHex().toUpperCase())+'" aria-label="포인트 색 헥스코드" spellcheck="false" autocomplete="off">'+
    '<input type="color" class="tier-pick" id="tiPick" value="'+ST.accentHex+'" aria-label="포인트 색 팔레트" tabindex="-1">';
}
function chip(id,txt,on,extra){ return '<button type="button" class="chip'+(on?' on':'')+'" data-v="'+esc(id)+'" aria-pressed="'+(on?'true':'false')+'"'+(extra||'')+'>'+txt+'</button>'; }
function html(){
  return '<div class="tier">'+
    '<section class="tier-stage" aria-label="티어 보드">'+
      '<div class="tier-cv" id="tiCv"><canvas id="tiCanvas" width="'+(W*DPR)+'" height="600" tabindex="0" aria-label="티어 보드 · 항목을 끌어 티어와 순서를 바꿔요"></canvas></div>'+
      '<input type="file" id="tiFile" accept="image/*" multiple hidden>'+
      '<input type="file" id="tiJsonFile" accept="application/json,.json" hidden>'+
    '</section>'+
    '<section class="tier-act" aria-label="내보내기">'+
      '<ul class="tier-chk" id="tiChk" aria-live="polite"></ul>'+
      '<button type="button" class="ghost" id="tiCopy">'+ic('copy')+'복사</button>'+
      '<button type="button" class="ghost" id="tiJson" title="보드 JSON 저장">'+ic('file')+'JSON</button>'+
      '<button type="button" class="ghost" id="tiLoad" title="보드 JSON 불러오기">'+ic('upload')+'열기</button>'+
      '<button type="button" class="ghost" id="tiClear">'+ic('broom')+'비우기</button>'+
      '<button type="button" class="cta" id="tiSave" title="" ><span>PNG 저장</span><span class="knob">'+ic('download')+'</span></button>'+
      '<div class="tier-cnt num" id="tiFn" style="flex-basis:100%"></div>'+
    '</section>'+
    '<section class="tier-ctl" aria-label="설정">'+
      '<div class="tier-sec"><div class="tier-st">디자인</div>'+
        '<div class="tier-chips" id="tiDesign" role="group" aria-label="디자인">'+Object.keys(DESIGNS).map(function(k){ var d=DESIGNS[k]; return chip(k,'<span class="dot" style="--ac:'+d.dot+'"></span>'+esc(d.n),ST.design===k); }).join('')+
          '<button type="button" class="chip'+(ST.sig?' on':'')+'" id="tiSig" aria-pressed="'+(ST.sig?'true':'false')+'" title="보드 바닥에 작성자 캐릭터를 넣어요">시그니처</button></div>'+
        '<div class="tier-lbl"><span>포인트 색</span></div>'+
        '<div class="tier-crow" id="tiSws" role="group" aria-label="포인트 색">'+swatchHtml()+'<span class="tier-swn" id="tiSwn"></span></div>'+
        '<div class="tier-ramp" id="tiRamp" aria-hidden="true"></div>'+
        '<div class="tier-lbl"><span>타일</span></div>'+
        '<div class="tier-chips" id="tiShape" role="group" aria-label="타일 모양">'+SHAPES.map(function(s){ return chip(s.id,esc(s.n),ST.shape===s.id); }).join('')+'</div>'+
        '<div class="tier-lbl"><span>한 줄에</span></div>'+
        '<div class="tier-chips" id="tiCols" role="group" aria-label="한 줄 항목 수">'+COLS.map(function(c){ return chip(String(c),c+'개',ST.cols===c); }).join('')+'</div>'+
      '</div>'+
      '<div class="tier-sec"><div class="tier-st">제목</div>'+
        '<label class="tier-lbl" for="tiTitle"><span>게임 이름</span><span class="tier-cnt num" id="tiTitleCnt"></span></label>'+
        '<input class="f-i" id="tiTitle" maxlength="30" placeholder="예: 쿠키런: 크럼블" autocomplete="off" value="'+esc(ST.title)+'">'+
        '<div class="tier-2">'+
          '<div><label class="tier-lbl" for="tiStamp"><span>기준</span></label><input class="f-i" id="tiStamp" maxlength="40" placeholder="예: v1.2 패치 · 9.7 기준" autocomplete="off" value="'+esc(ST.stamp)+'"></div>'+
          '<div><label class="tier-lbl" for="tiSign"><span>서명</span></label><input class="f-i" id="tiSign" maxlength="12" placeholder="'+esc(design().n)+'" autocomplete="off" value="'+esc(ST.sign)+'"></div>'+
        '</div>'+
      '</div>'+
      '<div class="tier-sec"><div class="tier-st">티어<span class="d" id="tiTd"></span></div>'+
        '<div class="tier-rows" id="tiRows"></div>'+
        '<button type="button" class="ghost tier-add" id="tiTierAdd">'+ic('plus')+'티어 추가</button>'+
      '</div>'+
      '<div class="tier-sec"><div class="tier-st">항목<span class="d" id="tiIc"></span><span class="sp"></span><button type="button" class="ghost" id="tiResOpen">'+ic('grid')+'리소스 불러오기</button></div>'+
        '<div class="tier-new"><select class="tier-sel" id="tiNewT" aria-label="넣을 티어"></select>'+
          '<input class="tier-in" id="tiNew" maxlength="120" placeholder="이름 · 쉼표로 여러 개" autocomplete="off" aria-label="추가할 항목 이름">'+
          '<button type="button" class="ghost" id="tiAdd">'+ic('plus')+'추가</button></div>'+
        '<div class="tier-list" id="tiList"></div>'+
      '</div>'+
      '<div class="tier-res" id="tiRes" hidden>'+
        '<div class="tier-res-h"><button type="button" class="tier-ib" id="tiResBack" aria-label="편집으로 돌아가기">'+ic('back')+'</button><b>리소스</b>'+
          '<select class="tier-sel" id="tiResB" aria-label="게임"></select><span class="tier-cnt" id="tiResM"></span></div>'+
        '<div class="tier-res-f" id="tiResF" role="group" aria-label="희귀도"></div>'+
        '<div class="tier-res-g" id="tiResG"></div>'+
      '</div>'+
    '</section>'+
  '</div>';
}
function tierOpts(cur){ return ST.tiers.map(function(t,i){ return '<option value="'+i+'"'+(i===cur?' selected':'')+'>'+esc(t.letter||'?')+'</option>'; }).join(''); }
function renderTiers(){
  var box=$('tiRows'); if(!box)return;
  var n=ST.tiers.length, acc=accentHex(), d=design();
  box.innerHTML=ST.tiers.map(function(t,i){
    return '<div class="tier-row" data-tid="'+t.id+'">'+
      '<span class="tier-dot" style="--c:'+blendOn(acc,tierAlpha(i,n),d.paper)+'"></span>'+
      '<input class="tier-in tier-in-l" data-f="letter" maxlength="3" value="'+esc(t.letter)+'" placeholder="S" aria-label="티어 '+(i+1)+' 글자">'+
      '<input class="tier-in" data-f="label" maxlength="8" value="'+esc(t.label)+'" placeholder="라벨" aria-label="티어 '+(i+1)+' 라벨">'+
      '<input class="tier-in" data-f="note" maxlength="30" value="'+esc(t.note)+'" placeholder="한 줄 · 비우면 안 그려요" aria-label="티어 '+(i+1)+' 한 줄">'+
      '<button type="button" class="tier-ib" data-act="tierDel" aria-label="티어 '+(i+1)+' 삭제"'+(n<=1?' disabled':'')+'>'+ic('x')+'</button>'+
    '</div>';
  }).join('');
  $('tiTd').textContent=n+'단계';
  var ramp=$('tiRamp'); if(ramp)ramp.innerHTML=ST.tiers.map(function(t,i){ return '<span style="--c:'+blendOn(acc,tierAlpha(i,n),d.paper)+'"></span>'; }).join('');
  var selT=$('tiNewT'); if(selT){ var v=parseInt(selT.value,10); if(!(v>=0&&v<n))v=0; selT.innerHTML=tierOpts(v); }
  var add=$('tiTierAdd'); if(add)add.disabled=n>=MAX_TIERS;
}
function renderList(){
  var box=$('tiList'); if(!box)return;
  var h='', total=0, n=ST.tiers.length, acc=accentHex(), d=design();
  ST.tiers.forEach(function(t,ti){
    h+='<div class="tier-gh"><span class="tier-dot" style="--c:'+blendOn(acc,tierAlpha(ti,n),d.paper)+'"></span>'+esc(t.letter||'?')+(t.label?'<span class="o">'+esc(t.label)+'</span>':'')+'<span class="n">'+t.items.length+'</span></div>';
    t.items.forEach(function(it,i){
      total++;
      var im=IMG[it.id], name=(it.name||'').trim();
      h+='<div class="tier-it'+(sel===it.id?' sel':'')+'" data-id="'+it.id+'">'+
        '<button type="button" class="tier-th" data-act="img" aria-label="'+esc(name||'빈 슬롯')+' 그림 '+(im?'바꾸기':'넣기')+'">'+(im&&im.img?'<img src="'+esc(im.url)+'" alt="">':(name?esc(Array.from(name)[0]):ic('image')))+'</button>'+
        '<input class="tier-in" data-f="name" value="'+esc(it.name)+'" maxlength="20" placeholder="이름" aria-label="항목 이름">'+
        '<select class="tier-sel" data-f="tier" aria-label="티어">'+tierOpts(ti)+'</select>'+
        '<span class="tier-ibs">'+
        '<button type="button" class="tier-ib" data-act="up" aria-label="위로"'+(ti===0&&i===0?' disabled':'')+'>'+ic('up')+'</button>'+
        '<button type="button" class="tier-ib" data-act="down" aria-label="아래로"'+(ti===n-1&&i===t.items.length-1?' disabled':'')+'>'+ic('down')+'</button>'+
        (im?'<button type="button" class="tier-ib" data-act="imgDel" aria-label="그림 지우기">'+ic('imgOff')+'</button>':'')+
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
  var d=design(), a=accentName();
  root.querySelectorAll('#tiDesign .chip').forEach(function(b){ var on=b.id==='tiSig'?ST.sig:(b.dataset.v===ST.design); b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  var sws=$('tiSws'); if(sws){ var hexEl=$('tiHex'); var focused=hexEl&&document.activeElement===hexEl; if(!focused){ sws.innerHTML=swatchHtml()+'<span class="tier-swn" id="tiSwn"></span>'; } }
  $('tiSwn').innerHTML=esc(a.n)+'<span class="num">'+esc(String(a.hex).toUpperCase())+'</span>';
  var cs=root.querySelector('#tiSws .custom'); if(cs){ cs.style.setProperty('--cc',ST.accentHex); cs.classList.toggle('has',ST.accent==='custom'); }
  root.querySelectorAll('#tiCols .chip').forEach(function(b){ var on=parseInt(b.dataset.v,10)===ST.cols; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  root.querySelectorAll('#tiShape .chip').forEach(function(b){ var on=b.dataset.v===ST.shape; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  var sg=$('tiSign'); if(sg)sg.placeholder=d.n;
}
function syncBoardInputs(){
  var ids={tiTitle:'title',tiStamp:'stamp',tiSign:'sign'};
  Object.keys(ids).forEach(function(id){ var e=$(id); if(e&&e.value!==ST[ids[id]])e.value=ST[ids[id]]; });
  var c=$('tiTitleCnt'); if(c){ var l=Array.from(ST.title||'').length; c.textContent=l?l+'/30':''; }
}
function renderAll(){ syncBoardInputs(); renderTiers(); renderList(); syncDesign(); schedule(); }
function selectItem(id,scroll){
  sel=id;
  root.querySelectorAll('.tier-it').forEach(function(r){ r.classList.toggle('sel',r.dataset.id===sel); });
  schedule();
  if(scroll&&sel){ var row=root.querySelector('.tier-it[data-id="'+sel+'"]'); if(row&&row.scrollIntoView)row.scrollIntoView({block:'nearest'}); }
}

/* ── 캔버스 상호작용 ── */
function cvPtFromClient(cx,cy){ if(!main)return null; var r=main.getBoundingClientRect(); if(cx<r.left||cx>r.right||cy<r.top||cy>r.bottom)return null; var k=W/(r.width||1); return {x:(cx-r.left)*k,y:(cy-r.top)*k}; }
function canvasPt(e){ var r=main.getBoundingClientRect(), k=W/(r.width||1); return {x:(e.clientX-r.left)*k,y:(e.clientY-r.top)*k}; }
function tileAt(p){ for(var i=HIT.length-1;i>=0;i--){ var t=HIT[i]; if(p.x>=t.x&&p.x<=t.x+t.w&&p.y>=t.y&&p.y<=t.y+t.h)return t; } return null; }
function bandAt(py){ if(!LAY)return null; for(var i=0;i<LAY.bands.length;i++){ var b=LAY.bands[i]; if(py<b.y+b.h)return b; } return LAY.bands[LAY.bands.length-1]||null; }
function emptyAt(p){ if(!LAY)return null; for(var i=0;i<LAY.bands.length;i++){ var b=LAY.bands[i]; if(b.tiles.length)continue; if(p.x>=b.itemsX&&p.x<=b.itemsX+b.tw&&p.y>=b.tilesY&&p.y<=b.tilesY+b.th)return b; } return null; }
function dropTarget(px,py){
  var b=bandAt(py); if(!b)return null;
  var idx, mk;
  if(!b.tiles.length){ idx=0; mk={x:b.itemsX-8,y:b.tilesY,h:b.th}; }
  else{
    var rows=Math.ceil(b.tiles.length/ST.cols), row=clamp(Math.floor((py-b.tilesY)/(b.rowH+M.gapY)),0,rows-1);
    var rt=b.tiles.filter(function(t){ return Math.floor(t.i/ST.cols)===row; }), hit=null;
    for(var k=0;k<rt.length;k++){ if(px<rt[k].x+rt[k].w/2){ hit=rt[k]; break; } }
    if(hit){ idx=hit.i; mk={x:hit.x-M.gapX/2-2,y:hit.y,h:hit.h}; }
    else{ var last=rt[rt.length-1]; idx=last.i+1; mk={x:last.x+last.w+M.gapX/2-2,y:last.y,h:last.h}; }
  }
  return {ti:b.ti,idx:idx,mk:mk};
}
function bindCanvas(){
  var cv=$('tiCv'), pendingAdd=null;
  main.addEventListener('pointerdown',function(e){
    if(e.button!==0&&e.pointerType==='mouse')return;
    var p=canvasPt(e), t=tileAt(p);
    if(!t){ var eb=emptyAt(p); pendingAdd=eb?{ti:eb.ti,sx:e.clientX,sy:e.clientY}:null; if(sel&&!eb)selectItem(null); return; }
    drag={id:t.id,ti:t.ti,i:t.i,sx:e.clientX,sy:e.clientY,dx:p.x-t.x,dy:p.y-t.y,px:p.x,py:p.y,moved:false,target:null,touch:e.pointerType==='touch'};
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
    if(!drag||!drag.id){ var t=tileAt(p); main.classList.toggle('grab',!!t); main.classList.toggle('add',!t&&!!emptyAt(p)); return; }
    if(drag.touch)return;
    if(!drag.moved&&Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)<6)return;
    drag.moved=true; main.classList.add('drag');
    drag.px=p.x; drag.py=p.y; drag.target=dropTarget(p.x,p.y);
    schedule();
  });
  function up(){
    if(!drag||!drag.id)return;
    var d=drag; drag=null; main.classList.remove('drag');
    if(d.moved&&d.target){ if(moveItem(d.id,d.target.ti,d.target.idx)){ selectItem(d.id); renderList(); save(); } }
    else if(!d.moved){ selectItem(sel===d.id?null:d.id,true); }
    schedule();
  }
  main.addEventListener('pointerup',up); main.addEventListener('pointercancel',up);
  main.addEventListener('keydown',function(e){ if(e.key==='Escape'&&sel){ e.preventDefault(); selectItem(null); } });
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
function applyHex(v){ v=String(v||'').trim(); if(/^[0-9a-f]{6}$/i.test(v))v='#'+v; if(!/^#[0-9a-f]{6}$/i.test(v))return false; ST.accent='custom'; ST.accentHex=v.toUpperCase(); var p=$('tiPick'); if(p)p.value=ST.accentHex; save(); syncDesign(); renderTiers(); renderList(); schedule(); return true; }
function bindEditor(){
  var file=$('tiFile'), fileFor=null;
  function pickFor(id){ fileFor=id; file.value=''; file.click(); }
  file.addEventListener('change',function(){
    var fs=file.files; if(!fs||!fs.length)return;
    if(fileFor&&findItem(fileFor)){ var f=findItem(fileFor); takeFiles(fs,f.ti,null,fileFor); }
    else takeFiles(fs,newTierIdx(),null,null);
    fileFor=null;
  });
  [['tiTitle','title'],['tiStamp','stamp'],['tiSign','sign']].forEach(function(p){
    $(p[0]).addEventListener('input',function(){ ST[p[1]]=this.value; if(p[1]==='title')syncBoardInputs(); save(); schedule(); });
  });
  /* 디자인 */
  $('tiDesign').addEventListener('click',function(e){
    var b=e.target.closest('.chip'); if(!b)return;
    if(b.id==='tiSig'){ ST.sig=!ST.sig; save(); syncDesign(); if(ST.sig)loadSig(); schedule(); return; }
    if(!DESIGNS[b.dataset.v])return;
    ST.design=b.dataset.v; if(ST.accent!=='custom')ST.accent='auto'; save(); syncDesign(); renderTiers(); renderList(); loadSig(); schedule(); loadFonts().then(function(){ if(mounted)schedule(); });
  });
  var sws=$('tiSws');
  sws.addEventListener('click',function(e){
    var b=e.target.closest('.tier-sw'); if(!b)return;
    var pick=$('tiPick');
    if(b.dataset.c==='custom'){ ST.accent='custom'; pick.value=ST.accentHex; save(); syncDesign(); renderTiers(); renderList(); schedule(); pick.click(); return; }
    ST.accent=b.dataset.c; save(); syncDesign(); renderTiers(); renderList(); schedule();
  });
  sws.addEventListener('input',function(e){
    if(e.target.id==='tiPick'){ ST.accent='custom'; ST.accentHex=String(e.target.value).toUpperCase(); save(); syncDesign(); renderTiers(); renderList(); schedule(); return; }
    if(e.target.id==='tiHex'){ var ok=applyHex(e.target.value); e.target.classList.toggle('bad',!ok&&e.target.value.length>=6); }
  });
  sws.addEventListener('change',function(e){ if(e.target.id==='tiHex'){ if(!applyHex(e.target.value)){ e.target.value=accentHex().toUpperCase(); e.target.classList.remove('bad'); } } });
  sws.addEventListener('keydown',function(e){ if(e.target.id==='tiHex'&&e.key==='Enter'){ e.preventDefault(); e.target.blur(); } });
  $('tiCols').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b)return; var c=parseInt(b.dataset.v,10); if(COLS.indexOf(c)<0)return; ST.cols=c; save(); syncDesign(); schedule(); });
  $('tiShape').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b)return; if(!SHAPES.some(function(s){ return s.id===b.dataset.v; }))return; ST.shape=b.dataset.v; save(); syncDesign(); schedule(); });
  /* 티어 */
  $('tiTierAdd').addEventListener('click',addTier);
  var rows=$('tiRows');
  rows.addEventListener('input',function(e){
    var inp=e.target.closest('.tier-in'); var row=e.target.closest('.tier-row'); if(!inp||!row)return;
    var t=ST.tiers.filter(function(x){ return x.id===row.dataset.tid; })[0]; if(!t)return;
    t[inp.dataset.f]=inp.value; save(); schedule();
    if(inp.dataset.f!=='note'){ var sT=$('tiNewT'), v=sT.value; sT.innerHTML=tierOpts(parseInt(v,10)||0); renderList(); }
  });
  rows.addEventListener('click',function(e){ var b=e.target.closest('[data-act="tierDel"]'); if(!b)return; removeTier(b.closest('.tier-row').dataset.tid); });
  /* 항목 */
  function add(){ var inp=$('tiNew'); var ids=addNames(newTierIdx(),inp.value); if(ids.length){ inp.value=''; inp.focus(); } }
  $('tiAdd').addEventListener('click',add);
  $('tiNew').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); add(); } });
  var list=$('tiList');
  list.addEventListener('input',function(e){
    var inp=e.target.closest('.tier-in[data-f="name"]'); var row=e.target.closest('.tier-it'); if(!inp||!row)return;
    var f=findItem(row.dataset.id); if(!f)return;
    f.item.name=inp.value; save(); schedule();
    if(!(IMG[f.item.id]&&IMG[f.item.id].img)){ var th=row.querySelector('.tier-th'); var nm=inp.value.trim(); th.innerHTML=nm?esc(Array.from(nm)[0]):ic('image'); }
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
    if(act==='up'){ if(f.i>0)moveItem(id,f.ti,f.i-1); else if(f.ti>0)moveItem(id,f.ti-1,null); else return; sel=id; renderList(); save(); schedule(); focusRow(id,'[data-act="up"]'); }
    if(act==='down'){ if(f.i<f.tier.items.length-1)moveItem(id,f.ti,f.i+2); else if(f.ti<ST.tiers.length-1)moveItem(id,f.ti+1,0); else return; sel=id; renderList(); save(); schedule(); focusRow(id,'[data-act="down"]'); }
  });
  function focusRow(id,q){ var row=root.querySelector('.tier-it[data-id="'+id+'"]'); if(!row)return; var b=row.querySelector(q); if(b&&!b.disabled)b.focus(); else row.querySelector('.tier-in').focus(); if(row.scrollIntoView)row.scrollIntoView({block:'nearest'}); }
  /* 리소스 */
  $('tiResOpen').addEventListener('click',openRes);
  $('tiResBack').addEventListener('click',closeRes);
  $('tiResB').addEventListener('change',function(){ RES.bundle=this.value; RES.filter=''; loadResGrid(); });
  $('tiResF').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b)return; RES.filter=b.dataset.r||''; loadResGrid(); });
  bindResDrag();
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
  api.toast(a.download+' 저장 · 손수 넣은 그림은 담기지 않아요');
}

/* ── 수명 ── */
function loadFonts(){
  var d=design();
  if(d.id==='bomding'&&!document.getElementById('tierNanum')){ var lk=document.createElement('link'); lk.id='tierNanum'; lk.rel='stylesheet'; lk.href=NANUM_CSS; document.head.appendChild(lk); }
  if(!(document.fonts&&document.fonts.load))return Promise.resolve();
  var t=(ST.title||'게임 이름')+'가나다 SABCD';
  var fam=d.id==='bomding'?'NanumSquare':'"Pretendard Variable"';
  return Promise.all([document.fonts.load('800 26px '+fam,t),document.fonts.load('700 18px '+fam,t)]).then(function(){ fontsReady[d.id]=true; }).catch(function(){});
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
  renderAll(); paint(); loadResImages(); loadSig();
  loadFonts().then(function(){ if(mounted)schedule(); });
}
function unmount(){
  mounted=false; if(raf){ cancelAnimationFrame(raf); raf=0; }
  if(onPaste){ document.removeEventListener('paste',onPaste); onPaste=null; }
  if(onDocMove){ document.removeEventListener('pointermove',onDocMove); onDocMove=null; }
  if(onDocUp){ document.removeEventListener('pointerup',onDocUp); document.removeEventListener('pointercancel',onDocUp); onDocUp=null; }
  if(ghostEl){ ghostEl.remove(); ghostEl=null; }
  rdrag=null; drag=null; root=null; main=null; mctx=null; HIT=[]; RES.open=false;
}

window.SseudamTools.tier={
  mount:mount, unmount:unmount,
  __test:{
    state:function(){ var d=data(); d.sel=sel; d.images=Object.keys(IMG).filter(function(k){ return IMG[k]&&IMG[k].img; }).length; d.fonts=fontsReady; d.W=W; return d; },
    setBoard:function(d){ restoreData(d,true); loadResImages(); renderAll(); save(); },
    addItem:function(ti,name){ return addNames(ti,name); },
    addRes:function(b,c,ti,idx){ return resBundle(b).then(function(){ return addRes(b,c,ti,idx); }); },
    move:function(id,ti,idx){ var ok=moveItem(id,ti,idx); if(ok){ renderList(); save(); paint(); } return ok; },
    select:function(id){ selectItem(id,true); },
    hits:function(){ return HIT.map(function(t){ return {id:t.id,ti:t.ti,i:t.i,x:t.x,y:t.y,w:t.w,h:t.h,lines:(t.lines||[]).length}; }); },
    layout:function(){ return LAY?{H:LAY.H,tw:LAY.tw,th:LAY.th,nfs:LAY.nfs,hd:{y:LAY.hd.y,h:LAY.hd.h},ft:{y:LAY.ft.y,h:LAY.ft.h,sig:LAY.ft.sig?{x:LAY.ft.sig.x,y:LAY.ft.sig.y,w:LAY.ft.sig.w,h:LAY.ft.sig.h}:null},bands:LAY.bands.map(function(b){ return {ti:b.ti,y:b.y,h:b.h,tiles:b.tiles.length,pl:b.pl}; })}:null; },
    dropTarget:function(x,y){ return dropTarget(x,y); },
    setImageURL:function(id,url){ return setImageURL(id,url,false); },
    openRes:function(){ openRes(); return resIndex(); }, closeRes:closeRes, res:function(){ return {open:RES.open,bundle:RES.bundle,filter:RES.filter,bundles:RES.index}; },
    fileName:fileName, paint:function(){ paint(); return LAY&&LAY.H; },
    blob:function(){ return toBlob().then(function(b){ return b?{size:b.size,type:b.type}:null; }); },
    dataURL:function(){ return exportCanvas().toDataURL('image/png'); },
    designs:Object.keys(DESIGNS), shapes:SHAPES.map(function(s){ return s.id; }),
    sigSrc:function(){ var im=sigImg(); return im?im.src:null; },
    plaques:function(){ var d=design(), acc=accentHex(), n=ST.tiers.length; return ST.tiers.map(function(t,i){ var fill=blendOn(acc,tierAlpha(i,n),d.paper), tc=plaqueText(fill,d); return {letter:t.letter,fill:fill,text:tc,contrast:Math.round(contrast(fill,tc)*100)/100}; }); },
    reset:function(){ IMG={}; sel=null; ST.design='bomding'; ST.accent='auto'; ST.cols=4; ST.shape='round'; defaultBoard(); renderAll(); save(); }
  }
};
})();
