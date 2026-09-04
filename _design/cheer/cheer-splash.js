/* ══════════════════════════════════════════════════════════════════
   쓰담 — 축하 스플래시 「봄딩 · 네이버 메이트 2026.09」  (2026-09-04)

   무엇  : 사이트에 «접속»했을 때 2~3초, 봄딩의 네이버 메이트 선정을 축하하는 화면을 띄운 뒤
           원형 조리개(iris)로 열리며 사이트를 드러낸다. 그동안 사이트는 뒤에서 그대로 부팅한다.
   어디  : index.html <body> 첫 줄에 동기 <script src> 한 줄 — 이 파일이 스타일·마크업·모션을 전부 스스로 넣는다.
           걷어낼 땐 그 한 줄만 지우면 된다(사이트 코드에 다른 흔적 없음).
   언제  : 세션당 1회(sessionStorage). 재생 = ?cheer=1 · 강제 끔 = ?cheer=0 · CFG.until 지나면 자동 종료.
   모션  : GSAP(사이트가 _vendor/gsap 로 이미 벤더)이 있으면 타임라인, 없으면 같은 안무의 CSS 키프레임 폴백.
           «반드시 걷힌다» — 데이터 준비(#view 스켈레톤 소멸) 뒤에만 걷히되 maxWait 백스톱 + JS 가 죽어도
           CSS 애니메이션(cheerDead)이 5.6초에 강제로 숨긴다. 스플래시는 화면을 통째로 가리므로 걷히지 않는
           실패 모드 = 서비스 중단이다.
   FX    : 컨페티는 의존성 없는 Canvas 2D 파티클(리본·원·하트·별, 중력·항력·플러터). DOM 노드 0개.
   자산  : bomding-mate.webp/.png = 나노바나나(Gemini 2.5 Flash Image)로 봄딩 아바타를 -Ref 로 잡아 생성 →
           배경 키잉·트림(nb_post.py). 실제 게임 콘텐츠가 아닌 사이트 디자인 자산이라 생성 허용 범위.
   규칙  : 색은 정체성에만(봄딩 --w-bomding · 네이버 그린) · 이중 베젤 · Pretendard 800 · 라벨 ≥12.5px ·
           바운스/엘라스틱 이징 없음 · transform/opacity 위주(조리개 mask 1회만 예외) ·
           모션은 항상 켬(OS reduce-motion 미준수 — 사이트 결정 09-04와 동일).
   ══════════════════════════════════════════════════════════════════ */
