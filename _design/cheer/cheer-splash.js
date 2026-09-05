/* ══════════════════════════════════════════════════════════════════
   쓰담 — 축하 스플래시 「봄딩 · 네이버 메이트 2026.09」  (2026-09-04 · v2 «빵빠레» 09-05 · v2.1 «5초 판» 09-05)

   무엇  : 사이트에 «접속»했을 때 약 5초, 봄딩의 네이버 메이트 선정을 축하하는 화면을 띄운 뒤
           원형 조리개(iris)로 열리며 사이트를 드러낸다. 그동안 사이트는 뒤에서 그대로 부팅한다.
   어디  : index.html <body> 첫 줄에 동기 <script src> 한 줄 — 이 파일이 스타일·마크업·모션을 전부 스스로 넣는다.
           걷어낼 땐 그 한 줄만 지우면 된다(사이트 코드에 다른 흔적 없음).
   언제  : 세션당 1회(sessionStorage). 재생 = ?cheer=1 · 강제 끔 = ?cheer=0 · CFG.until 지나면 자동 종료.
   길이  : 진입 ≈0.15s + hold 4.0s + 퇴장 0.85s ≈ 5.0s. 데이터가 늦으면 maxWait(5.8s)까지 기다렸다가 걷힌다(최대 ≈6.7s).
   안무  : 0.0 플라크·봄딩 → 0.3 헤드라인 글자 슬램(blur 8→0) → ★0.95 빅 비트(화면 플래시·블룸·충격파 링 2·방사 버스트·
           코너 캐논 2발+스트리머+머즐·플라크 킥) → 1.15 영도 비행 진입 → 1.5 봄딩 «기뻐서 뛰기» 루프 → 1.45~3.75 불꽃 7발 →
           1.8 «축하해요!» / 3.3 «정말 멋져요!» 말풍선 → 2.55 영도 배럴롤 → 2.7 2차 볼리 → 3.0 광택 2 → 4.0 퇴장.
           바닥 3px 바 = hold 의 실제 경과(가짜 진행률 아님 — 최소 노출 타이머 그 자체).
   v2    : ① 영도가 플라크 «옆»을 타원 궤도로 날아다니며 축하(앞을 지날 땐 크게·뒤를 지날 땐 작게, 진행 방향으로 기울고
           방향을 바꿀 땐 얇아졌다 펴지는 2D 턴, 두 포즈를 0.4초마다 교대 = 날갯짓, 꼬리 반짝이, 말풍선 2연)
           ② 봄딩은 «기뻐서 뛰기» 루프(앤티시페이션 스쿼시 → 점프+포즈 교체 → 착지 스쿼시 + 하트 팝)
           ③ FX: 캔버스 2겹(뒤/앞 — 앞 겹은 플라크 위로도 떨어진다), 컨페티는 뒤집힐 때 어두운 뒷면(양면).
   모션  : GSAP(사이트가 _vendor/gsap 로 이미 벤더)이 있으면 타임라인, 없으면 같은 안무의 CSS 키프레임 폴백(FX 는 자체 rAF 라 폴백에서도 터진다).
           «반드시 걷힌다» — 데이터 준비(#view 스켈레톤 소멸 +380ms) 뒤에만 걷히되 maxWait 백스톱 + JS 가 죽어도
           CSS 애니메이션(cheerDead)이 7.5초에 강제로 숨긴다. 스플래시는 화면을 통째로 가리므로 걷히지 않는 실패 모드 = 서비스 중단이다.
   FX    : 의존성 없는 Canvas 2D 파티클(컨페티 리본·원·하트·별 / 스파크(잔상선) / 스트리머(물결 폴리라인) / 링 / 트윙클 / 플래시선).
           DOM 노드 0개, 상한 데스크톱 1100·모바일 550.
   자산  : bomding-mate(기본)·bomding-jump(점프 포즈) / yeongdo-fly-a·b(비행 두 포즈) = 나노바나나(Gemini 2.5 Flash Image)로
           각 아바타를 -Ref 로 잡아 생성 → 배경 키잉·트림(nb_post.py) → 포즈 쌍은 같은 캔버스에 하단 중앙 정렬(pair_align.py).
           B 포즈 파일이 없으면 A 한 장으로만 움직인다(onerror 처리). 실제 게임 콘텐츠가 아닌 사이트 디자인 자산이라 생성 허용 범위.
   규칙  : 색은 정체성에만(봄딩 --w-bomding · 영도 --w-yeongdo · 네이버 그린) · 이중 베젤 · Pretendard 800 · 라벨 ≥12.5px ·
           바운스/엘라스틱 이징 없음(펀치는 «크게서 작게 expo.out»으로) · transform/opacity 위주(조리개 mask·퇴장 blur 1회만 예외) ·
           모션은 항상 켬(OS reduce-motion 미준수 — 사이트 결정 09-04와 동일).
   ══════════════════════════════════════════════════════════════════ */
