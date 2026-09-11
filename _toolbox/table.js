/*! 쓰담 도구함 · 표 제작 — v1 「봄딩 스크랩북 표」 2026-09-12
 *  index.html 「도구함」 탭이 처음 고를 때 받아 window.SseudamTools.table 로 등록한다({mount(host,api), unmount()}). 설계 근거 = BlogPreview/DESIGN.md §Toolbox
 *  왜 그림 표인가: 네이버 스마트에디터 표는 칸에 글자만 들어간다 — 이미지+이름이 붙은 비교표는 그림으로 구워 올려야 한다(사용자 요청 09-11).
 *  구성(요구 그대로): 첫 열 = 이미지(PC 파일 끌어 놓기·클릭·Ctrl+V) + 라벨 · 둘째 열은 기본 · 열·행 추가 · 각 열 첫 행 = 열 이름.
 *  디자인 = 봄딩 전용 「스크랩북」 — 티어표 봄딩 골격(09-08 사용자 선택 B1)과 같은 어휘: 모눈 종이 · 워시테이프로 붙인 종이 카드 · 폴라로이드 · ♥ 서명 · 시그니처 스티커.
 *    머리 띠 = 포인트 색(봄딩 로즈·핑크·플럼/기타), 첫 열 = 그 색을 아주 옅게 깐 «사진 열». 영도 스킨은 두지 않는다(봄딩 전용 요청).
 *  폭 = 네이버 PC 본문 이미지 실폭 693(티어표 09-07 실측) → 2배 1386 으로 내보낸다. 폰(≈360)에서는 ×0.52 로 보인다 → 검사 칩이 «폰 글자»를 환산한다.
 *  편집: 보드의 칸을 눌러 그 자리에서 입력(칸 위에 textarea — Enter=줄바꿈 · Tab=다음 칸 · Esc=끝, 네이버 표와 같은 손버릇) · 방향키로 칸 이동
 *        · 보드 가장자리 «+» 로 열/행 추가 · 편집 열에서 이름·너비·순서·삭제(되돌리기 토스트).
 *  그림은 긴 변 720px 로 줄여 IndexedDB 에 둔다 — 새로고침해도 남는다(표의 그림은 전부 PC 파일이라, 메모리만 쓰던 티어표와 달리 저장한다).
 *    JSON 보내기에는 그림이 data URL 로 들어가 다른 PC 에서도 그대로 열린다.
 */
