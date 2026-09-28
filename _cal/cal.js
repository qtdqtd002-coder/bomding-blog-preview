/* 쓰담 — 「캘린더」 탭 · 외주 일감 달력 (2026-09-28 신설)
   봄딩·영도 각자의 외주 일감(게임 · 외주업체 · 단가 · 완료)을 날짜 칸에 적고, 달·해 수입을 3.3% 원천징수를 빼고 본다.
   (옛 «캘린더 탭»(06-27 폐기, 트렌드 발매 일정)과는 다른 것이다 — 이것은 작성자의 외주 일감 원장이다.)

   ■ 싣는 법 — index.html 이 이 탭을 처음 열 때 _cal/cal.js?v= 를 한 번 받아 window.SseudamCal = {mount(host, api), unmount()} 로 쓴다.
     api = 사이트가 빌려주는 부품(base·openModal·closeModal·toast·MO·esc·setMeta). 색은 사이트 토큰만 쓴다(새 색 없음).
     ★이 파일을 고치면 index.html 의 CAL_SRC ?v= 를 같은 커밋에서 올린다(pre-push 가 막는다 — 안 올리면 브라우저가 옛 파일을 캐시에서 쓴다).
   ■ 저장 — 백엔드 /cal (blog-company-backend/src/cal.js 가 계약 정본). ★금액 정보라 암호로 잠긴다:
     암호 하나(봄딩·영도 공용 — 사용자 결정 09-28)를 처음 연 사람이 정하고, 기기마다 한 번만 넣으면 토큰으로 기억한다.
     브라우저엔 토큰과 «마지막으로 받은 원장» 캐시만 남는다(캐시는 편의 — 없어도 화면은 서버에서 다시 그린다).
   ■ 수입 규칙(사용자 확정 09-28) — 일감은 «적은 날짜가 속한 달»의 수입이다. 3.3% 는 «그 달 세전 합계 × 3.3%»(원 미만 버림).
     실제 원천징수는 지급 건마다 소득세 3%·지방세 0.3% 를 각각 10원 미만 절사하므로 입금액과 수십 원 다를 수 있다.
     해 합계 = 달 합계들의 합(달 표와 해 표가 1원까지 맞게).
   ■ 동시 편집 — 고치기·지우기는 그 일감의 판(updatedAt)을 같이 보내고, 다른 기기가 먼저 고쳤으면 서버가 409 + 최신 판을 준다.
     완료 체크를 연달아 눌러도 일감마다 요청을 한 줄로 세워(OPS) 판이 꼬이지 않는다.
   ■ 공휴일 — 연봄하우스 책력(almanac.js · lunar.js — 한국 음력 KST 표, 2023~2028 공표일 전수 대조)을 그대로 옮겼다.
     임시공휴일·선거일은 법으로 그때그때 정해져 계산이 안 되므로 EXTRA 에 손으로 넣는다. 음력 날짜·절기 표시는 사용자가 뺐다(09-28). */
(function(){
'use strict';

/* ══════════ 한국 음력(설날·추석·부처님오신날 계산용) — 연봄하우스 lunar.js 의 2000~2100 구간 ══════════
   한 해 = 32비트 정수 — bit 25..17 정월 초하루 양력 MMDD · bit 16..13 윤달 번호 · bit 12..0 달 크기(1=30일, LSB=첫 달) */
var LUNAR_MIN=2000;
var LUNAR=[
  0x19a0693,0xf89527,0x1a8052b,0x1920a5b,0xf4555a,0x1a2036a,0x102fb55,0x1b40ba4,0x19e0b49,0xfcba93,
  0x1ac0a95,0x196052d,0xf66a5d,0x1a40aad,0x10735aa,0x1b605d2,0x1a00da5,0x100bd49,0x1b00d4a,0x19a0a95,
  0xfa952d,0x1a80556,0x1920ab5,0xf455aa,0x1a406d2,0x102cea5,0x1b20ea5,0x19e0e4a,0xfeac96,0x1aa0c9b,
  0x196055a,0xf66ad5,0x1a60b69,0x1077752,0x1b60752,0x1a00b25,0x100d64b,0x1ae0a4b,0x19804ab,0xf8a55b,
  0x1a8056d,0x1920b69,0xf45b52,0x1a40d92,0x104fd25,0x1b20d25,0x19c0a4d,0xfcb4ad,0x1ac02b6,0x19405b5,
  0xf66da9,0x1a60dc9,0x1931d92,0x1b60e92,0x1a00d26,0x100ca56,0x1ae0a57,0x19804d6,0xf886b5,0x1a806d5,
  0x1940ec9,0xf46e92,0x1a20693,0x102f52b,0x1b2052b,0x19a0a5b,0xfcb55a,0x1ac056a,0x1960b55,0xf69749,
  0x1a60b49,0x1071a93,0x1b60a95,0x19e052d,0xfecaad,0x1ae0ab5,0x19a05aa,0xf88ba5,0x1a80da5,0x1940d4a,
  0xf47a95,0x1a20c95,0x102f52e,0x1b20556,0x19c0ab5,0xfcb5b2,0x1ac06d2,0x1960ea5,0xf89e4a,0x1a6064a,
  0x1050c97,0x1b40cab,0x1a0055a,0xfecad5,0x1ae0b69,0x19a0752,0xfa8ea5,0x1a80b25,0x192064b,0xf27497,
  0x1a204ab
];
var DAYMS=864e5;
function p2(n){ return (n<10?'0':'')+n; }
function isoOf(ms){ var d=new Date(ms); return d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)+'-'+p2(d.getUTCDate()); }
function msOf(s){ return Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10)); }
function addDays(s,n){ return isoOf(msOf(s)+n*DAYMS); }
function dowOfIso(s){ return new Date(msOf(s)).getUTCDay(); }
function lunarYear(y){
  var pk=LUNAR[y-LUNAR_MIN]; if(pk===undefined)return null;
  var mmdd=(pk>>17)&0xff, leap=(pk>>13)&0xf, bits=pk&0x1fff, months=[], off=0, i;
  for(var m=1;m<=12;m++){ months.push({m:m,leap:false}); if(leap===m)months.push({m:m,leap:true}); }
  for(i=0;i<months.length;i++){ months[i].len=((bits>>i)&1)?30:29; months[i].off=off; off+=months[i].len; }
  return {start:Date.UTC(y,Math.floor(mmdd/100)-1,mmdd%100), months:months};
}
/* 음력 (y,m,d) → 양력 'YYYY-MM-DD'. 윤달이 아닌 평달만 쓴다(명절은 평달). */
function lunarToSolar(y,m,d){
  var info=lunarYear(y); if(!info)return null;
  var mo=null; info.months.forEach(function(x){ if(!mo&&x.m===m&&!x.leap)mo=x; });
  if(!mo)return null;
  return isoOf(info.start+(mo.off+Math.min(Math.max(1,d),mo.len)-1)*DAYMS);
}

/* ══════════ 공휴일 — 연봄하우스 almanac.js 규칙(「관공서의 공휴일에 관한 규정」 제3조 · 2023.5.4. 개정) ══════════
   설·추석 연휴 = 일요일이나 다른 공휴일과 겹치면 대체 · 어린이날 = 토·일·다른 공휴일 · 삼일절·광복절·개천절·한글날·부처님오신날·성탄절 = 토·일·다른 공휴일
   신정·현충일 = 대체 없음 · 제헌절 = 2026 공휴일 재지정(대체는 2027부터). 대체일 = 그 공휴일 다음의 첫 비공휴일(일요일·이미 잡힌 공휴일 건너뜀). */
var EXTRA=[   /* 임시공휴일·선거일 — 계산이 안 된다. 새로 공표되면 여기에 한 줄 */
  {date:'2024-04-10',name:'국회의원선거'},
  {date:'2025-01-27',name:'임시공휴일'},
  {date:'2025-06-03',name:'대통령선거'},
  {date:'2026-06-03',name:'지방선거'},
  {date:'2028-04-12',name:'국회의원선거'}
];
var HOL_CACHE={};
function holidaysOfYear(y){
  if(HOL_CACHE[y])return HOL_CACHE[y];
  var base=[];
  function put(date,name,group){ if(date)base.push({date:date,name:name,group:group}); }
  put(y+'-01-01','신정','fixed');
  put(y+'-03-01','삼일절','national');
  put(y+'-05-05','어린이날','children');
  put(y+'-06-06','현충일','fixed');
  if(y>=2026)put(y+'-07-17','제헌절',y>=2027?'national':'fixed');
  put(y+'-08-15','광복절','national');
  put(y+'-10-03','개천절','national');
  put(y+'-10-09','한글날','national');
  put(y+'-12-25','성탄절','national');
  var sl=lunarToSolar(y,1,1);
  if(sl){ put(addDays(sl,-1),'설날 연휴','seollal'); put(sl,'설날','seollal'); put(addDays(sl,1),'설날 연휴','seollal'); }
  put(lunarToSolar(y,4,8),'부처님오신날','national');
  var cs=lunarToSolar(y,8,15);
  if(cs){ put(addDays(cs,-1),'추석 연휴','chuseok'); put(cs,'추석','chuseok'); put(addDays(cs,1),'추석 연휴','chuseok'); }
  EXTRA.forEach(function(e){ if(e.date.slice(0,5)===y+'-')put(e.date,e.name,'fixed'); });

  var by={}, dates=[];
  base.forEach(function(h){ if(!by[h.date]){ by[h.date]=[]; dates.push(h.date); } by[h.date].push(h); });
  var triggers=[];
  dates.forEach(function(d){
    var list=by[d], dow=dowOfIso(d), names={}, n=0;
    list.forEach(function(h){ if(!names[h.name]){ names[h.name]=1; n++; } });
    var collided=n>1;
    if(list.some(function(h){
      if(h.group==='seollal'||h.group==='chuseok')return dow===0||collided;
      if(h.group==='children'||h.group==='national')return dow===0||dow===6||collided;
      return false;
    }))triggers.push(d);
  });
  triggers.sort();
  var taken={}; dates.forEach(function(d){ taken[d]=1; });
  var out={};
  dates.forEach(function(d){ out[d]=by[d].map(function(h){ return h.name; }); });
  triggers.forEach(function(t){
    var d=addDays(t,1);
    while(taken[d]||dowOfIso(d)===0)d=addDays(d,1);
    taken[d]=1; (out[d]=out[d]||[]).push('대체공휴일');
  });
  HOL_CACHE[y]=out;
  return out;
}
function holidayNames(ds){
  var list=holidaysOfYear(+ds.slice(0,4))[ds]||[], seen={}, out=[];
  list.forEach(function(n){ if(!seen[n]){ seen[n]=1; out.push(n); } });
  return out;
}