(function(){
"use strict";

var CFG={
  key:'sseudam_cheer_202609',   /* 세션당 1회 */
  until:'2026-10-04',           /* 이 날(KST) 지나면 자동 종료 — 상수 하나로 연장·단축 */
  hold:2000,                    /* 안무 시작 후 최소 노출(ms). 이 뒤 «데이터 준비»가 되면 걷힌다(총 ≈3초) */
  maxWait:4000,                 /* 하드 백스톱(ms, 스크립트 시작 기준): 데이터가 영영 안 와도 걷힌다 */
  img:'_design/cheer/bomding-mate',
  title:'봄딩의 네이버 메이트 선정을 축하합니다!',
  who:'봄딩',                   /* title 안에서 정체성 색을 입힐 낱말 */
  kicker:'네이버 메이트 · 2026년 9월',
  sub:'당신의 글쓰기 동료, 쓰담 드림'
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
'.cheer{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:24px;',            /* 스플래시 층: 모달 95·토스트 90 위 */
'  background:#EFF0F2;color:#0E1114;touch-action:none;overscroll-behavior:contain;cursor:default;',
'  font-family:"Pretendard Variable",Pretendard,system-ui,sans-serif;letter-spacing:-.011em;',
'  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;',
'  --e:cubic-bezier(.32,.72,0,1);--r:0px;',
'  animation:cheerDead 1ms linear 5.6s forwards}',                                                      /* JS 가 죽어도 반드시 걷힌다 */
'.cheer::before{content:"";position:absolute;inset:0;pointer-events:none;background:',
'  radial-gradient(900px 520px at 12% -10%,rgba(255,255,255,.9),transparent 60%),',
'  radial-gradient(760px 480px at 96% 4%,rgba(255,255,255,.7),transparent 62%),',
'  radial-gradient(720px 460px at 50% 60%,rgba(196,61,99,.10),transparent 70%),',
'  radial-gradient(560px 380px at 50% 26%,rgba(3,199,90,.06),transparent 70%)}',
'.cheer.iris{-webkit-mask-image:radial-gradient(circle at 50% 50%,transparent var(--r),#000 calc(var(--r) + 36px));',   /* 조리개 가장자리는 36px 페더 */
'  mask-image:radial-gradient(circle at 50% 50%,transparent var(--r),#000 calc(var(--r) + 36px))}',
'.cheer-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
'.cheer-stage{position:relative;width:min(660px,100%);margin-top:72px;will-change:transform}',
'.cheer-tray{background:linear-gradient(180deg,#E5E7EB 0%,#DFE2E6 100%);border-radius:24px;padding:6px;',
'  box-shadow:0 0 0 1px rgba(14,17,20,.07),0 2px 6px rgba(14,17,20,.06),0 20px 48px -18px rgba(14,17,20,.20),0 60px 110px -50px rgba(14,17,20,.24)}',
'.cheer-core{position:relative;background:#fff;border-radius:18px;padding:118px 40px 34px;text-align:center;',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 1px rgba(14,17,20,.05)}',
'.cheer-badge{position:absolute;left:50%;top:-100px;width:210px;height:210px;margin-left:-105px;z-index:2;pointer-events:none}',
'.cheer-badge img{display:block;width:100%;height:100%;object-fit:contain;',
'  filter:drop-shadow(0 10px 18px rgba(14,17,20,.14)) drop-shadow(0 1px 2px rgba(14,17,20,.08))}',
'.cheer-shine{position:absolute;inset:0;pointer-events:none;overflow:hidden;',
'  -webkit-mask:var(--mask) center/contain no-repeat;mask:var(--mask) center/contain no-repeat}',          /* 마스크(스티커 실루엣)는 고정 */
'.cheer-shine i{position:absolute;top:-25%;bottom:-25%;left:0;width:100%;transform:translateX(-130%);',
'  background:linear-gradient(112deg,transparent 42%,rgba(255,255,255,.78) 50%,transparent 58%)}',       /* 띠만 스티커 밑을 지나간다 */
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
'.cheer-skip{position:absolute;right:max(22px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));',
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
'.cheer.pre .cheer-tray,.cheer.pre .cheer-badge,.cheer.pre .cheer-k,.cheer.pre .cc,.cheer.pre .cheer-sub,.cheer.pre .cheer-skip{opacity:0}',
/* CSS 폴백(GSAP 없을 때) — 같은 안무, 같은 무게 */
'.cheer.css .cheer-tray{animation:cheerUp .85s var(--e) both}',
'.cheer.css .cheer-badge{animation:cheerUp .8s var(--e) .1s both}',
'.cheer.css .cheer-k{animation:cheerUp .5s var(--e) .24s both}',
'.cheer.css .cc{animation:cheerUp .65s var(--e) both;animation-delay:calc(.32s + var(--i) * .026s)}',
'.cheer.css .cheer-sub{animation:cheerUp .5s var(--e) .95s both}',
'.cheer.css .cheer-skip{animation:cheerFade .4s var(--e) .6s both}',
'.cheer.css .cheer-shine i{animation:cheerShine 1s cubic-bezier(.45,0,.2,1) .85s both}',
'.cheer.css.out{animation:cheerOut .5s var(--e) forwards,cheerDead 1ms linear 5.6s forwards}',
'@keyframes cheerUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}',
'@keyframes cheerFade{from{opacity:0}to{opacity:1}}',
'@keyframes cheerShine{from{transform:translateX(-130%)}to{transform:translateX(130%)}}',
'@keyframes cheerOut{to{opacity:0}}',
'@keyframes cheerDead{to{visibility:hidden;opacity:0;pointer-events:none}}',
'@media (max-width:600px){',
'  .cheer{padding:16px}.cheer-stage{margin-top:60px}',
'  .cheer-badge{width:164px;height:164px;margin-left:-82px;top:-82px}',
'  .cheer-core{padding:96px 22px 26px}.cheer-h{font-size:27px}.cheer-sub{font-size:13.5px}}',
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

var HTML=
'<div class="cheer pre" id="cheer" role="dialog" aria-modal="true" aria-label="'+esc(CFG.title)+'">'+
  '<canvas class="cheer-fx" id="cheerFx" aria-hidden="true"></canvas>'+
  '<div class="cheer-stage" id="cheerStage">'+
    '<div class="cheer-badge" id="cheerBadge" aria-hidden="true">'+
      '<picture><source srcset="'+CFG.img+'.webp" type="image/webp">'+
      '<img id="cheerImg" src="'+CFG.img+'.png" alt="" width="210" height="210" decoding="async" fetchpriority="high"></picture>'+
      '<span class="cheer-shine" style="--mask:url(&quot;'+CFG.img+'.png&quot;)"><i id="cheerShine"></i></span>'+
    '</div>'+
    '<div class="cheer-tray" id="cheerTray"><div class="cheer-core">'+
      '<p class="cheer-k" id="cheerK"><i id="cheerDot" aria-hidden="true"></i>'+esc(CFG.kicker)+'</p>'+
      '<h1 class="cheer-h" id="cheerH" aria-label="'+esc(CFG.title)+'"><span aria-hidden="true">'+splitTitle(CFG.title,CFG.who)+'</span></h1>'+
      '<p class="cheer-sub" id="cheerSub">'+esc(CFG.sub)+'</p>'+
    '</div></div>'+
  '</div>'+
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
var stage=$('cheerStage'), tray=$('cheerTray'), badge=$('cheerBadge'), img=$('cheerImg'), shine=$('cheerShine'),
    kick=$('cheerK'), dot=$('cheerDot'), h=$('cheerH'), sub=$('cheerSub'), skip=$('cheerSkip'), canvas=$('cheerFx');
var chars=root.querySelectorAll('.cc');

var t0=performance.now(), gsapRef=null, tl=null, floatTw=null, playedAt=0, ready=false, gone=false, exiting=false, timers=[], DBG=[];
function dbg(m){ DBG.push(Math.round(performance.now()-t0)+'ms '+m); }
function later(fn,ms){ var id=setTimeout(fn,ms); timers.push(id); return id; }

/* ── 3. 컨페티 — Canvas 2D 파티클(의존성 0) ── */
var FX=(function(){
  var ctx=canvas.getContext('2d'), P=[], W=0, H=0, dpr=1, raf=0, last=0, on=false;
  var COLORS=['#C43D63','#E4879F','#F3C4D0','#03C75A','#8FE3B3','#FFFFFF','#D5D9DE','#0E1114'];
  function size(){
    dpr=Math.min(2,window.devicePixelRatio||1); W=canvas.clientWidth; H=canvas.clientHeight;
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function make(x,y,ang,spread,speed){
    var a=ang+(Math.random()-.5)*spread, s=speed*(.5+Math.random()*.75), r=Math.random();
    return {x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      w:5+Math.random()*7,h:9+Math.random()*9,rot:Math.random()*6.28,vr:(Math.random()-.5)*.3,
      tilt:Math.random()*6.28,vt:.12+Math.random()*.2,
      c:COLORS[(Math.random()*COLORS.length)|0],
      shape:r<.6?0:r<.8?1:r<.92?2:3,   /* 0 리본 · 1 원 · 2 하트 · 3 별 */
      life:1,decay:.0055+Math.random()*.005,g:.2+Math.random()*.1};
  }
  function heart(s){
    ctx.beginPath(); ctx.moveTo(0,s*.35);
    ctx.bezierCurveTo(s*1.1,-s*.5,s*.55,-s*1.15,0,-s*.45);
    ctx.bezierCurveTo(-s*.55,-s*1.15,-s*1.1,-s*.5,0,s*.35); ctx.closePath(); ctx.fill();
  }
  function star(s){
    ctx.beginPath();
    for(var i=0;i<10;i++){ var rr=i%2?s*.45:s, a=-Math.PI/2+i*Math.PI/5; ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); }
    ctx.closePath(); ctx.fill();
  }
  function step(t){
    var dt=last?Math.min(2.2,(t-last)/16.67):1; last=t;
    ctx.clearRect(0,0,W,H);
    var keep=[];
    for(var i=0;i<P.length;i++){
      var p=P[i];
      p.vy+=p.g*dt; p.vx*=Math.pow(.986,dt); p.vy*=Math.pow(.992,dt);
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt; p.tilt+=p.vt*dt;
      if(p.vy>0)p.life-=p.decay*dt;                     /* 정점을 지나 떨어질 때부터 옅어진다 */
      if(p.life<=0||p.y>H+40)continue;
      keep.push(p);
      ctx.globalAlpha=Math.min(1,p.life); ctx.fillStyle=p.c;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      var fl=Math.cos(p.tilt);                          /* 플러터: 얇은 종이가 뒤집히며 폭이 줄었다 는다 */
      if(p.shape===0){ ctx.scale(fl,1); if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(-p.w/2,-p.h/2,p.w,p.h,1.5); ctx.fill(); } else ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); }
      else if(p.shape===1){ ctx.scale(Math.abs(fl)*.6+.4,1); ctx.beginPath(); ctx.arc(0,0,p.w*.5,0,6.28); ctx.fill(); }
      else if(p.shape===2){ ctx.scale(fl,1); heart(p.w*.62); }
      else { ctx.scale(fl,1); star(p.w*.6); }
      ctx.restore();
    }
    P=keep;
    if(P.length&&on)raf=requestAnimationFrame(step); else { on=false; raf=0; last=0; ctx.clearRect(0,0,W,H); }
  }
  function burst(){
    size();
    var mobile=W<600, n=mobile?62:112, sp=mobile?15.5:19.5;
    for(var i=0;i<n;i++)P.push(make(W*.10,H+8,-Math.PI/2+.44,.95,sp));    /* 좌하단 → 우상향 */
    for(var j=0;j<n;j++)P.push(make(W*.90,H+8,-Math.PI/2-.44,.95,sp));    /* 우하단 → 좌상향 */
    if(!on){ on=true; last=0; raf=requestAnimationFrame(step); }
  }
  function stop(){ on=false; if(raf)cancelAnimationFrame(raf); raf=0; P=[]; }
  window.addEventListener('resize',function(){ if(on)size(); });
  return {burst:burst,stop:stop};
})();

