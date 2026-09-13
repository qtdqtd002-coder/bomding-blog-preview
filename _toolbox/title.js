/*! 쓰담 도구함 · 제목 검사기 — v1 2026-09-14
 *  index.html 「도구함」 탭이 처음 고를 때 받아 window.SseudamTools.title 로 등록한다({mount(host,api), unmount()}). 설계 근거 = BlogPreview/DESIGN.md §Toolbox
 *
 *  왜 만들었나
 *    제목 규칙은 정본에 다 있는데(봄딩 writer-playbook «현재 처방 2» ④ · 영도 feedback-log 07-24 실편집 델타)
 *    «쓰는 순간» 걸러 주는 것이 없어서, 다 쓰고 검수에 가서야 기사형 제목인 걸 알았다.
 *    이 도구는 제목을 치는 동안 ⑴각도 ⑵작성자별 금지 신호 ⑶검색 질의형인지 ⑷기존 글과 겹치는지를 즉시 보여 준다.
 *    ★판정이 아니라 «신호»다 — 막지 않는다. 최종 결정은 사람이 한다.
 *    기획 = 쓰담/docs/2026-09-13_봄딩영도_주제선정_도구지원_기획.html (B2)
 *
 *  ★작성자 격리 (이걸 어기면 한 사람의 규칙이 다른 사람 글을 망친다)
 *    봄딩 규칙과 영도 규칙은 RULES 안에서 완전히 분리돼 있고 서로 참조하지 않는다.
 *    - 봄딩 = 기사형 대시(—) 부제 금지 · 뉴스·소식형 주간 상한 · 부제는 두 번째 검색 질의(쉼표로 잇는다)
 *    - 영도 = D-n 시한부 표기 금지 · 괄호 영문 원문 병기 금지(짧은 통용 한글로)
 *    ⛔쉼표는 «영도 금지»가 아니다 — 07-24 델타 한 건만 보고 규칙으로 굳힐 뻔했으나 전수 실측은 정반대였다(영도 30.7%가 쉼표를 쓴다).
 *      그래서 실측률이 규칙을 이긴다. 아래 BASE 의 수치가 그 실측이다.
 *
 *  BASE = 라이브 실측(2026-09-14 · live-ledger.cjs 원장 · 2025-01-01 이후 봄딩 1,019편 · 영도 1,065편)
 *    두 사람 모두 제목 길이 중앙 33자 · 10편 중 9편이 45자 이하. 각 신호의 «실제 사용률»을 그대로 적어 둔다 —
 *    도구가 «하지 마라»라고만 하면 근거가 없고, 사용률을 같이 보여 주면 사람이 판단할 수 있다.
 *
 *  대조 데이터 = _trend/_live-titles.json(작성자별 라이브 제목 420편, check-published.ps1 이 갱신) + posts.json(우리 초안).
 *    겹침 판정 = 정규화 후 글자 2-gram 자카드 유사도(check-published.ps1 의 bigram 매칭과 같은 방식).
 */