/* ══════════ 돈 ══════════ */
var TAX_PERMILLE=33;   /* 3.3% = 소득세 3% + 지방소득세 0.3% */
function taxOf(gross){ return Math.floor(gross*TAX_PERMILLE/1000); }
function won(n){ return (n<0?'−':'')+Math.abs(Math.round(n)).toLocaleString('ko-KR'); }
function priceOf(e){ return (typeof e.price==='number'&&e.price>0)?e.price:0; }

/* ══════════ 모듈 상태 ══════════ */
var WR=[{k:'bomding',n:'봄딩',ac:'var(--w-bomding)'},{k:'yeongdo',n:'영도',ac:'var(--w-yeongdo)'}];
function wOf(k){ for(var i=0;i<WR.length;i++)if(WR[i].k===k)return WR[i]; return WR[0]; }
var WD=['일','월','화','수','목','금','토'];
var TOK_LS='sseudam_cal_tok_v1', CACHE_LS='sseudam_cal_cache_v1', W_LS='sseudam_cal_w_v1';
var PRICE_MAX=100000000;

var A=null, HOST=null, GEN=0;
var S={ w:'', ym:'', sel:'', st:'', err:'', data:{}, at:{} };
var WANT={};   /* id → 아직 서버에 안 간 «원하는 완료 상태»(낙관적 표시) */
var OPS={};    /* id → 그 일감의 요청 체인(한 줄로 세운다) */
var LIS=[];    /* unmount 때 뗄 문서 리스너 */
var TIP=null;