/* ── 4. 안무 ── */
function playG(g){
  gsapRef=g;
  var E='expo.out';
  tl=g.timeline({defaults:{ease:E}});
  tl.fromTo(tray,{opacity:0,y:28,scale:.97},{opacity:1,y:0,scale:1,duration:.85},0)
    .fromTo(badge,{opacity:0,y:22,scale:.9},{opacity:1,y:0,scale:1,duration:.8},.1)
    .fromTo(kick,{opacity:0,y:10},{opacity:1,y:0,duration:.5},.24)
    .fromTo(chars,{opacity:0,y:24},{opacity:1,y:0,duration:.7,stagger:{amount:.42}},.32)
    .fromTo(h,{filter:'blur(8px)'},{filter:'blur(0px)',duration:.6,clearProps:'filter'},.32)
    .add(function(){ FX.burst(); },.55)
    .fromTo(skip,{opacity:0},{opacity:1,duration:.4},.6)
    .fromTo(dot,{boxShadow:'0 0 0 0 rgba(3,199,90,.45)'},{boxShadow:'0 0 0 10px rgba(3,199,90,0)',duration:.9,ease:'power2.out'},.62)
    .fromTo(shine,{xPercent:-130,x:0},{xPercent:130,duration:1,ease:'power2.inOut'},.85)
    .fromTo(sub,{opacity:0,y:8},{opacity:1,y:0,duration:.5},.95)
    .add(function(){ floatTw=g.to(badge,{y:-5,duration:1.3,yoyo:true,repeat:-1,ease:'sine.inOut'}); },1.0);
  root.classList.remove('pre');   /* fromTo 가 시작값을 inline 으로 잡은 뒤라 깜빡임 없음 */
}
function playCss(){
  root.classList.add('css'); root.classList.remove('pre');
  later(FX.burst,550);
}
function play(){
  if(gone)return;
  playedAt=performance.now(); dbg('play gsap='+!!window.gsap);
  var g=window.gsap;
  try{ if(g)playG(g); else playCss(); }catch(e){ root.classList.remove('pre'); }
  later(maybeExit,CFG.hold);
}