(function(){
"use strict";
window.SseudamTools=window.SseudamTools||{};
if(window.SseudamTools.table)return;

var W=693, EXPORT_SCALE=2, DPR=2, LS='sseudam_table_v1', PHONE=.52;
var BASE=(function(){ var s=document.currentScript, u=(s&&s.src)||'_toolbox/table.js'; return u.replace(/\?.*$/,'').replace(/[^\/]*$/,''); })();
var SIG_SRC=BASE+'tier/sig/bomding.webp';   /* 봄딩 시그니처 스티커 — 티어표와 같은 파일(브랜드 한 벌) */
var NANUM_CSS=BASE.replace(/_toolbox\/$/,'')+'_design/nanumsquare.css';
var MAX_COLS=6, MIN_COLS=2, MAX_ROWS=30, IMG_MAX=720, FS_MIN=14, FS_MAX=24, FS_DEF=19, LONG_H=2200;
var LIM={title:30,note:40,sign:12,head:20,label:24,cell:100};
var MAXL={head:2,label:3,cell:6};
/* 봄딩 정본 값 — 티어표 DESIGNS.bomding 과 같은 출처(썸네일 표준 v1 플럼·로즈·핑크 · 나눔스퀘어 = output-format §2-0) */
var D={ fam:'"NanumSquare","나눔스퀘어","Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif',
  accent:'#C93C7C', sw:[{id:'rose',c:'#C93C7C',n:'로즈'},{id:'pink',c:'#F58AB4',n:'핑크'},{id:'plum',c:'#2E2038',n:'플럼'}],
  ink:'#2E2038', inkDeep:'#17101E', ink2:'#5E5068', ink3:'#8C8194', paper:'#FFFBFC', edge:'#F4E6EC',
  hair:'rgba(46,32,56,.08)', hair2:'rgba(46,32,56,.16)', hair3:'rgba(46,32,56,.30)', grid:'rgba(201,60,124,.055)', rule:'#F58AB4', tape:'rgba(245,138,180,.55)' };
var SIZES=[{id:'s',n:'작게',img:68},{id:'m',n:'보통',img:92},{id:'l',n:'크게',img:120}];
var FITS=[{id:'cover',n:'채우기'},{id:'contain',n:'맞추기'}];
var SHAPES=[{id:'polaroid',n:'폴라로이드'},{id:'round',n:'둥근 사각'},{id:'circle',n:'원'}];
var WIDTHS=[{id:'s',n:'좁게',k:.65},{id:'n',n:'보통',k:1},{id:'w',n:'넓게',k:1.6}];
function byId(list,id){ for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i]; return null; }

/* ── 상태 ── */
var UID=0;
function uid(p){ return p+(++UID); }
function mkCol(name,w){ return {id:uid('c'),name:name||'',w:w||'n'}; }
function mkRow(label){ return {id:uid('r'),label:label||'',cells:{}}; }
var ST={ title:'', note:'', sign:'', accent:'rose', accentHex:'#C93C7C', size:'m', fit:'cover', shape:'polaroid', fs:FS_DEF, cols:[], rows:[] };
var IMG={};   /* 행 id → {img,w,h,url,blob} */
function str(v,max){ return typeof v==='string'?v.slice(0,max):''; }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function defaultBoard(){ ST.title=''; ST.note=''; ST.sign=''; ST.cols=[mkCol(''),mkCol('')]; ST.rows=[mkRow(''),mkRow(''),mkRow('')]; }
/* 복원 — remap=true 면 id 를 새로 매긴다(JSON 불러오기: 지금 보드 그림의 id 와 섞이지 않게). 돌려주는 값 = 옛 행 id → 새 행 id (보드가 비었으면 null) */
function restoreData(sv,withDesign,remap){
  var b=(sv&&sv.board)||{}, cols0=Array.isArray(b.cols)?b.cols:[], rows0=Array.isArray(b.rows)?b.rows:[], seen={}, cmap={}, rmap={};
  if(!cols0.length&&!rows0.length)return null;
  if(!remap)cols0.concat(rows0).forEach(function(o){ var m=o&&typeof o.id==='string'&&/^[cr](\d+)$/.exec(o.id); if(m&&+m[1]>UID)UID=+m[1]; });
  function keep(o,re){ if(remap||typeof o.id!=='string'||!re.test(o.id)||seen[o.id])return null; seen[o.id]=1; return o.id; }
  var cols=[];
  cols0.slice(0,MAX_COLS).forEach(function(c){
    if(!c||typeof c!=='object')return;
    var x=mkCol(str(c.name,LIM.head),byId(WIDTHS,c.w)?c.w:'n'), k=keep(c,/^c\d+$/); if(k)x.id=k;
    if(typeof c.id==='string')cmap[c.id]=x.id; cols.push(x);
  });
  while(cols.length<MIN_COLS)cols.push(mkCol(''));
  var rows=[];
  rows0.slice(0,MAX_ROWS).forEach(function(r){
    if(!r||typeof r!=='object')return;
    var x=mkRow(str(r.label,LIM.label)), k=keep(r,/^r\d+$/); if(k)x.id=k;
    var cs=(r.cells&&typeof r.cells==='object')?r.cells:{};
    Object.keys(cs).forEach(function(key){ var nid=cmap[key]; if(nid&&nid!==cols[0].id&&typeof cs[key]==='string'&&cs[key])x.cells[nid]=cs[key].slice(0,LIM.cell); });
    if(typeof r.id==='string')rmap[r.id]=x.id; rows.push(x);
  });
  if(!rows.length)rows=[mkRow('')];
  ST.title=str(b.title,LIM.title); ST.note=str(b.note,LIM.note); ST.sign=str(b.sign,LIM.sign);
  ST.cols=cols; ST.rows=rows;
  if(withDesign&&sv.design&&typeof sv.design==='object'){
    var d=sv.design;
    if(d.accent==='custom'||byId(D.sw,d.accent))ST.accent=d.accent;
    if(/^#[0-9a-f]{6}$/i.test(d.accentHex||''))ST.accentHex=d.accentHex.toUpperCase();
    if(byId(SIZES,d.size))ST.size=d.size;
    if(byId(FITS,d.fit))ST.fit=d.fit;
    if(byId(SHAPES,d.shape))ST.shape=d.shape;
    if(typeof d.fs==='number'&&d.fs>=FS_MIN&&d.fs<=FS_MAX)ST.fs=Math.round(d.fs*2)/2;
  }
  return rmap;
}
function data(){
  return {app:'sseudam-table',v:1,
    board:{title:ST.title,note:ST.note,sign:ST.sign,
      cols:ST.cols.map(function(c){ return {id:c.id,name:c.name,w:c.w}; }),
      rows:ST.rows.map(function(r){ var cs={}; ST.cols.forEach(function(c,ci){ if(ci&&r.cells[c.id])cs[c.id]=r.cells[c.id]; }); return {id:r.id,label:r.label,cells:cs}; })},
    design:{accent:ST.accent,accentHex:ST.accentHex,size:ST.size,fit:ST.fit,shape:ST.shape,fs:ST.fs}};
}
try{ var sv0=JSON.parse(localStorage.getItem(LS)||'null'); if(!(sv0&&sv0.app==='sseudam-table'&&sv0.v===1&&restoreData(sv0,true,false)))defaultBoard(); }catch(e){ defaultBoard(); }
var saveT=0;
function save(){ clearTimeout(saveT); saveT=setTimeout(function(){ try{ localStorage.setItem(LS,JSON.stringify(data())); }catch(e){} },250); }
function snapshot(){ return JSON.stringify(data()); }
function restore(snap){ endEdit(false); try{ restoreData(JSON.parse(snap),true,false); }catch(e){ return; } cur=null; renderAll(); save(); }
function colIdx(cid){ for(var i=0;i<ST.cols.length;i++)if(ST.cols[i].id===cid)return i; return -1; }
function rowIdx(rid){ for(var i=0;i<ST.rows.length;i++)if(ST.rows[i].id===rid)return i; return -1; }

/* ── 그림 저장소(IndexedDB) — 못 쓰면 조용히 메모리만(보드는 그대로 동작) ── */
var DBP=null;
function idb(){
  if(DBP)return DBP;
  DBP=new Promise(function(res,rej){
    try{ var q=indexedDB.open('sseudam-table',1);
      q.onupgradeneeded=function(){ q.result.createObjectStore('img'); };
      q.onsuccess=function(){ res(q.result); }; q.onerror=function(){ rej(q.error); };
    }catch(e){ rej(e); }
  });
  return DBP;
}
function idbTx(mode,fn){ return idb().then(function(db){ return new Promise(function(res,rej){ var t=db.transaction('img',mode); fn(t.objectStore('img')); t.oncomplete=function(){ res(); }; t.onerror=t.onabort=function(){ rej(t.error); }; }); }); }
function idbPut(k,v){ return idbTx('readwrite',function(s){ s.put(v,k); }).catch(function(){}); }
function idbDel(k){ return idbTx('readwrite',function(s){ s.delete(k); }).catch(function(){}); }
function idbAll(){
  return idb().then(function(db){ return new Promise(function(res,rej){
    var t=db.transaction('img','readonly'), s=t.objectStore('img'), ks=s.getAllKeys(), vs=s.getAll();
    t.oncomplete=function(){ var o={}; (ks.result||[]).forEach(function(k,i){ o[k]=vs.result[i]; }); res(o); };
    t.onerror=t.onabort=function(){ rej(t.error); };
  }); });
}

/* ── 부품 ── */
var api=null, root=null, main=null, mctx=null, raf=0, mounted=false, LAY=null, cur=null, hover=null, drop=null, ED=null, T={}, SIG=null, imgBoot=null, ro=null, onPaste=null;
function $(id){ return root?root.querySelector('#'+id):null; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var IC={
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2.4"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  up:'<path d="m18 15-6-6-6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  left:'<path d="m15 18-6-6 6-6"/>',
  right:'<path d="m9 18 6-6-6-6"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  imgOff:'<path d="M10.4 3H19a2 2 0 0 1 2 2v8.6"/><path d="M21 21H5a2 2 0 0 1-2-2V5"/><path d="m21 15-5-5-3.5 3.5"/><path d="M2 2l20 20"/>',
  pipette:'<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  file:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  broom:'<path d="M3 21h18"/><path d="M5 21 9 9l6-6 6 6-12 12"/><path d="m9 9 6 6"/>'
};
function ic(n){ return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(IC[n]||'')+'</svg>'; }
function readTokens(){
  var cs=getComputedStyle(document.documentElement);
  function tk(n,d){ var v=(cs.getPropertyValue(n)||'').trim(); return v||d; }
  T.ink=tk('--ink','#0E1114'); T.alert=tk('--alert','#C4362A');
}

/* ── 색 ── */
function hexRGB(hex){ var n=parseInt(hex.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
function lum(hex){ var c=hexRGB(hex).map(function(v){ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; }
function contrast(a,b){ var la=lum(a), lb=lum(b); return (Math.max(la,lb)+.05)/(Math.min(la,lb)+.05); }
function blendOn(hex,a,base){ var c=hexRGB(hex), b=hexRGB(base||'#FFFFFF'); function m(i){ var s=Math.round(c[i]*a+b[i]*(1-a)).toString(16); return s.length<2?'0'+s:s; } return '#'+m(0)+m(1)+m(2); }
/* 머리 띠 글자색 — 흰색 → 잉크 → 진한 잉크 → 검정 중 4.5:1 을 넘는 첫 후보(티어표 plaqueText 와 같은 규칙 · 흰·검정 중 하나는 늘 넘는다) */
function onInk(fill){ var c=['#FFFFFF',D.ink,D.inkDeep,'#000000'], best=c[0], bc=0; for(var i=0;i<c.length;i++){ var v=contrast(fill,c[i]); if(v>=4.5)return c[i]; if(v>bc){ bc=v; best=c[i]; } } return best; }
function accentHex(){ if(ST.accent==='custom')return ST.accentHex; var s=byId(D.sw,ST.accent); return s?s.c:D.accent; }
function signText(){ return (ST.sign||'').trim()||'봄딩'; }
function safeName(s){ return String(s||'').replace(/[\\\/:*?"<>|]/g,'').replace(/\s+/g,'_').slice(0,40); }
function fileName(){ var t=safeName(ST.title); return (t||'봄딩')+'_표.png'; }
function fileBase(f){ return String(f&&f.name||'').replace(/\.[a-z0-9]+$/i,'').replace(/[_\-]+/g,' ').trim().slice(0,LIM.label); }

/* ── 글자 ── */
function F(w,px){ return w+' '+px+'px '+D.fam; }
function rrect(ctx,x,y,w,h,r){ r=Math.max(0,Math.min(r,w/2,h/2)); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function ellFit(ctx,s,maxW){ if(ctx.measureText(s).width<=maxW)return s; var a=Array.from(s); while(a.length>1){ a.pop(); var t=a.join('').replace(/\s+$/,'')+'…'; if(ctx.measureText(t).width<=maxW)return t; } return '…'; }
/* 한 문단 줄바꿈 — 어절 단위(keep-all), 한 어절이 폭보다 길면 글자 단위 */
function wrapPara(ctx,para,maxW){
  var words=para.split(' '), lines=[], line='';
  function fits(s){ return ctx.measureText(s).width<=maxW; }
  words.forEach(function(w){
    var cand=line?line+' '+w:w;
    if(fits(cand)){ line=cand; return; }
    if(line){ lines.push(line); line=''; }
    if(fits(w)){ line=w; return; }
    Array.from(w).forEach(function(ch){ if(fits(line+ch))line+=ch; else{ if(line)lines.push(line); line=ch; } });
  });
  lines.push(line);
  return lines;
}
/* 여러 줄 — 줄 수 상한을 넘으면 마지막 줄 끝에 … (cut=true → 검사 칩 «잘린 글»). keepTail = 편집 중인 칸은 끝 빈 줄도 높이에 넣는다(캐럿 줄이 잘리지 않게) */
function wrap(ctx,text,maxW,maxL,keepTail){
  var all=[];
  String(text||'').split('\n').forEach(function(p){ all=all.concat(wrapPara(ctx,p,maxW)); });
  if(!keepTail)while(all.length>1&&!all[all.length-1].trim())all.pop();
  var cut=false;
  if(all.length>maxL){ cut=true; all=all.slice(0,maxL); all[maxL-1]=ellFit(ctx,all[maxL-1]+'…',maxW); }
  return {lines:all,cut:cut};
}
var CSS=
/* 작업대 — 티어표와 같은 골격: 왼쪽 보드(내부 스크롤) + 오른쪽 편집 열(내부 스크롤) + 보드 아래 고정 내보내기 줄. 판 높이 = 뷰포트 */
'.tbl{display:grid;grid-template-columns:minmax(0,1fr) 400px;grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"stage ctl" "act ctl";height:calc(100dvh - 214px);min-height:600px}'+
'@media (max-width:1400px){.tbl{grid-template-columns:minmax(0,1fr) 340px}}'+
'.tbl-stage{grid-area:stage;overflow:auto;overscroll-behavior:contain;padding:18px 16px 22px;min-width:0;background:var(--surface-2)}'+
'.tbl-cv{position:relative;width:min(100%,693px);margin:0 auto}'+
'.tbl-cv canvas{display:block;width:100%;height:auto;touch-action:pan-y;border-radius:20px;box-shadow:0 0 0 1px var(--hair),var(--sh-rest)}'+
'.tbl-cv canvas.t-text{cursor:text}.tbl-cv canvas.t-pick{cursor:pointer}'+
'.tbl-cv canvas:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.tbl-cv.over canvas{box-shadow:0 0 0 2px var(--ink),var(--sh-lift)}'+
/* 칸 위 입력 — 칸의 글자 상자에 겹쳐 뜬다(배경 = 그 칸 색). 링은 사이트 포커스 어휘(바탕 2 + 잉크 2) */
'.tbl-ed{position:absolute;left:0;top:0;z-index:2;margin:0;padding:4px;border:0;outline:0;resize:none;overflow:hidden;box-sizing:border-box;border-radius:8px;'+
  'white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;text-align:center;letter-spacing:-.02em;'+
  'box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink)}'+
'.tbl-ed[hidden]{display:none}'+
'.tbl-ed::placeholder{color:var(--ph,#5E5068);opacity:1}'+
/* 보드 가장자리 «+» — 화면에만 있다(PNG 에는 안 들어간다) */
'.tbl-plus{position:absolute;left:0;top:0;z-index:1;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;display:grid;place-items:center;'+
  'background:var(--ink);color:#fff;box-shadow:0 0 0 2px var(--surface),var(--sh-lift);'+
  'transition:transform var(--t-fast) var(--e-out),opacity var(--t-fast) var(--e)}'+
'.tbl-plus::after{content:"";position:absolute;inset:-6px}'+
'.tbl-plus .ic{width:14px;height:14px;stroke-width:2.2}'+
'.tbl-plus:hover{transform:scale(1.12)}.tbl-plus:active{transform:scale(.92)}'+
'.tbl-plus:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.tbl-plus[hidden]{display:none}'+
'.tbl-ctl{grid-area:ctl;overflow:auto;overscroll-behavior:contain;min-width:0;border-left:1px solid var(--hair);padding:6px 18px 18px}'+
'.tbl-act{grid-area:act;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 24px;border-top:1px solid var(--hair);background:var(--surface)}'+
'.tbl-act .cta{margin-left:auto}'+
'.tbl-act .ghost .ic,.tbl-act .cta .ic{width:14px;height:14px}'+
'.tbl-chk{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;min-width:0;flex:1 1 260px}'+
'.tbl-chk li{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;line-height:1.4;color:var(--ink-2);white-space:nowrap;word-break:keep-all}'+
'.tbl-chk li .ic{width:13px;height:13px;flex:none;color:var(--ink-3)}'+
'.tbl-chk li.bad{color:var(--alert)}.tbl-chk li.bad .ic{color:var(--alert)}'+
'.tbl-chk li b{font-weight:600;color:inherit}'+
'.tbl-sec{padding:12px 0 14px;border-top:1px solid var(--hair)}.tbl-sec:first-child{border-top:0}'+
'.tbl-st{font-size:13.5px;font-weight:700;letter-spacing:-.025em;margin-bottom:10px;display:flex;align-items:center;gap:8px}'+
'.tbl-st .d{font-size:12.5px;font-weight:500;color:var(--ink-3)}'+
'.tbl-lbl{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12.5px;font-weight:600;color:var(--ink-2);margin:12px 0 6px}'+
'.tbl-lbl.first{margin-top:0}'+
'.tbl-lbl .o{font-weight:500;color:var(--ink-3)}'+
'.tbl-cnt{font-size:12.5px;font-weight:500;color:var(--ink-3)}'+
'.tbl-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 10px}'+
'.tbl-chips{display:flex;flex-wrap:wrap;gap:6px}'+
'.tbl-grp{display:inline-flex;flex-wrap:wrap;gap:6px}'+   /* 한 줄에 두 무리(그림 크기 · 맞춤) */
'.tbl-sep{width:1px;align-self:stretch;margin:5px 3px;background:var(--hair-2)}'+
/* 글자 크기 — 썸네일 도구와 같은 «슬라이더 + 숫자» 한 쌍(09-06 사용자: 바로만 조정하면 세밀 조정이 힘들다) */
'.tbl-sz{display:flex;align-items:center;gap:8px}'+
'.tbl-sz input[type=range]{flex:1 1 80px;min-width:60px;accent-color:var(--ink);height:28px;margin:0}'+
'.tbl-nm{display:inline-flex;align-items:center;gap:4px;flex:none}'+
'.tbl-nm input{width:58px;height:32px;padding:0 6px;border:0;outline:0;border-radius:9px;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);'+
  'font:inherit;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12.5px;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums;'+
  'transition:box-shadow var(--t-fast) var(--e),background var(--t-fast) var(--e)}'+
'.tbl-nm input:focus{box-shadow:0 0 0 2px var(--ink);background:var(--surface)}'+
'.tbl-nm span{font-size:12.5px;color:var(--ink-3)}'+
/* 목록 입력 공통 */
'.tbl-in{height:32px;padding:0 9px;border:0;outline:0;border-radius:9px;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);font:inherit;font-size:13px;letter-spacing:-.02em;color:var(--ink);min-width:0;width:100%;'+
  'transition:box-shadow var(--t-fast) var(--e),background var(--t-fast) var(--e)}'+
'.tbl-in:focus{box-shadow:0 0 0 2px var(--ink);background:var(--surface)}'+
'.tbl-in::placeholder{color:var(--ink-3)}'+
'.tbl-in-hex{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12.5px;width:92px;text-transform:uppercase}'+
'.tbl-in-hex.bad{box-shadow:0 0 0 2px var(--alert)}'+
'.tbl-sel{height:32px;padding:0 22px 0 8px;border:0;outline:0;border-radius:9px;background-color:var(--surface-2);box-shadow:0 0 0 1px var(--hair);font:inherit;font-size:12.5px;font-weight:600;color:var(--ink);'+
  'appearance:none;-webkit-appearance:none;cursor:pointer;min-width:0;width:100%;'+
  'background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23767D87\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'m6 9 6 6 6-6\'/></svg>");'+
  'background-repeat:no-repeat;background-position:right 7px center;transition:box-shadow var(--t-fast) var(--e),background-color var(--t-fast) var(--e)}'+
'.tbl-sel:focus{box-shadow:0 0 0 2px var(--ink);background-color:var(--surface)}'+
'.tbl-ib{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--ink-3);position:relative;'+
  'transition:background var(--t-fast) var(--e),color var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.tbl-ib::after{content:"";position:absolute;inset:-6px}'+
'.tbl-ib .ic{width:14px;height:14px}'+
'.tbl-ib:hover{background:var(--surface-2);color:var(--ink)}.tbl-ib:active{transform:scale(.9)}'+
'.tbl-ib:disabled{opacity:.3;cursor:default;transform:none;background:none}'+
'.tbl-ibs{display:inline-flex;align-items:center;gap:12px;padding-left:4px}'+   /* 히트존(±6)이 이웃과 겹치지 않는 간격 — 티어표 게이트 🟡 09-07 */
'.tbl-add{margin-top:10px}'+
/* 열 목록 */
'.tbl-cols{display:flex;flex-direction:column;gap:8px}'+
'.tbl-col{display:grid;grid-template-columns:26px minmax(0,1fr) 70px auto;gap:6px;align-items:center}'+
'.tbl-col .tbl-in.span{grid-column:2 / -1}'+
'.tbl-ci{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);font-size:12.5px;font-weight:600;color:var(--ink-2)}'+
'.tbl-ci .ic{width:14px;height:14px}'+
/* 행 목록 */
'.tbl-new{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center}'+
'.tbl-rows{display:flex;flex-direction:column;gap:4px;margin-top:10px}'+
'.tbl-it{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:6px;align-items:center;padding:2px;border-radius:10px;'+
  'transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e)}'+
'.tbl-it.cur{background:var(--surface-2);box-shadow:0 0 0 1px var(--hair-2)}'+
'.tbl-it.cur .tbl-in{background:var(--surface)}'+
'.tbl-th{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);color:var(--ink-3);position:relative;'+
  'transition:box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.tbl-th::after{content:"";position:absolute;inset:-4px 0 -4px -8px}'+   /* 히트존 40×40 — 오른쪽(이름 칸)으로는 안 넓힌다 */
'.tbl-th img{width:100%;height:100%;object-fit:cover;display:block;border-radius:9px}'+
'.tbl-th .ic{width:14px;height:14px}'+
'.tbl-th:hover,.tbl-th.over{box-shadow:0 0 0 2px var(--ink)}.tbl-th:active{transform:scale(.94)}'+
/* 색 */
'.tbl-crow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:34px}'+
'.tbl-sw{width:28px;height:28px;border-radius:50%;background:var(--c);flex:none;position:relative;box-shadow:inset 0 0 0 1px rgba(14,17,20,.14);'+
  'transition:transform var(--t-fast) var(--e-out),box-shadow var(--t-fast) var(--e)}'+
'.tbl-sw::after{content:"";position:absolute;inset:-7px}'+
'.tbl-sw:hover{transform:scale(1.08)}'+
'.tbl-sw.on{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink)}'+
'.tbl-sw:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.tbl-sw.custom{background:conic-gradient(from 200deg,#C93C7C,#E3B75E,#15A05A,#0F7C86,#7C5BC7,#C93C7C);display:grid;place-items:center;color:#fff}'+
'.tbl-sw.custom .ic{width:13px;height:13px;stroke-width:2;filter:drop-shadow(0 0 1px rgba(0,0,0,.6))}'+
'.tbl-sw.custom.has{background:var(--cc)}'+
'.tbl-pick{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}'+
'@media (max-width:860px){'+
  '.tbl{grid-template-columns:1fr;grid-template-rows:auto auto auto;grid-template-areas:"stage" "act" "ctl";height:auto;min-height:0}'+
  '.tbl-stage{overflow:visible;padding:14px 14px 18px}.tbl-ctl{overflow:visible;border-left:0;border-top:1px solid var(--hair);padding:0 14px 14px}'+
  '.tbl-act{padding:12px 14px}.tbl-act .cta{margin-left:0;width:100%;justify-content:space-between}'+
'}';
/* ── 치수(논리 px, 폭 693) ── */
var M={tray:6,rTray:22,padX:20,topPad:24,hdTop:22,hdH:60,hdGap:22,rCard:14,headMin:50,headPadY:13,padY:16,c0PadX:12,cellPadX:12,labelGap:9,
       ftGap:12,ftH:48,padB:10,sigH:96,sigR:6,sigRot:6,grid:22};
var CELL_W='700';   /* 글 칸 굵기 — 폰(×0.52)에서 획이 흐려지지 않게 */
function imgPx(){ return (byId(SIZES,ST.size)||SIZES[1]).img; }
function frame(){ return ST.shape==='polaroid'?{l:5,t:5,r:5,b:15}:{l:0,t:0,r:0,b:0}; }
function col0W(){ var f=frame(); return Math.max(120,imgPx()+f.l+f.r+2*M.c0PadX+14); }   /* 최소 120 — «작게»에서 이름칸이 82px 라 «브라이트시커» 같은 한 어절이 글자 중간에서 끊겼다(시각 점검 09-12) */
function colWidths(innerW){
  var c0=col0W(), rest=innerW-c0, ks=ST.cols.slice(1).map(function(c){ return (byId(WIDTHS,c.w)||WIDTHS[1]).k; }), sum=ks.reduce(function(a,b){ return a+b; },0)||1, ws=[c0], used=c0;
  ks.forEach(function(k,i){ var w=i===ks.length-1?innerW-used:Math.floor(rest*k/sum); ws.push(w); used+=w; });
  return ws;
}
function isEd(kind,rid,cid){ return !!ED&&ED.kind===kind&&(ED.rid||null)===(rid||null)&&(ED.cid||null)===(cid||null); }
function sigImg(){ return (SIG&&SIG.complete&&SIG.naturalWidth)?SIG:null; }
function setFont(ctx,w,px){ ctx.font=F(w,px); ctx.letterSpacing=(-px*.02)+'px'; }
function fitFs(ctx,s,maxW,fs,min,w){ for(;fs>min;fs-=1){ ctx.font=F(w,fs); ctx.letterSpacing=(-fs*.025)+'px'; if(ctx.measureText(s).width<=maxW)break; } ctx.font=F(w,fs); ctx.letterSpacing=(-fs*.025)+'px'; return fs; }

/* 배치 — 먼저 재고(layout) 나중에 그린다(draw). 화면·내보내기가 같은 함수를 쓴다 */
function layout(ctx){
  var fs=ST.fs, lh=Math.round(fs*1.36), hlh=Math.round(fs*1.28), cut=0;
  var x0=M.tray+M.padX, innerW=W-2*x0, y=M.tray, title=(ST.title||'').trim(), hd=null;
  if(title){ y+=M.hdTop; hd={y:y,h:M.hdH,title:title}; y+=M.hdH+M.hdGap; } else y+=M.topPad;
  var ws=colWidths(innerW), xs=[], ax=x0; ws.forEach(function(w){ xs.push(ax); ax+=w; });
  var cardY=y;
  setFont(ctx,'800',fs);
  var head=ST.cols.map(function(c,ci){
    var wr=wrap(ctx,c.name||'',ws[ci]-2*M.cellPadX,MAXL.head,isEd('head',null,c.id)); if(wr.cut)cut++;
    return {cid:c.id,ci:ci,x:xs[ci],w:ws[ci],lines:wr.lines,empty:!(c.name||'').trim()};
  });
  var headH=Math.max(M.headMin,Math.max.apply(null,head.map(function(h){ return h.lines.length; }))*hlh+2*M.headPadY);
  head.forEach(function(h){ h.y=y; h.h=headH; });
  y+=headH;
  var im=imgPx(), fr=frame(), boxW=im+fr.l+fr.r, boxH=im+fr.t+fr.b, lw=ws[0]-2*M.c0PadX;
  /* 사진 열 이름 — 한 어절이 칸보다 길어 글자 중간에서 끊길 것 같으면 모든 행 이름을 같은 비율로 줄인다(최소 80% · 행마다 크기가 달라지지 않게 표 단위) */
  setFont(ctx,'800',fs);
  var labFs=fs;
  ST.rows.forEach(function(r){ String(r.label||'').split(/\s+/).forEach(function(wd){ if(!wd)return; var w=ctx.measureText(wd).width; if(w>lw)labFs=Math.min(labFs,fs*lw/w); }); });
  labFs=Math.max(Math.round(fs*1.6)/2,Math.floor(labFs*2)/2);
  var llh=Math.round(labFs*1.36);
  var rows=ST.rows.map(function(r,ri){
    setFont(ctx,'800',labFs);
    var lwr=wrap(ctx,r.label||'',lw,MAXL.label,isEd('label',r.id,null)); if(lwr.cut)cut++;
    var labH=Math.max(1,lwr.lines.length)*llh, c0H=boxH+M.labelGap+labH;
    setFont(ctx,CELL_W,fs);
    var cells=ST.cols.slice(1).map(function(c,k){
      var ci=k+1, t=r.cells[c.id]||'', wr=wrap(ctx,t,ws[ci]-2*M.cellPadX,MAXL.cell,isEd('cell',r.id,c.id)); if(wr.cut)cut++;
      return {cid:c.id,ci:ci,x:xs[ci],w:ws[ci],lines:wr.lines,empty:!t.trim()};
    });
    var txtH=Math.max.apply(null,cells.map(function(c){ return c.lines.length*lh; }).concat([0]));
    var contentH=Math.max(c0H,txtH), rowH=contentH+2*M.padY, by=y+M.padY+Math.round((contentH-c0H)/2);
    var o={rid:r.id,ri:ri,y:y,h:rowH,cells:cells,labLines:lwr.lines,labEmpty:!(r.label||'').trim()};
    o.box={x:xs[0]+Math.round((ws[0]-boxW)/2),y:by,w:boxW,h:boxH};
    o.img={x:o.box.x+fr.l,y:by+fr.t,w:im,h:im};
    o.lab={x:xs[0]+M.c0PadX,y:by+boxH+M.labelGap,w:lw,h:labH};
    cells.forEach(function(c){ var th=Math.max(1,c.lines.length)*lh; c.y=y; c.h=rowH; c.th=th; c.ty=y+Math.round((rowH-th)/2); });
    y+=rowH;
    return o;
  });
  var card={x:x0,y:cardY,w:innerW,h:y-cardY,headH:headH};
  /* 시그니처 스티커 = 오른쪽 아래, 카드 모서리에 걸쳐 붙인다. 걸친 자리 밑 글자가 가려질 것 같으면 마지막 행 아래를 그만큼 늘린다(글자는 그대로) */
  var sg=sigImg(), sigW=sg?Math.round(M.sigH*sg.naturalWidth/sg.naturalHeight):0;
  if(sg&&rows.length){
    var last=rows[rows.length-1], sx=W-M.tray-M.sigR-sigW, stTop=card.y+card.h+M.ftGap+M.ftH+M.padB-4-M.sigH, need=0;
    last.cells.forEach(function(c){ if(c.empty||c.x+c.w<sx)return; var b=c.ty+c.th+8; if(b>stTop)need=Math.max(need,b-stTop); });
    if(need){ last.h+=need; card.h+=need; last.cells.forEach(function(c){ c.h+=need; }); }
  }
  var ftY=card.y+card.h+M.ftGap, H=Math.round(ftY+M.ftH+M.padB+M.tray), sig=null;
  if(sg)sig={img:sg,x:W-M.tray-M.sigR-sigW,y:H-M.tray-4-M.sigH,w:sigW,h:M.sigH,rot:M.sigRot};
  var ft={y:ftY,h:M.ftH,base:ftY+Math.round(M.ftH/2)+2,note:(ST.note||'').trim(),sign:signText(),signR:sig?sig.x-10:x0+innerW,sig:sig};
  return {H:H,fs:fs,lh:lh,hlh:hlh,labFs:labFs,llh:llh,x0:x0,innerW:innerW,ws:ws,xs:xs,hd:hd,head:head,rows:rows,card:card,ft:ft,cut:cut};
}

/* ── 그리기 ── */
function drawPaper(ctx,L){
  ctx.fillStyle=D.edge; rrect(ctx,0,0,W,L.H,M.rTray); ctx.fill();
  ctx.fillStyle=D.paper; rrect(ctx,M.tray,M.tray,W-2*M.tray,L.H-2*M.tray,M.rTray-M.tray); ctx.fill();
  ctx.save(); rrect(ctx,M.tray,M.tray,W-2*M.tray,L.H-2*M.tray,M.rTray-M.tray); ctx.clip();
  ctx.strokeStyle=D.grid; ctx.lineWidth=1;
  for(var gx=M.tray;gx<W;gx+=M.grid){ ctx.beginPath(); ctx.moveTo(gx+.5,M.tray); ctx.lineTo(gx+.5,L.H-M.tray); ctx.stroke(); }
  for(var gy=M.tray;gy<L.H;gy+=M.grid){ ctx.beginPath(); ctx.moveTo(M.tray,gy+.5); ctx.lineTo(W-M.tray,gy+.5); ctx.stroke(); }
  ctx.restore();
}
function tape(ctx,cx,cy,rot,w){ ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot*Math.PI/180); ctx.fillStyle=D.tape; ctx.fillRect(-w/2,-9,w,18); ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fillRect(-w/2,-9,w,4); ctx.restore(); }
/* 제목 = 워시테이프로 붙인 기울어진 종이 태그(티어표 봄딩 스크랩북과 같은 모티프) */
function drawTitle(ctx,L){
  var hd=L.hd, tagW=Math.min(L.innerW-120,440), tagX=(W-tagW)/2, tagY=hd.y, tagH=hd.h-4;
  ctx.save(); ctx.translate(tagX+tagW/2,tagY+tagH/2); ctx.rotate(-1.1*Math.PI/180); ctx.translate(-(tagX+tagW/2),-(tagY+tagH/2));
  ctx.save(); ctx.shadowColor='rgba(46,32,56,.14)'; ctx.shadowBlur=10; ctx.shadowOffsetY=3; ctx.fillStyle='#FFFFFF'; rrect(ctx,tagX,tagY,tagW,tagH,6); ctx.fill(); ctx.restore();
  var tfs=fitFs(ctx,hd.title,tagW-44,25,15,'800');
  ctx.fillStyle=D.ink; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(hd.title,tagX+tagW/2,tagY+tagH/2-2);
  var rw=Math.max(36,Math.round(ctx.measureText(hd.title).width*.5));
  ctx.fillStyle=D.rule; rrect(ctx,tagX+tagW/2-rw/2,tagY+tagH/2+Math.round(tfs*.62),rw,3,1.5); ctx.fill();
  tape(ctx,tagX+12,tagY+15,-16,60); tape(ctx,tagX+tagW-12,tagY+tagH-13,12,60);
  ctx.restore(); ctx.textBaseline='alphabetic'; ctx.textAlign='left';
}
function dashUnder(ctx,cx,y,w,color){ ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=.55; ctx.lineWidth=1.2; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(cx-w/2,y+.5); ctx.lineTo(cx+w/2,y+.5); ctx.stroke(); ctx.restore(); }
function imgPath(ctx,g){ if(ST.shape==='circle'){ ctx.beginPath(); ctx.arc(g.x+g.w/2,g.y+g.h/2,g.w/2,0,Math.PI*2); ctx.closePath(); } else rrect(ctx,g.x,g.y,g.w,g.h,ST.shape==='round'?Math.round(g.w*.18):2); }
function drawImage(ctx,r,im){
  var b=r.box, g=r.img, rot=ST.shape==='polaroid'?(r.ri%2?1.4:-1.4):0;
  ctx.save();
  if(rot){ ctx.translate(b.x+b.w/2,b.y+b.h/2); ctx.rotate(rot*Math.PI/180); ctx.translate(-(b.x+b.w/2),-(b.y+b.h/2)); }
  ctx.save(); ctx.shadowColor='rgba(46,32,56,.2)'; ctx.shadowBlur=8; ctx.shadowOffsetY=2; ctx.fillStyle='#FFFFFF';
  if(ST.shape==='polaroid')rrect(ctx,b.x,b.y,b.w,b.h,3); else imgPath(ctx,g);
  ctx.fill(); ctx.restore();
  ctx.save(); imgPath(ctx,g); ctx.clip(); ctx.fillStyle='#FFFFFF'; ctx.fillRect(g.x,g.y,g.w,g.h);
  var contain=ST.fit==='contain', k=contain?Math.min(g.w/im.w,g.h/im.h)*(ST.shape==='circle'?.74:.92):Math.max(g.w/im.w,g.h/im.h), dw=im.w*k, dh=im.h*k;
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  try{ ctx.drawImage(im.img,g.x+(g.w-dw)/2,g.y+(g.h-dh)/2,dw,dh); }catch(e){}
  ctx.restore();
  ctx.strokeStyle=D.hair2; ctx.lineWidth=1; imgPath(ctx,{x:g.x+.5,y:g.y+.5,w:g.w-1,h:g.h-1}); ctx.stroke();
  ctx.restore();
}
/* 빈 그림 자리 — 화면에만(내보내기엔 그리지 않는다) */
function drawSlot(ctx,r){
  var g=r.img, hot=(hover&&hover.kind==='img'&&hover.rid===r.rid)||(drop&&drop.rid===r.rid);
  ctx.save(); ctx.fillStyle=hot?'#FFFFFF':'rgba(255,255,255,.72)'; imgPath(ctx,g); ctx.fill();
  ctx.setLineDash([6,5]); ctx.strokeStyle=hot?T.ink:D.hair3; ctx.lineWidth=hot?2:1.5; imgPath(ctx,{x:g.x+1,y:g.y+1,w:g.w-2,h:g.h-2}); ctx.stroke(); ctx.setLineDash([]);
  var s=Math.round(g.w*.3), cx=g.x+g.w/2, cy=g.y+g.h/2;
  ctx.strokeStyle=hot?T.ink:D.ink3; ctx.lineWidth=1.8; ctx.lineJoin='round'; ctx.lineCap='round';
  rrect(ctx,cx-s/2,cy-s/2,s,s,s*.16); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx-s*.17,cy-s*.17,s*.09,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+s/2,cy+s*.14); ctx.lineTo(cx+s*.16,cy-s*.18); ctx.lineTo(cx-s/2,cy+s/2); ctx.stroke();
  ctx.restore();
}
function drawRow(ctx,L,r,o){
  var im=IMG[r.rid];
  if(im&&im.img)drawImage(ctx,r,im); else if(o.screen)drawSlot(ctx,r);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if(!isEd('label',r.rid,null)&&(!r.labEmpty||o.screen)){
    var ph=r.labEmpty, ls=ph?['이름']:r.labLines;
    setFont(ctx,ph?'400':'800',L.labFs); ctx.fillStyle=ph?D.ink2:D.ink;
    ls.forEach(function(s,li){ var cy=r.lab.y+(li+.5)*L.llh; ctx.fillText(s,r.lab.x+r.lab.w/2,cy); if(ph)dashUnder(ctx,r.lab.x+r.lab.w/2,cy+L.labFs*.62,ctx.measureText(s).width,D.ink2); });
  }
  setFont(ctx,CELL_W,L.fs); ctx.fillStyle=D.ink;
  r.cells.forEach(function(c){ if(c.empty||isEd('cell',r.rid,c.cid))return; c.lines.forEach(function(s,li){ ctx.fillText(s,c.x+c.w/2,c.ty+(li+.5)*L.lh); }); });
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}
function drawCard(ctx,L,o,acc){
  var c=L.card, hink=onInk(acc);
  ctx.save(); ctx.shadowColor='rgba(46,32,56,.13)'; ctx.shadowBlur=16; ctx.shadowOffsetY=4; ctx.fillStyle='#FFFFFF'; rrect(ctx,c.x,c.y,c.w,c.h,M.rCard); ctx.fill(); ctx.restore();
  ctx.save(); rrect(ctx,c.x,c.y,c.w,c.h,M.rCard); ctx.clip();
  ctx.fillStyle=acc; ctx.fillRect(c.x,c.y,c.w,c.headH);
  ctx.fillStyle=blendOn(acc,.08,'#FFFFFF'); ctx.fillRect(c.x,c.y+c.headH,L.ws[0],c.h-c.headH);   /* 사진 열 = 포인트 색을 아주 옅게 */
  ctx.fillStyle=hink==='#FFFFFF'?'rgba(255,255,255,.26)':'rgba(46,32,56,.16)';
  for(var i=1;i<L.xs.length;i++)ctx.fillRect(Math.round(L.xs[i]),c.y+10,1,c.headH-20);
  ctx.fillStyle=D.hair; for(var j=2;j<L.xs.length;j++)ctx.fillRect(Math.round(L.xs[j]),c.y+c.headH,1,c.h-c.headH);
  ctx.strokeStyle=D.hair2; ctx.lineWidth=1; ctx.setLineDash([3,5]);
  L.rows.forEach(function(r,ri){ if(!ri)return; ctx.beginPath(); ctx.moveTo(c.x,r.y+.5); ctx.lineTo(c.x+c.w,r.y+.5); ctx.stroke(); });
  ctx.setLineDash([]);
  if(o.screen&&hover&&!drop&&hover.kind!=='img'){ var hr=markRect(L,hover); if(hr){ ctx.fillStyle=hover.kind==='head'?(hink==='#FFFFFF'?'rgba(255,255,255,.14)':'rgba(46,32,56,.07)'):'rgba(201,60,124,.06)'; ctx.fillRect(hr.x,hr.y,hr.w,hr.h); } }
  ctx.restore();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  L.head.forEach(function(h){
    if(isEd('head',null,h.cid)||(h.empty&&!o.screen))return;
    var ph=h.empty, lines=ph?[h.ci?'열 이름':'항목']:h.lines, ty=h.y+Math.round((h.h-lines.length*L.hlh)/2);
    setFont(ctx,ph?'400':'800',L.fs); ctx.fillStyle=hink;
    lines.forEach(function(s,li){ var cy=ty+(li+.5)*L.hlh; ctx.fillText(s,h.x+h.w/2,cy); if(ph)dashUnder(ctx,h.x+h.w/2,cy+L.fs*.62,ctx.measureText(s).width,hink); });
  });
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  L.rows.forEach(function(r){ drawRow(ctx,L,r,o); });
  tape(ctx,c.x+16,c.y+3,-38,58); tape(ctx,c.x+c.w-16,c.y+3,38,58);
}
function heart(ctx,cx,cy,s){ ctx.beginPath(); ctx.moveTo(cx,cy+s*.35); ctx.bezierCurveTo(cx-s*.5,cy-s*.05,cx-s*.42,cy-s*.5,cx,cy-s*.22); ctx.bezierCurveTo(cx+s*.42,cy-s*.5,cx+s*.5,cy-s*.05,cx,cy+s*.35); ctx.closePath(); }
function drawFooter(ctx,L,acc){
  var f=L.ft;
  ctx.textBaseline='middle';
  ctx.font=F('800',15); ctx.letterSpacing='-0.3px'; var sw=ctx.measureText(f.sign).width;
  ctx.textAlign='right'; ctx.fillStyle=D.ink; ctx.fillText(f.sign,f.signR,f.base);
  ctx.fillStyle=acc; heart(ctx,f.signR-sw-12,f.base,13); ctx.fill();
  if(f.note){ ctx.font=F('700',14); ctx.letterSpacing='-0.2px'; ctx.fillStyle=D.ink2; ctx.textAlign='left'; ctx.fillText(ellFit(ctx,f.note,f.signR-sw-34-L.x0),L.x0+2,f.base); }
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  if(f.sig){ var s=f.sig; ctx.save(); ctx.translate(s.x+s.w/2,s.y+s.h/2); ctx.rotate(s.rot*Math.PI/180); ctx.translate(-(s.x+s.w/2),-(s.y+s.h/2)); try{ ctx.drawImage(s.img,s.x,s.y,s.w,s.h); }catch(e){} ctx.restore(); }
}
/* 칸 사각형(논리 좌표) — 호버 틴트·현재 칸 링·편집기 자리 */
function markRect(L,t){
  if(!t||!L)return null;
  if(t.kind==='head'){ var h=L.head[colIdx(t.cid)]; return h?{x:h.x,y:h.y,w:h.w,h:h.h}:null; }
  var r=L.rows[rowIdx(t.rid)]; if(!r)return null;
  if(t.kind==='img')return {x:r.box.x-3,y:r.box.y-3,w:r.box.w+6,h:r.box.h+6};
  if(t.kind==='label')return {x:L.xs[0],y:r.y,w:L.ws[0],h:r.h};
  var ci=colIdx(t.cid); return ci>0?{x:L.xs[ci],y:r.y,w:L.ws[ci],h:r.h}:null;
}
function drawMarks(ctx,L){
  if(cur&&!ED&&main&&document.activeElement===main){
    var cr=markRect(L,curTarget());
    if(cr){ ctx.save(); ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=5; rrect(ctx,cr.x+3,cr.y+3,cr.w-6,cr.h-6,8); ctx.stroke(); ctx.strokeStyle=T.ink; ctx.lineWidth=2.5; rrect(ctx,cr.x+3,cr.y+3,cr.w-6,cr.h-6,8); ctx.stroke(); ctx.restore(); }
  }
  if(drop&&drop.idx!=null){
    var y=drop.idx>=L.rows.length?L.card.y+L.card.h:(drop.idx===0?L.card.y+L.card.headH:L.rows[drop.idx].y);
    ctx.save(); ctx.fillStyle=T.ink; rrect(ctx,L.card.x-4,y-2,L.card.w+8,4,2); ctx.fill();
    ctx.beginPath(); ctx.arc(L.card.x-4,y,5,0,Math.PI*2); ctx.arc(L.card.x+L.card.w+4,y,5,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}
function draw(ctx,L,o){
  o=o||{}; var acc=accentHex();
  ctx.save(); ctx.clearRect(0,0,W,L.H);
  drawPaper(ctx,L);
  if(L.hd)drawTitle(ctx,L);
  drawCard(ctx,L,o,acc);
  drawFooter(ctx,L,acc);
  if(o.screen)drawMarks(ctx,L);
  ctx.restore();
}
/* ── 렌더 파이프(화면 = 2배 해상도로 그리고 CSS 로 줄인다 → 693 표시에서도 또렷) ── */
function paint(){
  if(!mounted||!main)return;
  mctx.setTransform(1,0,0,1,0,0);
  LAY=layout(mctx);
  var pw=W*DPR, ph=LAY.H*DPR;
  if(main.width!==pw||main.height!==ph){ main.width=pw; main.height=ph; }
  mctx.setTransform(DPR,0,0,DPR,0,0);
  draw(mctx,LAY,{screen:true});
  placeOverlay(); checks();
  var fn=$('tblFn'); if(fn)fn.textContent=fileName()+' · '+(W*EXPORT_SCALE)+'×'+(LAY.H*EXPORT_SCALE);
}
function schedule(){ if(raf||!mounted)return; raf=requestAnimationFrame(function(){ raf=0; paint(); }); }
/* 내보내기 — 편집 중인 칸도 글자로 굽는다(편집기는 화면 요소라 PNG 에 안 들어가므로). 빈 자리 표시·호버·링은 그리지 않는다 */
function exportCanvas(){
  var c=document.createElement('canvas'), x=c.getContext('2d'), keep=ED; ED=null;
  var L=layout(x); c.width=W*EXPORT_SCALE; c.height=L.H*EXPORT_SCALE; x.setTransform(EXPORT_SCALE,0,0,EXPORT_SCALE,0,0); draw(x,L,{});
  ED=keep; return c;
}
function toBlob(){ return new Promise(function(res){ exportCanvas().toBlob(function(b){ res(b); },'image/png'); }); }
/* 검사 — 폰 글자는 «693px 그림이 네이버 모바일 본문(≈360px)에 놓일 때»(×0.52), 9.5px 미만이면 경고(티어표와 같은 선) */
function checks(){
  var ul=$('tblChk'); if(!ul||!LAY)return;
  var noImg=0, empty=0;
  ST.cols.forEach(function(c){ if(!(c.name||'').trim())empty++; });
  ST.rows.forEach(function(r){
    if(!(IMG[r.id]&&IMG[r.id].img))noImg++;
    if(!(r.label||'').trim())empty++;
    ST.cols.forEach(function(c,ci){ if(ci&&!(r.cells[c.id]||'').trim())empty++; });
  });
  var rows=[{ok:true,t:'열 <b>'+ST.cols.length+'</b> · 행 <b>'+ST.rows.length+'</b>'}];
  if(noImg)rows.push({ok:false,t:'그림 없음 <b>'+noImg+'</b>'});
  if(empty)rows.push({ok:false,t:'빈 칸 <b>'+empty+'</b>'});
  if(LAY.cut)rows.push({ok:false,t:'잘린 글 <b>'+LAY.cut+'</b> · 줄이거나 넓게'});
  var ph=Math.round(ST.fs*PHONE*10)/10; rows.push({ok:ph>=9.5,t:'폰 글자 ≈ <b>'+ph+'px</b>'+(ph<9.5?' · 글자 키우기':'')});
  rows.push({ok:LAY.H<=LONG_H,t:'<b>693×'+LAY.H+'</b>'+(LAY.H>LONG_H?' · 길어요, 나눠 올리기':'')});
  ul.innerHTML=rows.map(function(r){ return '<li class="'+(r.ok?'':'bad')+'">'+ic(r.ok?'check':'alert')+'<span>'+r.t+'</span></li>'; }).join('');
}
function curTarget(){
  if(!cur)return null;
  var ci=colIdx(cur.cid); if(ci<0)return null;
  if(!cur.rid)return {kind:'head',cid:cur.cid};
  if(rowIdx(cur.rid)<0)return null;
  return ci===0?{kind:'label',rid:cur.rid}:{kind:'cell',rid:cur.rid,cid:cur.cid};
}

/* ── 그림 — 긴 변 720 으로 줄여 webp(투명 유지)로. 원본은 들고 있지 않는다 ── */
function shrink(file){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(file), im=new Image();
    im.onload=function(){
      var w=im.naturalWidth||1, h=im.naturalHeight||1, k=Math.min(1,IMG_MAX/Math.max(w,h)), cw=Math.max(1,Math.round(w*k)), ch=Math.max(1,Math.round(h*k));
      var c=document.createElement('canvas'); c.width=cw; c.height=ch;
      var x=c.getContext('2d'); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.drawImage(im,0,0,cw,ch);
      URL.revokeObjectURL(url);
      c.toBlob(function(b){ if(b&&b.size)res(b); else c.toBlob(function(p){ if(p)res(p); else rej(new Error('encode')); },'image/png'); },'image/webp',.92);
    };
    im.onerror=function(){ URL.revokeObjectURL(url); rej(new Error('decode')); };
    im.src=url;
  });
}
function setImageBlob(rid,blob,persist){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(blob), im=new Image(); im.decoding='async';
    im.onload=function(){
      var old=IMG[rid]; if(old&&old.url)try{ URL.revokeObjectURL(old.url); }catch(e){}
      IMG[rid]={img:im,w:im.naturalWidth,h:im.naturalHeight,url:url,blob:blob};
      if(persist)idbPut(rid,blob);
      if(mounted){ renderRows(); schedule(); }
      res(true);
    };
    im.onerror=function(){ try{ URL.revokeObjectURL(url); }catch(e){} rej(new Error('img')); };
    im.src=url;
  });
}
function setImageFile(rid,f){
  if(!f||!/^image\//.test(f.type||'')){ if(api)api.toast('이미지 파일만 넣을 수 있어요',{kind:'err'}); return Promise.resolve(false); }
  return shrink(f).then(function(b){ return setImageBlob(rid,b,true); }).catch(function(){ if(api)api.toast('그림을 읽지 못했어요 · '+(f.name||''),{kind:'err'}); return false; });
}
function clearImage(rid){
  var im=IMG[rid]; if(!im)return;
  var r=ST.rows[rowIdx(rid)], blob=im.blob;
  delete IMG[rid]; idbDel(rid);
  try{ URL.revokeObjectURL(im.url); }catch(e){}
  renderRows(); schedule();
  api.toast(((r&&r.label)||'행')+' 그림 지움',{action:'되돌리기',onAction:function(){ if(rowIdx(rid)>=0&&blob)setImageBlob(rid,blob,true); }});
}
/* 페이지를 연 뒤 처음 한 번 — 저장소의 그림을 행에 되살리고, 지난 세션에 지운 행의 그림은 치운다(되돌리기가 끝난 뒤라 안전) */
function bootImages(){
  if(imgBoot)return imgBoot;
  imgBoot=idbAll().then(function(all){
    var ps=[];
    Object.keys(all).forEach(function(k){
      if(rowIdx(k)<0){ idbDel(k); return; }
      if(IMG[k]||!(all[k] instanceof Blob))return;
      ps.push(setImageBlob(k,all[k],false).catch(function(){}));
    });
    return Promise.all(ps);
  }).catch(function(){});
  return imgBoot;
}
/* 파일 여러 장 — opt.rid = 그 행 그림(나머지는 바로 아래 새 행) / opt.idx = 그 자리에 새 행 / 없으면 맨 끝. 새 행 이름 = 파일 이름 */
function takeFiles(files,opt){
  opt=opt||{};
  var all=Array.prototype.slice.call(files||[]);
  var json=all.filter(function(f){ return /json$/i.test(f.type||'')||/\.json$/i.test(f.name||''); })[0];
  if(json){ loadJsonFile(json); return; }
  var list=all.filter(function(f){ return /^image\//.test(f.type||''); });
  if(!list.length){ api.toast('이미지 파일만 넣을 수 있어요',{kind:'err'}); return; }
  var at=ST.rows.length;
  if(opt.rid&&rowIdx(opt.rid)>=0){ setImageFile(opt.rid,list[0]); cur={rid:opt.rid,cid:ST.cols[0].id}; at=rowIdx(opt.rid)+1; list=list.slice(1); }
  else if(typeof opt.idx==='number')at=clamp(opt.idx,0,ST.rows.length);
  if(!list.length){ renderRows(); schedule(); return; }
  var take=list.slice(0,Math.max(0,MAX_ROWS-ST.rows.length));
  if(take.length<list.length)api.toast('행은 최대 '+MAX_ROWS+'개예요 · '+(list.length-take.length)+'장은 넣지 못했어요',{kind:'err'});
  if(!take.length)return;
  var made=take.map(function(f,k){ var r=mkRow(fileBase(f)); ST.rows.splice(at+k,0,r); return [r.id,f]; });
  cur={rid:made[made.length-1][0],cid:ST.cols[0].id};
  renderAll(); save();
  made.forEach(function(p){ setImageFile(p[0],p[1]); });
}

/* ── 편집(구조) — 삭제·비우기·불러오기는 전부 토스트 «되돌리기» ── */
function addRow(at,label){
  if(ST.rows.length>=MAX_ROWS){ api.toast('행은 최대 '+MAX_ROWS+'개예요',{kind:'err'}); return null; }
  var r=mkRow(str(label||'',LIM.label)); if(at==null||at>ST.rows.length)at=ST.rows.length;
  ST.rows.splice(at,0,r); cur={rid:r.id,cid:ST.cols[0].id};
  renderAll(); save(); return r.id;
}
function addRowsFromText(text){
  var names=String(text||'').split(/[,\n、]/).map(function(s){ return s.trim().slice(0,LIM.label); });
  if(names.length>1)names=names.filter(Boolean);
  if(!names.length)names=[''];
  if(ST.rows.length+names.length>MAX_ROWS){ api.toast('행은 최대 '+MAX_ROWS+'개예요',{kind:'err'}); return []; }
  var ids=names.map(function(n){ var r=mkRow(n); ST.rows.push(r); return r.id; });
  cur={rid:ids[ids.length-1],cid:ST.cols[0].id}; renderAll(); save(); return ids;
}
function addCol(at,name){
  if(ST.cols.length>=MAX_COLS){ api.toast('열은 최대 '+MAX_COLS+'개예요',{kind:'err'}); return null; }
  var c=mkCol(str(name||'',LIM.head)); if(at==null||at>ST.cols.length)at=ST.cols.length; at=Math.max(1,at);
  ST.cols.splice(at,0,c); cur={rid:null,cid:c.id};
  renderAll(); save(); return c.id;
}
function removeRow(rid){
  var i=rowIdx(rid); if(i<0)return;
  if(ST.rows.length<=1){ api.toast('행은 하나는 있어야 해요',{kind:'err'}); return; }
  endEdit(true);
  var snap=snapshot(), r=ST.rows[i];
  ST.rows.splice(i,1); if(cur&&cur.rid===rid)cur=null;
  renderAll(); save();
  api.toast(((r.label||'').trim()||(i+1)+'행')+' 삭제',{action:'되돌리기',onAction:function(){ restore(snap); }});
}
function removeCol(cid){
  var i=colIdx(cid); if(i<1)return;
  if(ST.cols.length<=MIN_COLS){ api.toast('글 열은 하나는 있어야 해요',{kind:'err'}); return; }
  endEdit(true);
  var snap=snapshot(), c=ST.cols[i];
  ST.cols.splice(i,1); ST.rows.forEach(function(r){ delete r.cells[cid]; }); if(cur&&cur.cid===cid)cur=null;
  renderAll(); save();
  api.toast(((c.name||'').trim()||(i+1)+'열')+' 삭제',{action:'되돌리기',onAction:function(){ restore(snap); }});
}
function moveRow(rid,d){ var i=rowIdx(rid), j=i+d; if(i<0||j<0||j>=ST.rows.length)return false; ST.rows.splice(j,0,ST.rows.splice(i,1)[0]); renderAll(); save(); return true; }
function moveCol(cid,d){ var i=colIdx(cid), j=i+d; if(i<1||j<1||j>=ST.cols.length)return false; ST.cols.splice(j,0,ST.cols.splice(i,1)[0]); renderAll(); save(); return true; }
function clearBoard(){
  endEdit(true);
  var snap=snapshot(); cur=null; defaultBoard(); renderAll(); save();
  api.toast('표를 비웠어요',{action:'되돌리기',onAction:function(){ restore(snap); }});
}

/* ── JSON — 그림은 data URL 로 함께 담는다(다른 PC 에서도 그대로) ── */
function blobToDataURL(b){ return new Promise(function(res,rej){ var rd=new FileReader(); rd.onload=function(){ res(String(rd.result)); }; rd.onerror=function(){ rej(rd.error); }; rd.readAsDataURL(b); }); }
function dataURLBlob(u){ var m=/^data:([^;,]+)(;base64)?,(.*)$/.exec(u||''); if(!m)return null; var raw=m[2]?atob(m[3]):decodeURIComponent(m[3]), a=new Uint8Array(raw.length); for(var i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i); return new Blob([a],{type:m[1]}); }
function jsonData(){
  var d=data(), imgs={};
  return Promise.all(ST.rows.map(function(r){ var im=IMG[r.id]; return im&&im.blob?blobToDataURL(im.blob).then(function(u){ imgs[r.id]=u; }).catch(function(){}):null; }))
    .then(function(){ d.images=imgs; return d; });
}
function saveJson(){
  jsonData().then(function(d){
    var b=new Blob([JSON.stringify(d)],{type:'application/json'}), a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=(safeName(ST.title)||'봄딩')+'_표.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(a.href); },4000);
    api.toast(a.download+' 저장 · 그림 '+Object.keys(d.images).length+'장 포함');
  });
}
function loadJsonData(d){
  if(!d||d.app!=='sseudam-table'||!d.board){ api.toast('쓰담 표 JSON 이 아니에요',{kind:'err'}); return false; }
  endEdit(true);
  var snap=snapshot(), rmap=restoreData(d,true,true);
  if(!rmap){ api.toast('빈 표 JSON 이에요',{kind:'err'}); return false; }
  cur=null; renderAll(); save();
  var imgs=(d.images&&typeof d.images==='object')?d.images:{};
  Object.keys(imgs).forEach(function(old){ var nid=rmap[old], b=typeof imgs[old]==='string'&&/^data:image\//.test(imgs[old])?dataURLBlob(imgs[old]):null; if(nid&&b)setImageBlob(nid,b,true).catch(function(){}); });
  api.toast(((ST.title||'').trim()||'표')+' 불러옴',{action:'되돌리기',onAction:function(){ restore(snap); }});
  return true;
}
function loadJsonFile(f){
  var rd=new FileReader();
  rd.onload=function(){ var d=null; try{ d=JSON.parse(String(rd.result||'')); }catch(e){} loadJsonData(d); };
  rd.onerror=function(){ api.toast('파일을 읽지 못했어요',{kind:'err'}); };
  rd.readAsText(f);
}
function savePng(){
  endEdit(true);
  toBlob().then(function(b){
    if(!b){ api.toast('PNG를 만들지 못했어요',{kind:'err'}); return; }
    var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fileName();
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(a.href); },4000);
    api.toast(fileName()+' · '+Math.round(b.size/1024)+'KB 저장');
  });
}
function copyPng(){
  endEdit(true);
  if(!(navigator.clipboard&&window.ClipboardItem)){ api.toast('이 브라우저는 이미지 복사를 지원하지 않아요 · PNG 저장을 쓰세요',{kind:'err'}); return; }
  toBlob().then(function(b){ return navigator.clipboard.write([new ClipboardItem({'image/png':b})]); })
    .then(function(){ api.toast('클립보드에 복사했어요 · 네이버 에디터에 붙여넣기'); })
    .catch(function(){ api.toast('클립보드 복사가 막혔어요 · PNG 저장을 쓰세요',{kind:'err'}); });
}
/* ── 마크업 ── */
function chip(id,txt,on){ return '<button type="button" class="chip'+(on?' on':'')+'" data-v="'+esc(id)+'" aria-pressed="'+(on?'true':'false')+'">'+txt+'</button>'; }
function swatchHtml(){
  return D.sw.map(function(s){ return '<button type="button" class="tbl-sw'+(ST.accent===s.id?' on':'')+'" data-c="'+s.id+'" style="--c:'+s.c+'" aria-label="봄딩 '+esc(s.n)+'" aria-pressed="'+(ST.accent===s.id)+'" title="'+esc(s.n)+'"></button>'; }).join('')+
    '<button type="button" class="tbl-sw custom'+(ST.accent==='custom'?' on has':'')+'" data-c="custom" style="--cc:'+ST.accentHex+'" aria-label="기타 색 (팔레트)" aria-pressed="'+(ST.accent==='custom')+'" title="팔레트">'+ic('pipette')+'</button>'+
    '<input class="tbl-in tbl-in-hex" id="tblHex" maxlength="7" value="'+esc(accentHex().toUpperCase())+'" aria-label="포인트 색 헥스코드" spellcheck="false" autocomplete="off">'+
    '<input type="color" class="tbl-pick" id="tblPick" value="'+ST.accentHex+'" aria-label="포인트 색 팔레트" tabindex="-1">';
}
function chipsHtml(list,key){ return list.map(function(x){ return chip(x.id,esc(x.n),ST[key]===x.id); }).join(''); }
function html(){
  return '<div class="tbl">'+
    '<section class="tbl-stage" aria-label="표 보드">'+
      '<div class="tbl-cv" id="tblCv">'+
        '<canvas id="tblCanvas" width="'+(W*DPR)+'" height="600" tabindex="0" aria-label="표 · 칸을 누르면 입력, 방향키로 칸 이동, Enter 로 편집" aria-describedby="tblLive"></canvas>'+
        '<textarea class="tbl-ed" id="tblEd" hidden rows="1" spellcheck="false" aria-label="칸 입력"></textarea>'+
        '<button type="button" class="tbl-plus" id="tblPlusCol" aria-label="열 추가" title="열 추가">'+ic('plus')+'</button>'+
        '<button type="button" class="tbl-plus" id="tblPlusRow" aria-label="행 추가" title="행 추가">'+ic('plus')+'</button>'+
      '</div>'+
      '<div class="sr" id="tblLive" aria-live="polite"></div>'+
      '<input type="file" id="tblFile" accept="image/*" multiple hidden>'+
      '<input type="file" id="tblJsonFile" accept="application/json,.json" hidden>'+
    '</section>'+
    '<section class="tbl-act" aria-label="내보내기">'+
      '<ul class="tbl-chk" id="tblChk" aria-live="polite"></ul>'+
      '<button type="button" class="ghost" id="tblCopy">'+ic('copy')+'복사</button>'+
      '<button type="button" class="ghost" id="tblJson" title="표 JSON 저장 · 그림 포함">'+ic('file')+'JSON</button>'+
      '<button type="button" class="ghost" id="tblLoad" title="표 JSON 불러오기">'+ic('upload')+'열기</button>'+
      '<button type="button" class="ghost" id="tblClear">'+ic('broom')+'비우기</button>'+
      '<button type="button" class="cta" id="tblSave"><span>PNG 저장</span><span class="knob">'+ic('download')+'</span></button>'+
      '<div class="tbl-cnt num" id="tblFn" style="flex-basis:100%"></div>'+
    '</section>'+
    '<section class="tbl-ctl" aria-label="설정">'+
      '<div class="tbl-sec"><div class="tbl-st">디자인</div>'+
        '<div class="tbl-lbl first"><span>포인트 색</span></div>'+
        '<div class="tbl-crow" id="tblSws" role="group" aria-label="포인트 색">'+swatchHtml()+'</div>'+   /* 이름·HEX 읽기값 줄은 두지 않는다 — 헥스 칸이 같은 값을 보여 준다(편집 열 높이 회수) */
        '<div class="tbl-lbl"><span>그림 틀</span></div>'+
        '<div class="tbl-chips" id="tblShape" role="group" aria-label="그림 틀">'+chipsHtml(SHAPES,'shape')+'</div>'+
        /* 크기·맞춤은 한 줄에 두 무리 — 열 6개(최대)에서 편집 열 «행» 머리가 1080 첫 화면 밖으로 36px 밀렸다(게이트 🟡 09-12) */
        '<div class="tbl-lbl"><span>그림 크기 · 맞춤</span></div>'+
        '<div class="tbl-chips">'+
          '<span class="tbl-grp" id="tblSize" role="group" aria-label="그림 크기">'+chipsHtml(SIZES,'size')+'</span>'+
          '<span class="tbl-sep" aria-hidden="true"></span>'+
          '<span class="tbl-grp" id="tblFit" role="group" aria-label="그림 맞춤">'+chipsHtml(FITS,'fit')+'</span>'+
        '</div>'+
        '<div class="tbl-lbl"><label for="tblFs">글자 크기</label></div>'+
        '<div class="tbl-sz"><input type="range" id="tblFs" min="'+FS_MIN+'" max="'+FS_MAX+'" step="0.5" value="'+ST.fs+'" aria-label="글자 크기 슬라이더(px)">'+
          '<span class="tbl-nm"><input type="number" id="tblFsN" min="'+FS_MIN+'" max="'+FS_MAX+'" step="0.5" value="'+ST.fs+'" aria-label="글자 크기(px)"><span>px</span></span></div>'+
      '</div>'+
      '<div class="tbl-sec"><div class="tbl-st">제목</div>'+
        '<label class="tbl-lbl first" for="tblTitle"><span>표 제목</span><span class="o">비우면 안 그려요</span></label>'+
        '<input class="f-i" id="tblTitle" maxlength="'+LIM.title+'" placeholder="예: 아기 서큘레이터 4종 비교" autocomplete="off" value="'+esc(ST.title)+'">'+
        '<div class="tbl-2">'+
          '<div><label class="tbl-lbl" for="tblNote"><span>기준·출처</span></label><input class="f-i" id="tblNote" maxlength="'+LIM.note+'" placeholder="예: 9월 쿠팡가 기준" autocomplete="off" value="'+esc(ST.note)+'"></div>'+
          '<div><label class="tbl-lbl" for="tblSign"><span>서명</span></label><input class="f-i" id="tblSign" maxlength="'+LIM.sign+'" placeholder="봄딩" autocomplete="off" value="'+esc(ST.sign)+'"></div>'+
        '</div>'+
      '</div>'+
      '<div class="tbl-sec"><div class="tbl-st">열<span class="d" id="tblColN"></span></div>'+
        '<div class="tbl-cols" id="tblCols"></div>'+
        '<button type="button" class="ghost tbl-add" id="tblColAdd">'+ic('plus')+'열 추가</button>'+
      '</div>'+
      '<div class="tbl-sec"><div class="tbl-st">행<span class="d" id="tblRowN"></span></div>'+
        '<div class="tbl-new"><input class="tbl-in" id="tblNew" maxlength="200" placeholder="이름 · 쉼표로 여러 개" autocomplete="off" aria-label="추가할 행 이름">'+
          '<button type="button" class="ghost" id="tblRowAdd">'+ic('plus')+'행 추가</button></div>'+
        '<div class="tbl-rows" id="tblRows"></div>'+
      '</div>'+
    '</section>'+
  '</div>';
}
/* 목록을 다시 그려도 입력 중인 칸·누른 버튼의 포커스와 캐럿을 지킨다(그림이 늦게 도착해 목록이 갱신돼도 타자가 끊기지 않게) */
function keepFocus(box,build){
  var a=document.activeElement, key=null, s=0, e=0;
  if(box&&a&&box.contains(a)){
    var row=a.closest('[data-rid],[data-cid]');
    if(row)key={id:row.dataset.rid||row.dataset.cid,f:a.dataset.f||'',act:a.dataset.act||''};
    if(typeof a.selectionStart==='number'){ s=a.selectionStart; e=a.selectionEnd; }
  }
  build();
  if(!key)return;
  var r2=box.querySelector('[data-rid="'+key.id+'"],[data-cid="'+key.id+'"]'); if(!r2)return;
  var el=key.f?r2.querySelector('[data-f="'+key.f+'"]'):r2.querySelector('[data-act="'+key.act+'"]');
  if(!el||el.disabled)el=r2.querySelector('.tbl-in');
  if(!el)return;
  el.focus({preventScroll:true});
  if(key.f&&el.tagName==='INPUT')try{ el.setSelectionRange(s,e); }catch(x){}
  if(key.act&&el.scrollIntoView)el.scrollIntoView({block:'nearest'});
}
function renderCols(){
  var box=$('tblCols'); if(!box)return;
  var n=ST.cols.length;
  keepFocus(box,function(){
    box.innerHTML=ST.cols.map(function(c,i){
      var nm='<input class="tbl-in'+(i?'':' span')+'" data-f="name" maxlength="'+LIM.head+'" value="'+esc(c.name)+'" placeholder="'+(i?'열 이름':'항목 · 예: 제품')+'" aria-label="'+(i+1)+'열 이름" autocomplete="off">';
      if(!i)return '<div class="tbl-col" data-cid="'+c.id+'"><span class="tbl-ci" title="그림 열">'+ic('image')+'</span>'+nm+'</div>';
      return '<div class="tbl-col" data-cid="'+c.id+'"><span class="tbl-ci num">'+(i+1)+'</span>'+nm+
        '<select class="tbl-sel" data-f="w" aria-label="'+(i+1)+'열 너비">'+WIDTHS.map(function(w){ return '<option value="'+w.id+'"'+(c.w===w.id?' selected':'')+'>'+w.n+'</option>'; }).join('')+'</select>'+
        '<span class="tbl-ibs">'+
          '<button type="button" class="tbl-ib" data-act="left" aria-label="'+(i+1)+'열 왼쪽으로"'+(i<=1?' disabled':'')+'>'+ic('left')+'</button>'+
          '<button type="button" class="tbl-ib" data-act="right" aria-label="'+(i+1)+'열 오른쪽으로"'+(i>=n-1?' disabled':'')+'>'+ic('right')+'</button>'+
          '<button type="button" class="tbl-ib" data-act="del" aria-label="'+(i+1)+'열 삭제"'+(n<=MIN_COLS?' disabled':'')+'>'+ic('x')+'</button>'+
        '</span></div>';
    }).join('');
  });
  var cn=$('tblColN'); if(cn)cn.textContent=n+'개';
  var add=$('tblColAdd'); if(add)add.disabled=n>=MAX_COLS;
}
function renderRows(){
  var box=$('tblRows'); if(!box)return;
  var n=ST.rows.length;
  keepFocus(box,function(){
    box.innerHTML=ST.rows.map(function(r,i){
      var im=IMG[r.id], nm=(r.label||'').trim();
      return '<div class="tbl-it'+(cur&&cur.rid===r.id?' cur':'')+'" data-rid="'+r.id+'">'+
        '<button type="button" class="tbl-th" data-act="img" aria-label="'+esc(nm||(i+1)+'행')+' 그림 '+(im?'바꾸기':'넣기')+'">'+(im&&im.img?'<img src="'+esc(im.url)+'" alt="">':ic('image'))+'</button>'+
        '<input class="tbl-in" data-f="label" maxlength="'+LIM.label+'" value="'+esc(r.label)+'" placeholder="이름" aria-label="'+(i+1)+'행 이름" autocomplete="off">'+
        '<span class="tbl-ibs">'+
          '<button type="button" class="tbl-ib" data-act="up" aria-label="'+(i+1)+'행 위로"'+(i===0?' disabled':'')+'>'+ic('up')+'</button>'+
          '<button type="button" class="tbl-ib" data-act="down" aria-label="'+(i+1)+'행 아래로"'+(i===n-1?' disabled':'')+'>'+ic('down')+'</button>'+
          (im?'<button type="button" class="tbl-ib" data-act="imgDel" aria-label="'+(i+1)+'행 그림 지우기">'+ic('imgOff')+'</button>':'')+
          '<button type="button" class="tbl-ib" data-act="del" aria-label="'+(i+1)+'행 삭제"'+(n<=1?' disabled':'')+'>'+ic('x')+'</button>'+
        '</span></div>';
    }).join('');
  });
  var rn=$('tblRowN'); if(rn)rn.textContent=n+'개';
  var add=$('tblRowAdd'); if(add)add.disabled=n>=MAX_ROWS;
}
function syncDesign(){
  if(!root)return;
  /* 스와치는 갈아 끼우지 않고 제자리에서 표시만 바꾼다 — 갈아 끼우면 열려 있는 OS 색 대화상자가 떨어져 나간 input 에 묶여 두 번째 색부터 안 먹는다 */
  var sws=$('tblSws'), hexEl=$('tblHex'), pick=$('tblPick');
  if(sws){
    sws.querySelectorAll('.tbl-sw').forEach(function(b){ var on=b.dataset.c===ST.accent; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
    var cs=sws.querySelector('.custom'); if(cs){ cs.style.setProperty('--cc',ST.accentHex); cs.classList.toggle('has',ST.accent==='custom'); }
  }
  if(hexEl&&document.activeElement!==hexEl){ hexEl.value=accentHex().toUpperCase(); hexEl.classList.remove('bad'); }
  if(pick&&pick.value.toUpperCase()!==ST.accentHex)pick.value=ST.accentHex;
  [['tblSize','size'],['tblShape','shape'],['tblFit','fit']].forEach(function(p){
    root.querySelectorAll('#'+p[0]+' .chip').forEach(function(b){ var on=b.dataset.v===ST[p[1]]; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  });
  var fs=$('tblFs'), fsn=$('tblFsN');
  if(fs&&document.activeElement!==fs)fs.value=ST.fs;
  if(fsn&&document.activeElement!==fsn)fsn.value=ST.fs;
}
function syncBoardInputs(){ [['tblTitle','title'],['tblNote','note'],['tblSign','sign']].forEach(function(p){ var e=$(p[0]); if(e&&e!==document.activeElement&&e.value!==ST[p[1]])e.value=ST[p[1]]; }); }
function renderAll(){ if(!root)return; syncBoardInputs(); renderCols(); renderRows(); syncDesign(); schedule(); }
/* 보드에서 고친 이름을 편집 열 입력칸에도(그 칸에 포커스가 없을 때만) */
function syncSide(t){
  if(!root||!t)return;
  var e=t.kind==='head'?root.querySelector('#tblCols [data-cid="'+t.cid+'"] [data-f="name"]'):t.kind==='label'?root.querySelector('#tblRows [data-rid="'+t.rid+'"] [data-f="label"]'):null;
  if(!e||e===document.activeElement)return;
  var v=t.kind==='head'?(ST.cols[colIdx(t.cid)]||{}).name:(ST.rows[rowIdx(t.rid)]||{}).label;
  if(typeof v==='string'&&e.value!==v)e.value=v;
}
function markCurRow(){ if(!root)return; root.querySelectorAll('#tblRows .tbl-it').forEach(function(x){ x.classList.toggle('cur',!!cur&&cur.rid===x.dataset.rid); }); }
function scaleK(){ var r=main?main.getBoundingClientRect():null; return r&&r.width?r.width/W:1; }
/* 보드 가장자리 «+» — 열 = 머리 띠 오른쪽 끝 / 행 = 카드 아래 가운데 */
function placeOverlay(){
  if(!LAY||!main)return;
  var k=scaleK(), c=LAY.card, pc=$('tblPlusCol'), pr=$('tblPlusRow');
  if(pc){ pc.hidden=ST.cols.length>=MAX_COLS; pc.style.left=((c.x+c.w)*k)+'px'; pc.style.top=((c.y+c.headH/2)*k)+'px'; }
  if(pr){ pr.hidden=ST.rows.length>=MAX_ROWS; pr.style.left=((c.x+c.w/2)*k)+'px'; pr.style.top=((c.y+c.h)*k)+'px'; }
  placeEditor();
}
/* ── 칸 찾기 ── */
function cvPt(cx,cy){ if(!main)return null; var r=main.getBoundingClientRect(); if(cx<r.left||cx>r.right||cy<r.top||cy>r.bottom)return null; var k=W/(r.width||1); return {x:(cx-r.left)*k,y:(cy-r.top)*k}; }
function targetAt(p){
  if(!LAY||!p)return null;
  var c=LAY.card; if(p.x<c.x||p.x>c.x+c.w||p.y<c.y||p.y>c.y+c.h)return null;
  var ci=0; for(var i=LAY.xs.length-1;i>=0;i--){ if(p.x>=LAY.xs[i]){ ci=i; break; } }
  if(p.y<c.y+c.headH)return {kind:'head',cid:ST.cols[ci].id};
  for(var ri=0;ri<LAY.rows.length;ri++){
    var r=LAY.rows[ri]; if(p.y>=r.y+r.h)continue;
    if(ci>0)return {kind:'cell',rid:r.rid,cid:ST.cols[ci].id};
    var b=r.box; return (p.x>=b.x-4&&p.x<=b.x+b.w+4&&p.y>=b.y-4&&p.y<=b.y+b.h+4)?{kind:'img',rid:r.rid}:{kind:'label',rid:r.rid};
  }
  return null;
}
/* 파일을 끌어 온 자리 — 사진 열 칸 = 그 행 그림 / 그 밖 = 가장 가까운 행 경계에 새 행 */
function dropAt(p){
  if(!LAY||!p)return null;
  var t=targetAt(p); if(t&&(t.kind==='img'||t.kind==='label'))return {rid:t.rid};
  var c=LAY.card; if(p.y<c.y+c.headH)return {idx:0};
  for(var i=0;i<LAY.rows.length;i++){ var r=LAY.rows[i]; if(p.y<r.y+r.h)return {idx:p.y<r.y+r.h/2?i:i+1}; }
  return {idx:LAY.rows.length};
}
function sameT(a,b){ return (!a&&!b)||(!!a&&!!b&&a.kind===b.kind&&(a.rid||null)===(b.rid||null)&&(a.cid||null)===(b.cid||null)&&a.idx===b.idx); }

/* ── 칸 위 편집기 ── */
function textOf(t){
  if(t.kind==='head')return (ST.cols[colIdx(t.cid)]||{}).name||'';
  var r=ST.rows[rowIdx(t.rid)]; if(!r)return '';
  return t.kind==='label'?(r.label||''):(r.cells[t.cid]||'');
}
function setText(t,v){
  if(t.kind==='head'){ var c=ST.cols[colIdx(t.cid)]; if(c)c.name=v.slice(0,LIM.head); return; }
  var r=ST.rows[rowIdx(t.rid)]; if(!r)return;
  if(t.kind==='label')r.label=v.slice(0,LIM.label);
  else if(v)r.cells[t.cid]=v.slice(0,LIM.cell); else delete r.cells[t.cid];
}
function edLabel(t){
  var ci=t.kind==='label'?0:colIdx(t.cid), col=ST.cols[ci];
  if(t.kind==='head')return (ci+1)+'열 이름';
  return (rowIdx(t.rid)+1)+'행 · '+(t.kind==='label'?'이름':((col&&col.name||'').trim()||(ci+1)+'열'));
}
function announce(s){ var l=$('tblLive'); if(l)l.textContent=s; }
function commitEdit(){ if(!ED)return; var t=ED, v=textOf(t), tv=v.replace(/\s+$/,''); if(tv!==v)setText(t,tv); syncSide(t); save(); }
function startEdit(t){
  if(!t||t.kind==='img'||!root)return;
  if(t.kind==='head'?colIdx(t.cid)<0:rowIdx(t.rid)<0)return;
  var ta=$('tblEd'); if(!ta)return;
  commitEdit();   /* 칸을 옮겨 가면 편집기를 닫지 않고 그대로 옮긴다(닫았다 열면 늦게 오는 blur 가 새 편집을 끊는다) */
  ED={kind:t.kind,rid:t.rid||null,cid:t.cid||null};
  cur={rid:ED.rid,cid:t.kind==='label'?ST.cols[0].id:ED.cid};
  ta.maxLength=LIM[t.kind==='head'?'head':(t.kind==='label'?'label':'cell')];
  ta.value=textOf(t);
  ta.placeholder=t.kind==='head'?(colIdx(t.cid)?'열 이름':'항목'):(t.kind==='label'?'이름':'');
  ta.setAttribute('aria-label',edLabel(t));
  ta.hidden=false; markCurRow(); paint();
  if(document.activeElement!==ta)ta.focus({preventScroll:true});
  var n=ta.value.length; try{ ta.setSelectionRange(n,n); }catch(e){}
  announce(edLabel(t));
}
function endEdit(commit){
  if(!ED)return;
  if(commit!==false)commitEdit();
  var ta=$('tblEd'); ED=null; if(ta)ta.hidden=true;
  schedule();
}
/* 편집기 자리 = 그 칸 글자 상자(논리 좌표 × 표시 배율). 배경 = 칸 색이라 캔버스 글자와 겹쳐 보이지 않는다 */
function edBox(t){
  if(!LAY)return null;
  var acc=accentHex();
  if(t.kind==='head'){ var h=LAY.head[colIdx(t.cid)]; if(!h)return null; var hh=Math.max(1,h.lines.length)*LAY.hlh; return {x:h.x+M.cellPadX,y:h.y+Math.round((h.h-hh)/2),w:h.w-2*M.cellPadX,h:hh,lh:LAY.hlh,wt:'800',bg:acc,fg:onInk(acc)}; }
  var r=LAY.rows[rowIdx(t.rid)]; if(!r)return null;
  if(t.kind==='label')return {x:r.lab.x,y:r.lab.y,w:r.lab.w,h:Math.max(1,r.labLines.length)*LAY.llh,lh:LAY.llh,fs:LAY.labFs,wt:'800',bg:blendOn(acc,.08,'#FFFFFF'),fg:D.ink};
  var c=null; r.cells.forEach(function(x){ if(x.cid===t.cid)c=x; }); if(!c)return null;
  return {x:c.x+M.cellPadX,y:c.ty,w:c.w-2*M.cellPadX,h:c.th,lh:LAY.lh,wt:CELL_W,bg:'#FFFFFF',fg:D.ink};
}
function placeEditor(){
  var ta=$('tblEd'); if(!ta||!ED)return;
  var b=edBox(ED); if(!b){ endEdit(true); return; }
  var k=scaleK(), pad=4;
  ta.style.left=(b.x*k-pad)+'px'; ta.style.top=(b.y*k-pad)+'px'; ta.style.width=(b.w*k+2*pad)+'px';
  ta.style.fontFamily=D.fam; ta.style.fontWeight=b.wt; ta.style.fontSize=((b.fs||LAY.fs)*k)+'px'; ta.style.lineHeight=(b.lh*k)+'px';   /* 사진 열 이름은 표 단위로 줄어들 수 있다(labFs) */
  ta.style.background=b.bg; ta.style.color=b.fg; ta.style.setProperty('--ph',b.fg===D.ink?D.ink2:b.fg);
  ta.style.height=(b.h*k+2*pad)+'px';
  if(ta.scrollHeight>ta.clientHeight+1)ta.style.height=ta.scrollHeight+'px';
}
/* Tab 순서 = 머리 행 → 1행(이름 → 칸들) → 2행 … */
function tabNext(t,dir){
  var seq=[];
  ST.cols.forEach(function(c){ seq.push({kind:'head',cid:c.id}); });
  ST.rows.forEach(function(r){ seq.push({kind:'label',rid:r.id}); ST.cols.slice(1).forEach(function(c){ seq.push({kind:'cell',rid:r.id,cid:c.id}); }); });
  var i=-1; seq.forEach(function(s,x){ if(sameT(s,t))i=x; });
  return seq[i+dir]||null;
}
function scrollCurIntoView(){
  var t=curTarget(), st=root&&root.querySelector('.tbl-stage'); if(!t||!st||!LAY||!main)return;
  var r=markRect(LAY,t); if(!r||st.scrollHeight<=st.clientHeight)return;
  var k=scaleK(), top=main.getBoundingClientRect().top-st.getBoundingClientRect().top+st.scrollTop, y1=top+r.y*k, y2=y1+r.h*k;
  if(y1<st.scrollTop)st.scrollTop=Math.max(0,y1-12); else if(y2>st.scrollTop+st.clientHeight)st.scrollTop=y2-st.clientHeight+12;
}
function moveCur(dx,dy){
  if(!cur)cur={rid:null,cid:ST.cols[0].id};
  else{
    var ci=clamp(colIdx(cur.cid)+dx,0,ST.cols.length-1), ri=clamp((cur.rid?rowIdx(cur.rid):-1)+dy,-1,ST.rows.length-1);
    cur={rid:ri<0?null:ST.rows[ri].id,cid:ST.cols[ci].id};
  }
  markCurRow(); schedule(); scrollCurIntoView();
  var t=curTarget(); if(t)announce(edLabel(t)+' · '+(textOf(t)||'비어 있음'));
}
var fileFor=null;
function pickImage(rid){ var f=$('tblFile'); if(!f)return; fileFor=rid; f.value=''; f.click(); }

/* ── 캔버스 · 편집기 · 끌어 놓기 · 붙여넣기 ── */
function bindCanvas(){
  var cv=$('tblCv'), ta=$('tblEd'), down=null;
  main.addEventListener('pointermove',function(e){
    var t=targetAt(cvPt(e.clientX,e.clientY));
    main.classList.toggle('t-text',!!t&&t.kind!=='img'); main.classList.toggle('t-pick',!!t&&t.kind==='img');
    if(!sameT(t,hover)){ hover=t; schedule(); }
  });
  main.addEventListener('pointerleave',function(){ main.classList.remove('t-text','t-pick'); if(hover){ hover=null; schedule(); } });
  /* 누르는 순간 캔버스로 포커스가 가면 편집기가 blur 로 닫혔다 열리며 깜빡인다 → 기본 동작을 막고, 뗄 때 편집을 연다 */
  main.addEventListener('pointerdown',function(e){ if(e.button!==0&&e.pointerType==='mouse')return; e.preventDefault(); down={x:e.clientX,y:e.clientY,t:targetAt(cvPt(e.clientX,e.clientY))}; });
  main.addEventListener('pointerup',function(e){
    var d=down; down=null; if(!d)return;
    if(Math.abs(e.clientX-d.x)+Math.abs(e.clientY-d.y)>8)return;   /* 스크롤·끌기는 편집으로 치지 않는다 */
    var t=targetAt(cvPt(e.clientX,e.clientY)); if(!sameT(t,d.t))return;
    if(!t){ endEdit(true); main.focus({preventScroll:true}); return; }
    if(t.kind==='img'){ endEdit(true); cur={rid:t.rid,cid:ST.cols[0].id}; markCurRow(); schedule(); pickImage(t.rid); return; }
    startEdit(t);
  });
  main.addEventListener('keydown',function(e){
    if(ED)return;
    var k=e.key, t=curTarget();
    if(k==='ArrowUp'||k==='ArrowDown'||k==='ArrowLeft'||k==='ArrowRight'){ e.preventDefault(); moveCur(k==='ArrowLeft'?-1:(k==='ArrowRight'?1:0),k==='ArrowUp'?-1:(k==='ArrowDown'?1:0)); return; }
    if((k==='Enter'||k==='F2')&&t){ e.preventDefault(); startEdit(t); return; }
    if(k===' '&&t&&t.kind==='label'){ e.preventDefault(); pickImage(t.rid); return; }
    if(k==='Escape'&&cur){ e.preventDefault(); cur=null; markCurRow(); schedule(); }
  });
  main.addEventListener('focus',function(){ if(!cur&&ST.cols.length)cur={rid:null,cid:ST.cols[0].id}; markCurRow(); schedule(); var t=curTarget(); if(t)announce(edLabel(t)+' · '+(textOf(t)||'비어 있음')); });
  main.addEventListener('blur',function(){ schedule(); });
  ta.addEventListener('input',function(){ if(!ED)return; setText(ED,ta.value); syncSide(ED); save(); paint(); });
  ta.addEventListener('keydown',function(e){
    if(!ED||e.isComposing||e.keyCode===229)return;   /* 한글 조합 중 Enter·Tab 은 조합 확정용 */
    if(e.key==='Tab'){ e.preventDefault(); var nx=tabNext(ED,e.shiftKey?-1:1); if(nx){ startEdit(nx); scrollCurIntoView(); } else{ endEdit(true); main.focus({preventScroll:true}); } return; }
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); endEdit(true); main.focus({preventScroll:true}); }
  });
  ta.addEventListener('blur',function(){ if(ED)endEdit(true); });
  var file=$('tblFile');
  file.addEventListener('change',function(){ var fs=file.files; if(fs&&fs.length)takeFiles(fs,fileFor&&rowIdx(fileFor)>=0?{rid:fileFor}:{}); fileFor=null; });
  /* 파일 끌어 놓기 — 도구 판 어디든 받는다(보드 밖이면 맨 끝 새 행, 편집 열 썸네일이면 그 행) */
  var box=root.querySelector('.tbl');
  function hasFiles(e){ var ty=e.dataTransfer&&e.dataTransfer.types; return !!ty&&Array.prototype.indexOf.call(ty,'Files')>=0; }
  box.addEventListener('dragover',function(e){
    if(!hasFiles(e))return;
    e.preventDefault(); e.dataTransfer.dropEffect='copy';
    var p=cvPt(e.clientX,e.clientY), th=e.target.closest?e.target.closest('.tbl-th'):null;
    root.querySelectorAll('.tbl-th.over').forEach(function(x){ if(x!==th)x.classList.remove('over'); }); if(th)th.classList.add('over');
    cv.classList.toggle('over',!!p);
    var nd=p?dropAt(p):null;
    if(!sameDrop(nd,drop)){ drop=nd; schedule(); }
  });
  box.addEventListener('dragleave',function(e){ if(e.relatedTarget&&box.contains(e.relatedTarget))return; clearDrop(); });
  box.addEventListener('drop',function(e){
    if(!hasFiles(e))return;
    e.preventDefault();
    var files=e.dataTransfer.files, p=cvPt(e.clientX,e.clientY), th=e.target.closest?e.target.closest('.tbl-th'):null, tg=p?dropAt(p):null;
    clearDrop();
    if(!files||!files.length)return;
    endEdit(true);
    if(th){ var row=th.closest('.tbl-it'); takeFiles(files,{rid:row?row.dataset.rid:null}); return; }
    if(tg&&tg.rid){ takeFiles(files,{rid:tg.rid}); return; }
    takeFiles(files,tg&&typeof tg.idx==='number'?{idx:tg.idx}:{});
  });
  onPaste=function(e){
    var items=(e.clipboardData&&e.clipboardData.items)||[], f=null;
    for(var i=0;i<items.length;i++){ if(items[i].kind==='file'&&/^image\//.test(items[i].type)){ f=items[i].getAsFile(); break; } }
    if(!f||!root)return;
    var tg=e.target, onEd=tg&&tg.id==='tblEd';
    if(!onEd&&tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.isContentEditable))return;   /* 다른 입력칸의 붙여넣기는 건드리지 않는다 */
    e.preventDefault();
    var rid=onEd&&ED?ED.rid:(curTarget()&&curTarget().rid);
    takeFiles([f],rid?{rid:rid}:{});
  };
  document.addEventListener('paste',onPaste);
}
function sameDrop(a,b){ return (!a&&!b)||(!!a&&!!b&&a.rid===b.rid&&a.idx===b.idx); }
function clearDrop(){ drop=null; var cv=$('tblCv'); if(cv)cv.classList.remove('over'); if(root)root.querySelectorAll('.tbl-th.over').forEach(function(x){ x.classList.remove('over'); }); schedule(); }
/* ── 편집 열 ── */
/* 헥스 — 타자 중에는 6자리가 읽히는 순간만 반영, 칸을 떠날 때는 #abc 도 받는다(썸네일 도구 v2.2 와 같은 규칙) */
function applyHex(v,allowShort){
  v=String(v||'').trim().replace(/^#/,'');
  if(allowShort&&/^[0-9a-f]{3}$/i.test(v))v=v[0]+v[0]+v[1]+v[1]+v[2]+v[2];
  if(!/^[0-9a-f]{6}$/i.test(v))return false;
  ST.accent='custom'; ST.accentHex=('#'+v).toUpperCase();
  save(); syncDesign(); schedule(); return true;
}
function bindSide(){
  [['tblTitle','title'],['tblNote','note'],['tblSign','sign']].forEach(function(p){ $(p[0]).addEventListener('input',function(){ ST[p[1]]=this.value; save(); schedule(); }); });
  var sws=$('tblSws');
  sws.addEventListener('click',function(e){
    var b=e.target.closest('.tbl-sw'); if(!b)return;
    if(b.dataset.c==='custom'){ ST.accent='custom'; save(); syncDesign(); schedule(); var pk=$('tblPick'); if(pk){ pk.value=ST.accentHex; pk.click(); } return; }
    ST.accent=b.dataset.c; save(); syncDesign(); schedule();
  });
  sws.addEventListener('input',function(e){
    if(e.target.id==='tblPick'){ ST.accent='custom'; ST.accentHex=String(e.target.value).toUpperCase(); save(); syncDesign(); schedule(); return; }
    if(e.target.id==='tblHex'){ var ok=applyHex(e.target.value,false); e.target.classList.toggle('bad',!ok&&e.target.value.replace('#','').length>=6); }
  });
  sws.addEventListener('change',function(e){ if(e.target.id!=='tblHex')return; if(!applyHex(e.target.value,true))e.target.value=accentHex().toUpperCase(); e.target.classList.remove('bad'); });
  sws.addEventListener('keydown',function(e){ if(e.target.id==='tblHex'&&e.key==='Enter'){ e.preventDefault(); e.target.blur(); } });
  [['tblSize','size',SIZES],['tblShape','shape',SHAPES],['tblFit','fit',FITS]].forEach(function(p){
    $(p[0]).addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(!b||!byId(p[2],b.dataset.v))return; ST[p[1]]=b.dataset.v; save(); syncDesign(); schedule(); });
  });
  var fs=$('tblFs'), fsn=$('tblFsN');
  function setFs(v){ ST.fs=clamp(Math.round(v*2)/2,FS_MIN,FS_MAX); save(); schedule(); }
  fs.addEventListener('input',function(){ setFs(parseFloat(fs.value)); fsn.value=ST.fs; });
  fsn.addEventListener('input',function(){ var v=parseFloat(fsn.value); if(v>=FS_MIN&&v<=FS_MAX){ setFs(v); fs.value=ST.fs; } });
  function fixFs(){ var v=parseFloat(fsn.value); setFs(isNaN(v)?ST.fs:v); fsn.value=ST.fs; fs.value=ST.fs; }
  fsn.addEventListener('change',fixFs);
  fsn.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); fixFs(); } });
  var cols=$('tblCols');
  cols.addEventListener('input',function(e){ var inp=e.target.closest('[data-f="name"]'), row=e.target.closest('.tbl-col'); if(!inp||!row)return; var c=ST.cols[colIdx(row.dataset.cid)]; if(!c)return; c.name=inp.value.slice(0,LIM.head); save(); schedule(); });
  cols.addEventListener('change',function(e){ var s=e.target.closest('[data-f="w"]'), row=e.target.closest('.tbl-col'); if(!s||!row)return; var c=ST.cols[colIdx(row.dataset.cid)]; if(!c||!byId(WIDTHS,s.value))return; c.w=s.value; save(); schedule(); });
  cols.addEventListener('click',function(e){
    var b=e.target.closest('[data-act]'), row=e.target.closest('.tbl-col'); if(!b||!row||b.disabled)return;
    var cid=row.dataset.cid, a=b.dataset.act;
    if(a==='left')moveCol(cid,-1); else if(a==='right')moveCol(cid,1);
    else if(a==='del'){ var i=colIdx(cid); removeCol(cid); var nx=ST.cols[Math.min(i,ST.cols.length-1)], el=nx&&root.querySelector('#tblCols [data-cid="'+nx.id+'"] [data-act="del"]'); if(el&&!el.disabled)el.focus(); else{ var ad=$('tblColAdd'); if(ad)ad.focus(); } }
  });
  $('tblColAdd').addEventListener('click',function(){ var id=addCol(null,''), inp=id&&root.querySelector('#tblCols [data-cid="'+id+'"] [data-f="name"]'); if(inp)inp.focus(); });
  var rows=$('tblRows');
  rows.addEventListener('input',function(e){ var inp=e.target.closest('[data-f="label"]'), row=e.target.closest('.tbl-it'); if(!inp||!row)return; var r=ST.rows[rowIdx(row.dataset.rid)]; if(!r)return; r.label=inp.value.slice(0,LIM.label); save(); schedule(); });
  rows.addEventListener('focusin',function(e){ var row=e.target.closest('.tbl-it'); if(row&&(!cur||cur.rid!==row.dataset.rid)){ cur={rid:row.dataset.rid,cid:ST.cols[0].id}; markCurRow(); schedule(); } });
  rows.addEventListener('click',function(e){
    var b=e.target.closest('[data-act]'), row=e.target.closest('.tbl-it'); if(!b||!row||b.disabled)return;
    var rid=row.dataset.rid, a=b.dataset.act;
    if(a==='img')pickImage(rid); else if(a==='imgDel')clearImage(rid); else if(a==='up')moveRow(rid,-1); else if(a==='down')moveRow(rid,1);
    else if(a==='del'){ var i=rowIdx(rid); removeRow(rid); var nx=ST.rows[Math.min(i,ST.rows.length-1)], el=nx&&root.querySelector('#tblRows [data-rid="'+nx.id+'"] [data-act="del"]'); if(el&&!el.disabled)el.focus(); else{ var ni=$('tblNew'); if(ni)ni.focus(); } }
  });
  function addFromInput(){ var inp=$('tblNew'), ids=addRowsFromText(inp.value); if(ids.length){ inp.value=''; inp.focus(); } }
  $('tblRowAdd').addEventListener('click',addFromInput);
  $('tblNew').addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); addFromInput(); } });
  $('tblPlusCol').addEventListener('click',function(){ var id=addCol(null,''); if(id){ paint(); startEdit({kind:'head',cid:id}); } });
  $('tblPlusRow').addEventListener('click',function(){ var id=addRow(null,''); if(id){ paint(); startEdit({kind:'label',rid:id}); scrollCurIntoView(); } });
  $('tblSave').addEventListener('click',savePng);
  $('tblCopy').addEventListener('click',copyPng);
  $('tblJson').addEventListener('click',saveJson);
  $('tblLoad').addEventListener('click',function(){ var j=$('tblJsonFile'); j.value=''; j.click(); });
  $('tblJsonFile').addEventListener('change',function(){ if(this.files&&this.files[0])loadJsonFile(this.files[0]); });
  $('tblClear').addEventListener('click',clearBoard);
}

/* ── 수명 ── */
/* 나눔스퀘어 — 스타일시트가 먼저 들어와야 document.fonts.load 가 무엇을 받을지 안다(시트 전에 부르면 빈 배열로 끝난다) */
var fontP=null;
function loadFonts(){
  if(fontP)return fontP;
  fontP=new Promise(function(res){
    function go(){
      if(!(document.fonts&&document.fonts.load)){ res(); return; }
      Promise.all(['400','700','800'].map(function(w){ return document.fonts.load(w+' 19px NanumSquare','가나다 봄딩 표 123'); })).then(function(){ res(); },function(){ res(); });
    }
    var lk=document.getElementById('tblNanum')||document.getElementById('tierNanum');
    if(lk){ if(lk.sheet)go(); else{ lk.addEventListener('load',go); lk.addEventListener('error',function(){ res(); }); } return; }
    lk=document.createElement('link'); lk.id='tblNanum'; lk.rel='stylesheet'; lk.href=NANUM_CSS; lk.onload=go; lk.onerror=function(){ res(); };
    document.head.appendChild(lk);
  });
  return fontP;
}
function loadSig(){ if(SIG)return; SIG=new Image(); SIG.decoding='async'; SIG.onload=function(){ if(mounted)schedule(); }; SIG.onerror=function(){ SIG=null; }; SIG.src=SIG_SRC; }
function mount(host,a){
  api=a; root=host; mounted=true; readTokens();
  if(!document.getElementById('tblCss')){ var st=document.createElement('style'); st.id='tblCss'; st.textContent=CSS; document.head.appendChild(st); }
  host.innerHTML=html();
  main=$('tblCanvas'); mctx=main.getContext('2d');
  bindCanvas(); bindSide();
  if(window.ResizeObserver){ ro=new ResizeObserver(function(){ schedule(); }); ro.observe($('tblCv')); }   /* 폭이 바뀌면 «+»·편집기 자리를 다시 잰다 */
  renderAll(); paint();
  loadSig(); bootImages();
  loadFonts().then(function(){ if(mounted)schedule(); });
}
function unmount(){
  endEdit(true);
  mounted=false; if(raf){ cancelAnimationFrame(raf); raf=0; }
  if(onPaste){ document.removeEventListener('paste',onPaste); onPaste=null; }
  if(ro){ try{ ro.disconnect(); }catch(e){} ro=null; }
  clearTimeout(saveT); try{ localStorage.setItem(LS,JSON.stringify(data())); }catch(e){}
  root=null; main=null; mctx=null; hover=null; drop=null; LAY=null;
}

window.SseudamTools.table={
  mount:mount, unmount:unmount,
  __test:{
    state:function(){ var d=data(); d.cur=cur; d.images=Object.keys(IMG).filter(function(k){ return IMG[k]&&IMG[k].img&&rowIdx(k)>=0; }).length; d.editing=ED?{kind:ED.kind,rid:ED.rid,cid:ED.cid}:null; d.W=W; return d; },
    layout:function(){
      if(!LAY)return null;
      return {H:LAY.H,fs:LAY.fs,lh:LAY.lh,x0:LAY.x0,innerW:LAY.innerW,ws:LAY.ws.slice(),xs:LAY.xs.slice(),cut:LAY.cut,hd:LAY.hd?{y:LAY.hd.y,h:LAY.hd.h}:null,
        card:{x:LAY.card.x,y:LAY.card.y,w:LAY.card.w,h:LAY.card.h,headH:LAY.card.headH},
        head:LAY.head.map(function(h){ return {cid:h.cid,x:h.x,y:h.y,w:h.w,h:h.h,lines:h.lines.length}; }),
        rows:LAY.rows.map(function(r){ return {rid:r.rid,y:r.y,h:r.h,box:r.box,img:r.img,lab:{x:r.lab.x,y:r.lab.y,w:r.lab.w,h:r.lab.h,lines:r.labLines.length},
          cells:r.cells.map(function(c){ return {cid:c.cid,x:c.x,y:c.y,w:c.w,h:c.h,ty:c.ty,th:c.th,lines:c.lines.length}; })}; }),
        ft:{y:LAY.ft.y,h:LAY.ft.h,sig:LAY.ft.sig?{x:LAY.ft.sig.x,y:LAY.ft.sig.y,w:LAY.ft.sig.w,h:LAY.ft.sig.h}:null}};
    },
    reset:function(){ endEdit(false); IMG={}; cur=null; ST.accent='rose'; ST.accentHex='#C93C7C'; ST.size='m'; ST.fit='cover'; ST.shape='polaroid'; ST.fs=FS_DEF; defaultBoard(); renderAll(); save(); if(mounted)paint(); return true; },
    setBoard:function(d){ endEdit(false); restoreData(d,true,false); cur=null; renderAll(); save(); if(mounted)paint(); return true; },
    setImageURL:function(rid,url){ return fetch(url).then(function(r){ if(!r.ok)throw new Error('http '+r.status); return r.blob(); }).then(function(b){ return setImageBlob(rid,b,true); }).then(function(){ if(mounted)paint(); return true; }).catch(function(e){ return String(e); }); },
    takeFiles:function(files,opt){ takeFiles(files,opt); return true; },
    addRow:function(label,at){ return addRow(at==null?null:at,label||''); },
    addCol:function(name,at){ return addCol(at==null?null:at,name||''); },
    removeRow:function(id){ removeRow(id); return true; }, removeCol:function(id){ removeCol(id); return true; },
    moveRow:moveRow, moveCol:moveCol,
    edit:function(kind,rid,cid){ startEdit({kind:kind,rid:rid||null,cid:cid||null}); return !!ED; },
    endEdit:function(){ endEdit(true); return true; },
    loadJson:function(d){ return loadJsonData(d); },
    json:function(){ return jsonData(); },
    idbKeys:function(){ return idbAll().then(function(o){ return Object.keys(o); }).catch(function(){ return null; }); },
    fileName:fileName,
    paint:function(){ paint(); return LAY&&LAY.H; },
    dataURL:function(){ return exportCanvas().toDataURL('image/png'); },
    blob:function(){ return toBlob().then(function(b){ return b?{size:b.size,type:b.type}:null; }); },
    headInk:function(){ var a=accentHex(), k=onInk(a); return {fill:a,ink:k,contrast:Math.round(contrast(a,k)*100)/100}; },
    sigSrc:function(){ var s=sigImg(); return s?s.src:null; },
    fonts:function(){ return loadFonts().then(function(){ return document.fonts?document.fonts.check('800 19px NanumSquare','가'):null; }); }
  }
};
})();