function ls(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }
function lset(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function ldel(k){ try{ localStorage.removeItem(k); }catch(e){} }
function getTok(){ return ls(TOK_LS,''); }
function cacheAll(){ try{ return JSON.parse(ls(CACHE_LS,'{}'))||{}; }catch(e){ return {}; } }
function cacheGet(w){ var c=cacheAll()[w]; return (c&&Array.isArray(c.entries))?c:null; }
function cachePut(w,entries){ var c=cacheAll(); c[w]={at:Date.now(),entries:entries}; lset(CACHE_LS,JSON.stringify(c)); }
function dropAuth(){ ldel(TOK_LS); ldel(CACHE_LS); S.data={}; S.at={}; WANT={}; }

function esc(s){ return A.esc(s); }
function todayStr(){ var d=new Date(); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
function ymOf(ds){ return ds.slice(0,7); }
function addYm(ym,n){ var y=+ym.slice(0,4), m=+ym.slice(5,7)-1+n; y+=Math.floor(m/12); m=((m%12)+12)%12; return y+'-'+p2(m+1); }
function daysIn(y,m){ return new Date(Date.UTC(y,m,0)).getUTCDate(); }
function ymLabel(ym){ return (+ym.slice(0,4))+'년 '+(+ym.slice(5,7))+'월'; }
function dLabel(ds){ return (+ds.slice(5,7))+'월 '+(+ds.slice(8,10))+'일 ('+WD[dowOfIso(ds)]+')'; }
function newId(){ return 'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function isDone(e){ return Object.prototype.hasOwnProperty.call(WANT,e.id)?WANT[e.id]:!!e.done; }
function list(){ return S.data[S.w]||[]; }
function findE(id){ var l=list(); for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i]; return null; }
function sortList(l){ l.sort(function(a,b){ return a.date<b.date?-1:a.date>b.date?1:((a.createdAt||0)-(b.createdAt||0)); }); return l; }
function upsertLocal(e){
  var l=S.data[S.w]||(S.data[S.w]=[]), i;
  for(i=0;i<l.length;i++)if(l[i].id===e.id){ l[i]=e; break; }
  if(i===l.length)l.push(e);
  sortList(l); cachePut(S.w,l);
}
function removeLocal(id){ var l=list().filter(function(x){ return x.id!==id; }); S.data[S.w]=l; cachePut(S.w,l); }
function title(e){ return e.game||e.agency||''; }

/* ══════════ 아이콘(사이트 스트로크 어휘 · currentColor) ══════════ */
var IC={
  cal:'<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M16 2.5v4"/><path d="M8 2.5v4"/><path d="M3 10h18"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.4"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  won:'<rect x="2.5" y="6" width="19" height="12" rx="2.2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  biz:'<rect x="4" y="3" width="16" height="18" rx="2.2"/><path d="M9.5 21v-4h5v4"/><path d="M8.5 7.5h.01"/><path d="M12 7.5h.01"/><path d="M15.5 7.5h.01"/><path d="M8.5 11.5h.01"/><path d="M12 11.5h.01"/><path d="M15.5 11.5h.01"/>',
  bars:'<path d="M3 3v18h18"/><path d="M8 16v-4"/><path d="M12.5 16V8"/><path d="M17 16v-6"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  chevL:'<path d="m15 18-6-6 6-6"/>',
  chevR:'<path d="m9 18 6-6-6-6"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M18.5 6l-.8 13.1A2 2 0 0 1 15.7 21H8.3a2 2 0 0 1-2-1.9L5.5 6"/>',
  arrowR:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};
function ic(n,cls){ return '<svg class="ic'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(IC[n]||'')+'</svg>'; }

/* ══════════ 스타일 — 사이트 토큰만(:root). 라벨 ≥12.5px · 포커스 링 2px 잉크 · 터치 표적 ≥40px ══════════ */
var CSS=[
'.cal{display:flex;flex-direction:column;gap:14px}',
'.cal-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
'.cal-ws{display:flex;gap:6px}',
'.cal-nav{display:flex;align-items:center;gap:6px}',
'.cal-ym{margin:0 4px;min-width:118px;text-align:center;font-size:16px;font-weight:750;letter-spacing:-.03em;white-space:nowrap}',
'.cal-nav .dpbtn{height:34px}',
'.cal-nav .dpbtn[data-go="older"],.cal-nav .dpbtn[data-go="newer"]{width:34px;padding:0;justify-content:center}',
'.cal-sp{flex:1 1 auto}',
'.cal-ib{width:34px;height:34px;border-radius:var(--r-pill);display:grid;place-items:center;background:var(--surface);color:var(--ink-3);box-shadow:0 0 0 1px var(--hair),var(--sh-rest);transition:transform var(--t-fast) var(--e),color var(--t-fast) var(--e)}',
'.cal-ib:hover{color:var(--ink);transform:translateY(-1px)}',
'.cal-ib:active{transform:scale(.94)}',
'.cal-ib .ic{width:15px;height:15px}',
'.cal-add .knob .ic{width:14px;height:14px}',
'.cal-body{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}',
'.cal-main>.core{position:relative}',
/* 요일 머리 + 칸 */
'.cal-wk,.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}',
'.cal-wk{border-bottom:1px solid var(--hair)}',
'.cal-wk span{padding:9px 0 8px 13px;font-size:12.5px;font-weight:650;color:var(--ink-3);letter-spacing:-.01em}',   /* 글자 가운데 ≈ 칸 날짜 동그라미 가운데(5+1+13) */
'.cal-wk span.sun{color:var(--alert)}',
'.cal-grid{grid-auto-rows:minmax(124px,auto)}',
'.cal-grid.r6{grid-auto-rows:minmax(108px,auto)}',   /* 6주짜리 달(연 4~5회) — 124 로는 빈 달도 1080 여유가 20px 뿐이었다 */
'.cal-d{position:relative;min-width:0;padding:6px 5px 8px;border-right:1px solid var(--hair);border-bottom:1px solid var(--hair);cursor:pointer;transition:background var(--t-fast) var(--e)}',
'.cal-d:nth-child(7n){border-right:0}',
'.cal-d.lastw{border-bottom:0}',
'.cal-d.wkend{background:var(--surface-2)}',
'.cal-d.out{background:var(--surface-2);cursor:default}',
'@media (hover:hover){ .cal-d:not(.out):hover{background:var(--surface-3)} }',
'.cal-dh{display:flex;align-items:center;gap:5px;min-height:26px;padding:0 1px 4px 1px}',
'.cal-dn{flex:none;min-width:26px;height:26px;padding:0 4px;border-radius:13px;display:inline-grid;place-items:center;font-family:"JetBrains Mono",monospace;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ink-2)}',
'.cal-d.sun .cal-dn,.cal-d.hol .cal-dn{color:var(--alert)}',
'.cal-d.today .cal-dn{background:var(--ink);color:#fff}',
'.cal-d.today.sun .cal-dn,.cal-d.today.hol .cal-dn{background:var(--alert);color:#fff}',
'.cal-hn{min-width:0;font-size:12.5px;font-weight:600;color:var(--alert);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.02em}',
'.cal-plus{flex:none;margin-left:auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;color:var(--ink-3);opacity:0;transition:opacity var(--t-fast) var(--e),background var(--t-fast) var(--e),color var(--t-fast) var(--e)}',
'.cal-plus .ic{width:14px;height:14px}',
'.cal-d:hover .cal-plus,.cal-plus:focus-visible{opacity:1}',
'.cal-plus:hover{background:var(--ink);color:#fff}',
/* 일감 칩 */
'.cal-es{display:flex;flex-direction:column;gap:1px}',
'.cal-e{display:flex;align-items:flex-start;gap:1px;min-width:0;border-radius:7px}',
'.cal-et{flex:1 1 auto;min-width:0;display:flex;align-items:flex-start;gap:6px;padding:3px 3px 3px 5px;border-radius:7px;text-align:left;font-size:12.5px;line-height:1.42;letter-spacing:-.02em;color:var(--ink);transition:background var(--t-fast) var(--e)}',
'.cal-et:hover{background:var(--surface);box-shadow:0 0 0 1px var(--hair-2)}',
'.cal-et .dot{flex:none;width:6px;height:6px;margin-top:6px;border-radius:50%;background:var(--ac,var(--ink-3))}',
/* «게임 (업체)» — 한 줄에 다 들어가면 한 줄, 안 들어가면 업체가 다음 줄로 내려간다(flex-wrap). 게임·업체 각각은 한 줄 말줄임.
   ★둘을 한 덩어리 글로 두고 2줄 자르기(line-clamp)를 하면, 게임명이 혼자 2줄을 채울 때 업체가 0px 로 사라졌다
   («아쿠아랜드:크레이지서바이벌 (플랜비)» → 플랜비 안 보임 · 09-28 디자인 게이트 🟡). 전체 글은 title·모달·모바일 목록에 남는다 */
'.cal-et .tx{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;column-gap:4px}',
'.cal-et .tx>*{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.cal-et .g{font-weight:650}',
'.cal-et .ag{color:var(--ink-3)}',
'.cal-e.done .cal-et{color:var(--ink-3)}',
'.cal-e.done .tx>*{text-decoration:line-through;text-decoration-thickness:1px;text-decoration-color:currentColor}',
/* 한 칸에 4건을 넘으면 3건 + «+N건 더»(그날 목록 창) — 몰린 날 하나가 그 주 전체를 늘여 1920 한 화면을 넘기던 것(09-28 게이트 🟡) */
'.cal-more{align-self:flex-start;margin:1px 0 0 3px;height:24px;padding:0 8px;border-radius:7px;font-size:12.5px;font-weight:650;color:var(--ink-2);letter-spacing:-.01em;transition:background var(--t-fast) var(--e),color var(--t-fast) var(--e)}',
'.cal-more:hover{background:var(--ink);color:#fff}',
'.cal-e.done .cal-et .dot{background:transparent;box-shadow:inset 0 0 0 1.5px var(--ink-4)}',
/* 완료 = 체크박스 모양(빈 칸 ↔ 채운 칸). ✓ 글리프만 두면 «안 한 일»에도 ✓가 보여 완료로 읽힌다(09-28 모바일 실측).
   칸 테두리 ink-4 = 흰 면 4.6:1 · surface-2 4.3:1 — 비텍스트 3:1(WCAG 1.4.11) 통과 */
'.cal-chk{flex:none;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;opacity:0;transition:opacity var(--t-fast) var(--e)}',
'.cal-chk .bx{width:16px;height:16px;border-radius:5px;display:grid;place-items:center;background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--ink-4);transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e-out)}',
'.cal-chk .bx .ic{width:11px;height:11px;stroke-width:2.6;color:#fff;opacity:0;transition:opacity var(--t-fast) var(--e)}',
'.cal-chk:hover .bx{box-shadow:inset 0 0 0 1.5px var(--ink)}',
'.cal-chk:active .bx{transform:scale(.88)}',
'.cal-chk[aria-pressed="true"] .bx{background:var(--ink);box-shadow:none}',
'.cal-chk[aria-pressed="true"] .bx .ic{opacity:1}',
'.cal-e:hover .cal-chk,.cal-chk:focus-visible,.cal-e.done .cal-chk{opacity:1}',
'.cal-dots{display:none}',
'.cal-ag{display:none}',
/* 그날 목록 줄 — 모바일 달력 아래(.cal-ag)와 데스크톱 «+N건 더» 창(.cal-dayl)이 같은 어휘를 쓴다 */
'.cal-ag-l{display:flex;flex-direction:column;padding:0 8px 8px}',
'.cal-ar{display:flex;align-items:center;gap:4px;border-top:1px solid var(--hair)}',
'.cal-ar .cal-chk{width:40px;height:40px;opacity:1;border-radius:10px}',
'.cal-ar .cal-chk .bx{width:20px;height:20px;border-radius:6px}',
'.cal-ar .cal-chk .bx .ic{width:13px;height:13px}',
'.cal-art{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:10px;min-height:52px;padding:6px 8px 6px 2px;text-align:left;border-radius:10px;transition:background var(--t-fast) var(--e)}',
'@media (hover:hover){ .cal-art:hover{background:var(--surface-2)} }',
'.cal-art .t{flex:1 1 auto;min-width:0;font-size:14px;line-height:1.4;letter-spacing:-.02em;word-break:keep-all;overflow-wrap:anywhere}',
'.cal-art .t b{font-weight:650}',
'.cal-art .t .ag{color:var(--ink-3)}',
'.cal-art .p{flex:none;font-size:13px;color:var(--ink-2);white-space:nowrap}',
'.cal-art .p.z{color:var(--ink-3)}',
'.cal-ar.done .cal-art .t{color:var(--ink-3);text-decoration:line-through}',
'.cal-dayl{margin:-6px -10px -8px}',
'.cal-dayl .cal-ag-l{padding:0}',
'.cal-dayl .cal-ar:first-child{border-top:0}',
'.cal-dayl .cal-ag-e{padding:6px 10px 10px;font-size:13px;color:var(--ink-3)}',
/* 오른쪽 패널 */
'.cal-side{display:flex;flex-direction:column;gap:14px;min-width:0}',
/* 사이트 .tile-m 은 11.5px 모노(홈 타일의 시각·숫자용)라 한글이 섞이는 여기서는 본문 서체 12.5px 로 — 숫자만 모노 */
'.cal-card .tile-m{font-family:inherit;font-size:12.5px;letter-spacing:-.01em}',
'.cal-card .tile-m b{font-family:"JetBrains Mono",monospace;font-weight:600;color:var(--ink)}',
'.cal-sum{padding:14px 16px 14px}',
'.cal-net{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding-bottom:12px;margin-bottom:8px;border-bottom:1px solid var(--hair)}',
'.cal-net .k{font-size:13px;font-weight:650;color:var(--ink-2)}',
'.cal-net .v{white-space:nowrap}',
'.cal-net .v .num{font-size:26px;font-weight:700;letter-spacing:-.035em;color:var(--ink)}',
'.cal-net .u{margin-left:3px;font-size:14px;font-weight:650;color:var(--ink-2)}',
'.cal-kv{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:13px;line-height:1.95;color:var(--ink-3)}',
'.cal-kv .num{font-weight:600;color:var(--ink)}',
'.cal-kv.warn,.cal-kv.warn .num{color:var(--alert)}',
'.cal-kv.tot{color:var(--ink-2);font-weight:650}',
'.cal-kv.tot .num{font-weight:700}',
'.cal-agl{display:flex;flex-direction:column;padding:6px 8px 8px}',
'.cal-agr{display:grid;grid-template-columns:minmax(0,1fr) auto 96px;align-items:baseline;gap:10px;padding:6px 8px;border-radius:9px;font-size:13px}',
'.cal-agr+.cal-agr{border-top:1px solid var(--hair)}',
'.cal-agr .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--ink)}',
'.cal-agr .nm.none{color:var(--ink-3);font-weight:500}',
'.cal-agr .c{color:var(--ink-3);white-space:nowrap}',
'.cal-agr .v{text-align:right;color:var(--ink);white-space:nowrap}',
'.cal-empty{padding:14px 16px 16px;font-size:13px;color:var(--ink-3)}',
'.cal-yr{display:flex;flex-direction:column;padding:5px 8px 6px}',
'.cal-yrow{display:grid;grid-template-columns:32px minmax(0,1fr) 96px;align-items:center;gap:10px;width:100%;min-height:26px;padding:0 8px;border-radius:8px;text-align:left;font-size:12.5px;color:var(--ink-3);transition:background var(--t-fast) var(--e)}',
'.cal-yrow:hover,.cal-yrow.on{background:var(--surface-2)}',
'.cal-yrow.on{color:var(--ink)}',
'.cal-yrow .mo{font-weight:650}',
'.cal-yrow .bar{position:relative;height:8px}',
'.cal-yrow .bar i{position:absolute;left:0;top:0;bottom:0;min-width:2px;border-radius:0 4px 4px 0;background:var(--ink-4);transform-origin:left center}',
'.cal-yrow.on .bar i{background:var(--ink)}',
'.cal-yrow .v{text-align:right;color:var(--ink-2)}',
'.cal-yrow.on .v{color:var(--ink);font-weight:650}',
'.cal-yrow .v.z{color:var(--ink-3)}',
'.cal-yf{padding:6px 16px 8px;border-top:1px solid var(--hair);background:var(--surface-2)}',
'.cal-yf .cal-kv{line-height:1.8}',
'.pmeta .cal-mv{font-style:normal;font-family:"JetBrains Mono",monospace;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}',
/* 잠금 */
'.cal-lk{max-width:440px;margin:28px auto 0}',
'.cal-lk-in{padding:26px 24px 22px}',
'.cal-lk-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--ink);color:#fff;margin-bottom:14px}',
'.cal-lk-ic .ic{width:18px;height:18px}',
'.cal-lk-t{margin:0 0 16px;font-size:18px;font-weight:750;letter-spacing:-.03em}',
'.cal-lk .f-l{margin-top:12px}',
'.cal-lk .mdl-msg{margin-top:10px;min-height:0}',
'.cal-lk .mdl-msg:empty{display:none}',
'.cal-lk-go{margin-top:16px;display:flex;justify-content:flex-end}',
'.cal-lk-go .cta{height:38px}',
/* 편집 모달 */
'.cal-f2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 12px}',
/* 사이트 .f-l:first-of-type{margin-top:0} 이 두 칸 줄의 라벨마다 걸려 윗칸에 붙는다(칸마다 «첫 라벨»이라서) — 줄 사이를 직접 준다 */
'.cal-f2+.cal-f2,.cal-f2+.f-l{margin-top:14px}',
'.cal-f2 .f-hint{margin-top:6px}',
'.cal-won{position:relative}',
'.cal-won .f-i{padding-right:34px;text-align:right;font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums}',
'.cal-won span{position:absolute;right:13px;top:50%;transform:translateY(-50%);font-size:13.5px;color:var(--ink-3);pointer-events:none}',
'.cal-net-h{min-height:20px}',
'.cal-tg{margin-top:16px;display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px 0 11px;border-radius:var(--r-pill);background:var(--surface-2);color:var(--ink-2);font-size:13.5px;font-weight:650;box-shadow:0 0 0 1px var(--hair-2);transition:background var(--t-fast) var(--e),color var(--t-fast) var(--e),transform var(--t-fast) var(--e)}',
'.cal-tg .bx{width:18px;height:18px;border-radius:6px;display:grid;place-items:center;background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--ink-4)}',
'.cal-tg .bx .ic{width:12px;height:12px;stroke-width:2.4;opacity:0}',
'.cal-tg:hover{color:var(--ink)}',
'.cal-tg:active{transform:scale(.97)}',
'.cal-tg[aria-pressed="true"]{background:var(--ink);color:#fff;box-shadow:0 0 0 1px var(--ink)}',
'.cal-tg[aria-pressed="true"] .bx{background:#fff;box-shadow:none;color:var(--ink)}',
'.cal-tg[aria-pressed="true"] .bx .ic{opacity:1}',
'.cal-del{color:var(--alert)}',
'.cal-del:hover{color:var(--alert);box-shadow:0 0 0 1px var(--alert)}',
'.cal-fsp{flex:1 1 auto}',
'.cal-mf .cta{margin-left:0}',
'.cal-mf .mdl-msg:empty{display:none}',
/* 넓은 폭 → 가운데 폭: 패널을 달력 아래 세 칸으로 */
'@media (max-width:1180px) and (min-width:861px){',
'  .cal-body{grid-template-columns:minmax(0,1fr)}',
'  .cal-side{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:start}',
'}',
/* 모바일 — 칸엔 점만, 고른 날의 일감은 달력 아래 목록 */
'@media (max-width:860px){',
'  .cal-body{grid-template-columns:minmax(0,1fr)}',
'  .cal-bar{gap:8px}',
'  .cal-nav{order:5;flex:1 1 100%}',
'  .cal-nav .cal-sp2{flex:1 1 auto}',
'  .cal-ym{min-width:0;margin:0 2px;font-size:15.5px}',
'  .cal-nav .dpbtn,.cal-ib,.cal-add,.cal-ws .chip{height:40px}',
'  .cal-nav .dpbtn[data-go="older"],.cal-nav .dpbtn[data-go="newer"],.cal-ib{width:40px}',
'  .cal-ws .chip{padding:0 15px}',
'  .cal-wk span{padding:8px 0 7px;text-align:center}',
'  .cal-grid,.cal-grid.r6{grid-auto-rows:minmax(58px,auto)}',
'  .cal-d{padding:5px 1px 6px;display:flex;flex-direction:column;align-items:center;gap:5px}',
'  .cal-dh{padding:0;min-height:0;justify-content:center}',
'  .cal-hn,.cal-plus,.cal-es{display:none}',
'  .cal-dots{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:3px;max-width:100%;padding:0 2px}',
'  .cal-dots i{width:6px;height:6px;border-radius:50%;background:var(--ac,var(--ink-3))}',
'  .cal-dots i.done{background:transparent;box-shadow:inset 0 0 0 1.5px var(--ink-4)}',
'  .cal-dots em{font-style:normal;font-size:12.5px;line-height:1;font-weight:600;color:var(--ink-3);font-family:"JetBrains Mono",monospace}',
'  .cal-d.sel{box-shadow:inset 0 0 0 2px var(--ink)}',
'  .cal-ag{display:block;border-top:1px solid var(--hair)}',
'  .cal-ag-h{display:flex;align-items:center;gap:8px;padding:12px 12px 8px 16px}',
'  .cal-ag-h b{font-size:14.5px;font-weight:700;letter-spacing:-.02em;white-space:nowrap}',
'  .cal-ag-h .cal-hn{display:inline}',
'  .cal-ag-h .ghost{margin-left:auto;height:40px}',
'  .cal-ag-e{padding:4px 16px 16px;font-size:13px;color:var(--ink-3)}',
'  .cal-f2{grid-template-columns:minmax(0,1fr)}',
'  .cal-lk{margin-top:8px}',
'}',
'@media (max-width:400px){ .cal-add .tx{display:none} .cal-add{padding:0;width:40px;justify-content:center} }',   /* 글자를 접어도 손가락 표적은 40px */
/* 터치 기기엔 hover 가 없다 — 칸의 «+»·완료 버튼을 늘 보인다(행 버튼 규칙과 같은 이유) */
'@media (hover:none){ .cal-plus,.cal-chk{opacity:1} }'
].join('\n');

/* ══════════ 백엔드 ══════════ */
function req(method,path,body,auth){
  var h={};
  if(body!=null)h['Content-Type']='application/json';
  if(auth){ var t=getTok(); if(t)h['X-Cal-Token']=t; }
  return fetch(A.base+path,{method:method,headers:h,body:body!=null?JSON.stringify(body):undefined,cache:'no-store'})
    .then(function(res){ return res.json().catch(function(){ return null; }).then(function(j){ return {s:res.status,j:j}; }); })
    .catch(function(){ return {s:0,j:null}; });
}
function errText(r){
  if(!r||!r.s)return '서버에 닿지 못했어요 — 연결을 확인해 주세요';
  return (r.j&&r.j.error)||('서버 오류 ('+r.s+')');
}
function bodyOf(e,patch){
  var b={date:e.date,game:e.game||'',agency:e.agency||'',price:(e.price==null?null:e.price),done:!!e.done,memo:e.memo||''};
  if(patch)for(var k in patch)if(Object.prototype.hasOwnProperty.call(patch,k))b[k]=patch[k];
  return b;
}
/* 판(base)을 붙여 PUT — 결과를 로컬 원장에 반영하고 {ok, s, stale, entry} 로 돌려준다 */
function putE(e,patch,isNew){
  var w=S.w, g=GEN, b=bodyOf(e,patch);
  if(!isNew)b.base=e.updatedAt;
  return req('PUT','/cal/'+w+'/'+encodeURIComponent(e.id),b,true).then(function(r){
    if(g!==GEN)return {ok:false,s:r.s};
    if((r.s===200||r.s===201)&&r.j&&r.j.entry){ if(S.w===w)upsertLocal(r.j.entry); return {ok:true,s:r.s,entry:r.j.entry}; }
    if(r.s===409&&r.j&&r.j.entry){ if(S.w===w)upsertLocal(r.j.entry); return {ok:false,s:409,stale:true,entry:r.j.entry,err:errText(r)}; }
    if(r.s===401){ lockedOut(); return {ok:false,s:401,err:errText(r)}; }
    return {ok:false,s:r.s,err:errText(r)};
  });
}
function chainOp(id,fn){
  var p=(OPS[id]||Promise.resolve()).then(fn,fn);
  OPS[id]=p.then(function(){},function(){});
  return p;
}
function lockedOut(){
  dropAuth(); S.st='boot';
  A.toast('캘린더가 다시 잠겼어요 — 암호를 입력해 주세요',{kind:'err'});
  if(A.closeModal)A.closeModal();
  paint();
  checkAuth();
}

/* ══════════ 흐름: 부팅 → (잠금|암호 정하기|달력) ══════════ */
function boot(){
  if(!A.base){ S.st='noapi'; paint(); return; }
  var tok=getTok();
  if(tok){
    if(!S.data[S.w]){ var c=cacheGet(S.w); if(c)S.data[S.w]=sortList(c.entries.slice()); }
    S.st='ready'; paint();
    load(S.w,true);
  }else{ S.st='boot'; paint(); checkAuth(); }
}
function checkAuth(){
  var g=GEN;
  req('GET','/cal/auth').then(function(r){
    if(g!==GEN)return;
    if(r.s===200&&r.j){ S.st=r.j.set?'locked':'unset'; }
    else{ S.st='error'; S.err=errText(r); }
    paint();
  });
}
function load(w,first){
  var g=GEN;
  return req('GET','/cal/'+w,null,true).then(function(r){
    if(g!==GEN)return;
    if(r.s===200&&r.j&&Array.isArray(r.j.entries)){
      var had=!!S.data[w];
      S.data[w]=sortList(r.j.entries.slice()); S.at[w]=Date.now(); cachePut(w,S.data[w]);
      if(w===S.w){ if(S.st!=='ready'){ S.st='ready'; paint(); } else refreshBody(null,!had); }
      return;
    }
    if(r.s===401){ lockedOut(); return; }
    if(S.data[w]){ if(first&&w===S.w)A.toast('서버에 닿지 못해 이 기기에 남은 내용을 보여 드려요',{kind:'err'}); return; }
    if(w===S.w){ S.st='error'; S.err=errText(r); paint(); }
  });
}

/* ══════════ 그리기 ══════════ */
function paint(){
  if(!HOST)return;
  hideTip();
  var w=wOf(S.w);
  if(S.st==='noapi'){
    A.setMeta('');
    HOST.innerHTML='<div class="tray"><div class="core"><div class="empty"><div class="empty-t">백엔드가 연결되지 않아 캘린더를 쓸 수 없어요</div></div></div></div>';
    return;
  }
  if(S.st==='boot'){
    A.setMeta('');
    HOST.innerHTML='<div class="tray"><div class="core"><div class="loading" role="status">캘린더를 여는 중</div></div></div>';
    return;
  }
  if(S.st==='error'){
    A.setMeta('');
    HOST.innerHTML='<div class="tray"><div class="core"><div class="empty"><div class="empty-t">캘린더를 불러오지 못했어요</div>'+
      '<div class="empty-s">'+esc(S.err)+'</div><div class="empty-s"><button type="button" class="ghost" id="calRetry">'+ic('arrowR')+'다시 시도</button></div></div></div></div>';
    HOST.querySelector('#calRetry').addEventListener('click',function(){ boot(); });
    return;
  }
  if(S.st==='locked'||S.st==='unset'){ paintLock(); return; }

  /* ready */
  HOST.innerHTML='<div class="cal" style="--ac:'+w.ac+'">'+barHtml()+
    '<div class="cal-body">'+
      '<section class="tray cal-main" aria-label="'+esc(w.n)+' 달력"><div class="core" id="calMain">'+mainHtml()+'</div></section>'+
      '<aside class="cal-side" id="calSide" aria-label="수입">'+sideHtml()+'</aside>'+
    '</div></div>';
  bindAll();
  paintMeta();
  countIn(HOST.querySelector('#calSide'),null);
  if(A.MO&&A.MO.rise)A.MO.rise(HOST.querySelectorAll('.cal-side .tray'),{amount:.16});
}
function barHtml(){
  var cur=ymOf(todayStr());
  return '<div class="cal-bar">'+
    '<div class="cal-ws" role="group" aria-label="누구의 달력">'+WR.map(function(x){
      var on=x.k===S.w;
      return '<button type="button" class="chip'+(on?' on':'')+'" data-w="'+x.k+'" aria-pressed="'+(on?'true':'false')+'" style="--ac:'+x.ac+'"><span class="dot"></span>'+esc(x.n)+'</button>';
    }).join('')+'</div>'+
    '<div class="cal-nav">'+
      '<button type="button" class="dpbtn" data-go="older" aria-label="이전 달">'+ic('chevL')+'</button>'+
      '<h2 class="cal-ym" id="calYm" aria-live="polite">'+ymLabel(S.ym)+'</h2>'+
      '<button type="button" class="dpbtn" data-go="newer" aria-label="다음 달">'+ic('chevR')+'</button>'+
      '<span class="cal-sp2"></span>'+
      '<button type="button" class="dpbtn" data-go="today"'+(S.ym===cur?' disabled':'')+'>오늘</button>'+
    '</div>'+
    '<span class="cal-sp"></span>'+
    '<button type="button" class="cal-ib" id="calLock" aria-label="이 기기에서 잠그기" title="이 기기에서 잠그기">'+ic('lock')+'</button>'+
    '<button type="button" class="cta cal-add" id="calAdd" aria-label="일감 추가"><span class="tx">일감 추가</span><span class="knob">'+ic('plus')+'</span></button>'+
  '</div>';
}
function monthEntries(ym){ return list().filter(function(e){ return e.date.slice(0,7)===ym; }); }
var CHIP_MAX=4;   /* 한 칸 칩 상한 — 넘으면 3건 + «+N건 더»(그날 목록 창) */
function mainHtml(){
  var y=+S.ym.slice(0,4), m=+S.ym.slice(5,7), n=daysIn(y,m), first=new Date(Date.UTC(y,m-1,1)).getUTCDay();
  var today=todayStr(), by={}, cells=[], total=Math.ceil((first+n)/7)*7;
  monthEntries(S.ym).forEach(function(e){ (by[e.date]=by[e.date]||[]).push(e); });
  if(!S.sel||S.sel.slice(0,7)!==S.ym)S.sel=(today.slice(0,7)===S.ym)?today:(S.ym+'-01');
  for(var i=0;i<total;i++){
    var d=i-first+1, wd=i%7, lastw=i>=total-7;
    if(d<1||d>n){ cells.push('<div class="cal-d out'+(lastw?' lastw':'')+'" aria-hidden="true"></div>'); continue; }
    var ds=S.ym+'-'+p2(d), hol=holidayNames(ds), es=by[ds]||[], shown=es.length>CHIP_MAX?es.slice(0,CHIP_MAX-1):es;
    var cls='cal-d'+(wd===0||wd===6?' wkend':'')+(wd===0?' sun':'')+(hol.length?' hol':'')+(ds===today?' today':'')+(ds===S.sel?' sel':'')+(lastw?' lastw':'');
    cells.push('<div class="'+cls+'" data-d="'+ds+'">'+
      '<div class="cal-dh"><span class="cal-dn">'+d+'</span>'+
        (hol.length?'<span class="cal-hn" title="'+esc(hol.join(' · '))+'">'+esc(hol.join(' · '))+'</span>':'')+
        '<button type="button" class="cal-plus" data-add="'+ds+'" aria-label="'+dLabel(ds)+' 일감 추가">'+ic('plus')+'</button></div>'+
      '<div class="cal-es">'+shown.map(chipHtml).join('')+
        (es.length>shown.length?'<button type="button" class="cal-more" data-day="'+ds+'" aria-label="'+dLabel(ds)+' 일감 '+es.length+'건 모두 보기">+'+(es.length-shown.length)+'건 더</button>':'')+
      '</div>'+
      dotsHtml(es)+
    '</div>');
  }
  return '<div class="cal-wk" aria-hidden="true">'+WD.map(function(x,i){ return '<span'+(i===0?' class="sun"':'')+'>'+x+'</span>'; }).join('')+'</div>'+
    '<div class="cal-grid'+(total>35?' r6':'')+'" id="calGrid">'+cells.join('')+'</div>'+
    '<div class="cal-ag" id="calAg">'+agendaHtml()+'</div>';
}
function tipText(e){
  var t=title(e)+(e.game&&e.agency?' ('+e.agency+')':'');
  t+=' · '+(e.price==null?'단가 미입력':won(e.price)+'원');
  if(isDone(e))t+=' · 완료';
  if(e.memo)t+='\n'+e.memo;
  return t;
}
function nameHtml(e){
  return '<b>'+esc(title(e))+'</b>'+(e.game&&e.agency?' <span class="ag">('+esc(e.agency)+')</span>':'');
}
function chipHtml(e){
  var done=isDone(e);
  return '<div class="cal-e'+(done?' done':'')+'" data-id="'+esc(e.id)+'">'+
    '<button type="button" class="cal-et" data-edit="'+esc(e.id)+'" title="'+esc(tipText(e))+'" aria-label="'+esc(dLabel(e.date)+' · '+tipText(e).replace(/\n/g,' · '))+'">'+
      '<span class="dot" aria-hidden="true"></span><span class="tx"><b class="g">'+esc(title(e))+'</b>'+
        (e.game&&e.agency?'<span class="ag">('+esc(e.agency)+')</span>':'')+'</span></button>'+
    '<button type="button" class="cal-chk" data-chk="'+esc(e.id)+'" aria-pressed="'+(done?'true':'false')+'" aria-label="'+esc(title(e))+' 완료"><span class="bx">'+ic('check')+'</span></button>'+
  '</div>';
}
function dotsHtml(es){
  if(!es.length)return '<div class="cal-dots" aria-hidden="true"></div>';
  var shown=es.length>4?es.slice(0,3):es;
  return '<div class="cal-dots" aria-hidden="true">'+shown.map(function(e){ return '<i'+(isDone(e)?' class="done"':'')+'></i>'; }).join('')+
    (es.length>4?'<em>+'+(es.length-3)+'</em>':'')+'</div>';
}
/* 그날 일감 목록 — 모바일 달력 아래 목록과 데스크톱 «+N건 더» 창이 같은 줄을 쓴다(이름 전체 · 단가 · 완료 체크 40px) */
function dayRowsHtml(ds){
  var es=list().filter(function(e){ return e.date===ds; });
  return es.length?'<div class="cal-ag-l">'+es.map(function(e){
    var done=isDone(e);
    return '<div class="cal-ar'+(done?' done':'')+'" data-id="'+esc(e.id)+'">'+
      '<button type="button" class="cal-chk" data-chk="'+esc(e.id)+'" aria-pressed="'+(done?'true':'false')+'" aria-label="'+esc(title(e))+' 완료"><span class="bx">'+ic('check')+'</span></button>'+
      '<button type="button" class="cal-art" data-edit="'+esc(e.id)+'"><span class="t">'+nameHtml(e)+'</span>'+
        '<span class="p'+(e.price==null?' z':'')+'">'+(e.price==null?'단가 —':'<span class="num">'+won(e.price)+'</span>원')+'</span></button>'+
    '</div>';
  }).join('')+'</div>':'<div class="cal-ag-e">일감 없음</div>';
}
function agendaHtml(){
  var ds=S.sel, hol=holidayNames(ds);
  return '<div class="cal-ag-h"><b>'+dLabel(ds)+'</b>'+(hol.length?'<span class="cal-hn">'+esc(hol.join(' · '))+'</span>':'')+
      '<button type="button" class="ghost" data-add="'+ds+'">'+ic('plus')+'추가</button></div>'+dayRowsHtml(ds);
}

/* ── 수입 ── */
function statsOf(l){
  var s={n:l.length,done:0,gross:0,noPrice:0};
  l.forEach(function(e){ if(isDone(e))s.done++; if(e.price==null)s.noPrice++; s.gross+=priceOf(e); });
  s.tax=taxOf(s.gross); s.net=s.gross-s.tax;
  return s;
}
function yearStats(y){
  var out={months:[],gross:0,tax:0,net:0,n:0};
  for(var m=1;m<=12;m++){
    var st=statsOf(monthEntries(y+'-'+p2(m)));
    st.m=m; out.months.push(st);
    out.gross+=st.gross; out.tax+=st.tax; out.net+=st.net; out.n+=st.n;
  }
  return out;
}
function wonCell(k,v,cls){ return '<span class="num'+(cls?' '+cls:'')+'" data-k="'+k+'" data-v="'+v+'">'+won(v)+'</span>'; }
function sideHtml(){
  var m=+S.ym.slice(5,7), y=+S.ym.slice(0,4), ms=statsOf(monthEntries(S.ym)), ys=yearStats(y);
  /* 업체별 — 세전(달 합계와 1원까지 맞는 쪽). 업체를 안 적은 일감은 한 줄로 모은다 */
  var ag=Object.create(null), keys=[];   /* 키 = 사용자가 적은 업체명 — 일반 객체면 «constructor» 같은 이름이 상속 속성과 부딪친다 */
  monthEntries(S.ym).forEach(function(e){
    var k=e.agency||''; if(!ag[k]){ ag[k]={n:0,gross:0}; keys.push(k); }
    ag[k].n++; ag[k].gross+=priceOf(e);
  });
  keys.sort(function(a,b){ return (ag[b].gross-ag[a].gross)||(ag[b].n-ag[a].n)||(a<b?-1:a>b?1:0); });
  var maxNet=0; ys.months.forEach(function(x){ if(x.net>maxNet)maxNet=x.net; });

  /* 순서 = 이달 → 해 → 업체별. 해 수입은 요청의 핵심이라 1920×1080 첫 화면 안에 둔다(업체별은 길이가 달마다 달라 맨 아래) */
  var agencyCard='<section class="tray cal-card" aria-label="'+m+'월 업체별"><div class="core">'+
      '<div class="tile-h"><span class="tile-ic">'+ic('biz')+'</span><span class="tile-t">'+m+'월 업체별</span><span class="tile-m">세전</span></div>'+
      (keys.length?'<div class="cal-agl">'+keys.map(function(k){
        return '<div class="cal-agr"><span class="nm'+(k?'':' none')+'">'+(k?esc(k):'업체 미입력')+'</span>'+
          '<span class="c"><span class="num">'+ag[k].n+'</span>건</span><span class="v num">'+won(ag[k].gross)+'</span></div>';
      }).join('')+'</div>':'<div class="cal-empty">이달 일감 없음</div>')+
    '</div></section>';
  return '<section class="tray cal-card" aria-label="'+m+'월 수입"><div class="core">'+
      '<div class="tile-h"><span class="tile-ic">'+ic('won')+'</span><span class="tile-t">'+m+'월 수입</span>'+
        '<span class="tile-m"><b>'+ms.n+'</b>건 · 완료 <b>'+ms.done+'</b></span></div>'+
      '<div class="cal-sum">'+
        '<div class="cal-net"><span class="k">실수령</span><span class="v">'+wonCell('mnet',ms.net)+'<span class="u">원</span></span></div>'+
        '<div class="cal-kv"><span>세전 합계</span>'+wonCell('mgross',ms.gross)+'</div>'+
        '<div class="cal-kv"><span>원천징수 3.3%</span>'+wonCell('mtax',-ms.tax)+'</div>'+
        (ms.noPrice?'<div class="cal-kv warn"><span>단가 미입력</span><span><span class="num">'+ms.noPrice+'</span>건</span></div>':'')+
      '</div></div></section>'+
    '<section class="tray cal-card" aria-label="'+y+'년 수입"><div class="core">'+
      '<div class="tile-h"><span class="tile-ic">'+ic('bars')+'</span><span class="tile-t">'+y+'년 수입</span><span class="tile-m">실수령</span></div>'+
      '<div class="cal-yr">'+ys.months.map(function(x){
        var ym=y+'-'+p2(x.m), on=ym===S.ym, pct=maxNet>0?Math.max(0,x.net/maxNet*100):0;
        /* 툴팁 값 칸(.ctip b)은 모노 서체라 숫자만 — «14건 · 완료 9» 처럼 한글을 섞으면 글꼴이 갈라진다(모노=숫자 전용 규칙) */
        var tip=x.m+'월 실수령|'+(x.n?won(x.net):'—')+'||세전|'+won(x.gross)+';3.3%|'+won(-x.tax)+';일감|'+x.n+';완료|'+x.done+(x.noPrice?';단가 미입력|'+x.noPrice:'');
        return '<button type="button" class="cal-yrow'+(on?' on':'')+'" data-ym="'+ym+'" data-tip="'+esc(tip)+'" aria-label="'+x.m+'월 실수령 '+won(x.net)+'원, '+x.n+'건"'+(on?' aria-current="true"':'')+'>'+
          '<span class="mo">'+x.m+'월</span><span class="bar">'+(x.net>0?'<i style="width:'+pct.toFixed(2)+'%"></i>':'')+'</span>'+
          '<span class="v num'+(x.n?'':' z')+'">'+(x.n?won(x.net):'—')+'</span></button>';
      }).join('')+'</div>'+
      '<div class="cal-yf">'+
        '<div class="cal-kv"><span>세전 합계</span>'+wonCell('ygross',ys.gross)+'</div>'+
        '<div class="cal-kv"><span>원천징수 3.3%</span>'+wonCell('ytax',-ys.tax)+'</div>'+
        '<div class="cal-kv tot"><span>실수령 합계</span>'+wonCell('ynet',ys.net)+'</div>'+
      '</div>'+
    '</div></section>'+
    agencyCard;
}
function paintMeta(){
  if(S.st!=='ready'){ A.setMeta(''); return; }
  var ms=statsOf(monthEntries(S.ym));
  A.setMeta('<span>'+(+S.ym.slice(5,7))+'월 <b>'+ms.n+'</b>건</span><span>실수령 <em class="cal-mv">'+won(ms.net)+'</em>원</span>');
}
/* 금액이 바뀌면 이전 값에서 굴러간다(GSAP 있을 때만 — 마크업엔 이미 최종값이 있어 없으면 정적으로 완성) */
function countIn(root,old){
  if(!root)return;
  var g=A.MO&&A.MO.live&&A.MO.live()?A.MO.g:null;
  Array.prototype.forEach.call(root.querySelectorAll('[data-k]'),function(n){
    var to=Number(n.getAttribute('data-v')), from=old&&Object.prototype.hasOwnProperty.call(old,n.getAttribute('data-k'))?old[n.getAttribute('data-k')]:0;
    if(!g||from===to||!isFinite(from))return;
    var o={v:from}; n.textContent=won(from);
    g.to(o,{v:to,duration:.55,ease:'power2.out',onUpdate:function(){ n.textContent=won(Math.round(o.v)); },onComplete:function(){ n.textContent=won(to); }});
  });
  if(g){
    var bars=root.querySelectorAll('.cal-yrow .bar i');
    if(bars.length&&!old)g.fromTo(bars,{scaleX:0},{scaleX:1,duration:.7,ease:'expo.out',stagger:{amount:.2},clearProps:'transform'});
  }
}
/* 달력 몸통만 다시 그린다(툴바·패널 틀은 유지). dir = 달 이동 방향(±1) · 0 = 제자리 */
function refreshBody(focusSel,animate,dir){
  if(!HOST||S.st!=='ready')return;
  var main=HOST.querySelector('#calMain'), side=HOST.querySelector('#calSide');
  if(!main||!side){ paint(); return; }
  var old={};
  Array.prototype.forEach.call(side.querySelectorAll('[data-k]'),function(n){ old[n.getAttribute('data-k')]=Number(n.getAttribute('data-v')); });
  var ymEl=HOST.querySelector('#calYm'); if(ymEl)ymEl.textContent=ymLabel(S.ym);
  var tb=HOST.querySelector('.cal-nav .dpbtn[data-go="today"]'); if(tb)tb.disabled=(S.ym===ymOf(todayStr()));
  var draw=function(){ main.innerHTML=mainHtml(); bindMain(); };
  if(dir&&A.MO&&A.MO.swap)A.MO.swap(main,{dir:dir},draw); else draw();
  side.innerHTML=sideHtml(); bindSide();
  countIn(side,animate?null:old);
  paintMeta();
  var dayB=document.getElementById('calDayB');   /* «+N건 더» 창이 열려 있으면 그 목록도 같이 */
  if(dayB&&DAY)dayB.innerHTML='<div class="cal-dayl">'+dayRowsHtml(DAY)+'</div>';
  /* 포커스는 문서 전체에서 찾는다 — 그날 목록 창(모달)은 HOST 밖(body)에 있다. 후보를 여럿 받아 처음 있는 것으로 */
  if(focusSel){
    var sels=[].concat(focusSel);
    for(var i=0;i<sels.length;i++){ var f=document.querySelector(sels[i]); if(f){ try{ f.focus({preventScroll:true}); }catch(e){ f.focus(); } break; } }
  }
}

/* ══════════ 그날 목록 창 — 칸에 다 못 담은 날(«+N건 더») ══════════ */
var DAY='';
function openDay(ds,btn){
  var hol=holidayNames(ds);
  DAY=ds;
  /* 창이 열린 동안 완료를 누르면 달력이 다시 그려져 «+N건 더» 버튼이 새것으로 바뀐다 — 닫을 때 옛 버튼(떨어져 나간 요소)으로
     포커스를 돌리면 허공이 되므로, 닫는 순간 그 날의 지금 버튼을 찾아 주는 대리 opener 를 넘긴다 */
  var opener={focus:function(){
    var b=document.querySelector('.cal-more[data-day="'+ds+'"]')||document.querySelector('.cal-d[data-d="'+ds+'"] .cal-plus')||btn;
    try{ b.focus({preventScroll:true}); }catch(x){}
  }};
  var back=A.openModal(
    '<div class="mdl-h"><span class="mdl-hic">'+ic('cal')+'</span><div><div class="mdl-ht">'+dLabel(ds)+'</div>'+
      '<div class="mdl-hs">'+esc(wOf(S.w).n)+(hol.length?' · '+esc(hol.join(' · ')):'')+'</div></div>'+
      '<button type="button" class="mdl-x" data-close aria-label="닫기">'+ic('x')+'</button></div>'+
    '<div class="mdl-b" id="calDayB"><div class="cal-dayl">'+dayRowsHtml(ds)+'</div></div>'+
    '<div class="mdl-f cal-mf"><span class="cal-fsp"></span><button type="button" class="ghost" data-close>닫기</button>'+
      '<button type="button" class="cta" id="calDayAdd">추가<span class="knob">'+ic('plus')+'</span></button></div>',
    opener,dLabel(ds)+' 일감');
  back.addEventListener('click',function(e){
    var t=e.target;
    var chk=t.closest('[data-chk]'); if(chk){ toggleDone(chk.getAttribute('data-chk'),'#calDayB'); return; }
    var ed=t.closest('[data-edit]'); if(ed){ var en=findE(ed.getAttribute('data-edit')); if(en){ DAY=''; openEditor(en,null,opener); } return; }
  });
  back.querySelector('#calDayAdd').addEventListener('click',function(){ DAY=''; openEditor(null,ds,opener); });
}

/* ══════════ 잠금 화면 ══════════ */
function paintLock(){
  A.setMeta('');
  var setup=S.st==='unset';
  HOST.innerHTML='<section class="tray cal-lk"><div class="core"><div class="cal-lk-in">'+
    '<div class="cal-lk-ic">'+ic('lock')+'</div>'+
    '<h2 class="cal-lk-t">'+(setup?'캘린더 암호 정하기':'캘린더 잠금')+'</h2>'+
    '<form id="calLkF" novalidate>'+
      (setup?'<input type="text" name="username" value="쓰담 캘린더" autocomplete="username" hidden>':'')+
      '<label class="f-l" for="calPw">암호</label>'+
      '<input class="f-i" id="calPw" type="password" maxlength="64" autocomplete="'+(setup?'new-password':'current-password')+'" required>'+
      (setup?'<label class="f-l" for="calPw2">암호 확인</label><input class="f-i" id="calPw2" type="password" maxlength="64" autocomplete="new-password" required>'+
        '<div class="f-hint">'+ic('info')+'<span>6자 이상 · 봄딩·영도 달력 공용 · 이 기기는 다음부터 묻지 않아요</span></div>':'')+
      '<div class="mdl-msg err" id="calLkMsg" role="alert"></div>'+
      '<div class="cal-lk-go"><button type="submit" class="cta" id="calLkGo">'+(setup?'정하고 열기':'열기')+'<span class="knob">'+ic('arrowR')+'</span></button></div>'+
    '</form></div></div></section>';
  var f=HOST.querySelector('#calLkF'), pw=HOST.querySelector('#calPw'), pw2=HOST.querySelector('#calPw2'),
      msg=HOST.querySelector('#calLkMsg'), go=HOST.querySelector('#calLkGo');
  setTimeout(function(){ try{ pw.focus({preventScroll:true}); }catch(e){} },60);
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    var p=pw.value;
    msg.textContent='';
    if(setup){
      if(p.length<6){ msg.textContent='암호는 6자 이상으로 정해 주세요'; pw.focus(); return; }
      if(p!==pw2.value){ msg.textContent='두 칸의 암호가 달라요'; pw2.focus(); return; }
    }else if(!p){ msg.textContent='암호를 입력해 주세요'; pw.focus(); return; }
    go.disabled=true;
    var g=GEN;
    req('POST',setup?'/cal/auth/setup':'/cal/auth/login',{pass:p}).then(function(r){
      if(g!==GEN)return;
      go.disabled=false;
      if((r.s===200||r.s===201)&&r.j&&r.j.token){
        lset(TOK_LS,r.j.token);
        A.toast(setup?'암호를 정했어요 — 이 기기는 기억해 둘게요':'캘린더를 열었어요');
        S.data={}; S.at={}; S.st='ready';
        paintSkeleton(); load(S.w,true);
        return;
      }
      if(r.s===409&&r.j&&r.j.code==='already'){ S.st='locked'; paintLock(); A.toast('그새 다른 기기에서 암호를 정했어요 — 그 암호로 열어 주세요',{kind:'err'}); return; }
      if(r.s===409&&r.j&&r.j.code==='unset'){ S.st='unset'; paintLock(); return; }
      msg.textContent=errText(r)+((r.s===401&&r.j&&typeof r.j.left==='number'&&r.j.left<=3)?' (남은 기회 '+r.j.left+'번)':'');
      pw.select();
    });
  });
}
/* 암호를 막 연 직후 — 원장이 오기 전까지 달력 틀만 먼저 */
function paintSkeleton(){
  S.data[S.w]=[];
  paint();
  S.data[S.w]=null;
}