/* 종료: 판이 물러나고(0.3s) → 조리개가 열린다(0.62s). mask 미지원이면 페이드 */
function exit(){
  if(gone||exiting)return; exiting=true;
  try{
    if(floatTw)floatTw.kill();
    var w=window.innerWidth, hh=window.innerHeight, R=Math.hypot(w,hh)*.5+48;
    var maskOK=('maskImage' in root.style)||('webkitMaskImage' in root.style);
    dbg('exit gsap='+!!gsapRef+' mask='+maskOK+' R='+Math.round(R));
    if(gsapRef){
      var g=gsapRef, t=g.timeline({onComplete:teardown});
      t.to(stage,{opacity:0,y:-12,scale:.975,duration:.3,ease:'power2.in'},0)
       .to([skip,canvas],{opacity:0,duration:.25,ease:'power2.in'},0);
      if(maskOK){
        root.style.setProperty('--r','0px');
        t.add(function(){ root.classList.add('iris'); },.12)
         .to(root,{'--r':R+'px',duration:.62,ease:'power4.out'},.14);
      } else t.to(root,{opacity:0,duration:.45,ease:'power2.in'},.12);
    } else {
      root.classList.add('out'); later(teardown,520);
    }
  }catch(e){ teardown(); }
}
function teardown(){
  if(gone)return; gone=true; dbg('teardown');
  try{ if(tl)tl.kill(); if(floatTw)floatTw.kill(); }catch(e){}
  FX.stop();
  timers.forEach(clearTimeout);
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

/* «데이터 준비» = 사이트가 #view 의 스켈레톤을 실제 화면으로 바꾼 순간. 가짜 진행률을 만들지 않는다 */
function watchReady(){
  var view=document.getElementById('view');
  if(!view){ later(function(){ ready=true; maybeExit(); },0); return; }
  if(!view.querySelector('.skel')){ ready=true; maybeExit(); return; }
  try{
    var mo=new MutationObserver(function(){
      if(!view.querySelector('.skel')){ mo.disconnect(); ready=true; dbg('ready'); maybeExit(); }
    });
    mo.observe(view,{childList:true,subtree:true});
  }catch(e){ ready=true; }
}

/* ── 5. 입력: 아무 데나 누르거나 Esc/Enter/Space 면 건너뛴다 ── */
function onKey(e){
  if(e.key==='Escape'||e.key==='Enter'||e.key===' '){ e.preventDefault(); e.stopPropagation(); exit(); }
}
skip.addEventListener('click',function(e){ e.stopPropagation(); exit(); });
root.addEventListener('pointerdown',function(e){ if(e.button===0)exit(); });
root.addEventListener('wheel',function(e){ e.preventDefault(); },{passive:false});
root.addEventListener('touchmove',function(e){ e.preventDefault(); },{passive:false});
document.addEventListener('keydown',onKey,true);

/* ── 6. 시작: 문서 파싱 완료(GSAP 로드 확정) + 글꼴·스티커 준비(각 상한) 뒤 재생 ── */
function start(){
  watchReady();
  later(maybeExit,CFG.maxWait);   /* 하드 백스톱 */
  var waits=[];
  try{ if(document.fonts&&document.fonts.load)waits.push(Promise.race([document.fonts.load('800 44px "Pretendard Variable"'),new Promise(function(r){ setTimeout(r,350); })])); }catch(e){}
  try{ if(img&&img.decode)waits.push(Promise.race([img.decode().catch(function(){}),new Promise(function(r){ setTimeout(r,600); })])); }catch(e){}
  Promise.all(waits).then(play,play);
}
/* 공개 API: 콘솔·다른 스크립트에서 건너뛰기/상태 확인 */
window.SseudamCheer={skip:exit,state:function(){ return {played:playedAt>0,ready:ready,exiting:exiting,gone:gone,log:DBG.slice()}; }};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