(function(){
"use strict";

var CFG={
  key:'sseudam_cheer_202609',   /* 세션당 1회 */
  until:'2026-10-04',           /* 이 날(KST) 지나면 자동 종료 — 상수 하나로 연장·단축 */
  hold:4000,                    /* 안무 시작 후 최소 노출(ms). 진입 0.15 + 이것 + 퇴장 0.85 ≈ 총 5.0초 */
  maxWait:5800,                 /* 하드 백스톱(ms, 스크립트 시작 기준): 데이터가 영영 안 와도 걷힌다. hold 보다 커야 한다 */
  img:'_design/cheer/bomding-mate',      /* 봄딩 기본 포즈 */
  imgB:'_design/cheer/bomding-jump',     /* 봄딩 점프 포즈(없으면 기본만) */
  fly:'_design/cheer/yeongdo-fly-a',     /* 영도 비행 포즈 A */
  flyB:'_design/cheer/yeongdo-fly-b',    /* 영도 비행 포즈 B(날갯짓 교대, 없으면 A만) */
  title:'봄딩의 네이버 메이트 선정을 축하합니다!',
  who:'봄딩',                   /* title 안에서 정체성 색을 입힐 낱말 */
  kicker:'네이버 메이트 · 2026년 9월',
  sub:'당신의 글쓰기 동료, 쓰담 드림',
  say:'축하해요!',              /* 영도 말풍선 1 */
  say2:'정말 멋져요!'           /* 영도 말풍선 2 */
};

/* ── 0. 띄울지 결정 ── */
var q=location.search;
if(/[?&]cheer=(0|off)\b/.test(q))return;
var force=/[?&]cheer=(1|on)\b/.test(q);
if(!force){
  var until=Date.parse(CFG.until+'T23:59:59+09:00');
  if(isFinite(until)&&Date.now()>until)return;
  try{ if(sessionStorage.getItem(CFG.key))return; }catch(e){}
}
try{ sessionStorage.setItem(CFG.key,'1'); }catch(e){}

/* ── 1. 스타일 (사이트 토큰 실값을 그대로 — 파일 하나로 자립) ── */
var CSS=[
'.cheer{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:24px;overflow:hidden;',   /* 스플래시 층: 모달 95·토스트 90 위 */
'  background:#EFF0F2;color:#0E1114;touch-action:none;overscroll-behavior:contain;cursor:default;',
'  font-family:"Pretendard Variable",Pretendard,system-ui,sans-serif;letter-spacing:-.011em;',
'  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;',
'  --e:cubic-bezier(.32,.72,0,1);--r:0px;',
'  animation:cheerDead 1ms linear 7.5s forwards}',                                                      /* JS 가 죽어도 반드시 걷힌다 */
'.cheer::before{content:"";position:absolute;inset:0;pointer-events:none;background:',
'  radial-gradient(900px 520px at 12% -10%,rgba(255,255,255,.9),transparent 60%),',
'  radial-gradient(760px 480px at 96% 4%,rgba(255,255,255,.7),transparent 62%)}',
'.cheer-bloom{position:absolute;left:50%;top:50%;width:1100px;height:760px;margin:-380px 0 0 -550px;z-index:0;pointer-events:none;opacity:.3;',   /* 플라크 뒤 광원 — 빅 비트에 터지고 숨 쉰다 */
'  background:radial-gradient(closest-side,rgba(196,61,99,.17),rgba(3,199,90,.06) 56%,transparent 72%)}',
'.cheer.iris{-webkit-mask-image:radial-gradient(circle at 50% 50%,transparent var(--r),#000 calc(var(--r) + 36px));',   /* 조리개 가장자리는 36px 페더 */
'  mask-image:radial-gradient(circle at 50% 50%,transparent var(--r),#000 calc(var(--r) + 36px))}',
'.cheer-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
'.cheer-fx.back{z-index:0}.cheer-fx.front{z-index:2}',
'.cheer-flash{position:absolute;inset:0;z-index:3;background:#fff;opacity:0;pointer-events:none}',
'.cheer-bar{position:absolute;left:0;right:0;bottom:0;height:3px;z-index:4;background:#C43D63;opacity:.7;transform:scaleX(0);transform-origin:0 50%;pointer-events:none}',   /* 최소 노출 타이머(실제 경과) */
'.cheer-stage{position:relative;z-index:1;width:min(660px,100%);margin-top:72px;will-change:transform}',
'.cheer-tray{position:relative;z-index:1;background:linear-gradient(180deg,#E5E7EB 0%,#DFE2E6 100%);border-radius:24px;padding:6px;',
'  box-shadow:0 0 0 1px rgba(14,17,20,.07),0 2px 6px rgba(14,17,20,.06),0 20px 48px -18px rgba(14,17,20,.20),0 60px 110px -50px rgba(14,17,20,.24)}',
'.cheer-core{position:relative;background:#fff;border-radius:18px;padding:118px 40px 34px;text-align:center;',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 1px rgba(14,17,20,.05)}',
'.cheer-badge{position:absolute;left:50%;top:-100px;width:210px;height:210px;margin-left:-105px;z-index:2;pointer-events:none}',
'.cheer-badge img,.cheer-fly img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;',
'  transition:opacity 90ms linear}',
'.cheer-badge img{filter:drop-shadow(0 10px 18px rgba(14,17,20,.14)) drop-shadow(0 1px 2px rgba(14,17,20,.08))}',
'.cheer-badge img.alt,.cheer-fly img.alt{opacity:0}',
'.cheer-badge.b img{opacity:0}.cheer-badge.b img.alt{opacity:1}',
'.cheer-fly.b img{opacity:0}.cheer-fly.b img.alt{opacity:1}',
'.cheer-shine{position:absolute;inset:0;pointer-events:none;overflow:hidden;',
'  -webkit-mask:var(--mask) center/contain no-repeat;mask:var(--mask) center/contain no-repeat}',          /* 마스크(스티커 실루엣)는 고정 */
'.cheer-shine i{position:absolute;top:-25%;bottom:-25%;left:0;width:100%;transform:translateX(-130%);',
'  background:linear-gradient(112deg,transparent 42%,rgba(255,255,255,.78) 50%,transparent 58%)}',       /* 띠만 스티커 밑을 지나간다 */
/* 영도 — 스테이지 중심에 앵커, GSAP(또는 CSS 궤도)이 translate 로 옮긴다. 뒤를 지날 땐 z 0(트레이 뒤), 앞을 지날 땐 z 3 */
'.cheer-fly{position:absolute;left:50%;top:50%;width:236px;height:236px;margin:-118px 0 0 -118px;z-index:0;pointer-events:none;will-change:transform}',
'.cheer-fly.front{z-index:3}',
'.cheer-fly img{filter:drop-shadow(0 8px 14px rgba(14,17,20,.16))}',
'.cheer-say{position:absolute;left:50%;top:50%;z-index:4;display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px 0 10px;',
'  border-radius:999px;background:#fff;color:#0E1114;font-size:13.5px;font-weight:700;letter-spacing:-.02em;white-space:nowrap;pointer-events:none;',
'  box-shadow:0 0 0 1px rgba(14,17,20,.07),0 6px 18px -8px rgba(14,17,20,.22);opacity:0;transform-origin:0 100%}',
'.cheer-say::after{content:"";position:absolute;left:12px;bottom:-4px;width:9px;height:9px;background:#fff;transform:rotate(45deg);',   /* 말꼬리 */
'  box-shadow:1px 1px 0 0 rgba(14,17,20,.07)}',
'.cheer-say.l::after{left:auto;right:12px}',
'.cheer-say i{width:8px;height:8px;border-radius:50%;background:#0F7C86;flex:none}',                     /* 영도 = --w-yeongdo */
'.cheer-k{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 13px 0 11px;border-radius:999px;',
'  background:#F6F7F9;color:#494F57;font-size:13px;font-weight:600;letter-spacing:-.01em;',
'  box-shadow:0 0 0 1px rgba(14,17,20,.07)}',
'.cheer-k i{width:8px;height:8px;border-radius:50%;background:#03C75A;box-shadow:0 0 0 0 rgba(3,199,90,.45);flex:none}',
'.cheer-h{margin:18px 0 0;font-size:clamp(28px,4.2vw,44px);font-weight:800;line-height:1.18;letter-spacing:-.03em;',
'  color:#0E1114;text-wrap:balance;word-break:keep-all;will-change:filter}',
'.cheer-h .cw{display:inline-block;white-space:nowrap}',
'.cheer-h .cc{display:inline-block}',
'.cheer-h .who .cc{color:#C43D63}',                                                                        /* 봄딩 = --w-bomding (정체성 색) */
'.cheer-sub{margin:14px 0 0;font-size:14.5px;font-weight:500;color:#5F666F;letter-spacing:-.01em}',
'.cheer-skip{position:absolute;z-index:4;right:max(22px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));',
'  display:inline-flex;align-items:center;gap:9px;height:36px;padding:0 10px 0 14px;border-radius:999px;',
'  background:#fff;color:#494F57;font:inherit;font-size:13px;font-weight:600;letter-spacing:-.01em;border:0;cursor:pointer;',
'  box-shadow:0 0 0 1px rgba(14,17,20,.07),0 1px 2px rgba(14,17,20,.04),0 6px 18px -10px rgba(14,17,20,.10);',
'  transition:transform 220ms var(--e),color 220ms var(--e)}',
'.cheer-skip:hover{color:#0E1114;transform:translateY(-1px)}',
'.cheer-skip:active{transform:translateY(0) scale(.98)}',
'.cheer-skip:focus-visible{outline:2px solid #0E1114;outline-offset:2px}',
'.cheer-skip kbd{font:inherit;font-size:12.5px;font-weight:600;color:#6C737C;padding:1px 7px;border-radius:6px;',
'  box-shadow:0 0 0 1px rgba(14,17,20,.13)}',
/* 시작 전엔 전부 감춤 — GSAP 이 fromTo 로 잡거나, CSS 폴백 키프레임이 both 로 채운다 */
'.cheer.pre .cheer-tray,.cheer.pre .cheer-badge,.cheer.pre .cheer-k,.cheer.pre .cc,.cheer.pre .cheer-sub,.cheer.pre .cheer-skip,.cheer.pre .cheer-fly{opacity:0}',
/* CSS 폴백(GSAP 없을 때) — 같은 안무, 같은 무게 */
'.cheer.css .cheer-tray{animation:cheerUp .85s var(--e) both,cheerKick .6s var(--e) .97s}',
'.cheer.css .cheer-badge{animation:cheerUp .8s var(--e) .1s both,cheerHop 1.15s var(--e) 1.5s infinite}',
'.cheer.css .cheer-k{animation:cheerUp .5s var(--e) .24s both}',
'.cheer.css .cheer-k i{animation:cheerPulse 1.4s ease-out .95s infinite}',
'.cheer.css .cc{animation:cheerUp .65s var(--e) both;animation-delay:calc(.32s + var(--i) * .026s)}',
'.cheer.css .cheer-sub{animation:cheerUp .5s var(--e) 1.05s both}',
'.cheer.css .cheer-skip{animation:cheerFade .4s var(--e) .6s both}',
'.cheer.css .cheer-shine i{animation:cheerShine .8s cubic-bezier(.45,0,.2,1) .5s both,cheerShine .8s cubic-bezier(.45,0,.2,1) 3s both}',
'.cheer.css .cheer-fly{animation:cheerFade .3s var(--e) 1.15s both,cheerOrbit 2.9s linear 1.15s infinite}',
'.cheer.css .cheer-say{animation:cheerSay 1.4s var(--e) 1.8s both}',
'.cheer.css .cheer-flash{animation:cheerFlash .38s var(--e) .95s both}',
'.cheer.css .cheer-bloom{animation:cheerBloom 1.1s var(--e) .95s both}',
'.cheer.css .cheer-bar{animation:cheerBar 4s linear .15s forwards}',
'.cheer.css.out{animation:cheerOut .5s var(--e) forwards,cheerDead 1ms linear 7.5s forwards}',
'@keyframes cheerUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}',
'@keyframes cheerFade{from{opacity:0}to{opacity:1}}',
'@keyframes cheerShine{from{transform:translateX(-130%)}to{transform:translateX(130%)}}',
'@keyframes cheerKick{from{transform:scale(1.04)}to{transform:none}}',
'@keyframes cheerPulse{from{box-shadow:0 0 0 0 rgba(3,199,90,.45)}60%,to{box-shadow:0 0 0 10px rgba(3,199,90,0)}}',
'@keyframes cheerHop{0%,100%{transform:none}12%{transform:scale(1.06,.93)}38%{transform:translateY(-26px) scale(.96,1.06)}62%{transform:none}72%{transform:scale(1.04,.95)}}',
'@keyframes cheerOrbit{0%{transform:translate(-386px,20px) scale(.9)}25%{transform:translate(0,300px) scale(1)}50%{transform:translate(386px,20px) scale(.9)}75%{transform:translate(0,-256px) scale(.78)}100%{transform:translate(-386px,20px) scale(.9)}}',
'@keyframes cheerSay{0%{opacity:0;transform:translate(120px,-120px) scale(.8)}12%,88%{opacity:1;transform:translate(120px,-120px) scale(1)}100%{opacity:0;transform:translate(120px,-120px) scale(.9)}}',
'@keyframes cheerFlash{0%{opacity:0}16%{opacity:.55}100%{opacity:0}}',
'@keyframes cheerBloom{0%{opacity:.3}10%{opacity:1}100%{opacity:.55}}',
'@keyframes cheerBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
'@keyframes cheerOut{to{opacity:0}}',
'@keyframes cheerDead{to{visibility:hidden;opacity:0;pointer-events:none}}',
'@media (max-width:600px){',
'  .cheer{padding:16px}.cheer-stage{margin-top:60px}',
'  .cheer-badge{width:164px;height:164px;margin-left:-82px;top:-82px}',
'  .cheer-fly{width:150px;height:150px;margin:-75px 0 0 -75px}',
'  .cheer-bloom{width:700px;height:620px;margin:-310px 0 0 -350px}',
'  .cheer-core{padding:96px 22px 26px}.cheer-h{font-size:27px}.cheer-sub{font-size:13.5px}',
'  @keyframes cheerOrbit{0%{transform:translate(-222px,20px) scale(.9)}25%{transform:translate(0,240px)}50%{transform:translate(222px,20px) scale(.9)}75%{transform:translate(0,-210px) scale(.78)}100%{transform:translate(-222px,20px) scale(.9)}}}',
'@media (max-height:600px){',
'  .cheer-stage{margin-top:44px}.cheer-badge{width:136px;height:136px;margin-left:-68px;top:-64px}',
'  .cheer-core{padding:80px 28px 24px}.cheer-h{font-size:clamp(24px,3.6vw,34px);margin-top:12px}.cheer-sub{margin-top:10px}}'
].join('\n');

function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* 제목을 «어절(inline-block, 줄바꿈 단위) › 글자(span)» 로 쪼갠다 — keep-all 을 지키며 글자별 등장 */
function splitTitle(s,who){
  var i=0, words=s.split(' '), out='';
  words.forEach(function(w,wi){
    out+='<span class="cw'+(w.indexOf(who)===0?' who':'')+'">';
    Array.from(w).forEach(function(ch){ out+='<span class="cc" style="--i:'+(i++)+'">'+esc(ch)+'</span>'; });
    out+='</span>';
    if(wi<words.length-1)out+=' ';
  });
  return out;
}
function pic(base,id,cls){
  return '<picture><source srcset="'+base+'.webp" type="image/webp">'+
         '<img id="'+id+'" class="'+cls+'" src="'+base+'.png" alt="" decoding="async"></picture>';
}

var HTML=
'<div class="cheer pre" id="cheer" role="dialog" aria-modal="true" aria-label="'+esc(CFG.title)+'">'+
  '<div class="cheer-bloom" id="cheerBloom" aria-hidden="true"></div>'+
  '<canvas class="cheer-fx back" id="cheerFxB" aria-hidden="true"></canvas>'+
  '<div class="cheer-stage" id="cheerStage">'+
    '<div class="cheer-fly" id="cheerFly" aria-hidden="true">'+pic(CFG.fly,'cheerFlyA','')+pic(CFG.flyB,'cheerFlyB','alt')+'</div>'+
    '<div class="cheer-say" id="cheerSay" aria-hidden="true"><i></i>'+esc(CFG.say)+'</div>'+
    '<div class="cheer-badge" id="cheerBadge" aria-hidden="true">'+
      pic(CFG.img,'cheerImg','')+pic(CFG.imgB,'cheerImgB','alt')+
      '<span class="cheer-shine" style="--mask:url(&quot;'+CFG.img+'.png&quot;)"><i id="cheerShine"></i></span>'+
    '</div>'+
    '<div class="cheer-tray" id="cheerTray"><div class="cheer-core">'+
      '<p class="cheer-k" id="cheerK"><i id="cheerDot" aria-hidden="true"></i>'+esc(CFG.kicker)+'</p>'+
      '<h1 class="cheer-h" id="cheerH" aria-label="'+esc(CFG.title)+'"><span aria-hidden="true">'+splitTitle(CFG.title,CFG.who)+'</span></h1>'+
      '<p class="cheer-sub" id="cheerSub">'+esc(CFG.sub)+'</p>'+
    '</div></div>'+
  '</div>'+
  '<canvas class="cheer-fx front" id="cheerFxF" aria-hidden="true"></canvas>'+
  '<div class="cheer-flash" id="cheerFlash" aria-hidden="true"></div>'+
  '<div class="cheer-bar" id="cheerBar" aria-hidden="true"></div>'+
  '<button class="cheer-skip" id="cheerSkip" type="button">건너뛰기 <kbd>Esc</kbd></button>'+
'</div>';

/* ── 2. 즉시 주입 — <body> 첫 자식이라 첫 페인트부터 사이트를 덮는다 ── */
var st=document.createElement('style'); st.id='cheerCss'; st.textContent=CSS;
document.head.appendChild(st);
var cs=document.currentScript;
if(cs&&cs.parentNode)cs.insertAdjacentHTML('afterend',HTML);
else document.body.insertAdjacentHTML('afterbegin',HTML);

var root=document.getElementById('cheer'); if(!root)return;
var $=function(id){ return document.getElementById(id); };
var stage=$('cheerStage'), tray=$('cheerTray'), badge=$('cheerBadge'), img=$('cheerImg'), imgB=$('cheerImgB'), shine=$('cheerShine'),
    kick=$('cheerK'), dot=$('cheerDot'), h=$('cheerH'), sub=$('cheerSub'), skip=$('cheerSkip'),
    fly=$('cheerFly'), flyA=$('cheerFlyA'), flyB=$('cheerFlyB'), say=$('cheerSay'), flash=$('cheerFlash'),
    bloom=$('cheerBloom'), bar=$('cheerBar'), cvB=$('cheerFxB'), cvF=$('cheerFxF');
var chars=root.querySelectorAll('.cc');
var hasB=true, hasFlyB=true;                 /* B 포즈 파일이 없으면 A 한 장으로만 움직인다 */
imgB.addEventListener('error',function(){ hasB=false; });
flyB.addEventListener('error',function(){ hasFlyB=false; });

var t0=performance.now(), gsapRef=null, tl=null, hopTl=null, orbTw=null, sayTl=null, floatTw=null, bloomTw=null,
    playedAt=0, ready=false, gone=false, exiting=false, timers=[], DBG=[];
function dbg(m){ DBG.push(Math.round(performance.now()-t0)+'ms '+m); }
function later(fn,ms){ var id=setTimeout(fn,ms); timers.push(id); return id; }
function mobile(){ return window.innerWidth<600; }
function setSay(text){ say.lastChild.nodeValue=text; }

/* ── 3. FX 엔진 — Canvas 2D 파티클 2겹(뒤/앞), 의존성 0 ── */
var FX=(function(){
  var xb=cvB.getContext('2d'), xf=cvF.getContext('2d');
  var P=[], W=0, H=0, dpr=1, raf=0, last=0, on=false, drizzle=false, frame=0, CAP=1100;
  var C=['#C43D63','#E4879F','#F3C4D0','#03C75A','#8FE3B3','#FFFFFF','#D5D9DE','#0E1114'];
  var CF=['#C43D63','#E4879F','#F3C4D0','#03C75A','#8FE3B3','#FFFFFF','#BFE7EA'];        /* 앞 겹 팔레트 — 먹색 없음(흰 판 위에서 때처럼 보인다) */
  var PINK=['#C43D63','#E4879F','#F3C4D0','#FFFFFF'], GREEN=['#03C75A','#8FE3B3','#FFFFFF'], TEAL=['#0F7C86','#5FB7BF','#BFE7EA','#FFFFFF'];
  var FW=[PINK,GREEN,TEAL,['#FFFFFF','#F3C4D0','#8FE3B3']];
  var SHADE={};
  function shade(hex,k){                      /* 컨페티 뒷면(어두운 면) — 뒤집힐 때 보인다 */
    var key=hex+k; if(SHADE[key])return SHADE[key];
    var n=parseInt(hex.slice(1),16), r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    var s='rgb('+Math.round(r*k)+','+Math.round(g*k)+','+Math.round(b*k)+')'; SHADE[key]=s; return s;
  }
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function rnd(a,b){ return a+Math.random()*(b-a); }
  function size(){
    dpr=Math.min(2,window.devicePixelRatio||1); W=cvB.clientWidth; H=cvB.clientHeight; CAP=W<600?550:1100;
    [cvB,cvF].forEach(function(c){ c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); });
    xb.setTransform(dpr,0,0,dpr,0,0); xf.setTransform(dpr,0,0,dpr,0,0);
  }
  function add(p){ if(P.length<CAP)P.push(p); }
  function start(){ if(on)return; on=true; size(); last=0; raf=requestAnimationFrame(step); }
  /* 컨페티 조각: k=0 · shape 0 리본 1 원 2 하트 3 별 */
  function conf(x,y,ang,spread,speed,layer,colors,o){
    o=o||{}; var a=ang+(Math.random()-.5)*spread, s=speed*(.5+Math.random()*.75), r=Math.random(), c=pick(colors||(layer?CF:C));
    add({k:0,x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      w:(o.w||5)+Math.random()*(o.wv||7),h:(o.h||9)+Math.random()*(o.hv||9),rot:Math.random()*6.28,vr:(Math.random()-.5)*.3,
      tilt:Math.random()*6.28,vt:.12+Math.random()*.2,c:c,c2:shade(c,.74),
      shape:o.shape!=null?o.shape:(r<.6?0:r<.8?1:r<.92?2:3),
      life:1,decay:(o.decay||.0055)+Math.random()*.005,g:(o.g!=null?o.g:.2)+Math.random()*.1,layer:layer||0});
  }
  /* 스파크(잔상선) — 불꽃 */
  function spark(x,y,vx,vy,color,layer,o){
    o=o||{}; add({k:1,x:x,y:y,px:x,py:y,vx:vx,vy:vy,c:color,life:1,decay:o.decay||.016,g:o.g!=null?o.g:.045,drag:o.drag||.965,lw:o.lw||2.2,layer:layer||1});
  }
  /* 스트리머 — 물결치는 긴 리본 */
  function streamer(x,y,ang,spread,speed,layer){
    var a=ang+(Math.random()-.5)*spread, s=speed*(.6+Math.random()*.6);
    add({k:2,x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,len:rnd(70,130),amp:rnd(5,10),ph:Math.random()*6.28,vph:rnd(.22,.34),
      c:pick(['#C43D63','#E4879F','#03C75A','#8FE3B3','#FFFFFF','#0F7C86']),life:1,decay:.0045+Math.random()*.003,g:.14,layer:layer||1});
  }
  function ring(x,y,R,color,layer,dur,lw){ add({k:3,x:x,y:y,R:R,t:0,dur:dur||.55,c:color,lw:lw||4,layer:layer==null?1:layer}); }
  function twinkle(x,y,s,layer,life){ add({k:4,x:x,y:y,s:s,ph:Math.random()*6.28,t:0,life:life||1.6,layer:layer==null?1:layer,c:pick(['#FFFFFF','#F3C4D0','#8FE3B3','#BFE7EA'])}); }
  function flashline(x,y,ang,r0,len,color,layer){ add({k:5,x:x,y:y,a:ang,r0:r0,len:len,t:0,c:color,layer:layer==null?1:layer}); }
  function heart(s,ctx){
    ctx.beginPath(); ctx.moveTo(0,s*.35);
    ctx.bezierCurveTo(s*1.1,-s*.5,s*.55,-s*1.15,0,-s*.45);
    ctx.bezierCurveTo(-s*.55,-s*1.15,-s*1.1,-s*.5,0,s*.35); ctx.closePath(); ctx.fill();
  }
  function star(s,ctx){
    ctx.beginPath();
    for(var i=0;i<10;i++){ var rr=i%2?s*.45:s, a=-Math.PI/2+i*Math.PI/5; ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); }
    ctx.closePath(); ctx.fill();
  }
  function easeOut(t){ return 1-Math.pow(1-t,3); }
  function step(ts){
    var dt=last?Math.min(2.2,(ts-last)/16.67):1; last=ts; frame++;
    xb.clearRect(0,0,W,H); xf.clearRect(0,0,W,H);
    if(drizzle&&(frame%(mobile()?3:2)===0))conf(Math.random()*W,-12,Math.PI/2,.5,1.2,0,C,{g:.02,decay:.003,w:4,wv:5,h:7,hv:7});
    var keep=[];
    for(var i=0;i<P.length;i++){
      var p=P[i], ctx=p.layer?xf:xb, alive=true;
      if(p.k===0){
        p.vy+=p.g*dt; p.vx*=Math.pow(.986,dt); p.vy*=Math.pow(.992,dt);
        p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt; p.tilt+=p.vt*dt;
        if(p.vy>0)p.life-=p.decay*dt;                     /* 정점을 지나 떨어질 때부터 옅어진다 */
        if(p.life<=0||p.y>H+40){ alive=false; }
        else{
          var fl=Math.cos(p.tilt);                          /* 플러터: 얇은 종이가 뒤집히며 폭이 줄었다 는다 */
          ctx.globalAlpha=Math.min(1,p.life); ctx.fillStyle=(fl<0&&p.shape!==1)?p.c2:p.c;   /* 뒤집히면 뒷면(어두운 면) */
          ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
          if(p.shape===0){ ctx.scale(fl,1); if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(-p.w/2,-p.h/2,p.w,p.h,1.5); ctx.fill(); } else ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); }
          else if(p.shape===1){ ctx.scale(Math.abs(fl)*.6+.4,1); ctx.beginPath(); ctx.arc(0,0,p.w*.5,0,6.28); ctx.fill(); }
          else if(p.shape===2){ ctx.scale(fl,1); heart(p.w*.62,ctx); }
          else { ctx.scale(fl,1); star(p.w*.6,ctx); }
          ctx.restore();
        }
      } else if(p.k===1){
        p.px=p.x; p.py=p.y; p.vy+=p.g*dt; p.vx*=Math.pow(p.drag,dt); p.vy*=Math.pow(p.drag,dt);
        p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=p.decay*dt;
        if(p.life<=0||p.y>H+20){ alive=false; }
        else{
          ctx.globalAlpha=Math.max(0,p.life); ctx.strokeStyle=p.c; ctx.lineWidth=p.lw*(0.35+p.life*.65); ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(p.px-(p.x-p.px)*1.6,p.py-(p.y-p.py)*1.6); ctx.lineTo(p.x,p.y); ctx.stroke();
        }
      } else if(p.k===2){
        p.vy+=p.g*dt; p.vx*=Math.pow(.984,dt); p.vy*=Math.pow(.99,dt); p.x+=p.vx*dt; p.y+=p.vy*dt; p.ph+=p.vph*dt;
        if(p.vy>0)p.life-=p.decay*dt;
        if(p.life<=0||p.y>H+140){ alive=false; }
        else{
          var sp=Math.hypot(p.vx,p.vy)||.001, dx=-p.vx/sp, dy=-p.vy/sp, px2=-dy, py2=dx, seg=p.len/12;
          ctx.globalAlpha=Math.min(1,p.life); ctx.strokeStyle=p.c; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
          ctx.beginPath();
          for(var k=0;k<=12;k++){ var wob=Math.sin(p.ph+k*.8)*p.amp*(k/12); var qx=p.x+dx*k*seg+px2*wob, qy=p.y+dy*k*seg+py2*wob; if(k)ctx.lineTo(qx,qy); else ctx.moveTo(qx,qy); }
          ctx.stroke();
        }
      } else if(p.k===3){
        p.t+=dt/60/p.dur; if(p.t>=1){ alive=false; }
        else{ var e=easeOut(p.t); ctx.globalAlpha=(1-p.t)*.9; ctx.strokeStyle=p.c; ctx.lineWidth=p.lw*(1-p.t)+.6;
          ctx.beginPath(); ctx.arc(p.x,p.y,4+p.R*e,0,6.28); ctx.stroke(); }
      } else if(p.k===4){
        p.t+=dt/60; if(p.t>=p.life){ alive=false; }
        else{ var env=Math.min(1,p.t*4)*Math.min(1,(p.life-p.t)*2), sc=.5+.5*Math.sin(p.t*11+p.ph);
          ctx.globalAlpha=env; ctx.fillStyle=p.c; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.ph); star(p.s*(.35+sc*.65),ctx); ctx.restore(); }
      } else if(p.k===5){
        p.t+=dt/60/.26; if(p.t>=1){ alive=false; }
        else{ var e2=easeOut(p.t), r1=p.r0+p.len*e2*1.4, r2=r1+p.len*(1-e2)*.6;
          ctx.globalAlpha=(1-p.t); ctx.strokeStyle=p.c; ctx.lineWidth=3*(1-p.t)+.5; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(p.x+Math.cos(p.a)*r1,p.y+Math.sin(p.a)*r1); ctx.lineTo(p.x+Math.cos(p.a)*r2,p.y+Math.sin(p.a)*r2); ctx.stroke(); }
      }
      if(alive)keep.push(p);
    }
    P=keep; xb.globalAlpha=1; xf.globalAlpha=1;
    if(on)raf=requestAnimationFrame(step); else { raf=0; xb.clearRect(0,0,W,H); xf.clearRect(0,0,W,H); }
  }
  /* ── 이미터 ── */
  function cannons(k){                        /* k = 볼리 세기(1 = 본 볼리, .55 = 2차) */
    start(); k=k||1;
    var m=mobile(), n=Math.round((m?80:150)*k), sp=m?16.5:21, cx1=W*.08, cx2=W*.92, y=H+8;
    for(var i=0;i<n;i++)conf(cx1,y,-Math.PI/2+.46,.95,sp,i%3?0:1);          /* 좌하단 → 우상향 (1/3 은 앞 겹으로) */
    for(var j=0;j<n;j++)conf(cx2,y,-Math.PI/2-.46,.95,sp,j%3?0:1);          /* 우하단 → 좌상향 */
    var ns=Math.round((m?4:7)*k);
    for(var s=0;s<ns;s++){ streamer(cx1,y,-Math.PI/2+.42,.7,sp*.75,1); streamer(cx2,y,-Math.PI/2-.42,.7,sp*.75,1); }
    muzzle(cx1,H-6,-Math.PI/2+.46,k); muzzle(cx2,H-6,-Math.PI/2-.46,k);
    drizzle=true;
  }
  function muzzle(x,y,ang,k){
    ring(x,y,70*k,'#FFFFFF',1,.35,5);
    for(var i=0;i<Math.round(9*k);i++)flashline(x,y,ang+(i-4)*.16,10,rnd(40,90),pick(['#FFFFFF','#F3C4D0','#8FE3B3']),1);
  }
  /* 팡파르 — 화면 중앙(스티커)에서 사방으로 */
  function fanfare(x,y){
    start();
    var m=mobile(), n=m?60:110;
    for(var i=0;i<n;i++)conf(x,y,Math.random()*6.28,0,m?8:11,1,CF,{g:.16,decay:.008});
    for(var k=0;k<14;k++)flashline(x,y,k*(6.28/14)+Math.random()*.2,40,rnd(60,130),pick(['#FFFFFF','#E4879F','#8FE3B3']),1);
    ring(x,y,m?170:280,'#C43D63',1,.6,5); ring(x,y,m?120:200,'#03C75A',1,.75,3);
    var sw=stage.getBoundingClientRect();
    for(var t=0;t<(m?8:14);t++)twinkle(sw.left+rnd(-30,sw.width+30),sw.top+rnd(-60,sw.height+30),rnd(5,10),1,rnd(1.2,2.2));
  }
  /* 불꽃 — 잔상선 스파크 + 화이트 코어 + 링 2 */
  function firework(x,y){
    start();
    var cols=pick(FW), m=mobile(), n=m?52:84;
    for(var i=0;i<n;i++){ var a=Math.random()*6.28, s=rnd(m?2.6:3.2,m?8:10.5); spark(x,y,Math.cos(a)*s,Math.sin(a)*s,pick(cols),1,{decay:rnd(.011,.018),lw:m?2.4:3}); }
    for(var i2=0;i2<(m?14:22);i2++){ var a2=Math.random()*6.28, s2=rnd(1.2,3.4); spark(x,y,Math.cos(a2)*s2,Math.sin(a2)*s2,'#FFFFFF',1,{decay:rnd(.02,.03),lw:2}); }
    ring(x,y,m?70:110,'#FFFFFF',1,.32,4); ring(x,y,m?44:70,cols[0],1,.5,2.5);
    for(var j=0;j<(m?6:10);j++)conf(x,y,Math.random()*6.28,0,m?4:5.5,1,cols,{shape:3,g:.08,decay:.012,w:6,wv:5});
  }
  /* 봄딩 착지 하트 */
  function hearts(x,y){
    start();
    for(var i=0;i<(mobile()?5:8);i++)conf(x+rnd(-26,26),y,-Math.PI/2,1.1,rnd(2.5,5.5),1,PINK,{shape:2,g:.06,decay:.014,w:6,wv:6});
  }
  /* 영도 꼬리 반짝이 */
  function trail(x,y,vx,vy){
    if(!on)start();
    for(var i=0;i<2;i++)conf(x+rnd(-8,8),y+rnd(-8,8),Math.atan2(-vy,-vx)+rnd(-.5,.5),0,rnd(.4,1.6),0,TEAL,{shape:Math.random()<.5?3:1,g:.02,decay:.045,w:3,wv:3,h:3,hv:2});
  }
  function stop(){ on=false; drizzle=false; if(raf)cancelAnimationFrame(raf); raf=0; P=[]; }
  window.addEventListener('resize',function(){ if(on)size(); });
  return {cannons:cannons,fanfare:fanfare,firework:firework,hearts:hearts,trail:trail,stop:stop,start:start,W:function(){ return W; },H:function(){ return H; }};
})();