/* ══════════ 이벤트 ══════════ */
function compact(){ return window.matchMedia&&window.matchMedia('(max-width:860px)').matches; }
function bindAll(){
  HOST.querySelector('.cal-ws').addEventListener('click',function(e){
    var b=e.target.closest('.chip'); if(!b||b.dataset.w===S.w)return;
    switchWriter(b.dataset.w);
  });
  HOST.querySelector('.cal-nav').addEventListener('click',function(e){
    var b=e.target.closest('.dpbtn'); if(!b||b.disabled)return;
    var go=b.dataset.go;
    if(go==='older')goMonth(addYm(S.ym,-1));
    else if(go==='newer')goMonth(addYm(S.ym,1));
    else if(go==='today'){ S.sel=todayStr(); goMonth(ymOf(S.sel)); }
  });
  HOST.querySelector('#calLock').addEventListener('click',function(){
    var t=getTok();
    if(t)req('POST','/cal/auth/logout',null,true);
    dropAuth(); S.st='locked'; paintLock();
    A.toast('이 기기에서 캘린더를 잠갔어요');
  });
  HOST.querySelector('#calAdd').addEventListener('click',function(){
    var ds=(S.sel&&S.sel.slice(0,7)===S.ym)?S.sel:(ymOf(todayStr())===S.ym?todayStr():S.ym+'-01');
    openEditor(null,ds,this);
  });
  bindMain(); bindSide();
}
function bindMain(){
  var main=HOST&&HOST.querySelector('#calMain'); if(!main||main.__b)return;
  main.__b=1;
  main.addEventListener('click',function(e){
    var t=e.target;
    var chk=t.closest('[data-chk]'); if(chk){ toggleDone(chk.getAttribute('data-chk'),chk.closest('#calAg')?'#calAg':'#calGrid'); return; }
    var ed=t.closest('[data-edit]'); if(ed){ var en=findE(ed.getAttribute('data-edit')); if(en)openEditor(en,null,ed); return; }
    var ad=t.closest('[data-add]'); if(ad){ openEditor(null,ad.getAttribute('data-add'),ad); return; }
    var dy=t.closest('[data-day]'); if(dy){ openDay(dy.getAttribute('data-day'),dy); return; }
    var cell=t.closest('.cal-d'); if(!cell||cell.classList.contains('out'))return;
    var ds=cell.getAttribute('data-d');
    if(compact()){ selectDay(ds); return; }
    openEditor(null,ds,cell.querySelector('.cal-plus'));
  });
}
function bindSide(){
  var side=HOST&&HOST.querySelector('#calSide'); if(!side||side.__b)return;
  side.__b=1;
  side.addEventListener('click',function(e){
    var r=e.target.closest('.cal-yrow'); if(!r)return;
    var ym=r.getAttribute('data-ym'); if(!ym||ym===S.ym)return;
    hideTip(); goMonth(ym);
    var nr=HOST&&HOST.querySelector('.cal-yrow[data-ym="'+ym+'"]');   /* 패널을 다시 그렸으니 같은 달 줄로 포커스를 돌려준다 */
    if(nr)try{ nr.focus({preventScroll:true}); }catch(x){}
  });
  side.addEventListener('pointerover',function(e){ var r=e.target.closest('.cal-yrow'); if(r)showTip(r); else hideTip(); });
  side.addEventListener('pointerleave',hideTip);
  side.addEventListener('focusin',function(e){ var r=e.target.closest('.cal-yrow'); if(r)showTip(r); });
  side.addEventListener('focusout',hideTip);
}
function selectDay(ds){
  S.sel=ds;
  var grid=HOST.querySelector('#calGrid'); if(!grid)return;
  Array.prototype.forEach.call(grid.querySelectorAll('.cal-d.sel'),function(c){ c.classList.remove('sel'); });
  var c=grid.querySelector('.cal-d[data-d="'+ds+'"]'); if(c)c.classList.add('sel');
  var ag=HOST.querySelector('#calAg'); if(ag){ ag.innerHTML=agendaHtml(); if(A.MO&&A.MO.pop)A.MO.pop(ag.querySelector('.cal-ag-h b')); }
}
function goMonth(ym){
  if(ym===S.ym)return;
  var dir=ym>S.ym?1:-1;
  S.ym=ym;
  if(!S.sel||S.sel.slice(0,7)!==ym)S.sel='';
  refreshBody(null,false,dir);
}
function switchWriter(w){
  S.w=w; lset(W_LS,w); WANT={};
  if(!S.data[w]){ var c=cacheGet(w); if(c)S.data[w]=sortList(c.entries.slice()); }
  var box=HOST.querySelector('.cal');
  var draw=function(){
    paint();
    var c=HOST&&HOST.querySelector('.cal-ws .chip[data-w="'+w+'"]');   /* 툴바까지 다시 그렸으니 고른 칩으로 포커스를 돌려준다 */
    if(c)try{ c.focus({preventScroll:true}); }catch(x){}
  };
  if(box&&A.MO&&A.MO.swap){ A.MO.swap(HOST,{dir:0},draw); } else draw();
  load(w,false);
}