(function(){
"use strict";
window.SseudamTools=window.SseudamTools||{};
if(window.SseudamTools.title)return;

var BASE=(function(){ var s=document.currentScript, u=(s&&s.src)||'_toolbox/title.js'; return u.replace(/\?.*$/,'').replace(/[^\/]*$/,'').replace(/_toolbox\/$/,''); })();
var LS='sseudam_title_v1';
var SIM_MIN=.34, SIM_SHOW=4;

/* ── 각도 사다리 — angle-mix.py 부록 A · live-ledger.cjs 와 같은 이식본(분류가 어긋나면 주간 판정과 숫자가 달라진다) ── */
var LADDER=[
  ['공략·방법형', /하는 ?법|방법|공략|위치|얻는 ?법|만드는 ?법|세팅|스킬트리|조합|루트|파밍|재료|퀘스트|보는 ?법|설정|설치|사용법|치트|명령어|염색코드|코디|기댓값|확률/],
  ['쿠폰형', /쿠폰|코드/],
  ['추천·티어·비교형', /티어|추천|순위|BEST|TOP|비교|뭐가 다를|차이/i],
  ['후기·리뷰형', /후기|리뷰|사용기|써본|첫인상/],
  ['뉴스·소식형', /출시|사전예약|사전 예약|발표|공개|업데이트|패치|콜라보|이벤트|일정|중단|확정|출시일|정식|소식|근황|생중계|응모/],
  ['정리·모음형', /총정리|정리|가이드|모음|링크|사이트/]
];
function angleOf(t){ for(var i=0;i<LADDER.length;i++) if(LADDER[i][1].test(t)) return LADDER[i][0]; return '기타'; }

/* 검색 질의형 = 독자가 검색창에 치는 «행위/조건» 말이 들어 있나 (writer-playbook 봄딩 처방2 ①) */
/* «~는 법»은 종류가 많다(하는·얻는·받는·올리는·키우는·여는 …) — 사다리는 몇 개만 열거하지만 이 신호는 형태로 잡는다.
   ★사다리(LADDER)는 건드리지 않는다: angle-mix.py 와 숫자가 어긋나면 주간 판정이 무의미해진다. 이건 별개 신호다. */
var QUERYISH=/[가-힣]{1,5}는 ?법|공략|위치|조건|비용|가격|추천|순위|티어|쿠폰|재료|세팅|조합|확률|기댓값|차이|비교|정리|방법|뜻|의미|언제|어디/;
var DASH=/\s[—–]\s|—|\s-\s/;            /* 기사형 대시 부제 — angle-mix.py 의 DASH 와 같은 자리 */
var DN=/\bD[-‑–]\s?\d+/i;                /* D-7 같은 시한부 표기 */
var ENGP=/\([A-Za-z0-9][A-Za-z0-9 .:'&\/-]{2,}\)/;   /* 괄호 안 영문 원문 병기 */
var EXPW=/해보니|해봤|직접|써본|써보니|플레이해|가봤|먹어봤|당해|겪어|실패|성공했/;

/* ── 작성자 정본 ─────────────────────────────────────────────────────────
   rules[] 항목 = {id, kind:'bad'|'warn'|'ok'|'info', test(ctx)→bool, label, why, hint?}
   kind 는 «그 신호가 걸렸을 때»의 등급이다. why 에는 반드시 근거(정본 위치 + 실측률)를 적는다. */
var RULES={
  '봄딩':{
    ac:'var(--w-bomding)', id:'bomding',
    base:{n:1019, median:33, p90:45, dash:3.3, comma:21.2, q:4.5, exp:5.1},
    rules:[
      {id:'dash', kind:'bad',
        test:function(c){ return DASH.test(c.t); },
        label:'기사형 대시(—) 부제',
        why:'봄딩 라이브 제목의 3.3%만 쓴다. 우리 초안은 16.5%로 거꾸로 갔다(2026-09-13 각도 실측).',
        hint:'부제는 두 번째 검색 질의로 — 대시 대신 쉼표로 잇는다. 예) 「아이온2 인장 제작 재료 공략, 키나 비용 투력 상승까지」'},
      {id:'news', kind:'warn',
        test:function(c){ return c.angle==='뉴스·소식형'; },
        label:'뉴스·소식형 각도',
        why:'주간 발주 기준 뉴스·소식형 ≤10%(writer-playbook 봄딩 «현재 처방 2» ①). 브리핑이 안 뜨는 질의가 많다.',
        hint:'소식을 how-to 로 뒤집는다 — 콜라보 발표→「○○ 얻는 법·조건」 · 패치→「바뀐 것 + 대응 세팅」 · 출시→「출시일·가격 + 사전예약 보상 받는 법」. 뒤집을 how-to 가 없으면 발주하지 않는다.'},
      {id:'query', kind:'ok',
        test:function(c){ return QUERYISH.test(c.t); },
        label:'검색 질의형',
        why:'독자가 검색창에 치는 말이 제목에 있다. 공략·방법·쿠폰형 주간 ≥50% 가 목표.'}
    ]
  },
  '영도':{
    ac:'var(--w-yeongdo)', id:'yeongdo',
    base:{n:1065, median:33, p90:44, dash:0.9, comma:30.7, q:2.6, exp:10.9},
    rules:[
      {id:'dn', kind:'bad',
        test:function(c){ return DN.test(c.t); },
        label:'D-n 시한부 표기',
        why:'라이브 제목의 0.1%뿐이다. 주인장이 실제로 지운 자리(feedback-log 2026-07-24 헤일로 델타) — 발행 시점이 지나면 곧장 낡는다.',
        hint:'남은 날짜 대신 무엇을 하는지로. 예) 「… 출시일 D-7, 얼리액세스 언제부터?」 → 「… 출시일 얼리액세스 한국 시간 언제」'},
      {id:'engp', kind:'bad',
        test:function(c){ return ENGP.test(c.t); },
        label:'괄호 영문 원문 병기',
        why:'라이브 1.8%. 주인장은 제품·플랫폼명을 짧은 통용 한글로 눌러 쓴다(07-24 델타 2표본 — Xbox Series X|S, PC, PlayStation 5 → Xbox, PC, PS5).',
        hint:'괄호는 조건·환산에만. 부연·영문 원문은 뺀다.'},
      {id:'query', kind:'ok',
        test:function(c){ return QUERYISH.test(c.t); },
        label:'검색 질의형',
        why:'영도는 공략·방법형 비중 41%로 이미 높다(2026-09-13 진단). 이 결을 유지하는 제목.'}
    ]
  }
};
var ORDER=['봄딩','영도'];

/* ── 겹침 판정 — 정규화 + 글자 2-gram 자카드(check-published.ps1 과 같은 방식) ── */
function norm(s){ return String(s||'').toLowerCase().replace(/[\s·:：\-—–_'"’”“()\[\]{}!?.,~/|]/g,''); }
function grams(s){ var n=norm(s), g={}, i; for(i=0;i<n.length-1;i++) g[n.substr(i,2)]=1; return g; }
function sim(a,b){
  var ka=Object.keys(a), kb=Object.keys(b), i, inter=0;
  if(!ka.length||!kb.length) return 0;
  for(i=0;i<ka.length;i++) if(b[ka[i]]) inter++;
  return inter/(ka.length+kb.length-inter);
}

/* ── 상태 ───────────────────────────────────────────────────────────────── */
var api=null, root=null, mounted=false, writer='봄딩', text='', tId=0;
var DATA={live:null, draft:null, err:null, loading:false};

function save(){ try{ localStorage.setItem(LS, JSON.stringify({writer:writer, text:text})); }catch(e){} }
function load(){
  try{ var d=JSON.parse(localStorage.getItem(LS)||'{}');
    if(d && ORDER.indexOf(d.writer)>=0) writer=d.writer;
    if(d && typeof d.text==='string') text=d.text;
  }catch(e){}
}

function fetchData(){
  if(DATA.loading||DATA.live) return Promise.resolve();
  DATA.loading=true; DATA.err=null;
  var live=fetch(BASE+'_trend/_live-titles.json',{cache:'no-cache'}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  var draft=fetch(BASE+'posts.json',{cache:'no-cache'}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  return Promise.all([live,draft]).then(function(a){
    DATA.loading=false;
    DATA.live=(a[0]&&a[0].byAuthor)?a[0].byAuthor:{};
    DATA.liveAt=(a[0]&&a[0].updatedAt)?a[0].updatedAt:null;
    var p=a[1], arr=Array.isArray(p)?p:((p&&p.posts)||[]);
    var by={};
    arr.forEach(function(x){ if(!x||!x.author||!x.title)return; (by[x.author]=by[x.author]||[]).push(x.title); });
    DATA.draft=by;
    if(!a[0]) DATA.err='라이브 제목 목록을 받지 못했다 — 겹침 검사만 건너뛴다.';
    if(mounted) render();
  });
}

/* ── 평가 ───────────────────────────────────────────────────────────────── */
function evaluate(){
  var t=String(text||'').trim();
  var W=RULES[writer], out={t:t, writer:writer, len:t.length, angle:t?angleOf(t):null, signals:[], dupes:[]};
  if(!t) return out;
  var ctx={t:t, angle:out.angle};
  W.rules.forEach(function(r){ if(r.test(ctx)) out.signals.push({id:r.id, kind:r.kind, label:r.label, why:r.why, hint:r.hint}); });
  /* 길이 — 판정이 아니라 실측 대비 위치 */
  if(t.length>W.base.p90) out.signals.push({id:'len', kind:'info', label:'길다',
    why:'라이브 제목 10편 중 9편이 '+W.base.p90+'자 이하다(중앙 '+W.base.median+'자 · 표본 '+W.base.n+'편). 지금 '+t.length+'자.'});
  /* 경험 신호 — 있으면 알려만 준다. «없다»를 경고로 쓰지 않는다(경험 문장은 실제로 해본 것이 있을 때만 쓴다) */
  if(EXPW.test(t)) out.signals.push({id:'exp', kind:'info', label:'경험 신호 있음',
    why:'라이브 제목의 '+W.base.exp+'% 가 이 결이다. 본문에 실제로 해본 내용이 있을 때만 남긴다.'});

  var mine=grams(t), rows=[];
  (['live','draft']).forEach(function(src){
    var pool=(DATA[src]&&DATA[src][writer])||[];
    pool.forEach(function(x){
      var s=sim(mine, grams(x));
      if(s>=SIM_MIN) rows.push({src:src, title:x, sim:s});
    });
  });
  rows.sort(function(a,b){ return b.sim-a.sim; });
  var seen={};
  out.dupes=rows.filter(function(r){ var k=norm(r.title); if(seen[k])return false; seen[k]=1; return true; }).slice(0,SIM_SHOW);
  if(out.dupes.length) out.signals.push({id:'dup', kind:'warn', label:'비슷한 기존 글 '+out.dupes.length+'편',
    why:'같은 작성자 안에서 중복·각도 겹침을 판단한다(작성자 단위 원칙). 오른쪽 목록을 보고 각도를 벌린다.'});
  return out;
}

/* ── 그리기 ─────────────────────────────────────────────────────────────── */
var CSS=
'.ttl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,380px);gap:18px;align-items:start}'+
'@media (max-width:900px){.ttl{grid-template-columns:minmax(0,1fr)}}'+
'.ttl-l{min-width:0}.ttl-r{min-width:0}'+
'.ttl-chips{display:flex;gap:8px;margin:0 0 14px}'+
'.ttl-chip{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:var(--r-pill);border:1px solid var(--hair-2);'+
  'background:var(--surface);color:var(--ink-3);font-size:13.5px;font-weight:600;cursor:pointer;transition:color var(--t-fast) var(--e),border-color var(--t-fast) var(--e),background var(--t-fast) var(--e)}'+
'.ttl-chip .dot{width:9px;height:9px;border-radius:50%;background:currentColor;opacity:.65}'+
'.ttl-chip:hover{border-color:var(--hair-3);color:var(--ink-2)}'+
'.ttl-chip.on{color:#fff;border-color:transparent}'+
'.ttl-chip.on .dot{background:rgba(255,255,255,.85);opacity:1}'+
'.ttl-in{width:100%;box-sizing:border-box;min-height:82px;padding:16px 18px;border-radius:var(--r-core);border:1px solid var(--hair-2);background:var(--surface);'+
  'color:var(--ink);font:600 20px/1.45 inherit;letter-spacing:-.01em;resize:vertical;outline:0;word-break:keep-all}'+
/* ★포커스 링 = 2px 잍크. `.f-i:focus` 와 같은 값이다 — 1px hair-3 조합은 1.6:1 로 안 보여 09-06 에 전역 폐기됐다(DESIGN.md §Inputs). */
'.ttl-in:focus{border-color:transparent;box-shadow:0 0 0 2px var(--ink)}'+
'.ttl-in::placeholder{color:var(--seg-off);font-weight:500}'+
'.ttl-meta{display:flex;align-items:center;gap:14px;margin-top:10px;font-size:12.5px;color:var(--ink-4)}'+
'.ttl-meta b{color:var(--ink-2);font-weight:600}'+
'.ttl-ang{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:var(--r-pill);background:var(--surface-3);color:var(--ink-2);font-weight:600}'+
'.ttl-list{margin:16px 0 0;display:flex;flex-direction:column;gap:8px}'+
'.ttl-sig{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;padding:12px 14px;border-radius:var(--r-row);background:var(--surface);border:1px solid var(--hair)}'+
'.ttl-sig.bad{border-color:rgba(196,54,42,.28);background:var(--alert-weak)}'+
/* ★3단 위계(09-14 검수): bad=색면·빨강 > warn=회색면·짙은 잍크 > ok/info=흰 면·얙은 잍크.
   warn 은 «지금 확인해라»(뉴스형 각도·겹치는 글)라 ok/info 와 같은 무게로 보이면 안 된다.
   새 색을 만들지 않고 기존 토큰의 «면 농도»만 쓴다 — 도구는 사이트 색을 새로 만들지 않는다. */
'.ttl-sig.warn{background:var(--surface-3);border-color:var(--hair-2)}'+
'.ttl-sig.warn .ttl-ic,.ttl-sig.warn .lb{color:var(--ink-2)}'+
'.ttl-sig.warn .wy{color:var(--ink-3)}'+
'.ttl-sig .ttl-ic{width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:var(--ink-4)}'+
'.ttl-sig.bad .ttl-ic,.ttl-sig.bad .lb{color:var(--alert)}'+
'.ttl-sig .ttl-ic svg{width:16px;height:16px}'+
'.ttl-sig .lb{font-size:14px;font-weight:600;color:var(--ink);margin-bottom:3px}'+
'.ttl-sig .wy{font-size:12.5px;line-height:1.6;color:var(--ink-3);word-break:keep-all}'+
'.ttl-sig .hn{margin-top:7px;padding-top:7px;border-top:1px dashed var(--hair-2);font-size:12.5px;line-height:1.6;color:var(--ink-2);word-break:keep-all}'+
'.ttl-empty{padding:26px 14px;text-align:center;color:var(--seg-off);font-size:13px}'+
'.ttl-card{background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-core);padding:14px 16px}'+
'.ttl-card h4{margin:0 0 10px;font-size:12.5px;font-weight:600;color:var(--ink-4);letter-spacing:.02em}'+
'.ttl-dup{display:block;padding:9px 0;border-top:1px solid var(--hair)}'+
'.ttl-dup:first-of-type{border-top:0}'+
'.ttl-dup .tt{font-size:13px;line-height:1.55;color:var(--ink);word-break:keep-all}'+
'.ttl-dup .mt{margin-top:4px;font-size:11.5px;color:var(--ink-4);display:flex;gap:8px;align-items:center}'+
'.ttl-dup .sc{font-variant-numeric:tabular-nums}'+
'.ttl-tag{display:inline-flex;height:18px;align-items:center;padding:0 7px;border-radius:var(--r-pill);background:var(--surface-3);color:var(--ink-3);font-size:11px;font-weight:600}'+
'.ttl-bar{display:flex;gap:8px;margin-top:14px}'+
'.ttl-btn{height:34px;padding:0 14px;border-radius:var(--r-pill);border:1px solid var(--hair-2);background:var(--surface);color:var(--ink-2);font-size:13px;font-weight:600;cursor:pointer}'+
'.ttl-btn:hover{border-color:var(--hair-3);color:var(--ink)}'+
'.ttl-note{margin-top:12px;font-size:11.5px;line-height:1.6;color:var(--ink-4);word-break:keep-all}';

/* 사이트의 svg(name) 를 쓴다 — api.icon 은 <svg> 껍데기 없이 path 만 준다(2026-09-14 실측: 아이콘 칸이 비어 보였다) */
function ic(name){ return (api&&api.svg)?api.svg(name):''; }
function esc(s){ return (api&&api.esc)?api.esc(s):String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

function html(){
  var chips=ORDER.map(function(n){
    var on=n===writer, ac=RULES[n].ac;
    return '<button type="button" class="ttl-chip'+(on?' on':'')+'" data-w="'+esc(n)+'"'+
      (on?' style="background:'+ac+'"':' style="color:'+ac+'"')+'><span class="dot"></span>'+esc(n)+'</button>';
  }).join('');
  return '<div class="ttl">'+
    '<div class="ttl-l">'+chips+
      '<textarea class="ttl-in" id="ttlIn" rows="2" spellcheck="false" placeholder="제목을 여기에">'+esc(text)+'</textarea>'+
      '<div class="ttl-meta" id="ttlMeta"></div>'+
      '<div class="ttl-list" id="ttlList"></div>'+
      '<div class="ttl-bar"><button type="button" class="ttl-btn" id="ttlCopy">제목 복사</button>'+
        '<button type="button" class="ttl-btn" id="ttlClear">지우기</button></div>'+
    '</div>'+
    '<div class="ttl-r"><div class="ttl-card"><h4>비슷한 기존 글</h4><div id="ttlDup"></div>'+
      '<div class="ttl-note" id="ttlSrc"></div></div></div>'+
  '</div>';
}

function render(){
  if(!root) return;
  var r=evaluate(), W=RULES[writer];
  var meta=document.getElementById('ttlMeta'), list=document.getElementById('ttlList'),
      dup=document.getElementById('ttlDup'), src=document.getElementById('ttlSrc');
  if(!meta) return;

  meta.innerHTML = r.t
    ? '<span class="ttl-ang">'+esc(r.angle)+'</span><span><b>'+r.len+'</b>자</span>'+
      '<span>라이브 중앙 '+W.base.median+'자 · 90% 가 '+W.base.p90+'자 이하</span>'
    : '';

  if(!r.t){ list.innerHTML='<div class="ttl-empty">제목을 쓰면 각도·신호·겹치는 글을 바로 보여 준다</div>'; }
  else{
    var order={bad:0, warn:1, ok:2, info:3};
    var sigs=r.signals.slice().sort(function(a,b){ return order[a.kind]-order[b.kind]; });
    list.innerHTML = sigs.length ? sigs.map(function(s){
      var icon = s.kind==='bad'?'alertTri' : s.kind==='warn'?'alert' : s.kind==='ok'?'check' : 'info';
      return '<div class="ttl-sig '+s.kind+'"><span class="ttl-ic">'+ic(icon)+'</span><div>'+
        '<div class="lb">'+esc(s.label)+'</div><div class="wy">'+esc(s.why)+'</div>'+
        (s.hint?'<div class="hn">'+esc(s.hint)+'</div>':'')+'</div></div>';
    }).join('') : '<div class="ttl-empty">걸리는 신호가 없다</div>';
  }

  dup.innerHTML = r.dupes.length ? r.dupes.map(function(d){
    return '<div class="ttl-dup"><div class="tt">'+esc(d.title)+'</div>'+
      '<div class="mt"><span class="ttl-tag">'+(d.src==='live'?'라이브':'초안')+'</span>'+
      '<span class="sc">겹침 '+Math.round(d.sim*100)+'%</span></div></div>';
  }).join('') : '<div class="ttl-empty">'+(r.t?'없다':'—')+'</div>';

  src.textContent = DATA.err ? DATA.err
    : (DATA.live ? ('라이브 '+((DATA.live[writer]||[]).length)+'편 · 초안 '+(((DATA.draft||{})[writer]||[]).length)+'편 대조'
        +(DATA.liveAt?' · 갱신 '+DATA.liveAt.slice(0,10):'')) : '대조 자료 받는 중');
}

function bind(){
  var inp=document.getElementById('ttlIn');
  inp.addEventListener('input', function(){
    text=inp.value; save();
    clearTimeout(tId); tId=setTimeout(render, 140);
  });
  root.querySelectorAll('.ttl-chip').forEach(function(b){
    b.addEventListener('click', function(){
      var w=b.getAttribute('data-w');
      if(w===writer) return;
      writer=w; save(); root.innerHTML=html(); bind(); render();
      document.getElementById('ttlIn').focus();
    });
  });
  document.getElementById('ttlCopy').addEventListener('click', function(){
    var t=String(text||'').trim();
    if(!t){ api&&api.toast&&api.toast('제목이 비어 있다'); return; }
    var done=function(){ api&&api.toast&&api.toast('제목을 복사했다'); };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
    else{ var ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select();
          try{ document.execCommand('copy'); }catch(e){} document.body.removeChild(ta); done(); }
  });
  document.getElementById('ttlClear').addEventListener('click', function(){
    text=''; save(); document.getElementById('ttlIn').value=''; render(); document.getElementById('ttlIn').focus();
  });
}

function mount(host,a){
  api=a; root=host; mounted=true;
  if(!document.getElementById('ttlCss')){ var st=document.createElement('style'); st.id='ttlCss'; st.textContent=CSS; document.head.appendChild(st); }
  load();
  host.innerHTML=html();
  bind(); render();
  fetchData();
}
function unmount(){
  mounted=false; clearTimeout(tId); tId=0; root=null; api=null;
}

window.SseudamTools.title={
  mount:mount, unmount:unmount,
  __test:{
    state:function(){ var r=evaluate(); return {writer:writer, text:text, len:r.len, angle:r.angle,
      signals:r.signals.map(function(s){ return {id:s.id, kind:s.kind}; }), dupes:r.dupes.length,
      loaded:!!DATA.live, live:(DATA.live&&(DATA.live[writer]||[]).length)||0}; },
    set:function(w,t){ if(ORDER.indexOf(w)>=0) writer=w; text=String(t==null?'':t);
      if(root){ root.innerHTML=html(); bind(); } render(); return this.state?null:null; },
    rules:function(){ var o={}; ORDER.forEach(function(n){ o[n]=RULES[n].rules.map(function(r){ return r.id; }); }); return o; },
    angleOf:angleOf, sim:function(a,b){ return sim(grams(a),grams(b)); }
  }
};
})();