/* 좌표 헬퍼 — 스티커 중심(뷰포트) */
function badgeCenter(){ var r=badge.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height*.55}; }
function flyViewport(){ var r=fly.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; }
function fw(px,py){ return function(){ FX.firework(FX.W()*px,FX.H()*py); }; }

/* ── 4. 영도 궤도 — 스테이지 중심 기준 타원. a 가 줄어드는 방향 = 왼쪽에서 «앞(아래)»으로 먼저 지나간다 ── */
var ORB={a:Math.PI, t:0, roll:0, front:null};
function placeFly(){
  var g=gsapRef; if(!g)return;
  var m=mobile(), sw=stage.offsetWidth, sh=stage.offsetHeight;
  var rx=sw/2+(m?42:96), ry=sh/2+(m?44:64), a=ORB.a, w=6.28/2.9;      /* 한 바퀴 2.9s */
  var x=rx*Math.cos(a), y=ry*Math.sin(a)+20+6*Math.sin(ORB.t*7);
  var vx=rx*Math.sin(a)*w, vy=-ry*Math.cos(a)*w;                        /* a 감소 기준 속도 */
  var mir=vx<0, ang=mir?-Math.atan2(vy,-vx):Math.atan2(vy,vx);
  ang=Math.max(-.5,Math.min(.5,ang))*.62*57.3;
  var depth=(Math.sin(a)+1)/2, sc=.78+.22*depth, front=Math.sin(a)>0;
  /* 2D 턴: 방향이 바뀌는 구간에서 얇아졌다 펴진다(순간 반전 대신) */
  var k=Math.max(-1,Math.min(1,vx/(rx*w*.28))); if(Math.abs(k)<.14)k=k<0?-.14:.14;
  if(front!==ORB.front){ ORB.front=front; fly.classList.toggle('front',front); }
  g.set(fly,{x:x,y:y,rotation:ang+ORB.roll,scaleX:k*sc,scaleY:sc});
  if(hasFlyB){ var ph=Math.floor(ORB.t/.4)%2; fly.classList.toggle('b',ph===1); }
  /* 말풍선은 영도 머리 옆(진행 방향 쪽), 말꼬리는 영도 쪽 */
  say.classList.toggle('l',mir);
  g.set(say,{x:x+(mir?-1:1)*(m?52:82)-(mir?say.offsetWidth:0),y:y-(m?60:88)});
  /* 꼬리 반짝이(뷰포트 좌표) */
  if(front||depth>.35){ var v=flyViewport(); FX.trail(v.x-(mir?-1:1)*(m?42:66)*sc,v.y+12*sc,vx,vy); }
}