/* ── 완료 체크(낙관적 표시 + 일감별 한 줄 요청) ── */
/* where = 누른 자리(#calGrid 칸 / #calAg 모바일 목록) — 같은 id 의 버튼이 두 곳에 있어 포커스를 «누른 쪽»으로 돌려준다
   (모바일에서 칸 쪽 버튼은 숨어 있어 그쪽으로 보내면 포커스가 사라진다) */
function toggleDone(id,where){
  var e=findE(id); if(!e)return;
  var sel=(where||'#calGrid')+' [data-chk="'+cssEsc(id)+'"]';
  WANT[id]=!isDone(e);
  refreshBody(sel);
  chainOp(id,function(){
    var cur=findE(id);
    if(!cur||!Object.prototype.hasOwnProperty.call(WANT,id))return null;
    var want=WANT[id];
    if(want===!!cur.done){ delete WANT[id]; refreshBody(); return null; }
    return putE(cur,{done:want},false).then(function(r){
      if(r.ok||r.stale||!Object.prototype.hasOwnProperty.call(WANT,id)||WANT[id]===want)delete WANT[id];
      if(r.stale)A.toast('다른 기기에서 먼저 고친 일감이라 최신 내용으로 바꿨어요',{kind:'err'});
      else if(!r.ok&&r.s!==401)A.toast('완료 표시를 저장하지 못했어요 — '+(r.err||''),{kind:'err'});
      var ae=document.activeElement;
      refreshBody(ae&&ae.getAttribute&&ae.getAttribute('data-chk')===id?sel:null);
    });
  });
}
function cssEsc(s){ return String(s).replace(/["\\]/g,'\\$&'); }
/* 저장 뒤 포커스 — 방금 고친 일감(데스크톱은 칸의 칩, 모바일은 목록 줄). 칸에 못 담겨 «+N건 더» 뒤에 숨었으면 그 버튼, 그것도 없으면 «일감 추가» */
function entrySel(id){
  var e=findE(id), out=[(compact()?'#calAg':'#calGrid')+' [data-edit="'+cssEsc(id)+'"]'];
  if(e)out.push('.cal-more[data-day="'+e.date+'"]');
  out.push('#calAdd');
  return out;
}

/* ══════════ 편집 모달 ══════════ */
function suggestions(){
  var games=Object.create(null), ags=Object.create(null), gl=[], al=[];
  list().slice().sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0; }).forEach(function(e){
    if(e.game&&!games[e.game]){ games[e.game]=1; gl.push(e.game); }
    if(e.agency&&!ags[e.agency]){ ags[e.agency]=1; al.push(e.agency); }
  });
  return {games:gl.slice(0,80),agencies:al.slice(0,40)};
}
function lastOfGame(game){
  var k=game.replace(/\s+/g,'').toLowerCase(), best=null;
  list().forEach(function(e){
    if(!e.game||e.game.replace(/\s+/g,'').toLowerCase()!==k)return;
    if(!best||e.date>best.date||(e.date===best.date&&(e.updatedAt||0)>(best.updatedAt||0)))best=e;
  });
  return best;
}
function parsePrice(v){
  var s=String(v==null?'':v).replace(/[,\s원]/g,'');
  if(!s)return null;
  if(!/^\d+$/.test(s))return NaN;
  return Number(s);
}
function openEditor(entry,ds,opener){
  var isNew=!entry, w=wOf(S.w), sg=suggestions();
  var e0=entry||{id:newId(),date:ds||todayStr(),game:'',agency:'',price:null,done:false,memo:''};
  var base=entry?entry.updatedAt:null;
  var inner=
    '<div class="mdl-h"><span class="mdl-hic">'+ic('cal')+'</span><div><div class="mdl-ht">'+(isNew?'일감 추가':'일감 고치기')+'</div>'+
      '<div class="mdl-hs" id="cfSub">'+esc(w.n)+' · '+dLabel(e0.date)+'</div></div>'+
      '<button type="button" class="mdl-x" data-close aria-label="닫기">'+ic('x')+'</button></div>'+
    '<div class="mdl-b"><form id="cfForm" novalidate autocomplete="off">'+
      '<div class="cal-f2">'+
        '<div><label class="f-l" for="cfGame">게임</label><input class="f-i" id="cfGame" list="cfGames" maxlength="60" value="'+esc(e0.game)+'" autocomplete="off"></div>'+
        '<div><label class="f-l" for="cfAgency">외주업체</label><input class="f-i" id="cfAgency" list="cfAgencies" maxlength="40" value="'+esc(e0.agency)+'" autocomplete="off"></div>'+
      '</div>'+
      '<div class="cal-f2">'+
        '<div><label class="f-l" for="cfPrice">단가</label><div class="cal-won"><input class="f-i" id="cfPrice" inputmode="numeric" maxlength="13" value="'+(e0.price==null?'':won(e0.price))+'" autocomplete="off"><span>원</span></div>'+
          '<div class="f-hint cal-net-h" id="cfNet" aria-live="polite"></div></div>'+
        '<div><label class="f-l" for="cfDate">날짜</label><input class="f-i" id="cfDate" type="date" value="'+esc(e0.date)+'" min="2000-01-01" max="2100-12-31"></div>'+
      '</div>'+
      '<label class="f-l" for="cfMemo">메모 <span class="f-opt">선택</span></label><input class="f-i" id="cfMemo" maxlength="200" value="'+esc(e0.memo)+'" autocomplete="off">'+
      '<button type="button" class="cal-tg" id="cfDone" aria-pressed="'+(e0.done?'true':'false')+'"><span class="bx">'+ic('check')+'</span>완료</button>'+
      '<datalist id="cfGames">'+sg.games.map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist>'+
      '<datalist id="cfAgencies">'+sg.agencies.map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist>'+
      '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button>'+
    '</form></div>'+
    '<div class="mdl-f cal-mf">'+
      (isNew?'':'<button type="button" class="ghost cal-del" id="cfDel">'+ic('trash')+'삭제</button>')+
      '<span class="cal-fsp"></span>'+
      '<button type="button" class="ghost" data-close>취소</button>'+
      '<button type="button" class="cta" id="cfSave">'+(isNew?'추가':'저장')+'<span class="knob">'+ic('check')+'</span></button>'+
      '<div class="mdl-msg err" id="cfMsg" role="alert"></div>'+
    '</div>';
  var back=A.openModal(inner,opener,isNew?'일감 추가':'일감 고치기');
  var $=function(id){ return back.querySelector('#'+id); };
  var fGame=$('cfGame'), fAg=$('cfAgency'), fPrice=$('cfPrice'), fDate=$('cfDate'), fMemo=$('cfMemo'), fDone=$('cfDone'),
      fNet=$('cfNet'), fMsg=$('cfMsg'), fSave=$('cfSave'), fSub=$('cfSub');
  var touched={agency:!!e0.agency,price:e0.price!=null};
  function net(){
    var p=parsePrice(fPrice.value);
    fNet.textContent=(p&&p>0&&p<=PRICE_MAX)?('3.3% 떼면 '+won(p-taxOf(p))+'원'):'';
  }
  net();
  fPrice.addEventListener('input',function(ev){
    if(ev.isComposing)return;
    var v=fPrice.value, pos=fPrice.selectionStart==null?v.length:fPrice.selectionStart;
    var before=v.slice(0,pos).replace(/\D/g,'').length;
    var digits=v.replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,10);
    var out=digits?Number(digits).toLocaleString('ko-KR'):'';
    fPrice.value=out;
    var p=0,c=0; while(p<out.length&&c<before){ if(/\d/.test(out.charAt(p)))c++; p++; }
    try{ fPrice.setSelectionRange(p,p); }catch(x){}
    touched.price=!!out; net();
  });
  fAg.addEventListener('input',function(){ touched.agency=!!fAg.value.trim(); });
  function autofill(){
    if(!isNew)return;
    var g=fGame.value.trim(); if(!g)return;
    var last=lastOfGame(g); if(!last)return;
    var did=false;
    if(!touched.agency&&!fAg.value.trim()&&last.agency){ fAg.value=last.agency; did=true; }
    if(!touched.price&&!fPrice.value.trim()&&last.price!=null){ fPrice.value=won(last.price); net(); did=true; }
    if(did&&A.MO&&A.MO.pulse){ A.MO.pulse(fAg.value?fAg:fPrice,null); }
  }
  fGame.addEventListener('change',autofill);
  fGame.addEventListener('input',function(ev){ if(ev.inputType==='insertReplacementText'||!ev.inputType)autofill(); });
  fDate.addEventListener('change',function(){ if(/^\d{4}-\d{2}-\d{2}$/.test(fDate.value))fSub.textContent=w.n+' · '+dLabel(fDate.value); });
  fDone.addEventListener('click',function(){ fDone.setAttribute('aria-pressed',fDone.getAttribute('aria-pressed')==='true'?'false':'true'); });
  back.querySelector('#cfForm').addEventListener('submit',function(ev){ ev.preventDefault(); save(); });
  [fGame,fAg,fPrice,fMemo].forEach(function(n){ n.addEventListener('keydown',function(ev){ if(ev.key==='Enter'&&!ev.isComposing){ ev.preventDefault(); save(); } }); });
  fSave.addEventListener('click',save);
  var del=$('cfDel'); if(del)del.addEventListener('click',function(){ removeEntry(entry,back); });
  setTimeout(function(){ try{ (isNew?fGame:fGame).focus({preventScroll:true}); }catch(x){} },80);

  var busy=false;
  function fail(t,el){ fMsg.textContent=t; if(el)try{ el.focus(); }catch(x){} }
  function save(){
    if(busy)return;
    fMsg.textContent='';
    var game=fGame.value.replace(/\s+/g,' ').trim(), ag=fAg.value.replace(/\s+/g,' ').trim(), memo=fMemo.value.replace(/\s+/g,' ').trim();
    var date=fDate.value, price=parsePrice(fPrice.value);
    if(!game&&!ag)return fail('게임 이름이나 외주업체 중 하나는 적어 주세요',fGame);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||+date.slice(0,4)<2000||+date.slice(0,4)>2100)return fail('날짜를 골라 주세요',fDate);
    if(price!==null&&(isNaN(price)||price>PRICE_MAX))return fail('단가는 1억 원 이하의 숫자로 적어 주세요',fPrice);
    var done=fDone.getAttribute('aria-pressed')==='true';
    var next={id:e0.id,date:date,game:game,agency:ag,price:price,done:done,memo:memo,updatedAt:base};
    busy=true; fSave.disabled=true;
    delete WANT[e0.id];
    chainOp(e0.id,function(){
      return putE(next,null,isNew).then(function(r){
        busy=false; fSave.disabled=false;
        if(r.ok){
          A.closeModal();
          var ym=r.entry.date.slice(0,7);
          if(ym!==S.ym){
            A.toast(dLabel(r.entry.date)+'에 '+(isNew?'추가':'옮겨')+'했어요',{action:'그 달 보기',onAction:function(){ S.sel=r.entry.date; goMonth(ym); }});
            refreshBody('#calAdd');
            return;
          }
          if(isNew)A.toast(dLabel(r.entry.date)+'에 추가했어요');
          S.sel=r.entry.date;
          refreshBody(entrySel(r.entry.id));
          return;
        }
        if(r.stale){
          base=r.entry.updatedAt;
          refreshBody();
          return fail('다른 기기에서 이 일감을 먼저 고쳤어요. 지금 내용으로 덮어쓰려면 한 번 더 눌러 주세요');
        }
        if(r.s===401)return;
        fail('저장하지 못했어요 — '+(r.err||''));
      });
    });
  }
}
function removeEntry(entry,back){
  var id=entry.id, snapshot=findE(id)||entry;
  chainOp(id,function(){
    return req('DELETE','/cal/'+S.w+'/'+encodeURIComponent(id)+'?base='+encodeURIComponent(snapshot.updatedAt||''),null,true).then(function(r){
      if(r.s===200||r.s===404){
        removeLocal(id); delete WANT[id];
        A.closeModal(); refreshBody('#calAdd');
        A.toast('일감을 지웠어요',{action:'되돌리기',onAction:function(){
          var e={id:snapshot.id,date:snapshot.date,game:snapshot.game,agency:snapshot.agency,price:snapshot.price,done:snapshot.done,memo:snapshot.memo};
          chainOp(id,function(){ return putE(e,null,true).then(function(rr){ if(rr.ok)refreshBody(); else A.toast('되돌리지 못했어요 — '+(rr.err||''),{kind:'err'}); }); });
        }});
        return;
      }
      if(r.s===409&&r.j&&r.j.entry){ upsertLocal(r.j.entry); refreshBody(); A.closeModal(); A.toast('다른 기기에서 먼저 고친 일감이에요 — 확인한 뒤 다시 지워 주세요',{kind:'err'}); return; }
      if(r.s===401){ lockedOut(); return; }
      var m=back&&back.querySelector('#cfMsg'); if(m)m.textContent='지우지 못했어요 — '+errText(r);
    });
  });
}

/* ══════════ 연간 막대 툴팁(사이트 .ctip 어휘) ══════════ */
/* 자리 — 줄에 붙인다(커서를 따라다니지 않는다). 카드 «바깥 왼쪽»에 둬 같은 카드의 다른 줄·아래 합계(.cal-yf)를 가리지 않는다
   (09-28 게이트 🟡: 커서 옆에 띄우니 12월 줄에서 제 줄과 합계를 덮었다). 왼쪽에 자리가 없으면(패널이 전폭인 좁은 화면) 줄 위, 그것도 없으면 아래 */
function showTip(el){
  if(!TIP){ TIP=document.createElement('div'); TIP.className='ctip'; TIP.id='calTip'; TIP.setAttribute('role','tooltip'); document.body.appendChild(TIP); }
  var parts=(el.getAttribute('data-tip')||'').split('||'), head=parts[0].split('|'), rows=(parts[1]||'').split(';').filter(Boolean);
  TIP.textContent='';
  var h=document.createElement('div'); h.className='ctip-h';
  var ht=document.createElement('span'); ht.textContent=head[0]||''; h.appendChild(ht);
  var hv=document.createElement('b'); hv.textContent=head[1]||''; h.appendChild(hv); TIP.appendChild(h);
  rows.forEach(function(r){
    var kv=r.split('|'), d=document.createElement('div'); d.className='ctip-r';
    var s=document.createElement('span'); s.textContent=kv[0]; d.appendChild(s);
    var b=document.createElement('b'); b.textContent=kv[1]||''; d.appendChild(b); TIP.appendChild(d);
  });
  var vw=window.innerWidth, vh=window.innerHeight, tw=TIP.offsetWidth||180, th=TIP.offsetHeight||80;
  var rc=el.getBoundingClientRect(), card=el.closest('.tray')||el, cr=card.getBoundingClientRect(), x, y;
  if(cr.left-tw-12>=8){ x=cr.left-tw-12; y=rc.top+rc.height/2-th/2; }
  else{ x=rc.left+rc.width/2-tw/2; y=rc.top-th-8; if(y<8)y=rc.bottom+8; }
  x=Math.max(8,Math.min(vw-tw-8,x)); y=Math.max(8,Math.min(vh-th-8,y));
  TIP.style.left=x+'px'; TIP.style.top=y+'px';
  TIP.classList.add('on');
}
function hideTip(){ if(TIP)TIP.classList.remove('on'); }