/* ── 5. 안무 (시간 = 재생 시작 기준 초) ── */
function playG(g){
  gsapRef=g;
  var E='expo.out', m=mobile();
  g.set(badge,{transformOrigin:'50% 100%'}); g.set(bar,{transformOrigin:'0% 50%'});
  tl=g.timeline({defaults:{ease:E}});
  tl.fromTo(tray,{opacity:0,y:28,scale:.97},{opacity:1,y:0,scale:1,duration:.85},0)
    .fromTo(bar,{scaleX:0},{scaleX:1,duration:CFG.hold/1000,ease:'none'},0)                     /* 최소 노출 타이머 — 실제 경과 */
    .fromTo(badge,{opacity:0,y:22,scale:.9},{opacity:1,y:0,scale:1,duration:.8},.1)
    .fromTo(kick,{opacity:0,y:10},{opacity:1,y:0,duration:.5},.24)
    .fromTo(chars,{opacity:0,y:24,scale:1.22},{opacity:1,y:0,scale:1,duration:.7,stagger:{amount:.42}},.32)   /* «크게서 작게» = 펀치(오버슛 없음) */
    .fromTo(h,{filter:'blur(8px)'},{filter:'blur(0px)',duration:.6,clearProps:'filter'},.32)
    .fromTo(shine,{xPercent:-130,x:0},{xPercent:130,duration:.8,ease:'power2.inOut'},.5)
    .fromTo(skip,{opacity:0},{opacity:1,duration:.4},.6)
    .add(function(){ floatTw=g.to(badge,{y:-4,duration:.7,yoyo:true,repeat:-1,ease:'sine.inOut'}); },.9)   /* 뛰기 전 숨쉬기 */
    /* ★빅 비트 — 헤드라인이 다 앉은 순간: 플래시 + 블룸 + 충격파 + 방사 버스트 + 코너 캐논 + 플라크 킥 */
    .add(function(){ var c=badgeCenter(); FX.fanfare(c.x,c.y); FX.cannons(1); },.95)
    .fromTo(flash,{opacity:0},{opacity:.55,duration:.06,ease:'power1.out'},.95)
    .to(flash,{opacity:0,duration:.32,ease:'power2.out'},1.01)
    .fromTo(bloom,{opacity:.3},{opacity:1,duration:.1,ease:'power1.out'},.95)
    .to(bloom,{opacity:.5,duration:1,ease:'power2.out'},1.05)
    .fromTo(tray,{scale:1.04},{scale:1,duration:.6,ease:E,immediateRender:false},.97)
    .fromTo(dot,{boxShadow:'0 0 0 0 rgba(3,199,90,.45)'},{boxShadow:'0 0 0 10px rgba(3,199,90,0)',duration:.9,repeat:-1,repeatDelay:.5,ease:'power2.out'},.95)
    .fromTo(sub,{opacity:0,y:8},{opacity:1,y:0,duration:.5},1.05)
    /* 영도 등장 → 궤도 비행 */
    .add(function(){
      ORB.a=Math.PI; ORB.t=0; ORB.roll=0; ORB.front=null; placeFly();
      orbTw=g.to(ORB,{a:Math.PI-6.28*4,t:2.9*4,duration:2.9*4,ease:'none',onUpdate:placeFly});
    },1.15)
    .fromTo(fly,{opacity:0},{opacity:1,duration:.32,ease:'power2.out'},1.15)
    /* 봄딩 — 기뻐서 뛰기 루프(앤티시페이션 → 점프+포즈 B → 착지 스쿼시 + 하트) */
    .add(function(){
      if(floatTw){ floatTw.kill(); floatTw=null; }
      hopTl=g.timeline({repeat:-1,repeatDelay:.32});
      hopTl.to(badge,{y:0,scaleY:.93,scaleX:1.06,duration:.13,ease:'power2.in'})
           .add(function(){ if(hasB)badge.classList.add('b'); })
           .to(badge,{y:m?-20:-28,scaleY:1.06,scaleX:.96,rotation:-3,duration:.3,ease:E})
           .to(badge,{y:0,scaleY:1,scaleX:1,rotation:0,duration:.24,ease:'power2.in'})
           .add(function(){ badge.classList.remove('b'); var c=badgeCenter(); FX.hearts(c.x,c.y-10); })
           .to(badge,{scaleY:.95,scaleX:1.045,duration:.09,ease:'power1.out'})
           .to(badge,{scaleY:1,scaleX:1,duration:.2,ease:'power2.out'});
    },1.5)
    /* 불꽃 7발 — 하늘이 비지 않게 */
    .add(fw(.2,.22),1.45).add(fw(.8,.2),1.9).add(fw(.5,.1),2.3).add(fw(.3,.32),2.7)
    .add(fw(.72,.3),3.05).add(fw(.16,.12),3.4).add(fw(.84,.14),3.75)
    /* 블룸 숨쉬기 */
    .add(function(){ bloomTw=g.to(bloom,{opacity:.72,duration:1.1,yoyo:true,repeat:-1,ease:'sine.inOut'}); },2.1)
    /* 영도 배럴롤(오른쪽 옆을 지날 때) */
    .add(function(){ g.to(ORB,{roll:'+=360',duration:.6,ease:'power2.inOut'}); },2.55)
    /* 2차 볼리 + 광택 2 */
    .add(function(){ FX.cannons(.55); },2.7)
    .fromTo(shine,{xPercent:-130,x:0},{xPercent:130,duration:.8,ease:'power2.inOut',immediateRender:false},3.0)
    /* 말풍선 2연 */
    .add(function(){
      setSay(CFG.say);
      sayTl=g.timeline();
      sayTl.fromTo(say,{opacity:0,scale:.8},{opacity:1,scale:1,duration:.32,ease:E})
           .to(say,{opacity:0,scale:.92,duration:.2,ease:'power2.in'},1.2)
           .add(function(){ setSay(CFG.say2); },1.42)
           .fromTo(say,{opacity:0,scale:.8},{opacity:1,scale:1,duration:.32,ease:E},1.5);
    },1.8);
  root.classList.remove('pre');   /* fromTo 가 시작값을 inline 으로 잡은 뒤라 깜빡임 없음 */
}
function playCss(){
  root.classList.add('css'); root.classList.remove('pre');
  later(function(){ var c=badgeCenter(); FX.fanfare(c.x,c.y); FX.cannons(1); },950);
  [[.2,.22,1450],[.8,.2,1900],[.5,.1,2300],[.3,.32,2700],[.72,.3,3050],[.16,.12,3400],[.84,.14,3750]].forEach(function(f){ later(fw(f[0],f[1]),f[2]); });
  later(function(){ FX.cannons(.55); },2700);
  if(hasFlyB)later(function(){ var iv=setInterval(function(){ if(gone){ clearInterval(iv); return; } fly.classList.toggle('b'); },400); timers.push(iv); },1150);
}
function play(){
  if(gone)return;
  playedAt=performance.now(); dbg('play gsap='+!!window.gsap);
  var g=window.gsap;
  try{ if(g)playG(g); else playCss(); }catch(e){ root.classList.remove('pre'); dbg('play err '+e.message); }
  later(maybeExit,CFG.hold);
}

/* 종료: 영도가 오른쪽 위로 날아가고(0.38s) → 판이 카메라 쪽으로 밀리며 흐려지고(0.36s) → 조리개가 열린다(0.62s). mask 미지원이면 페이드 */
function exit(){
  if(gone||exiting)return; exiting=true;
  try{
    if(orbTw)orbTw.kill(); if(hopTl)hopTl.kill(); if(sayTl)sayTl.kill(); if(floatTw)floatTw.kill(); if(bloomTw)bloomTw.kill();
    var w=window.innerWidth, hh=window.innerHeight, R=Math.hypot(w,hh)*.5+48;
    var maskOK=('maskImage' in root.style)||('webkitMaskImage' in root.style);
    dbg('exit gsap='+!!gsapRef+' mask='+maskOK+' R='+Math.round(R));
    if(gsapRef){
      var g=gsapRef, t=g.timeline({onComplete:teardown});
      t.to(fly,{x:'+=560',y:'-=200',rotation:-16,opacity:0,duration:.38,ease:'power2.in'},0)
       .to(say,{opacity:0,duration:.15},0)
       .to(stage,{opacity:0,scale:1.04,filter:'blur(6px)',duration:.36,ease:'power2.in'},.08)
       .to([skip,bar,bloom,cvB,cvF],{opacity:0,duration:.25,ease:'power2.in'},.08);
      if(maskOK){
        root.style.setProperty('--r','0px');
        t.add(function(){ root.classList.add('iris'); },.2)
         .to(root,{'--r':R+'px',duration:.62,ease:'power4.out'},.22);
      } else t.to(root,{opacity:0,duration:.45,ease:'power2.in'},.2);
    } else {
      root.classList.add('out'); later(teardown,520);
    }
  }catch(e){ dbg('exit err '+e.message); teardown(); }
}
function teardown(){
  if(gone)return; gone=true; dbg('teardown');
  try{ if(tl)tl.kill(); if(orbTw)orbTw.kill(); if(hopTl)hopTl.kill(); if(sayTl)sayTl.kill(); if(floatTw)floatTw.kill(); if(bloomTw)bloomTw.kill(); }catch(e){}
  FX.stop();
  timers.forEach(function(id){ clearTimeout(id); clearInterval(id); });
  document.removeEventListener('keydown',onKey,true);
  if(root.parentNode)root.parentNode.removeChild(root);
  if(st.parentNode)st.parentNode.removeChild(st);
}
function maybeExit(){
  if(gone||exiting)return;
  var now=performance.now();
  if(now-t0>=CFG.maxWait){ exit(); return; }
  if(ready&&playedAt&&now-playedAt>=CFG.hold)exit();
}