/* ══════════ mount / unmount ══════════ */
function onVis(){
  if(document.visibilityState!=='visible'||S.st!=='ready')return;
  if(Date.now()-(S.at[S.w]||0)>15000)load(S.w,false);
}
function on(t,ev,fn){ t.addEventListener(ev,fn); LIS.push([t,ev,fn]); }
function mount(host,api){
  A=api; HOST=host; GEN++;
  if(!document.getElementById('calCss')){ var st=document.createElement('style'); st.id='calCss'; st.textContent=CSS; document.head.appendChild(st); }
  if(!S.w){ var sw=ls(W_LS,'bomding'); S.w=(sw==='yeongdo')?'yeongdo':'bomding'; }
  if(!S.ym)S.ym=ymOf(todayStr());
  on(document,'visibilitychange',onVis);
  on(window,'resize',hideTip);
  on(window,'scroll',hideTip);
  boot();
}
function unmount(){
  GEN++;
  LIS.forEach(function(x){ x[0].removeEventListener(x[1],x[2]); }); LIS=[];
  hideTip();
  HOST=null;
}
window.SseudamCal={mount:mount,unmount:unmount,
  /* 게이트(verify-cal.mjs)가 계산 규칙을 브라우저 밖에서 대조할 수 있게 순수 함수만 내놓는다 */
  _t:{lunarToSolar:lunarToSolar,holidaysOfYear:holidaysOfYear,holidayNames:holidayNames,taxOf:taxOf,won:won}};
})();