/* «데이터 준비» = 사이트가 #view 의 스켈레톤을 실제 화면으로 바꾼 순간 + 380ms(첫 렌더 버스트가 rAF 를 붙드는 구간을 피한다). 가짜 진행률을 만들지 않는다 */
function markReady(){ dbg('data'); later(function(){ ready=true; dbg('ready'); maybeExit(); },380); }
function watchReady(){
  var view=document.getElementById('view');
  if(!view){ later(function(){ ready=true; maybeExit(); },0); return; }
  if(!view.querySelector('.skel')){ markReady(); return; }
  try{
    var mo=new MutationObserver(function(){
      if(!view.querySelector('.skel')){ mo.disconnect(); markReady(); }
    });
    mo.observe(view,{childList:true,subtree:true});
  }catch(e){ ready=true; }
}

/* ── 6. 입력: 아무 데나 누르거나 Esc/Enter/Space 면 건너뛴다 ── */
function onKey(e){
  if(e.key==='Escape'||e.key==='Enter'||e.key===' '){ e.preventDefault(); e.stopPropagation(); exit(); }
}
skip.addEventListener('click',function(e){ e.stopPropagation(); exit(); });
root.addEventListener('pointerdown',function(e){ if(e.button===0)exit(); });
root.addEventListener('wheel',function(e){ e.preventDefault(); },{passive:false});
root.addEventListener('touchmove',function(e){ e.preventDefault(); },{passive:false});
document.addEventListener('keydown',onKey,true);

/* ── 7. 시작: 문서 파싱 완료(GSAP 로드 확정) + 글꼴·스티커 준비(각 상한) 뒤 재생 ── */
function start(){
  watchReady();
  later(maybeExit,CFG.maxWait);   /* 하드 백스톱 */
  var waits=[];
  function capped(p,ms){ return Promise.race([p.catch(function(){}),new Promise(function(r){ setTimeout(r,ms); })]); }
  try{ if(document.fonts&&document.fonts.load)waits.push(capped(document.fonts.load('800 44px "Pretendard Variable"'),350)); }catch(e){}
  try{ if(img&&img.decode)waits.push(capped(img.decode(),600)); }catch(e){}
  try{ if(flyA&&flyA.decode)waits.push(capped(flyA.decode(),600)); }catch(e){}
  Promise.all(waits).then(play,play);
}
/* 공개 API: 콘솔·다른 스크립트에서 건너뛰기/상태 확인 */
window.SseudamCheer={skip:exit,state:function(){ return {played:playedAt>0,ready:ready,exiting:exiting,gone:gone,hasB:hasB,hasFlyB:hasFlyB,log:DBG.slice()}; }};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
