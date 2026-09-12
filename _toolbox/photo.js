/*! 쓰담 도구함 · 이미지 편집 — 2026-09-12 · v2(작성자 팩·도형 15·손그림·사진 밖 가드·레이어 서랍)
 *  index.html 「도구함」 탭이 처음 고를 때 받아 window.SseudamTools.photo 로 등록한다({mount(host,api), unmount()}).
 *  기능 = 네이버 스마트에디터 ONE 사진 편집(PC)의 10가지를 같은 순서로 — 크기 · 자르기·회전 · 필터 · 보정 · 액자 · 서명 · 모자이크 · 텍스트 · 스티커 · 마스크
 *    (2026-09-11 실측: 스마트에디터 사진 편집 안내 글 5편 이상이 같은 목록·순서를 적는다. 서명=이미지/텍스트/템플릿·위치 이동, 모자이크=사각/원형)
 *    + 사진 편집기의 대중 기능 2가지(도형·화살표·돋보기 / 그리기·형광펜) · 되돌리기 · 레이어 · 원본 비교 · 확대.
 *  «작성자 전용» = 스티커(봄딩·영도 캐릭터 포즈 + 벡터)·텍스트 스타일·액자·서명 템플릿이 그 작성자 정본 색
 *    (봄딩 로즈 #C93C7C·핑크 #F58AB4·플럼 #2E2038 / 영도 그린 #15A05A·민트 #14B8A6·틸 #0F7C86) — 팩은 «앞으로 만들 것»의 기본값만 정한다
 *    · 나눔스퀘어 · 티어표 「스크랩북」 모티프(워시테이프·포스트잇·모눈·점선)에서 나온다. 사이트 크롬(레일·패널·버튼)은 사이트 토큰만 쓴다.
 *  모델 = 비파괴 문서: 원본 이미지(자산 id) + 방향(정수 행렬) · 수평 맞춤 · 자르기 창 · 필터 · 보정 · 액자 · 마스크 · 출력 폭 + 개체 목록.
 *    개체 좌표는 «방향을 적용한 원본 픽셀 공간» — 90° 회전·반전하면 개체도 같이 돌고, 자르기는 창만 옮긴다.
 *  미리보기는 화면 배율로 합성하고(보정 결과 캐시), 내보내기는 출력 배율로 처음부터 다시 그린다. 의존성 0.
 */
(function(){
"use strict";
window.SseudamTools=window.SseudamTools||{};
if(window.SseudamTools.photo)return;

var BASE=(function(){ var s=document.currentScript, u=(s&&s.src)||'_toolbox/photo.js'; return u.replace(/\?.*$/,'').replace(/[^\/]*$/,''); })();
var ASSET=BASE+'photo/';
var LS='sseudam_photo_v1';
var IDB_NAME='sseudam_photo', IDB_STORE='work';
var MAX_SIDE=8192;       /* 내보내기 긴 변 상한 — 크롬 캔버스 한계 안쪽, 메모리 보호 */
var PREVIEW_MAX=2600;    /* 미리보기 합성 긴 변 상한 */
var NAVER_W=693;         /* 네이버 PC 본문 이미지 실폭 — 09-07 봄딩·영도 실제 글 헤드리스 실측(.se-image-resource 693) */
var HIST_MAX=60;

/* ── 봄딩 정본 색 ── 티어표 SKINS.bomding · 썸네일 표준 · 봄딩 output-format(인포 핑크) */
var BD={ rose:'#C93C7C', pink:'#F58AB4', plum:'#2E2038', deep:'#17101E', ink2:'#5E5068', paper:'#FFFBFC', blush:'#F6E1EA', tint:'#F9E4EC', soft:'#FFEFF5', butter:'#FFE45C', mint:'#34C79A', white:'#FFFFFF' };
/* ── 작성자 디자인 팩 ──────────────────────────────────────────────────────
   색·글꼴·글리프는 티어표 도구(_toolbox/tier.js DESIGNS)와 같은 정본에서 가져온다
   (봄딩 = 썸네일 표준 v1 플럼·로즈·핑크 / 영도 = output-format §1-4 그린·민트 + 사이트 정체성색 틸).
   팩은 «앞으로 만들 것»의 기본값만 정한다 — 이미 올린 개체는 자기 색·글꼴을 들고 있어 두 작성자 것을 섞어 쓸 수 있다. */
var PACKS=[
  {id:'bomding', n:'봄딩', face:'face', font:'nanum', glyph:'heart',
   accent:'#C93C7C', sub:'#F58AB4', ink:'#2E2038', deep:'#17101E', soft:'#FFB3CF', tint:'#F9E4EC', hl:'#FFE45C',
   sigTx:'봄딩', sigUrl:'blog.naver.com/bomding',
   sw:[{c:'#C93C7C',n:'로즈'},{c:'#F58AB4',n:'핑크'},{c:'#FFD9E7',n:'연분홍'},{c:'#2E2038',n:'플럼'},{c:'#FFFFFF',n:'흰색'},{c:'#17101E',n:'먹색'},{c:'#FFE45C',n:'노랑'},{c:'#34C79A',n:'민트'}],
   stk:['thumbs','wow','love','point','think','peace','sad','bow','check','phone','mate','jump']},
  {id:'yeongdo', n:'영도', face:'yd_face', font:'pret', glyph:'square',
   accent:'#15A05A', sub:'#14B8A6', ink:'#0E1114', deep:'#06181C', soft:'#A9E3D4', tint:'#E3EEEA', hl:'#FFE066',
   sigTx:'영도', sigUrl:'blog.naver.com/kkodug9',
   sw:[{c:'#15A05A',n:'그린'},{c:'#14B8A6',n:'민트'},{c:'#0F7C86',n:'틸'},{c:'#A9E3D4',n:'연민트'},{c:'#FFFFFF',n:'흰색'},{c:'#0E1114',n:'먹색'},{c:'#FFE066',n:'노랑'},{c:'#F08C00',n:'주황'}],
   stk:['yd_thumbs','yd_wow','yd_clap','yd_point','yd_think','yd_ok','yd_sad','yd_bow','yd_explain','yd_cheer','yd_jump','yd_slime']}
];
var STK_N={ thumbs:'최고', wow:'헉', love:'사랑해요', point:'여기 보세요', think:'고민', peace:'브이', sad:'아쉬워요', bow:'감사해요', check:'체크', phone:'폰 들고', mate:'축하', jump:'신나요',
  yd_thumbs:'최고', yd_wow:'헉', yd_clap:'박수', yd_point:'여기 보세요', yd_think:'고민', yd_ok:'오케이', yd_sad:'아쉬워요', yd_bow:'감사해요', yd_explain:'설명해요', yd_cheer:'축하', yd_jump:'신나요', yd_slime:'슬라임' };
function PK(id){ for(var i=0;i<PACKS.length;i++)if(PACKS[i].id===id)return PACKS[i]; return PACKS[0]; }
function pack(){ return PK(PREF.pack); }
function SW(){ return pack().sw; }
function tone(p,k){ return k==='white'?'#FFFFFF':(p[k]||k); }
/* 바탕 위 글자색은 «흰색» 고정이 아니라 대비로 고른다 — 티어표 plaqueText 와 같은 규칙(흰 → 잉크 → 진한 잉크 → 검정 중 4.5:1 을 처음 넘는 색).
   영도 그린 #15A05A + 흰 글자 = 3.38:1 로 AA 미달이었다(09-07 티어표에서 겪은 것이 09-12 검수에서 재발 · 봄딩 로즈는 4.75:1 이라 흰색 그대로). */
function onInk(p,bg){
  var cand=['#FFFFFF',p.ink,p.deep,'#000000'], best='#FFFFFF', bc=-1, i, c;
  for(i=0;i<cand.length;i++){ c=contrast(cand[i],bg); if(c>=4.5)return cand[i]; if(c>bc){ bc=c; best=cand[i]; } }
  return best;
}
function styleCols(p,st){ var bg=tone(p,st.bg); return {col:(st.col==='white'?onInk(p,bg):tone(p,st.col)), bg:bg}; }
/* 글꼴 — 나눔스퀘어 = 봄딩 본문 정본(_design/nanumsquare.css). 나머지는 구글 폰트(마운트 때 <link> 한 번, 캔버스는 document.fonts.load 뒤 다시 그린다) */
var FONTS=[
  {id:'nanum',   n:'나눔스퀘어',      fam:'"NanumSquare","나눔스퀘어","Pretendard Variable",sans-serif', w:[400,800], ls:-0.02},
  {id:'pret',    n:'Pretendard',      fam:'"Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif',   w:[500,800], ls:-0.02},
  {id:'black',   n:'검은고딕',        fam:'"Black Han Sans","Pretendard Variable",sans-serif',             w:[400],     ls:0},
  {id:'dohyeon', n:'도현',            fam:'"Do Hyeon","Pretendard Variable",sans-serif',                   w:[400],     ls:0},
  {id:'jua',     n:'주아',            fam:'Jua,"Pretendard Variable",sans-serif',                          w:[400],     ls:0},
  {id:'gaegu',   n:'개구 (손글씨)',   fam:'Gaegu,"Pretendard Variable",sans-serif',                        w:[400,700], ls:0},
  {id:'pen',     n:'나눔손글씨 펜',   fam:'"Nanum Pen Script","Pretendard Variable",sans-serif',           w:[400],     ls:0},
  {id:'song',    n:'송명 (세리프)',   fam:'"Song Myung","Nanum Myeongjo",serif',                           w:[400],     ls:-0.01}
];
var GF_URL='https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Jua&family=Gaegu:wght@400;700&family=Nanum+Pen+Script&family=Song+Myung&display=swap';
var NS_URL=BASE+'../_design/nanumsquare.css';

/* 레일 — 스마트에디터 사진 편집(PC) 순서 그대로 + 도형·그리기는 스티커 뒤 */
var TOOLS=[
  {id:'size',    n:'크기',     full:'크기',        ic:'size'},
  {id:'crop',    n:'자르기',   full:'자르기·회전', ic:'crop'},
  {id:'filter',  n:'필터',     full:'필터',        ic:'filter'},
  {id:'adjust',  n:'보정',     full:'보정',        ic:'sliders'},
  {id:'frame',   n:'액자',     full:'액자',        ic:'frame'},
  {id:'sig',     n:'서명',     full:'서명',        ic:'sig'},
  {id:'mosaic',  n:'모자이크', full:'모자이크',    ic:'mosaic'},
  {id:'text',    n:'텍스트',   full:'텍스트',      ic:'type'},
  {id:'sticker', n:'스티커',   full:'스티커',      ic:'sticker'},
  {id:'shape',   n:'도형',     full:'도형·화살표', ic:'shapes'},
  {id:'draw',    n:'그리기',   full:'그리기',      ic:'pen'},
  {id:'mask',    n:'마스크',   full:'마스크',      ic:'mask'}
];
var ADJ=[
  {k:'bri', n:'밝기'}, {k:'con', n:'대비'}, {k:'sat', n:'채도'}, {k:'tmp', n:'색온도'},
  {k:'hil', n:'하이라이트'}, {k:'sha', n:'그림자'}, {k:'shr', n:'선명도'}, {k:'vig', n:'비네팅'}
];
/* 필터 = 보정 값 묶음 + 톤(lift·스플릿 톤·세피아·그레인). 세기 0~100 이 값 전체를 곱한다 */
var FILTERS=[
  {id:'none',    n:'원본',     p:{}},
  {id:'spring',  n:'봄날',     p:{tmp:10, sat:-4, con:-8, lift:.035, sh:[6,0,8], hi:[12,3,5]}},
  {id:'milk',    n:'딸기우유', p:{bri:8, sat:-22, con:-12, lift:.09, sh:[10,3,9], hi:[14,2,8]}},
  {id:'cream',   n:'크림',     p:{tmp:16, sat:-18, con:-14, lift:.08, sh:[6,4,0], hi:[8,6,0]}},
  {id:'vivid',   n:'선명',     p:{sat:28, con:16, shr:25}},
  {id:'cool',    n:'시원',     p:{tmp:-20, sat:6, con:8, sh:[0,4,12]}},
  {id:'film',    n:'필름',     p:{sat:-12, con:-6, lift:.06, sh:[0,8,12], hi:[12,6,-6], grain:.05}},
  {id:'sunset',  n:'노을',     p:{tmp:26, sat:10, sh:[12,0,14], hi:[18,6,-10]}},
  {id:'mono',    n:'흑백',     p:{sat:-100, con:14}},
  {id:'vintage', n:'빈티지',   p:{sepia:.7, lift:.08, con:-8, vig:30, grain:.04}}
];
var FRAMES=[
  {id:'none',n:'없음'}, {id:'line',n:'라인'}, {id:'margin',n:'여백'}, {id:'polaroid',n:'폴라로이드'}, {id:'scrap',n:'스크랩북'},
  {id:'stitch',n:'스티치'}, {id:'film',n:'필름'}, {id:'heart',n:'하트'}, {id:'tape',n:'테이프'}, {id:'round',n:'둥근 모서리'}
];
var MASKS=[
  {id:'none',n:'없음'}, {id:'circle',n:'원'}, {id:'rounded',n:'둥근 사각'}, {id:'heart',n:'하트'},
  {id:'arch',n:'아치'}, {id:'cloud',n:'구름'}, {id:'scallop',n:'물결'}
];
var MASK_BG=[{id:'clear',n:'투명'},{id:'white',n:'흰색'},{id:'blush',n:'연한 색'},{id:'plum',n:'진한 색'}];
function maskBgCol(id){ var P=pack(); return id==='white'?'#FFFFFF':(id==='blush'?P.tint:(id==='plum'?P.ink:null)); }
/* col·bg 는 «팩 키»(accent·sub·ink·deep·soft·tint·white) — 팩을 바꾸면 같은 스타일이 그 작성자 색으로 나온다 */
var TSTYLES=[
  {id:'plain',  n:'기본',     col:'ink',   bg:'accent'},
  {id:'outline',n:'외곽선',   col:'white', bg:'ink'},
  {id:'label',  n:'라벨',     col:'white', bg:'accent'},
  {id:'marker', n:'형광펜',   col:'ink',   bg:'soft'},
  {id:'bubble', n:'말풍선',   col:'ink',   bg:'white'},
  {id:'memo',   n:'메모지',   col:'ink',   bg:'tint', font:'gaegu'},
  {id:'tape',   n:'테이프',   col:'ink',   bg:'sub'},
  {id:'band',   n:'제목 띠',  col:'white', bg:'ink'},
  {id:'shadow', n:'그림자',   col:'white', bg:'deep'},
  {id:'dash',   n:'점선 박스',col:'ink',   bg:'accent'},
  {id:'chip',   n:'태그',     col:'ink',   bg:'accent'},
  {id:'under',  n:'밑줄 강조',col:'ink',   bg:'hl'}
];
/* 스티커 — 작성자 캐릭터(래스터 webp, _toolbox/photo/stk/<id>.webp · 목록은 _t.webp · 영도는 yd_ 접두) + 벡터(캔버스 경로, 색 바꾸기 가능) */
var STK_CATS=[{id:'bomding',n:'봄딩'},{id:'yeongdo',n:'영도'},{id:'deco',n:'하트·반짝'},{id:'label',n:'라벨'},{id:'point',n:'화살표·강조'},{id:'paper',n:'테이프·메모'},{id:'photo',n:'내 사진'}];
var MASCOT=PACKS.reduce(function(a,p){ return a.concat(p.stk.map(function(id){ return {id:id,n:STK_N[id]||'스티커',pk:p.id}; })); },[]);
var VEC=[
  {k:'heart',      c:'deco',  n:'하트',          ar:1.08, col:'sub'},
  {k:'heartLine',  c:'deco',  n:'하트 선',       ar:1.08, col:'accent'},
  {k:'hearts',     c:'deco',  n:'하트 셋',       ar:1.2,  col:'sub'},
  {k:'sparkle',    c:'deco',  n:'반짝',          ar:1,    col:'hl'},
  {k:'sparkles',   c:'deco',  n:'반짝 셋',       ar:1.1,  col:'hl'},
  {k:'star',       c:'deco',  n:'별',            ar:1.05, col:'hl'},
  {k:'flower',     c:'deco',  n:'꽃',            ar:1,    col:'sub'},
  {k:'blush',      c:'deco',  n:'볼터치',        ar:2.6,  col:'sub'},
  {k:'pill',       c:'label', n:'추천',  tx:'추천',  ar:2.3, col:'accent'},
  {k:'pill',       c:'label', n:'꿀팁',  tx:'꿀팁',  ar:2.3, col:'sub'},
  {k:'pill',       c:'label', n:'주의',  tx:'주의',  ar:2.3, col:'ink'},
  {k:'pill',       c:'label', n:'필수',  tx:'필수',  ar:2.3, col:'accent'},
  {k:'burst',      c:'label', n:'BEST',  tx:'BEST',  ar:1,   col:'accent'},
  {k:'burst',      c:'label', n:'NEW',   tx:'NEW',   ar:1,   col:'sub'},
  {k:'ribbon',     c:'label', n:'핵심',  tx:'핵심',  ar:2.6, col:'ink'},
  {k:'ribbon',     c:'label', n:'득템',  tx:'득템',  ar:2.6, col:'accent'},
  {k:'arrowCurve', c:'point', n:'곡선 화살표',   ar:1.3,  col:'accent'},
  {k:'arrowFat',   c:'point', n:'굵은 화살표',   ar:1.6,  col:'sub'},
  {k:'scribble',   c:'point', n:'강조 동그라미', ar:1.6,  col:'accent'},
  {k:'squiggle',   c:'point', n:'물결 밑줄',     ar:4.2,  col:'accent'},
  {k:'exclaim',    c:'point', n:'느낌표',        ar:.8,   col:'accent'},
  {k:'check',      c:'point', n:'체크',          ar:1,    col:'ok'},
  {k:'cross',      c:'point', n:'엑스',          ar:1,    col:'accent'},
  {k:'num',        c:'point', n:'번호',  tx:'1', ar:1,    col:'accent'},
  {k:'tapeStripe', c:'paper', n:'줄무늬 테이프', ar:3.6,  col:'sub'},
  {k:'tapeDot',    c:'paper', n:'땡땡이 테이프', ar:3.6,  col:'accent'},
  {k:'tapeGrid',   c:'paper', n:'모눈 테이프',   ar:3.6,  col:'ink'},
  {k:'postit',     c:'paper', n:'포스트잇',      ar:1,    col:'note'},
  {k:'postitY',    c:'paper', n:'노랑 포스트잇', ar:1,    col:'note2'},
  {k:'clip',       c:'paper', n:'클립',          ar:.42,  col:'accent'},
  {k:'pin',        c:'paper', n:'압정',          ar:.8,   col:'accent'},
  {k:'torn',       c:'paper', n:'찢은 종이',     ar:1.5,  col:'white'}
];
var SHAPES=[
  {id:'rect',n:'사각형'}, {id:'round',n:'둥근 사각'}, {id:'ellipse',n:'원'}, {id:'tri',n:'삼각형'},
  {id:'star',n:'별'}, {id:'heart',n:'하트'}, {id:'bubble',n:'말풍선'}, {id:'thought',n:'구름 말풍선'},
  {id:'burst',n:'폭탄 말풍선'}, {id:'wave',n:'물결선'}, {id:'line',n:'선'}, {id:'arrow',n:'화살표'},
  {id:'hl',n:'형광 박스'}, {id:'lens',n:'돋보기'}, {id:'num',n:'번호'}
];
var SHAPE_BOX='rect round ellipse tri star heart bubble thought burst wave';   /* 끌어서 상자로 만드는 도형(선·화살표·형광·돋보기·번호 제외) */
function isShape(ob){ return !!ob&&ob.t==='shape'; }
function canFill(k){ return k!=='wave'; }
var CROP_AR=[{id:'free',n:'자유'},{id:'orig',n:'원본'},{id:'1:1',n:'1:1'},{id:'4:3',n:'4:3'},{id:'3:4',n:'3:4'},{id:'16:9',n:'16:9'},{id:'9:16',n:'9:16'},{id:'3:2',n:'3:2'}];
var OUT_PRESETS=[{id:'orig',n:'원본'},{id:'693',n:'693',w:693},{id:'1386',n:'1386',w:1386},{id:'1000',n:'1000',w:1000},{id:'1920',n:'1920',w:1920}];
var SIG_TPL=[{id:'text',n:'글자'},{id:'pill',n:'배지'},{id:'url',n:'블로그 주소'},{id:'mascot',n:'캐릭터'},{id:'stamp',n:'스탬프'},{id:'tape',n:'테이프'}];
var ANCHORS=['tl','tc','tr','ml','mc','mr','bl','bc','br'];

/* ── 설정(localStorage) — 이미지·작업은 IndexedDB(아래 IDB) ── */
var PREF={
  pack:'bomding', hand:false, lay:true,
  tool:'adjust', stkCat:'bomding', shape:'rect', penMode:'pen', cropAR:'free',
  text:{font:'nanum', style:'label', col:'#FFFFFF', bg:'#C93C7C', size:.075, align:'center', bold:true},
  line:{col:'#C93C7C', w:.008, dash:'solid', fill:'none', fo:.22},
  pen:{col:'#C93C7C', w:.008, hlCol:'#FFE45C', hlW:.035},
  mos:{shape:'rect', mode:'pixel', amt:55},
  frame:{col:'#FFFFFF', size:50, caption:''},
  mask:{bg:'clear'},
  sig:{tpl:'pill', text:'봄딩', col:'#C93C7C', size:20, o:92, anchor:'br', auto:false},
  fmt:'auto', out:'orig', outW:1386
};
/* 팩 전환 — «앞으로 만들 것»의 기본값만 바꾼다(이미 올린 개체는 그대로). 서명 글자는 그 작성자 이름·주소 그대로였을 때만 갈아끼운다 */
function applyPack(id){
  var o=pack(), p=PK(id); if(p.id===o.id)return;
  PREF.pack=p.id;
  var st=byId(TSTYLES,PREF.text.style), sc=styleCols(p,st);
  PREF.text.font=st.font||p.font; PREF.text.col=sc.col; PREF.text.bg=sc.bg;
  PREF.line.col=p.accent; PREF.pen.col=p.accent; PREF.pen.hlCol=p.hl; PREF.sig.col=p.accent;
  if(PREF.sig.text===o.sigTx||PREF.sig.text===o.sigUrl||!PREF.sig.text)PREF.sig.text=PREF.sig.tpl==='url'?p.sigUrl:p.sigTx;
  if(PREF.stkCat==='bomding'||PREF.stkCat==='yeongdo')PREF.stkCat=p.id;
  savePrefs();
}
function isHex(v){ return typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v); }
function has(list,id){ return list.some(function(x){ return x.id===id; }); }
(function loadPrefs(){
  try{
    var sv=JSON.parse(localStorage.getItem(LS)||'null'); if(!sv||typeof sv!=='object')return;
    if(has(PACKS,sv.pack))applyPack(sv.pack);   /* 팩 기본값을 먼저 깔고, 아래에서 사용자가 바꾼 값이 이긴다 */
    if(typeof sv.hand==='boolean')PREF.hand=sv.hand;
    if(typeof sv.lay==='boolean')PREF.lay=sv.lay;
    if(has(TOOLS,sv.tool))PREF.tool=sv.tool;
    if(has(STK_CATS,sv.stkCat))PREF.stkCat=sv.stkCat;
    if(has(SHAPES,sv.shape))PREF.shape=sv.shape;
    if(sv.penMode==='pen'||sv.penMode==='hl'||sv.penMode==='erase')PREF.penMode=sv.penMode;
    if(has(CROP_AR,sv.cropAR))PREF.cropAR=sv.cropAR;
    var t=sv.text||{};
    if(has(FONTS,t.font))PREF.text.font=t.font;
    if(has(TSTYLES,t.style))PREF.text.style=t.style;
    if(isHex(t.col))PREF.text.col=t.col; if(isHex(t.bg))PREF.text.bg=t.bg;
    if(typeof t.size==='number'&&t.size>=.01&&t.size<=.4)PREF.text.size=t.size;
    if(t.align==='left'||t.align==='center'||t.align==='right')PREF.text.align=t.align;
    if(typeof t.bold==='boolean')PREF.text.bold=t.bold;
    var l=sv.line||{};
    if(isHex(l.col))PREF.line.col=l.col; if(typeof l.w==='number'&&l.w>0&&l.w<=.06)PREF.line.w=l.w;
    if(l.dash==='solid'||l.dash==='dash'||l.dash==='dot')PREF.line.dash=l.dash;
    if(l.fill==='none'||isHex(l.fill))PREF.line.fill=l.fill; if(typeof l.fo==='number'&&l.fo>=0&&l.fo<=1)PREF.line.fo=l.fo;
    var pn=sv.penSet||{};
    if(isHex(pn.col))PREF.pen.col=pn.col; if(typeof pn.w==='number'&&pn.w>0&&pn.w<=.08)PREF.pen.w=pn.w;
    if(isHex(pn.hlCol))PREF.pen.hlCol=pn.hlCol; if(typeof pn.hlW==='number'&&pn.hlW>0&&pn.hlW<=.12)PREF.pen.hlW=pn.hlW;
    var m=sv.mos||{};
    if(m.shape==='rect'||m.shape==='ellipse')PREF.mos.shape=m.shape;
    if(m.mode==='pixel'||m.mode==='blur')PREF.mos.mode=m.mode;
    if(typeof m.amt==='number'&&m.amt>=1&&m.amt<=100)PREF.mos.amt=m.amt;
    var f=sv.frame||{};
    if(isHex(f.col))PREF.frame.col=f.col; if(typeof f.size==='number'&&f.size>=0&&f.size<=100)PREF.frame.size=f.size;
    if(typeof f.caption==='string')PREF.frame.caption=f.caption.slice(0,40);
    if(sv.mask&&has(MASK_BG,sv.mask.bg))PREF.mask.bg=sv.mask.bg;
    var s=sv.sig||{};
    if(has(SIG_TPL,s.tpl))PREF.sig.tpl=s.tpl;
    if(typeof s.text==='string')PREF.sig.text=s.text.slice(0,40);
    if(isHex(s.col)||s.col==='auto')PREF.sig.col=s.col;
    if(typeof s.size==='number'&&s.size>=6&&s.size<=60)PREF.sig.size=s.size;
    if(typeof s.o==='number'&&s.o>=10&&s.o<=100)PREF.sig.o=s.o;
    if(ANCHORS.indexOf(s.anchor)>=0)PREF.sig.anchor=s.anchor;
    if(typeof s.auto==='boolean')PREF.sig.auto=s.auto;
    if(sv.fmt==='auto'||sv.fmt==='png'||sv.fmt==='jpg')PREF.fmt=sv.fmt;
    if(has(OUT_PRESETS,sv.out)||sv.out==='custom')PREF.out=sv.out;
    if(typeof sv.outW==='number'&&sv.outW>=64&&sv.outW<=MAX_SIDE)PREF.outW=Math.round(sv.outW);
  }catch(e){}
})();
var prefT=0;
function savePrefs(){
  clearTimeout(prefT);
  prefT=setTimeout(function(){
    try{ localStorage.setItem(LS,JSON.stringify({pack:PREF.pack,hand:PREF.hand,lay:PREF.lay,tool:PREF.tool,stkCat:PREF.stkCat,shape:PREF.shape,penMode:PREF.penMode,cropAR:PREF.cropAR,
      text:PREF.text,line:PREF.line,penSet:PREF.pen,mos:PREF.mos,frame:PREF.frame,mask:PREF.mask,sig:PREF.sig,fmt:PREF.fmt,out:PREF.out,outW:PREF.outW})); }catch(e){}
  },250);
}

/* ── 유틸 ── */
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function lerp(a,b,t){ return a+(b-a)*t; }
function hexRGB(hex){ var n=parseInt(String(hex).slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
function rgba(hex,a){ var c=hexRGB(hex); return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'; }
function lum(hex){ var c=hexRGB(hex).map(function(v){ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; }
function contrast(a,b){ var x=lum(a), y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
function shade(hex,k){ /* k<0 어둡게, k>0 밝게 (0~1) */ var c=hexRGB(hex); return '#'+c.map(function(v){ v=k<0?v*(1+k):v+(255-v)*k; return ('0'+Math.round(clamp(v,0,255)).toString(16)).slice(-2); }).join('').toUpperCase(); }
function normHex(v){
  var s=String(v==null?'':v).trim().replace(/^#/,'');
  if(/^[0-9a-fA-F]{3}$/.test(s))s=s.charAt(0)+s.charAt(0)+s.charAt(1)+s.charAt(1)+s.charAt(2)+s.charAt(2);
  return /^[0-9a-fA-F]{6}$/.test(s)?('#'+s.toUpperCase()):null;
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var UIDN=0;
function uid(p){ return (p||'o')+Date.now().toString(36)+(++UIDN).toString(36); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function safeName(s){ return String(s||'').replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[\\\/:*?"<>|]/g,'').replace(/\s+/g,'_').slice(0,40); }
function fmtBytes(n){ return n>=1048576?(n/1048576).toFixed(n>=10485760?0:1)+'MB':Math.max(1,Math.round(n/1024))+'KB'; }
function fontById(id){ for(var i=0;i<FONTS.length;i++)if(FONTS[i].id===id)return FONTS[i]; return FONTS[0]; }
function byId(list,id){ for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i]; return list[0]; }
function swName(hex){ var L=SW(); for(var i=0;i<L.length;i++)if(L[i].c.toUpperCase()===String(hex).toUpperCase())return L[i].n; return '기타'; }
function deg(r){ return r*Math.PI/180; }
function smooth(e0,e1,x){ var t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); }
/* 조사 — 마지막 글자에 받침이 있으면 a(을·이), 없으면 b(를·가). 한글이 아니면 a */
function josa(w,a,b){ var s=String(w), c=s.charCodeAt(s.length-1); return (c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28===0)?b:a; }

/* ── 아이콘(24 격자 · 선) ── */
var IC={
  size:'<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>',
  crop:'<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  filter:'<circle cx="9" cy="9" r="6.5"/><circle cx="15" cy="15" r="6.5"/>',
  sliders:'<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  frame:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><rect x="7.5" y="7.5" width="9" height="9" rx="1"/>',
  sig:'<path d="M3 17c3-1 4.5-9 7-9 2 0-1 8 1.5 8 1.8 0 2.6-4 4.2-4 1.2 0 .8 2.6 2 2.6.7 0 1.6-.8 2.3-1.6"/><path d="M3 21h18"/>',
  mosaic:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  type:'<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  sticker:'<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M14 3v4a2 2 0 0 0 2 2h4"/><path d="M8.5 13h.01"/><path d="M15.5 13h.01"/><path d="M9.5 16.2s1 1.1 2.5 1.1 2.5-1.1 2.5-1.1"/>',
  shapes:'<path d="M8.3 10a.7.7 0 0 1-.63-1.08L11.4 3a.7.7 0 0 1 1.2-.04L16.3 8.9a.7.7 0 0 1-.57 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  mask:'<rect x="3" y="3" width="18" height="18" rx="2.5" stroke-dasharray="2.6 2.6"/><path d="M12 17.2s-4.6-2.8-4.6-5.8a2.3 2.3 0 0 1 4.6-.9 2.3 2.3 0 0 1 4.6.9c0 3-4.6 5.8-4.6 5.8z"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  compare:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M12 3v18"/><path d="m15 9 3 3-3 3"/>',
  zin:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
  zout:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>',
  fit:'<path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/>',
  rotL:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  rotR:'<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  flipH:'<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/>',
  flipV:'<path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2.4"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  dup:'<rect x="8" y="8" width="13" height="13" rx="2.4"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/><path d="M14.5 11.5v6"/><path d="M11.5 14.5h6"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  up:'<path d="m18 15-6-6-6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  wand:'<path d="m15 4-1 1"/><path d="M9 3v2"/><path d="M17 9h2"/><path d="m4 20 11-11"/><path d="m13 7 1.5 1.5"/><path d="M4.5 6.5 6 8"/><path d="M19 13.5 17.5 12"/>',
  reset:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  eraser:'<path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  marker:'<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  bold:'<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  alignL:'<path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/>',
  alignC:'<path d="M21 6H3"/><path d="M17 12H7"/><path d="M19 18H5"/>',
  alignR:'<path d="M21 6H3"/><path d="M21 12H9"/><path d="M21 18H7"/>',
  layers:'<path d="m12 2 8.5 4.9-8.5 4.9L3.5 6.9z"/><path d="m3.5 12 8.5 4.9 8.5-4.9"/><path d="m3.5 17 8.5 4.9 8.5-4.9"/>',
  pipette:'<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  restore:'<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
  lens:'<circle cx="10" cy="10" r="6.5"/><path d="m21 21-6.1-6.1"/><path d="M7.5 10h5"/><path d="M10 7.5v5"/>',
  hash:'<circle cx="12" cy="12" r="9"/><path d="M11 8h1.5v8"/><path d="M10 16h4"/>'
};
function ic(n,cls){ return '<svg class="ic'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(IC[n]||'')+'</svg>'; }

var CSS=
/* 작업대 = 레일 | 스테이지 | 설정 열, 스테이지 아래 고정 내보내기 줄. 높이는 뷰포트(티어표 작업대와 같은 식) */
'.ph{display:grid;grid-template-columns:84px minmax(0,1fr) 360px;grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"rail stage panel" "rail act panel";height:calc(100dvh - 214px);min-height:600px}'+
'@media (max-width:1400px){.ph{grid-template-columns:80px minmax(0,1fr) 320px}}'+
/* 레일 — 목록 선택 어휘(잉크 채움)는 사이트 도구 목록과 같다 */
'.ph-rail{grid-area:rail;display:flex;flex-direction:column;gap:2px;padding:8px 6px;border-right:1px solid var(--hair);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;min-height:0}'+
'.ph-ri{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:100%;min-height:56px;padding:7px 2px 6px;border-radius:12px;color:var(--ink-2);flex:none;'+
  'transition:background var(--t-fast) var(--e),color var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.ph-ri .ic{width:20px;height:20px;stroke-width:1.7}'+
'.ph-ri b{font-size:12.5px;font-weight:600;letter-spacing:-.03em;line-height:1.1;white-space:nowrap}'+
'.ph-ri:hover{background:var(--surface-2);color:var(--ink)}'+
'.ph-ri:active{transform:scale(.97)}'+
'.ph-ri.on{background:var(--ink);color:#fff}'+
'.ph-ri:focus-visible{outline:2px solid var(--ink);outline-offset:1px}'+
'.ph.empty .ph-ri{opacity:.42;pointer-events:none}'+
/* 낮은 화면(1366×768 등)에선 작업대가 600 인데 레일 12개가 710 이라 아래 두 도구가 스크롤 뒤로 숨었다(09-12 실측) → 한 칸을 줄여 다 보이게 */
'@media (min-width:861px) and (max-height:940px){.ph-ri{min-height:46px;padding:5px 2px 4px;gap:3px}.ph-ri .ic{width:18px;height:18px}.ph-ri b{font-size:11.5px}}'+
/* 스테이지 */
'.ph-stage{grid-area:stage;position:relative;min-width:0;min-height:0;overflow:hidden;background:var(--surface-2);touch-action:none;outline:0}'+
'.ph-stage.over{box-shadow:inset 0 0 0 2px var(--ink)}'+
'.ph-stage.t-make.out,.ph-stage.t-make.out .ph-cv{cursor:default}'+
'.ph-stage.t-make{cursor:crosshair}.ph-stage.t-pan,.ph-stage.t-pan .ph-cv{cursor:grab}.ph-stage.panning,.ph-stage.panning .ph-cv{cursor:grabbing}'+
'.ph-cv{position:absolute;left:0;top:0;display:block;box-shadow:0 0 0 1px var(--hair),var(--sh-rest);'+
  'background:repeating-conic-gradient(#E6E8EC 0 25%,#F8F9FB 0 50%) 0 0/16px 16px}'+   /* 투명(마스크·둥근 모서리)이 보이는 체크 */
'.ph-cv[hidden]{display:none}'+
'.ph-ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}'+
'.ph-cmp{position:absolute;left:14px;top:14px;height:28px;padding:0 11px;border-radius:999px;background:var(--ink);color:#fff;font-size:12.5px;font-weight:600;display:flex;align-items:center;pointer-events:none}'+
'.ph-cmp[hidden]{display:none}'+
/* 선택 상자 · 손잡이 */
'.ph-sel{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;box-shadow:0 0 0 1px rgba(255,255,255,.95),0 0 0 2.5px var(--ink)}'+
'.ph-sel.ln{box-shadow:none}'+
'.ph-h{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:3px;background:#fff;box-shadow:0 0 0 1.5px var(--ink),0 1px 3px rgba(14,17,20,.3);pointer-events:auto;touch-action:none}'+
'.ph-h::after{content:"";position:absolute;inset:-10px}'+   /* 보이는 손잡이 12px, 누르는 자리 32px */
'.ph-h.r{border-radius:50%;cursor:grab}'+
'.ph-h.pt{border-radius:50%;width:14px;height:14px;margin:-7px 0 0 -7px}'+
'.ph-rl{position:absolute;left:50%;width:1.5px;margin-left:-.75px;background:var(--ink);pointer-events:none}'+
/* 자르기 */
'.ph-crop{position:absolute;pointer-events:auto;cursor:move;touch-action:none;box-shadow:0 0 0 1.5px #fff,0 0 0 100vmax rgba(14,17,20,.52);'+
  'background-image:linear-gradient(90deg,transparent calc(33.333% - .5px),rgba(255,255,255,.55) calc(33.333% - .5px),rgba(255,255,255,.55) calc(33.333% + .5px),transparent calc(33.333% + .5px),transparent calc(66.667% - .5px),rgba(255,255,255,.55) calc(66.667% - .5px),rgba(255,255,255,.55) calc(66.667% + .5px),transparent calc(66.667% + .5px)),'+
  'linear-gradient(180deg,transparent calc(33.333% - .5px),rgba(255,255,255,.55) calc(33.333% - .5px),rgba(255,255,255,.55) calc(33.333% + .5px),transparent calc(33.333% + .5px),transparent calc(66.667% - .5px),rgba(255,255,255,.55) calc(66.667% - .5px),rgba(255,255,255,.55) calc(66.667% + .5px),transparent calc(66.667% + .5px))}'+
'.ph-crop .ph-h{width:14px;height:14px;margin:-7px 0 0 -7px}'+
'.ph-cropz{position:absolute;left:8px;top:8px;height:24px;padding:0 9px;border-radius:999px;background:rgba(14,17,20,.72);color:#fff;font-size:12.5px;display:flex;align-items:center;pointer-events:none;white-space:nowrap}'+
/* 빈 상태(드롭존) */
'.ph-dz{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;cursor:pointer;outline:0}'+
'.ph-dz[hidden]{display:none}'+
'.ph-dz::after{content:"";position:absolute;inset:16px;border:1.5px dashed var(--hair-3);border-radius:16px;pointer-events:none;transition:border-color var(--t-fast) var(--e)}'+
'.ph-dz:hover::after,.ph-dz.over::after{border-color:var(--ink)}.ph-dz.over::after{border-style:solid;border-width:2px}'+
'.ph-dz:focus-visible::after{border:2px solid var(--ink)}'+
'.ph-dz-in{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:22px 28px 20px;border-radius:16px;background:var(--surface);box-shadow:0 0 0 1px var(--hair),var(--sh-rest);text-align:center;max-width:380px}'+
'.ph-dz-in>.ic{width:24px;height:24px;color:var(--ink-3);margin-bottom:6px;transition:transform var(--t) var(--e-out),color var(--t-fast) var(--e)}'+
'.ph-dz:hover .ph-dz-in>.ic,.ph-dz.over .ph-dz-in>.ic{transform:translateY(-2px);color:var(--ink)}'+
'.ph-dz-in b{font-size:14px;font-weight:600;letter-spacing:-.02em;color:var(--ink)}'+
'.ph-dz-in span{font-size:12.5px;color:var(--ink-3)}'+
'.ph-dz-in .ghost{margin-top:12px;max-width:100%}'+
'.ph-dz-in .ghost span{color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
'.ph [hidden]{display:none!important}'+   /* 사이트 .ghost{display:inline-flex} 등이 [hidden] UA 규칙을 이긴다 — 빈 화면 «이어서 편집»이 늘 보이던 결함(리뷰어 🔴 09-12) */
/* 내보내기 줄 */
'.ph-act{grid-area:act;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid var(--hair);background:var(--surface);min-width:0}'+
'.ph-act .sp{flex:1 1 auto}'+
'.ph-ib{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;color:var(--ink-2);background:var(--surface);box-shadow:0 0 0 1px var(--hair);flex:none;position:relative;'+
  'transition:transform var(--t-fast) var(--e),color var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e),background var(--t-fast) var(--e)}'+
'.ph-ib::after{content:"";position:absolute;inset:-3px}'+
'.ph-ib .ic{width:16px;height:16px}'+
'.ph-ib:hover{color:var(--ink);box-shadow:0 0 0 1px var(--hair-2);transform:translateY(-1px)}'+
'.ph-ib:active{transform:scale(.95)}'+
'.ph-ib.on{background:var(--ink);color:#fff;box-shadow:0 0 0 1px var(--ink)}'+
'.ph-ib:focus-visible,.ph-act .ghost:focus-visible,.ph-act .cta:focus-visible{outline:2px solid var(--ink);outline-offset:2px}'+
'.ph-act button:disabled,.ph-act select:disabled{opacity:.42;cursor:default;transform:none}'+
'.ph-zv{min-width:50px;text-align:center;font-size:12.5px;color:var(--ink-2)}'+
'.ph-vsep{width:1px;height:20px;background:var(--hair-2);margin:0 4px;flex:none}'+
'.ph-fn{font-size:12.5px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto;max-width:280px}'+
'select.f-i.ph-fmt{width:auto;height:34px;padding:0 32px 0 13px;font-size:12.5px;font-weight:600;border-radius:999px;background-color:var(--surface);color:var(--ink-2);flex:none}'+
'.ph-act .ghost .ic,.ph-act .cta .ic{width:14px;height:14px}'+'@media (max-width:1400px){.ph-act .ph-fn{display:none}.ph-act .ghost.cp{width:34px;padding:0;justify-content:center}.ph-act .ghost.cp .lb{display:none}}'+
/* 설정 열 */
/* 설정 열 = 머리 | 설정(여기만 스크롤) | 레이어(바닥 고정·자체 스크롤).
   레이어를 설정 아래에 이어 붙이면 설정이 길어질수록 화면 밖으로 밀려나 «레이어 관리가 힘들다»는 문제가 생긴다(09-12 사용자 지적 4). */
'.ph-panel{grid-area:panel;min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border-left:1px solid var(--hair);position:relative}'+
'.ph-ph{display:flex;align-items:center;gap:8px;padding:14px 18px 12px;background:var(--surface);border-bottom:1px solid var(--hair)}'+
'.ph-scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 18px 18px;scrollbar-width:thin}'+
'.ph-pt{font-size:15px;font-weight:700;letter-spacing:-.03em;color:var(--ink)}'+
'.ph-ph .ghost{height:32px;padding:0 12px}'+'.ph-ph .ph-pks{margin-left:auto}'+
/* 작성자 디자인 고르개 — 얼굴 두 개(봄딩·영도) */
'.ph-pks{display:flex;align-items:center;gap:5px;flex:none}'+
'.ph-pk{width:30px;height:30px;padding:0;border-radius:50%;overflow:hidden;position:relative;flex:none;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);'+
  'transition:box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e),opacity var(--t-fast) var(--e)}'+
'.ph-pk img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block;opacity:.5;transition:opacity var(--t-fast) var(--e)}'+
'.ph-pk:hover{transform:translateY(-1px)}.ph-pk:hover img{opacity:.8}'+
'.ph-pk.on{box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px var(--ink)}.ph-pk.on img{opacity:1}'+
'.ph-pk:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.ph.empty .ph-pb,.ph.empty .ph-ph .ghost,.ph.empty .ph-pks,.ph.empty .ph-laysec{opacity:.42;pointer-events:none}'+
'.ph-sec{padding:13px 0 14px;border-top:1px solid var(--hair)}'+
'.ph-pb>.ph-sec:first-child{border-top:0}'+
'.ph-sec[hidden]{display:none}'+
'.ph-st{display:flex;align-items:center;gap:8px;min-height:28px;margin-bottom:9px;font-size:13.5px;font-weight:700;letter-spacing:-.025em;color:var(--ink)}'+
'.ph-st .d{font-size:12.5px;font-weight:500;color:var(--ink-3)}'+
'.ph-st .ghost{margin-left:auto;height:30px;padding:0 11px}'+
'.ph-sl{display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:8px;min-height:36px}'+
'.ph-sl label{font-size:12.5px;font-weight:600;color:var(--ink-2);white-space:nowrap}'+
'.ph-sl input[type=range]{width:100%;min-width:0;height:28px;margin:0;accent-color:var(--ink)}'+
'.ph-sl.off{opacity:.45}'+
'.ph-nm{display:inline-flex;align-items:center;gap:4px;flex:none}'+
'.ph-nm input{width:58px;height:32px;padding:0 6px;border:0;outline:0;border-radius:9px;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);'+
  'font:inherit;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12.5px;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums;'+
  'transition:box-shadow var(--t-fast) var(--e),background var(--t-fast) var(--e)}'+
'.ph-nm input:focus{box-shadow:0 0 0 2px var(--ink);background:var(--surface)}'+
'.ph-nm input:disabled{color:var(--ink-4);cursor:default}'+
'.ph-nm span{font-size:12.5px;color:var(--ink-3)}'+
'.ph-seg{display:flex;flex-wrap:wrap;gap:6px}'+
'.ph-seg .chip{height:32px;padding:0 12px}'+
'.ph-seg .chip .ic{width:15px;height:15px}'+
'.ph-seg .chip.sq{width:34px;padding:0;justify-content:center}'+
'.ph-seg .chip:focus-visible{outline:2px solid var(--ink);outline-offset:2px}'+
'.ph-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:36px}'+
'.ph-row+.ph-row,.ph-sl+.ph-row,.ph-row+.ph-sl,.ph-seg+.ph-sl,.ph-seg+.ph-row{margin-top:8px}'+
'.ph-lbl{font-size:12.5px;font-weight:600;color:var(--ink-2);margin:12px 0 7px;display:flex;align-items:center;gap:8px}'+
'.ph-lbl:first-child{margin-top:0}'+
'.ph-lbl .d{font-weight:500;color:var(--ink-3)}'+
'.ph-hint{font-size:12.5px;line-height:1.55;color:var(--ink-3);margin-top:9px;word-break:keep-all}'+
/* 타일(필터·액자·마스크·도형·서명 템플릿) */
'.ph-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}'+
'.ph-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 3px 5px;border-radius:12px;min-width:0;'+
  'transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.ph-tile canvas,.ph-tile .tv{display:block;width:100%;max-width:62px;aspect-ratio:1/1;border-radius:9px;background:var(--surface-3);box-shadow:0 0 0 1px var(--hair);transition:box-shadow var(--t-fast) var(--e)}'+
'.ph-tile .tv{display:grid;place-items:center;color:var(--ink-2)}.ph-tile .tv .ic{width:24px;height:24px}'+
'.ph-tile b{font-size:12.5px;font-weight:600;letter-spacing:-.04em;color:var(--ink-2);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}'+
'.ph-tile:hover{background:var(--surface-2)}.ph-tile:hover b{color:var(--ink)}'+
'.ph-tile:active{transform:scale(.97)}'+
'.ph-tile.on{background:var(--surface-2);box-shadow:0 0 0 1px var(--hair-2)}'+
'.ph-tile.on canvas,.ph-tile.on .tv{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink)}'+
'.ph-tile.on b{color:var(--ink)}'+
'.ph-tile:focus-visible{outline:2px solid var(--ink);outline-offset:1px}'+
'.ph-tiles.sm{grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:4px}'+
'.ph-tiles.sm .ph-tile{padding:5px 2px 4px;gap:4px}'+
'.ph-tiles.sm .ph-tile canvas,.ph-tiles.sm .ph-tile .tv{max-width:44px;border-radius:8px}'+
'.ph-tiles.sm .ph-tile .tv .ic{width:20px;height:20px}'+
'.ph-tiles.sm .ph-tile b{font-size:11.5px}'+
/* 스티커 판 */
'.ph-stk{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:6px;margin-top:10px}'+
'.ph-sk{position:relative;aspect-ratio:1/1;border-radius:12px;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);display:grid;place-items:center;padding:6px;cursor:grab;touch-action:manipulation;overflow:hidden;'+
  'transition:background var(--t-fast) var(--e),box-shadow var(--t-fast) var(--e),transform var(--t-fast) var(--e)}'+
'.ph-sk img,.ph-sk canvas{position:absolute;left:6px;top:6px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:contain;display:block;pointer-events:none;-webkit-user-drag:none;user-select:none}'+
'.ph-sk:hover{background:var(--surface);box-shadow:0 0 0 1px var(--hair-2),var(--sh-rest);transform:translateY(-1px)}'+
'.ph-sk:active{transform:scale(.96)}'+
'.ph-sk:focus-visible{outline:2px solid var(--ink);outline-offset:1px}'+
'.ph-sk.miss{cursor:default}.ph-sk.miss:hover{transform:none}'+
'.ph-ghost{position:fixed;left:0;top:0;z-index:50;width:72px;height:72px;margin:-36px 0 0 -36px;pointer-events:none;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.9);box-shadow:0 0 0 1px var(--hair-2),var(--sh-float)}'+
'.ph-ghost img,.ph-ghost canvas{max-width:60px;max-height:60px}'+
'.ph-photoadd{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;margin-top:10px;border-radius:12px;background:var(--surface-2);box-shadow:inset 0 0 0 1.5px var(--hair-3);font-size:13px;font-weight:600;color:var(--ink-2);'+
  'transition:box-shadow var(--t-fast) var(--e),color var(--t-fast) var(--e)}'+
'.ph-photoadd .ic{width:16px;height:16px}.ph-photoadd:hover{box-shadow:inset 0 0 0 1.5px var(--ink);color:var(--ink)}'+
/* 색 스와치 · HEX */
'.ph-crow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:32px}'+
'.ph-sw{width:28px;height:28px;border-radius:50%;background:var(--c);flex:none;position:relative;box-shadow:inset 0 0 0 1px rgba(14,17,20,.16);'+
  'transition:transform var(--t-fast) var(--e-out),box-shadow var(--t-fast) var(--e)}'+
'.ph-sw::after{content:"";position:absolute;inset:-7px}'+
'.ph-sw:hover{transform:scale(1.08)}'+
'.ph-sw.on{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink)}'+
'.ph-sw:focus-visible{outline:2px solid var(--ink);outline-offset:3px}'+
'.ph-sw.none{background:linear-gradient(135deg,transparent 46%,#C4362A 46%,#C4362A 54%,transparent 54%),var(--surface)}'+
'.ph-sw.custom{background:conic-gradient(from 200deg,#C93C7C,#E3B75E,#34C79A,#0F7C86,#7C5BC7,#C93C7C);display:grid;place-items:center;color:#fff}'+
'.ph-sw.custom .ic{width:13px;height:13px;stroke-width:2;filter:drop-shadow(0 0 1px rgba(0,0,0,.6))}'+
'.ph-sw.custom.has{background:var(--cc)}'+
'.ph-hexrow{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12.5px;font-weight:600;color:var(--ink-2)}'+
'.ph-hex{width:100px;height:30px;padding:0 9px;border:0;outline:0;border-radius:9px;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);'+
  'font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12.5px;letter-spacing:.02em;color:var(--ink);text-transform:uppercase;'+
  'transition:box-shadow var(--t-fast) var(--e),background var(--t-fast) var(--e)}'+
'.ph-hex::placeholder{color:var(--ink-3);text-transform:none}'+
'.ph-hex:focus{box-shadow:0 0 0 2px var(--ink);background:var(--surface)}'+
'.ph-hex.bad{box-shadow:0 0 0 2px var(--alert)}'+
'.ph-pick{position:absolute;right:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none}'+'.ph-colors{min-width:0}'+'.ph-hexrow{position:relative}'+'.ph-hexrow .ph-sw.custom{flex:none}'+
/* 입력 */
'.ph-panel .f-i{height:38px;font-size:13.5px}'+
'.ph-panel textarea.f-i{height:auto;min-height:78px;padding:10px 12px;line-height:1.5;resize:vertical}'+
'.ph-panel select.f-i{padding-right:34px}'+
'.ph-wh{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'+
'.ph-wh .ph-nm input{width:78px}'+
'.ph-wh .x{font-size:12.5px;color:var(--ink-3)}'+
'.ph-out{font-size:12.5px;color:var(--ink-2)}.ph-out b{color:var(--ink);font-weight:700}'+
/* 개체 동작 */
'.ph-oa{display:flex;align-items:center;gap:6px;flex-wrap:wrap}'+
'.ph-oa .ghost{height:32px;padding:0 11px}'+
'.ph-oa .ghost.warn:hover,.ph-st .ghost.warn:hover{color:var(--alert);box-shadow:0 0 0 1px rgba(196,54,42,.4)}'+
'.ph-ph .ghost:disabled,.ph-oa .ghost:disabled{opacity:.42;cursor:default;transform:none;box-shadow:0 0 0 1px var(--hair);color:var(--ink-2)}'+
'.ph-panel .ghost:focus-visible,.ph-photoadd:focus-visible,.ph-dz-in .ghost:focus-visible,.ph-panel select.f-i:focus-visible{outline:2px solid var(--ink);outline-offset:2px}'+
/* 레이어 — 바닥 고정 서랍(접기 가능) */
'.ph-laysec{display:flex;flex-direction:column;min-height:0;max-height:min(34vh,238px);border-top:1px solid var(--hair);background:var(--surface)}'+
'.ph-laysec.closed{max-height:none}'+
'.ph-layh{display:flex;align-items:center;gap:7px;flex:none;width:100%;padding:11px 18px;font-size:13.5px;font-weight:700;letter-spacing:-.025em;color:var(--ink);text-align:left;'+
  'transition:background var(--t-fast) var(--e)}'+
'.ph-layh:hover{background:var(--surface-2)}'+
'.ph-layh:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}'+
'.ph-layh>.ic{width:16px;height:16px;color:var(--ink-2);flex:none}'+
'.ph-layh .d{font-weight:500;color:var(--ink-3)}'+
'.ph-layh .cv{margin-left:auto;display:grid;place-items:center;color:var(--ink-3);transition:transform var(--t) var(--e-out)}'+
'.ph-layh .cv .ic{width:15px;height:15px}'+
'.ph-laysec.closed .ph-layh .cv{transform:rotate(-90deg)}'+
'.ph-laysec.closed .ph-lays{display:none}'+
'.ph-lays{list-style:none;margin:0;padding:0 12px 11px;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;display:flex;flex-direction:column;gap:2px}'+
'.ph-lay{display:flex;align-items:center;gap:2px;border-radius:10px;transition:background var(--t-fast) var(--e)}'+
'.ph-lay:hover{background:var(--surface-2)}'+
'.ph-lay.on{background:var(--surface-2);box-shadow:inset 0 0 0 1.5px var(--ink)}'+
'.ph-lay .lsel{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:9px;height:40px;padding:0 6px 0 8px;border-radius:10px;text-align:left;color:var(--ink-2)}'+
'.ph-lay .lsel:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}'+
'.ph-lay .li{width:26px;height:26px;display:grid;place-items:center;border-radius:7px;background:var(--surface);box-shadow:0 0 0 1px var(--hair);flex:none;color:var(--ink-2)}'+
'.ph-lay .li .ic{width:14px;height:14px}'+
'.ph-lay .ln{min-width:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.ph-lay .lb{width:29px;height:32px;display:grid;place-items:center;border-radius:8px;color:var(--ink-3);flex:none}'+
'.ph-lay.off .lsel{opacity:.45}'+'.ph-lay .lb.on{color:var(--ink)}'+
'.ph-lay .lb:hover{background:var(--surface);color:var(--ink)}'+
'.ph-lay .lb:disabled{opacity:.3;cursor:default;background:none}'+
'.ph-lay .lb:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}'+
'.ph-lay .lb .ic{width:14px;height:14px}'+
/* 서명 위치 9칸 */
'.ph-anc{display:grid;grid-template-columns:repeat(3,36px);gap:4px}'+
'.ph-anc button{width:36px;height:36px;border-radius:9px;background:var(--surface-2);box-shadow:0 0 0 1px var(--hair);display:grid;place-items:center;transition:background var(--t-fast) var(--e)}'+
'.ph-anc button i{width:8px;height:8px;border-radius:2px;background:var(--ink-3)}'+
'.ph-anc button:hover{background:var(--surface-3)}'+
'.ph-anc button.on{background:var(--ink)}.ph-anc button.on i{background:#fff}'+
'.ph-anc button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}'+
'@media (max-width:860px){'+
  '.ph{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto auto;grid-template-areas:"rail" "stage" "act" "panel";height:auto;min-height:0}'+
  '.ph-rail{flex-direction:row;overflow-x:auto;overflow-y:hidden;border-right:0;border-bottom:1px solid var(--hair);padding:6px}'+
  '.ph-ri{width:64px;min-height:54px}'+
  '.ph-stage{height:min(58vh,480px)}'+
  '.ph-panel{display:block;overflow:visible;border-left:0;border-top:1px solid var(--hair)}'+
  '.ph-scroll{overflow:visible;padding:0 14px 14px}'+
  '.ph-ph{padding:12px 14px 10px}'+
  '.ph-laysec{max-height:none}'+'.ph-lays{overflow:visible;padding:0 8px 10px}'+
  '.ph-act{padding:10px 12px}'+
  '.ph-fn{max-width:none;flex:1 1 100%;order:9}'+
  '.ph-act .cta{margin-left:auto}'+
'}';

/* ══════════ 자산 ══════════
   이미지는 문서 JSON 밖(ASSETS)에 둔다 — 되돌리기 스냅샷·자동 보관이 가볍고, 원본 교체도 «문서의 base id 가 바뀐 것»일 뿐이라 되돌릴 수 있다. */
var ASSETS={};       /* id → {img,w,h,blob,name,type,kind:'base'|'photo',shrunk} */
var STK={}, STK_P={};  /* 캐릭터 스티커 id → Image / Promise */
function decodeBlob(blob){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(blob), im=new Image(); im.decoding='async';
    im.onload=function(){ URL.revokeObjectURL(url); res(im); };
    im.onerror=function(){ URL.revokeObjectURL(url); rej(new Error('decode')); };
    im.src=url;
  });
}
/* 긴 변이 MAX_SIDE 를 넘는 사진은 캔버스로 줄여 쓴다(원본 blob 은 그대로 보관 — 복원 때 같은 규칙으로 다시 줄인다) */
function fitSource(im){
  var w=im.naturalWidth||im.width, h=im.naturalHeight||im.height, k=Math.min(1,MAX_SIDE/Math.max(w,h));
  if(k>=1)return {img:im,w:w,h:h,shrunk:false};
  var c=document.createElement('canvas'); c.width=Math.round(w*k); c.height=Math.round(h*k);
  var x=c.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(im,0,0,c.width,c.height);
  return {img:c,w:c.width,h:c.height,shrunk:true};
}
function addAsset(blob,name,kind,id){
  return decodeBlob(blob).then(function(im){
    var f=fitSource(im); id=id||uid('a');
    ASSETS[id]={img:f.img,w:f.w,h:f.h,blob:blob,name:name||'',type:blob.type||'',kind:kind,shrunk:f.shrunk};
    return id;
  });
}
function stkLoad(id){
  if(STK[id])return Promise.resolve(STK[id]);
  if(!STK_P[id])STK_P[id]=new Promise(function(res,rej){
    var im=new Image(); im.decoding='async';
    im.onload=function(){ STK[id]=im; res(im); };
    im.onerror=function(){ delete STK_P[id]; rej(new Error('stk '+id)); };
    im.src=ASSET+'stk/'+id+'.webp';
  });
  return STK_P[id];
}

/* ══════════ 문서 ══════════
   m = 방향 행렬 [a,b,c,d] — 원본 중심 기준 (x,y) → (a·x + c·y, b·x + d·y). 원소는 -1·0·1 뿐(90° 회전·반전의 합성)
   st = 수평 맞춤(도, −45~45) — 원본만 돌리고 자르기 창이 비지 않게 k 배 확대한다. 개체는 돌지 않는다.
   crop = 방향 공간의 자르기 창 · objs 좌표도 방향 공간 */
var DOC=null, HIST=[], HI=-1, SEL=null;
function newDoc(baseId){
  var a=ASSETS[baseId];
  return {v:1, base:baseId, m:[1,0,0,1], st:0, crop:{x:0,y:0,w:a.w,h:a.h},
    adj:{bri:0,con:0,sat:0,tmp:0,hil:0,sha:0,shr:0,vig:0}, auto:null,
    flt:{id:'none',amt:100},
    frame:{id:'none',col:PREF.frame.col,size:PREF.frame.size,caption:PREF.frame.caption||''},
    mask:{id:'none',bg:PREF.mask.bg},
    out:{preset:PREF.out,w:PREF.outW},
    objs:[], num:1};
}
function mmul(T,M){ return [T[0]*M[0]+T[2]*M[1], T[1]*M[0]+T[3]*M[1], T[0]*M[2]+T[2]*M[3], T[1]*M[2]+T[3]*M[3]]; }
function odim(d){ d=d||DOC; var a=ASSETS[d.base], m=d.m; return {w:Math.abs(m[0])*a.w+Math.abs(m[2])*a.h, h:Math.abs(m[1])*a.w+Math.abs(m[3])*a.h}; }
var ROT_R=[0,1,-1,0], ROT_L=[0,-1,1,0], FLIP_H=[-1,0,0,1], FLIP_V=[1,0,0,-1];
function normAng(r){ r=((r%360)+540)%360-180; return Math.abs(r)<1e-9?0:r; }
/* 수평 맞춤 확대율 — W×H 틀을 θ 만큼 돌린 사진이 틀을 빈틈 없이 덮는 최소 배율 */
function stK(W,H,st){ var t=Math.abs(deg(st)), c=Math.cos(t), s=Math.sin(t); return Math.max((W*c+H*s)/W,(W*s+H*c)/H); }
function clampCrop(c,W,H){ var w=clamp(c.w,16,W), h=clamp(c.h,16,H); return {x:clamp(c.x,0,W-w), y:clamp(c.y,0,H-h), w:w, h:h}; }
/* 90° 회전·반전 — 사진과 함께 자르기 창·개체를 같은 변환으로 옮긴다 */
function orientDoc(T){
  var o=odim(DOC); DOC.m=mmul(T,DOC.m); var n=odim(DOC);
  function P(x,y){ var dx=x-o.w/2, dy=y-o.h/2; return [T[0]*dx+T[2]*dy+n.w/2, T[1]*dx+T[3]*dy+n.h/2]; }
  var c=DOC.crop, p1=P(c.x,c.y), p2=P(c.x+c.w,c.y+c.h);
  DOC.crop=clampCrop({x:Math.min(p1[0],p2[0]),y:Math.min(p1[1],p2[1]),w:Math.abs(p2[0]-p1[0]),h:Math.abs(p2[1]-p1[1])},n.w,n.h);
  var det=T[0]*T[3]-T[1]*T[2], dAng=det>0?Math.round(Math.atan2(T[1],T[0])*180/Math.PI):0;
  DOC.objs.forEach(function(ob){
    if(ob.t==='line'||ob.t==='arrow'){ var a=P(ob.x1,ob.y1), b=P(ob.x2,ob.y2); ob.x1=a[0]; ob.y1=a[1]; ob.x2=b[0]; ob.y2=b[1]; return; }
    if(ob.t==='pen'){ for(var i=0;i<ob.pts.length;i+=2){ var q=P(ob.pts[i],ob.pts[i+1]); ob.pts[i]=q[0]; ob.pts[i+1]=q[1]; } penBox(ob); return; }
    if(ob.t==='lens'){ var s=P(ob.sx,ob.sy); ob.sx=s[0]; ob.sy=s[1]; }
    var p=P(ob.x,ob.y); ob.x=p[0]; ob.y=p[1];
    if(ob.t==='mosaic'){ if(Math.abs(dAng)===90){ var t=ob.w; ob.w=ob.h; ob.h=t; } ob.r=0; return; }
    ob.r=det>0?normAng((ob.r||0)+dAng):normAng(-(ob.r||0));   /* 반전: 상자는 방향이 없어 −r 이 거울상과 같다(글자가 뒤집히지 않는다) */
  });
  if(det<0)DOC.st=-DOC.st;
}
function arOf(id){
  if(id==='free')return 0;
  if(id==='orig'){ var o=odim(); return o.w/o.h; }
  var p=String(id).split(':'); return (+p[0])/(+p[1]);
}
/* 비율을 고르면 지금 창의 가운데를 지키며 그 비율로 가장 크게 */
function fitCropAR(ar){
  if(!ar)return;
  var o=odim(), c=DOC.crop, cx=c.x+c.w/2, cy=c.y+c.h/2, w=o.w, h=w/ar;
  if(h>o.h){ h=o.h; w=h*ar; }
  DOC.crop=clampCrop({x:cx-w/2,y:cy-h/2,w:w,h:h},o.w,o.h);
}
/* 액자 여백(자르기 창 픽셀 단위) — 크기 슬라이더 0~100(기본 50) */
function framePads(d,cw,ch){
  var f=d.frame, u=Math.min(cw,ch), k=clamp(f.size,0,100)/50, p;
  switch(f.id){
    case 'margin':   p=u*.045*k;          return {l:p,t:p,r:p,b:p};
    case 'polaroid': p=u*(.012+.045*k);   return {l:p,t:p,r:p,b:p+u*(.1+.07*Math.min(k,1.4))};
    case 'scrap':    p=u*(.016+.06*k);    return {l:p,t:p,r:p,b:p};
    case 'stitch':   p=u*(.012+.05*k);    return {l:p,t:p,r:p,b:p};
    case 'film':     p=u*(.075+.04*k);    return {l:u*.02*k,t:p,r:u*.02*k,b:p};
    case 'heart':    p=u*(.016+.055*k);   return {l:p,t:p,r:p,b:p};
    default:         return {l:0,t:0,r:0,b:0};
  }
}
/* 출력 크기 — 폭 프리셋은 «액자 포함» 전체 폭. 긴 변 MAX_SIDE 상한 */
function outInfo(d){
  d=d||DOC; var c=d.crop, pd=framePads(d,c.w,c.h), tw=c.w+pd.l+pd.r, th=c.h+pd.t+pd.b;
  var s=d.out.preset==='orig'?1:(clamp(d.out.w,64,MAX_SIDE)/tw);
  var long=Math.max(tw,th)*s, capped=false; if(long>MAX_SIDE){ s*=MAX_SIDE/long; capped=true; }
  return {s:s, W:Math.max(1,Math.round(tw*s)), H:Math.max(1,Math.round(th*s)), pd:pd, capped:capped};
}
function unitSize(){ var c=DOC.crop; return Math.min(c.w,c.h); }

/* ── 개체 ── 좌표는 방향 공간. 상자형(x,y=가운데 · w,h · r=도) / 선형(x1..y2) / 펜(pts) */
function penBox(ob){
  var p=ob.pts, x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(var i=0;i<p.length;i+=2){ if(p[i]<x0)x0=p[i]; if(p[i]>x1)x1=p[i]; if(p[i+1]<y0)y0=p[i+1]; if(p[i+1]>y1)y1=p[i+1]; }
  var h=ob.sw/2; ob.x=(x0+x1)/2; ob.y=(y0+y1)/2; ob.w=Math.max(1,x1-x0+2*h); ob.h=Math.max(1,y1-y0+2*h); ob.r=0;
}
function lineBox(ob){ var pad=ob.sw*(ob.t==='arrow'?2.2:1)/2+2; return {x:(ob.x1+ob.x2)/2, y:(ob.y1+ob.y2)/2, w:Math.abs(ob.x2-ob.x1)+2*pad, h:Math.abs(ob.y2-ob.y1)+2*pad, r:0}; }
function objById(id){ if(!DOC||!id)return null; for(var i=0;i<DOC.objs.length;i++)if(DOC.objs[i].id===id)return DOC.objs[i]; return null; }
function mkText(x,y,tx){
  var T=PREF.text, st=byId(TSTYLES,T.style), u=unitSize();
  return {id:uid(),t:'text',x:x,y:y,w:40,h:20,r:0,o:1,tx:tx||'텍스트를 입력하세요',font:T.font,fs:Math.max(12,Math.round(u*T.size)),
          col:T.col,bg:T.bg,st:st.id,align:T.align,bold:T.bold,pk:PREF.pack};
}
function mkStk(src,x,y,im){
  var u=unitSize(), ar=im?(im.naturalWidth||im.width)/(im.naturalHeight||im.height):1, h=u*.36, w=h*ar;
  return {id:uid(),t:'stk',src:src,x:x,y:y,w:w,h:h,r:0,o:1};
}
function mkPhoto(assetId,x,y){
  var a=ASSETS[assetId], u=unitSize(), k=u*.5/Math.max(a.w,a.h);
  return {id:uid(),t:'img',src:assetId,x:x,y:y,w:a.w*k,h:a.h*k,r:0,o:1,rad:0};
}
function mkVec(v,x,y){
  var u=unitSize(), h=u*(v.ar>=3?.12:(v.ar>=2?.16:.24)), w=h*v.ar;
  var ob={id:uid(),t:'vec',k:v.k,tx:v.tx||'',col:vecCol(v.col),x:x,y:y,w:w,h:h,r:0,o:1,pk:PREF.pack};
  if(v.k==='num'){ ob.tx=String(DOC.num++); }
  return ob;
}
function mkShape(kind,x1,y1,x2,y2){
  var L=PREF.line, u=unitSize(), sw=Math.max(2,Math.round(u*L.w*10)/10);
  if(kind==='line'||kind==='arrow')return {id:uid(),t:kind,x1:x1,y1:y1,x2:x2,y2:y2,col:L.col,sw:sw,dash:L.dash,head:kind==='arrow'?'end':'none',o:1,hand:PREF.hand};
  var x=Math.min(x1,x2), y=Math.min(y1,y2), w=Math.max(8,Math.abs(x2-x1)), h=Math.max(8,Math.abs(y2-y1));
  if(kind==='hl')return {id:uid(),t:'hl',x:x+w/2,y:y+h/2,w:w,h:h,r:0,o:1,col:PREF.pen.hlCol,hand:PREF.hand};
  if(kind==='num'){ var d=Math.max(24,u*.085); return {id:uid(),t:'vec',k:'num',tx:String(DOC.num++),col:L.col,x:x2,y:y2,w:d,h:d,r:0,o:1,pk:PREF.pack}; }
  return {id:uid(),t:'shape',k:kind,rad:kind==='round'?.2:0,x:x+w/2,y:y+h/2,w:w,h:h,r:0,o:1,col:L.col,sw:sw,dash:L.dash,
          fill:canFill(kind)?L.fill:'none',fo:L.fo,hand:PREF.hand};
}
/* 돋보기 — 끌어서 정한 원(원본 자리) 옆에 2배 원을 둔다. 자리가 없으면 반대편 */
function mkLens(sx,sy,sr){
  var o=odim(), c=DOC.crop, r=sr*2, gap=sr*.6, x=sx+sr+gap+r, y=sy;
  if(x+r>c.x+c.w)x=sx-sr-gap-r;
  x=clamp(x,c.x+r*.6,c.x+c.w-r*.6); y=clamp(y,c.y+r*.6,c.y+c.h-r*.6);
  return {id:uid(),t:'lens',sx:sx,sy:sy,sr:sr,x:x,y:y,w:2*r,h:2*r,r:0,o:1,col:PREF.line.col,sw:Math.max(2,Math.round(unitSize()*.007))};
}
function mkMosaic(x1,y1,x2,y2){
  var M=PREF.mos, x=Math.min(x1,x2), y=Math.min(y1,y2), w=Math.max(8,Math.abs(x2-x1)), h=Math.max(8,Math.abs(y2-y1));
  return {id:uid(),t:'mosaic',shape:M.shape,mode:M.mode,amt:M.amt,x:x+w/2,y:y+h/2,w:w,h:h,r:0,o:1};
}
function mkPen(pts,hl){
  var P=PREF.pen, u=unitSize();
  var ob={id:uid(),t:'pen',pts:pts,hl:!!hl,col:hl?P.hlCol:P.col,sw:Math.max(2,u*(hl?P.hlW:P.w)),o:1};
  penBox(ob); return ob;
}
function mkSig(){
  var S=PREF.sig;
  return {id:uid(),t:'sig',tpl:S.tpl,tx:S.text,col:S.col,size:S.size,o:S.o/100,anchor:S.anchor,x:0,y:0,w:40,h:20,r:0,pk:PREF.pack};
}
/* 벡터 스티커 기본색 — 팩 키(accent·sub·ink·hl) 또는 팩과 무관한 자체 색 */
var VEC_C={ok:'#34C79A',note:'#FFD9E7',note2:'#FFF1A8',white:'#FFFFFF'};
function vecCol(k){ return isHex(k)?k:(VEC_C[k]||tone(pack(),k)); }
function famOf(ob){ return fontById((ob&&ob.pk)?PK(ob.pk).font:'nanum').fam; }
function sigObj(){ if(!DOC)return null; for(var i=0;i<DOC.objs.length;i++)if(DOC.objs[i].t==='sig')return DOC.objs[i]; return null; }

/* ── 되돌리기 ── 문서 JSON 스냅샷(이미지는 id 만) */
function snap(){ return JSON.stringify(DOC); }
function commit(){
  if(!DOC)return;
  var s=snap(); if(HI>=0&&HIST[HI]===s)return;
  HIST=HIST.slice(0,HI+1); HIST.push(s);
  if(HIST.length>HIST_MAX)HIST.shift();
  HI=HIST.length-1;
  if(typeof onDocChanged==='function')onDocChanged(true);
  autosave();
}
function resetHistory(){ HIST=[snap()]; HI=0; }
function restoreAt(i){
  HI=i; DOC=JSON.parse(HIST[HI]);
  if(SEL&&!objById(SEL))SEL=null;
  if(typeof onDocChanged==='function')onDocChanged(false);
  autosave();
}
function undo(){ if(HI>0)restoreAt(HI-1); }
function redo(){ if(HI<HIST.length-1)restoreAt(HI+1); }

/* ── 복원용 검증 — 저장본이 깨졌거나 옛 형태여도 편집기가 죽지 않게 ── */
var OBJ_TYPES={text:1,stk:1,img:1,vec:1,shape:1,rect:1,ellipse:1,hl:1,line:1,arrow:1,pen:1,mosaic:1,lens:1,sig:1};
function num(v,d){ return typeof v==='number'&&isFinite(v)?v:d; }
function sanitizeDoc(d){
  if(!d||typeof d!=='object'||!ASSETS[d.base])throw new Error('doc');
  var a=ASSETS[d.base], out=newDoc(d.base);
  if(Array.isArray(d.m)&&d.m.length===4&&d.m.every(function(v){ return v===0||v===1||v===-1; })&&Math.abs(d.m[0]*d.m[3]-d.m[1]*d.m[2])===1)out.m=d.m.slice();
  out.st=clamp(num(d.st,0),-45,45);
  var o=odim(out), c=d.crop||{};
  out.crop=clampCrop({x:num(c.x,0),y:num(c.y,0),w:num(c.w,o.w),h:num(c.h,o.h)},o.w,o.h);
  ADJ.forEach(function(p){ out.adj[p.k]=clamp(Math.round(num(d.adj&&d.adj[p.k],0)),-100,100); });
  if(d.auto&&typeof d.auto==='object')out.auto={lo:clamp(num(d.auto.lo,0),0,120),hi:clamp(num(d.auto.hi,255),135,255)};
  if(d.flt&&has(FILTERS,d.flt.id))out.flt={id:d.flt.id,amt:clamp(num(d.flt.amt,100),0,100)};
  if(d.frame&&has(FRAMES,d.frame.id))out.frame={id:d.frame.id,col:isHex(d.frame.col)?d.frame.col:'#FFFFFF',size:clamp(num(d.frame.size,50),0,100),caption:typeof d.frame.caption==='string'?d.frame.caption.slice(0,40):''};
  if(d.mask&&has(MASKS,d.mask.id))out.mask={id:d.mask.id,bg:has(MASK_BG,d.mask.bg)?d.mask.bg:'clear'};
  if(d.out&&(has(OUT_PRESETS,d.out.preset)||d.out.preset==='custom'))out.out={preset:d.out.preset,w:clamp(Math.round(num(d.out.w,1386)),64,MAX_SIDE)};
  out.num=Math.max(1,Math.round(num(d.num,1)));
  out.objs=(Array.isArray(d.objs)?d.objs:[]).filter(function(ob){
    if(!ob||typeof ob!=='object'||!OBJ_TYPES[ob.t])return false;
    if(ob.t==='img'&&!ASSETS[ob.src])return false;
    if(ob.t==='pen'&&!(Array.isArray(ob.pts)&&ob.pts.length>=2))return false;
    return true;
  }).map(function(ob){
    if(ob.t==='rect'||ob.t==='ellipse'){ ob.k=ob.t==='ellipse'?'ellipse':(ob.rad?'round':'rect'); ob.t='shape'; }   /* v1 문서 이어받기 */
    if(ob.t==='shape'&&!has(SHAPES,ob.k))ob.k='rect';
    ob.id=typeof ob.id==='string'?ob.id:uid(); ob.o=clamp(num(ob.o,1),0,1); ob.hide=!!ob.hide; return ob; });
  return out;
}

/* ── 자동 보관(IndexedDB · 최근 작업 1건) — 새로고침·탭 닫기에도 이어서 편집 ── */
var IDBP=null, saveT=0;
function idb(){
  if(IDBP)return IDBP;
  IDBP=new Promise(function(res,rej){
    if(!window.indexedDB){ rej(new Error('no idb')); return; }
    var rq; try{ rq=indexedDB.open(IDB_NAME,1); }catch(e){ rej(e); return; }
    rq.onupgradeneeded=function(){ rq.result.createObjectStore(IDB_STORE); };
    rq.onsuccess=function(){ res(rq.result); };
    rq.onerror=function(){ rej(rq.error); };
  });
  IDBP.catch(function(){ IDBP=null; });
  return IDBP;
}
function idbReq(mode,fn){
  return idb().then(function(db){ return new Promise(function(res,rej){
    var tx=db.transaction(IDB_STORE,mode), st=tx.objectStore(IDB_STORE), rq=fn(st), val;
    if(rq)rq.onsuccess=function(){ val=rq.result; };
    tx.oncomplete=function(){ res(val); }; tx.onerror=function(){ rej(tx.error); }; tx.onabort=function(){ rej(tx.error); };
  }); });
}
function usedAssets(d){ var s={}; s[d.base]=1; d.objs.forEach(function(o){ if(o.t==='img')s[o.src]=1; }); return Object.keys(s); }
function autosave(){
  clearTimeout(saveT);
  saveT=setTimeout(function(){
    if(!DOC)return;
    var assets={};
    usedAssets(DOC).forEach(function(id){ var a=ASSETS[id]; if(a&&a.blob)assets[id]={blob:a.blob,name:a.name,type:a.type,kind:a.kind}; });
    var rec={v:1,t:Date.now(),doc:JSON.parse(snap()),assets:assets,name:(ASSETS[DOC.base]||{}).name||''};
    idbReq('readwrite',function(st){ return st.put(rec,'cur'); }).catch(function(){});
  },900);
}
function savedInfo(){ return idbReq('readonly',function(st){ return st.get('cur'); }).then(function(r){ return r&&r.doc&&r.assets?r:null; },function(){ return null; }); }
function loadSaved(rec){
  var ids=Object.keys(rec.assets||{});
  return Promise.all(ids.map(function(id){ var a=rec.assets[id]; return ASSETS[id]?id:addAsset(a.blob,a.name,a.kind,id); }))
    .then(function(){ return sanitizeDoc(rec.doc); });
}

/* ══════════ 그리기 ══════════ */
var SC=1;   /* 지금 그리는 배율 — 그림자 흐림·오프셋은 캔버스 변환을 따르지 않아 직접 곱한다 */
var BLUR_OK=(function(){ try{ var x=document.createElement('canvas').getContext('2d'); return !!x&&typeof x.filter==='string'; }catch(e){ return false; } })();
var TMP_A=document.createElement('canvas'), TMP_B=document.createElement('canvas');
var LABEL_FAM='"NanumSquare","나눔스퀘어","Pretendard Variable",Pretendard,sans-serif';
var LBF=LABEL_FAM;   /* 지금 그리는 벡터·서명의 라벨 글꼴(개체가 들고 있는 팩) */
function rrect(ctx,x,y,w,h,r){ r=Math.max(0,Math.min(r,w/2,h/2)); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function shadow(ctx,blur,oy,col){ ctx.shadowColor=col||'rgba(46,32,56,.22)'; ctx.shadowBlur=Math.max(0,blur*SC); ctx.shadowOffsetX=0; ctx.shadowOffsetY=(oy||0)*SC; }
function noShadow(ctx){ ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; }
function onColor(bg){ return contrast('#FFFFFF',bg)>=2.6?'#FFFFFF':BD.plum; }
function heartShape(ctx,cx,cy,w,h){
  var x=cx-w/2, y=cy-h/2;
  ctx.moveTo(cx,y+h);
  ctx.bezierCurveTo(x+w*.08,y+h*.66, x-w*.02,y+h*.26, x+w*.24,y+h*.07);
  ctx.bezierCurveTo(x+w*.4,y-h*.03, cx-w*.03,y+h*.1, cx,y+h*.27);
  ctx.bezierCurveTo(cx+w*.03,y+h*.1, x+w*.6,y-h*.03, x+w*.76,y+h*.07);
  ctx.bezierCurveTo(x+w*1.02,y+h*.26, x+w*.92,y+h*.66, cx,y+h);
  ctx.closePath();
}
function sparklePath(ctx,cx,cy,r){ var q=r*.13; ctx.moveTo(cx,cy-r); ctx.quadraticCurveTo(cx+q,cy-q,cx+r,cy); ctx.quadraticCurveTo(cx+q,cy+q,cx,cy+r); ctx.quadraticCurveTo(cx-q,cy+q,cx-r,cy); ctx.quadraticCurveTo(cx-q,cy-q,cx,cy-r); ctx.closePath(); }
function starPath(ctx,cx,cy,ro,ri){ for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, r=i%2?ri:ro, x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r; if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y); } ctx.closePath(); }
function burstPath(ctx,cx,cy,ro,ri,n){ for(var i=0;i<n*2;i++){ var a=-Math.PI/2+i*Math.PI/n, r=i%2?ri:ro; if(i)ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); else ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); } ctx.closePath(); }
/* 흰 스티커 테두리 + 옅은 그림자 → 채움 (봄딩 스티커 공통 마감) */
function outlined(ctx,build,fill,lw){
  ctx.save(); shadow(ctx,lw*1.1,lw*.4,'rgba(46,32,56,.22)'); ctx.beginPath(); build(); ctx.lineJoin='round'; ctx.lineWidth=lw; ctx.strokeStyle='#FFFFFF'; ctx.stroke(); ctx.restore();
  ctx.beginPath(); build(); ctx.fillStyle=fill; ctx.fill();
}
function shine(ctx,x,y,r){ ctx.save(); ctx.globalAlpha*=.55; ctx.fillStyle='#FFFFFF'; ctx.beginPath(); ctx.ellipse(x,y,r,r*.62,deg(-35),0,Math.PI*2); ctx.fill(); ctx.restore(); }
function fitText(ctx,tx,maxW,fs,fam,wt){ for(;fs>4;fs-=Math.max(.5,fs*.05)){ ctx.font=(wt||800)+' '+fs+'px '+fam; if(ctx.measureText(tx).width<=maxW)break; } return fs; }
function labelText(ctx,tx,x,y,maxW,fs,col){
  if(!tx)return;
  ctx.letterSpacing='0px'; fs=fitText(ctx,tx,maxW,fs,LBF,800);
  ctx.font='800 '+fs+'px '+LBF; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=col; ctx.fillText(tx,x,y+fs*.04);
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}
function tapePath(ctx,x,y,w,h){
  var d=h*.09, n=6, i;
  ctx.moveTo(x,y); ctx.lineTo(x+w,y);
  for(i=1;i<=n;i++)ctx.lineTo(x+w-(i%2?d:0),y+h*i/n);
  ctx.lineTo(x,y+h);
  for(i=n-1;i>=0;i--)ctx.lineTo(x+(i%2?d:0),y+h*i/n);
  ctx.closePath();
}
function drawTape(ctx,x,y,w,h,col,pat){
  ctx.save(); ctx.beginPath(); tapePath(ctx,x,y,w,h); ctx.fillStyle=rgba(col,.8); ctx.fill(); ctx.clip();
  ctx.globalAlpha*=.42; ctx.fillStyle='#FFFFFF'; ctx.strokeStyle='#FFFFFF';
  if(pat==='dot'){ var r=h*.085, g=h*.33, row=0; for(var yy=y+g*.5;yy<y+h+g;yy+=g,row++){ for(var xx=x+g*.5+(row%2?g/2:0);xx<x+w+g;xx+=g){ ctx.beginPath(); ctx.arc(xx,yy,r,0,Math.PI*2); ctx.fill(); } } }
  else if(pat==='grid'){ ctx.lineWidth=Math.max(1,h*.04); ctx.beginPath(); var gg=h*.25; for(var a=x+gg/2;a<x+w;a+=gg){ ctx.moveTo(a,y); ctx.lineTo(a,y+h); } for(var b=y+gg/2;b<y+h;b+=gg){ ctx.moveTo(x,b); ctx.lineTo(x+w,b); } ctx.stroke(); }
  else if(pat==='stripe'){ ctx.lineWidth=h*.13; ctx.beginPath(); for(var t=x-h;t<x+w+h;t+=h*.42){ ctx.moveTo(t,y+h); ctx.lineTo(t+h,y); } ctx.stroke(); }
  ctx.restore();
}
function paperPath(ctx,x,y,w,h,fold){ ctx.moveTo(x,y); ctx.lineTo(x+w,y); ctx.lineTo(x+w,y+h-fold); ctx.lineTo(x+w-fold,y+h); ctx.lineTo(x,y+h); ctx.closePath(); }
function drawPaper(ctx,x,y,w,h,col,fold,tape){
  ctx.save(); shadow(ctx,Math.min(w,h)*.06,Math.min(w,h)*.02,'rgba(46,32,56,.24)');
  ctx.beginPath(); paperPath(ctx,x,y,w,h,fold); ctx.fillStyle=col; ctx.fill(); ctx.restore();
  if(fold){ ctx.beginPath(); ctx.moveTo(x+w,y+h-fold); ctx.lineTo(x+w-fold,y+h); ctx.lineTo(x+w-fold,y+h-fold); ctx.closePath(); ctx.fillStyle=shade(col,-.12); ctx.fill(); }
  if(tape){ ctx.save(); ctx.translate(x+w/2,y); ctx.rotate(deg(-4)); var tw=w*.38, th=Math.min(h*.2,w*.12); drawTape(ctx,-tw/2,-th/2,tw,th,tape,'stripe'); ctx.restore(); }
}

/* 벡터 스티커 — (0,0) 가운데, w×h 상자 */
function drawVec(ctx,k,w,h,col,tx,fam){
  LBF=fam||LABEL_FAM;
  var m=Math.min(w,h), lw=m*.07, oc=onColor(col), i;
  switch(k){
    case 'heart': outlined(ctx,function(){ heartShape(ctx,0,h*.02,w*.88,h*.84); },col,lw*1.4); shine(ctx,-w*.2,-h*.17,m*.1); break;
    case 'heartLine':
      ctx.save(); ctx.beginPath(); heartShape(ctx,0,h*.02,w*.78,h*.74); ctx.lineJoin='round';
      shadow(ctx,lw,lw*.3); ctx.lineWidth=lw*2.6; ctx.strokeStyle='#FFFFFF'; ctx.stroke(); noShadow(ctx);
      ctx.lineWidth=lw*1.25; ctx.strokeStyle=col; ctx.stroke(); ctx.restore(); break;
    case 'hearts':
      [[-.16,.12,.6,col],[.27,-.17,.4,shade(col,.3)],[.3,.29,.26,shade(col,-.18)]].forEach(function(q){
        var hw=w*q[2]*.82, hh=h*q[2]*.9; outlined(ctx,function(){ heartShape(ctx,w*q[0],h*q[1],hw,hh); },q[3],lw*q[2]*2);
      }); break;
    case 'sparkle': outlined(ctx,function(){ sparklePath(ctx,0,0,m*.46); },col,lw*1.2); break;
    case 'sparkles':
      [[-.17,.1,.34],[.27,-.22,.2],[.24,.3,.13]].forEach(function(q){ outlined(ctx,function(){ sparklePath(ctx,w*q[0],h*q[1],m*q[2]); },col,lw*q[2]*2.6); }); break;
    case 'star': ctx.save(); outlined(ctx,function(){ starPath(ctx,0,h*.05,m*.46,m*.21); },col,lw*1.4); ctx.restore(); shine(ctx,-m*.1,-m*.08,m*.07); break;
    case 'flower':
      outlined(ctx,function(){ for(i=0;i<5;i++){ var a=-Math.PI/2+i*Math.PI*2/5, px=Math.cos(a)*m*.25, py=Math.sin(a)*m*.25; ctx.moveTo(px+m*.21,py); ctx.arc(px,py,m*.21,0,Math.PI*2); } },col,lw*1.2);
      ctx.beginPath(); ctx.arc(0,0,m*.14,0,Math.PI*2); ctx.fillStyle=BD.butter; ctx.fill(); break;
    case 'blush':
      [-1,1].forEach(function(sd){
        var cx=sd*w*.26; ctx.beginPath(); ctx.ellipse(cx,0,w*.2,h*.34,0,0,Math.PI*2); ctx.fillStyle=rgba(col,.75); ctx.fill();
        ctx.save(); ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineCap='round'; ctx.lineWidth=h*.07;
        for(var j=-1;j<=1;j++){ ctx.beginPath(); ctx.moveTo(cx+j*w*.07-w*.02,h*.1); ctx.lineTo(cx+j*w*.07+w*.03,-h*.12); ctx.stroke(); }
        ctx.restore();
      }); break;
    case 'pill':
      outlined(ctx,function(){ rrect(ctx,-w/2+lw,-h/2+lw,w-2*lw,h-2*lw,(h-2*lw)/2); },col,lw*1.5);
      labelText(ctx,tx,0,0,w-2*lw-h*.55,h*.46,oc); break;
    case 'burst':
      outlined(ctx,function(){ burstPath(ctx,0,0,m*.47,m*.4,16); },col,lw*1.1);
      ctx.save(); ctx.beginPath(); ctx.arc(0,0,m*.32,0,Math.PI*2); ctx.setLineDash([m*.035,m*.028]); ctx.lineWidth=m*.018; ctx.strokeStyle=rgba(oc,.75); ctx.stroke(); ctx.restore();
      labelText(ctx,tx,0,0,m*.52,m*.22,oc); break;
    case 'ribbon':
      var bh2=h*.62, tl=w*.12;
      outlined(ctx,function(){ ctx.moveTo(-w/2+lw,-bh2/2+h*.14); ctx.lineTo(-w/2+tl+lw,-bh2/2+h*.14); ctx.lineTo(-w/2+tl+lw,bh2/2+h*.14); ctx.lineTo(-w/2+lw,bh2/2+h*.14); ctx.lineTo(-w/2+tl*.55+lw,h*.14); ctx.closePath();
                              ctx.moveTo(w/2-lw,-bh2/2+h*.14); ctx.lineTo(w/2-tl-lw,-bh2/2+h*.14); ctx.lineTo(w/2-tl-lw,bh2/2+h*.14); ctx.lineTo(w/2-lw,bh2/2+h*.14); ctx.lineTo(w/2-tl*.55-lw,h*.14); ctx.closePath(); },shade(col,-.25),lw*1.2);
      outlined(ctx,function(){ rrect(ctx,-w/2+tl*.7,-bh2/2-h*.06,w-tl*1.4,bh2,h*.08); },col,lw*1.2);
      labelText(ctx,tx,0,-h*.06,w-tl*1.4-h*.4,bh2*.56,oc); break;
    case 'arrowCurve':
      var ah=m*.2;
      ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
      function curve(){ ctx.beginPath(); ctx.moveTo(-w*.4,h*.32); ctx.bezierCurveTo(-w*.28,-h*.28,w*.06,-h*.36,w*.3,-h*.12); }
      function head(){ ctx.beginPath(); ctx.moveTo(w*.42,-h*.02); ctx.lineTo(w*.14,-h*.02-ah*.2); ctx.lineTo(w*.32,-h*.36); ctx.closePath(); }
      shadow(ctx,lw,lw*.3); ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=m*.2; curve(); ctx.stroke(); head(); ctx.lineWidth=m*.12; ctx.stroke(); ctx.fillStyle='#FFFFFF'; ctx.fill(); noShadow(ctx);
      ctx.strokeStyle=col; ctx.lineWidth=m*.09; curve(); ctx.stroke(); head(); ctx.fillStyle=col; ctx.lineWidth=m*.04; ctx.stroke(); ctx.fill();
      ctx.restore(); break;
    case 'arrowFat':
      outlined(ctx,function(){ ctx.moveTo(-w*.44,-h*.17); ctx.lineTo(w*.06,-h*.17); ctx.lineTo(w*.06,-h*.4); ctx.lineTo(w*.45,0); ctx.lineTo(w*.06,h*.4); ctx.lineTo(w*.06,h*.17); ctx.lineTo(-w*.44,h*.17); ctx.closePath(); },col,lw*1.3); break;
    case 'scribble':
      ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
      function loop(){ ctx.beginPath(); for(var t=0;t<=1;t+=.01){ var a=-Math.PI*.62+t*Math.PI*2.18, rx=w*(.44-.05*t), ry=h*(.4-.04*t); var x=Math.cos(a)*rx+w*.02*t, y=Math.sin(a)*ry-h*.02*t; if(t)ctx.lineTo(x,y); else ctx.moveTo(x,y); } }
      ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=m*.1; loop(); ctx.stroke(); ctx.strokeStyle=col; ctx.lineWidth=m*.055; loop(); ctx.stroke(); ctx.restore(); break;
    case 'squiggle':
      ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
      function wave(){ ctx.beginPath(); for(var t=0;t<=1;t+=.01){ var x=-w*.46+t*w*.92, y=Math.sin(t*Math.PI*7)*h*.24; if(t)ctx.lineTo(x,y); else ctx.moveTo(x,y); } }
      ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=h*.42; wave(); ctx.stroke(); ctx.strokeStyle=col; ctx.lineWidth=h*.22; wave(); ctx.stroke(); ctx.restore(); break;
    case 'exclaim':
      ctx.save(); ctx.rotate(deg(8));
      outlined(ctx,function(){ [-.21,.21].forEach(function(dx){ rrect(ctx,w*dx-w*.11,-h*.44,w*.22,h*.6,w*.11); ctx.moveTo(w*dx+w*.11,h*.34); ctx.arc(w*dx,h*.34,w*.11,0,Math.PI*2); }); },col,lw*1.2);
      ctx.restore(); break;
    case 'check':
      outlined(ctx,function(){ ctx.arc(0,0,m*.46,0,Math.PI*2); },col,lw*1.1);
      ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=oc; ctx.lineWidth=m*.1; ctx.beginPath(); ctx.moveTo(-m*.22,m*.01); ctx.lineTo(-m*.05,m*.18); ctx.lineTo(m*.24,-m*.16); ctx.stroke(); ctx.restore(); break;
    case 'cross':
      ctx.save(); ctx.lineCap='round'; shadow(ctx,lw,lw*.3);
      function xx(){ ctx.beginPath(); ctx.moveTo(-m*.33,-m*.33); ctx.lineTo(m*.33,m*.33); ctx.moveTo(m*.33,-m*.33); ctx.lineTo(-m*.33,m*.33); }
      ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=m*.27; xx(); ctx.stroke(); noShadow(ctx); ctx.strokeStyle=col; ctx.lineWidth=m*.15; xx(); ctx.stroke(); ctx.restore(); break;
    case 'num':
      outlined(ctx,function(){ ctx.arc(0,0,m*.45,0,Math.PI*2); },col,lw*1.2);
      labelText(ctx,tx,0,0,m*.62,m*.5,oc); break;
    case 'tapeStripe': drawTape(ctx,-w/2,-h/2,w,h,col,'stripe'); break;
    case 'tapeDot':    drawTape(ctx,-w/2,-h/2,w,h,col,'dot'); break;
    case 'tapeGrid':   drawTape(ctx,-w/2,-h/2,w,h,col,'grid'); break;
    case 'postit': case 'postitY':
      drawPaper(ctx,-w*.44,-h*.4,w*.88,h*.84,col,m*.16,k==='postit'?BD.pink:'#FFFFFF'); break;
    case 'clip':
      var a=w*.34, b=w*.13, top=-h*.28, bot=h*.32;
      ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
      function clip(){ ctx.beginPath(); ctx.moveTo(b,-h*.14); ctx.lineTo(b,bot); ctx.arc(0,bot,b,0,Math.PI); ctx.lineTo(-b,top); ctx.arc((a-b)/2,top,(a+b)/2,Math.PI,Math.PI*2); ctx.lineTo(a,h*.3); ctx.arc(0,h*.3,a,0,Math.PI); ctx.lineTo(-a,-h*.08); }
      shadow(ctx,w*.06,w*.02); ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=w*.2; clip(); ctx.stroke(); noShadow(ctx);
      ctx.strokeStyle=col; ctx.lineWidth=w*.1; clip(); ctx.stroke(); ctx.restore(); break;
    case 'pin':
      var pr=m*.3, py=-h*.18;
      ctx.save(); ctx.lineCap='round'; ctx.strokeStyle='#8F8898'; ctx.lineWidth=m*.07; ctx.beginPath(); ctx.moveTo(0,py+pr*.5); ctx.lineTo(0,h*.44); ctx.stroke(); ctx.restore();
      outlined(ctx,function(){ ctx.arc(0,py,pr,0,Math.PI*2); },col,lw*1.1);
      ctx.beginPath(); ctx.ellipse(0,py+pr*.62,pr*.62,pr*.22,0,0,Math.PI*2); ctx.fillStyle=shade(col,-.22); ctx.fill();
      shine(ctx,-pr*.34,py-pr*.36,pr*.24); break;
    case 'torn':
      ctx.save(); shadow(ctx,m*.06,m*.02,'rgba(46,32,56,.22)'); ctx.beginPath();
      var n=14, seed=7;
      function rnd(){ seed=(seed*9301+49297)%233280; return seed/233280; }
      ctx.moveTo(-w*.46,-h*.36);
      for(i=1;i<=n;i++)ctx.lineTo(-w*.46+w*.92*i/n,-h*.36-(rnd()-.5)*h*.12);
      ctx.lineTo(w*.46,h*.36);
      for(i=n-1;i>=0;i--)ctx.lineTo(-w*.46+w*.92*i/n,h*.36+(rnd()-.5)*h*.12);
      ctx.closePath(); ctx.fillStyle=col; ctx.fill(); ctx.restore(); break;
  }
}

/* ── 텍스트 ── 스타일 12(팩 색): 기본·외곽선·라벨·형광펜·말풍선·메모지·테이프·제목 띠·그림자·점선 박스·태그·밑줄 강조 */
function fontStr(ob){ var F=fontById(ob.font), wt=(ob.bold&&F.w.length>1)?F.w[F.w.length-1]:F.w[0]; return wt+' '+Math.max(4,ob.fs)+'px '+F.fam; }
function textLayout(ctx,ob){
  var F=fontById(ob.font), fs=Math.max(4,ob.fs);
  ctx.font=fontStr(ob); ctx.letterSpacing=((F.ls||0)*fs)+'px';
  var lines=String(ob.tx==null?'':ob.tx).split('\n');
  var ws=lines.map(function(l){ return ctx.measureText(l).width; });
  var tw=Math.max(fs*.6,Math.max.apply(null,ws));
  var lh=fs*(F.id==='pen'?1.1:1.3), asc=fs*.86, desc=fs*.24, th=lh*(lines.length-1)+asc+desc;
  var P={plain:[.06,.04,0],outline:[.14,.1,0],label:[.62,.34,0],marker:[.14,.06,0],bubble:[.72,.5,.5],memo:[.8,.72,0],tape:[.95,.38,0],band:[.72,.44,.18],shadow:[.12,.12,0],dash:[.68,.46,0]}[ob.st]||[.06,.04,0];
  var px=fs*P[0], py=fs*P[1];
  return {F:F,lines:lines,ws:ws,tw:tw,th:th,lh:lh,asc:asc,desc:desc,fs:fs,px:px,py:py,bw:tw+2*px,bh:th+2*py,xb:fs*P[2],font:ctx.font,ls:ctx.letterSpacing};
}
function measureText(ob){ var x=TMP_A.getContext('2d'); var L=textLayout(x,ob); ob.w=L.bw; ob.h=L.bh+L.xb; return L; }
function drawText(ctx,ob){
  var L=textLayout(ctx,ob); ob.w=L.bw; ob.h=L.bh+L.xb;
  ctx.translate(ob.x,ob.y); if(ob.r)ctx.rotate(deg(ob.r));
  var bw=L.bw, bh=L.bh, x0=-bw/2, y0=-ob.h/2, fs=L.fs, bg=isHex(ob.bg)?ob.bg:BD.rose, col=isHex(ob.col)?ob.col:BD.plum, i;
  switch(ob.st){
    case 'label':
      ctx.save(); shadow(ctx,fs*.2,fs*.06,'rgba(46,32,56,.2)'); ctx.beginPath(); rrect(ctx,x0,y0,bw,bh,Math.min(bh/2,fs*1.2)); ctx.fillStyle=bg; ctx.fill(); ctx.restore(); break;
    case 'bubble':
      ctx.save(); shadow(ctx,fs*.34,fs*.1,'rgba(46,32,56,.22)'); ctx.beginPath(); rrect(ctx,x0,y0,bw,bh,Math.min(fs*.8,bh/2));
      var tx0=x0+Math.min(bw*.26,fs*1.6); ctx.moveTo(tx0,y0+bh-2); ctx.lineTo(tx0-fs*.16,y0+bh+L.xb); ctx.lineTo(tx0+fs*.66,y0+bh-2); ctx.closePath();
      ctx.fillStyle=bg; ctx.fill(); ctx.restore(); break;
    case 'memo':
      var MP=PK(ob.pk); ctx.rotate(deg(-1.2)); drawPaper(ctx,x0,y0,bw,bh,bg,fs*.66,bg.toUpperCase()===MP.sub?'#FFFFFF':MP.sub); break;
    case 'tape':
      drawTape(ctx,x0,y0,bw,bh,bg,'stripe'); break;
    case 'band':
      ctx.beginPath(); rrect(ctx,x0,y0,bw,bh+L.xb,fs*.22); ctx.fillStyle=bg; ctx.fill();
      var rw=Math.max(fs*1.2,Math.min(L.tw*.34,bw-2*L.px)), rh=fs*.12, rx=ob.align==='left'?x0+L.px:(ob.align==='right'?x0+bw-L.px-rw:-rw/2);
      var BP=PK(ob.pk); ctx.fillStyle=bg.toUpperCase()===BP.sub?BP.accent:BP.sub; ctx.fillRect(rx,y0+bh+L.xb-L.py*.62-rh,rw,rh); break;
    case 'dash':
      ctx.beginPath(); rrect(ctx,x0+fs*.04,y0+fs*.04,bw-fs*.08,bh-fs*.08,fs*.42); ctx.fillStyle='rgba(255,255,255,.92)'; ctx.fill();
      ctx.save(); ctx.setLineDash([fs*.34,fs*.24]); ctx.lineCap='round'; ctx.lineWidth=fs*.08; ctx.strokeStyle=bg; ctx.stroke(); ctx.restore(); break;
    case 'chip':
      /* 사진 위에 얹는 꼬리표 — 옅은 틴트만 깔면 바탕 사진이 비쳐 글자가 안 읽힌다(09-12 실사진 확인) → 흰 판 + 왼쪽 색 바 */
      ctx.save(); shadow(ctx,fs*.22,fs*.06,'rgba(23,16,30,.2)');
      ctx.beginPath(); rrect(ctx,x0,y0,bw,bh,fs*.16); ctx.fillStyle='rgba(255,255,255,.95)'; ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); rrect(ctx,x0,y0,Math.max(fs*.2,bw*.035),bh,fs*.08); ctx.fillStyle=bg; ctx.fill();
      ctx.globalAlpha*=.1; ctx.beginPath(); rrect(ctx,x0,y0,bw,bh,fs*.16); ctx.fillStyle=bg; ctx.fill(); ctx.restore(); break;
    case 'under':
      ctx.save(); ctx.fillStyle=rgba(bg,.9);
      for(i=0;i<L.lines.length;i++){ if(!L.lines[i])continue; var ulx=lineX(L,ob,i,x0,bw), uby=y0+L.py+L.asc+i*L.lh+L.desc*.42;
        ctx.beginPath(); rrect(ctx,ulx-fs*.04,uby,L.ws[i]+fs*.08,Math.max(2,fs*.16),fs*.06); ctx.fill(); }
      ctx.restore(); break;
    case 'marker':
      ctx.save(); ctx.fillStyle=rgba(bg,.92);
      for(i=0;i<L.lines.length;i++){ if(!L.lines[i])continue; var mlx=lineX(L,ob,i,x0,bw), mby=y0+L.py+L.asc+i*L.lh;
        ctx.beginPath(); rrect(ctx,mlx-fs*.1,mby-L.asc*.44,L.ws[i]+fs*.2,L.asc*.44+L.desc*.7,fs*.08); ctx.fill(); }
      ctx.restore(); break;
  }
  ctx.font=L.font; ctx.letterSpacing=L.ls; ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  for(i=0;i<L.lines.length;i++){
    var line=L.lines[i]; if(!line)continue;
    var lx=lineX(L,ob,i,x0,bw), ly=y0+L.py+L.asc+i*L.lh;
    if(ob.st==='outline'){ ctx.save(); ctx.lineJoin='round'; ctx.miterLimit=2; ctx.lineWidth=fs*.2; ctx.strokeStyle=bg; ctx.strokeText(line,lx,ly); ctx.restore(); }
    if(ob.st==='shadow'){ ctx.save(); shadow(ctx,fs*.24,fs*.07,rgba(bg,.62)); ctx.fillStyle=col; ctx.fillText(line,lx,ly); ctx.restore(); continue; }
    ctx.fillStyle=col; ctx.fillText(line,lx,ly);
  }
}
function lineX(L,ob,i,x0,bw){ return ob.align==='left'?x0+L.px:(ob.align==='right'?x0+bw-L.px-L.ws[i]:-L.ws[i]/2); }

/* ── 서명 ── 템플릿 6(글자·배지·블로그 주소·캐릭터·스탬프·테이프). 위치 9칸이면 자르기 창 기준으로 매번 다시 놓는다 */
/* 서명 글리프 — 팩이 정한다(봄딩 하트 · 영도 네모) */
function sigGlyph(ctx,g,cx,cy,w,h){
  if(g==='square'){ var r=Math.min(w,h)*.22; rrect(ctx,cx-w/2,cy-h/2,w,h,r); return; }
  heartShape(ctx,cx,cy,w,h);
}
function sigFs(ob,d){ return Math.max(8,Math.min(d.crop.w,d.crop.h)*clamp(ob.size,6,60)/100*.25); }
function sigColor(ob){ return isHex(ob.col)?ob.col:(ob.tpl==='text'||ob.tpl==='url'?'#FFFFFF':PK(ob.pk).accent); }
function sigMeasure(ctx,ob,d){
  var fs=sigFs(ob,d), tx=String(ob.tx||PK(ob.pk).sigTx); LBF=famOf(ob); ctx.letterSpacing='0px';
  ctx.font='800 '+fs+'px '+LBF; var tw=ctx.measureText(tx).width;
  var g=fs*.9;   /* 하트 글리프 폭 */
  switch(ob.tpl){
    case 'pill':   ob.w=tw+g+fs*1.5; ob.h=fs*1.9; break;
    case 'url':    ctx.font='700 '+fs+'px '+LBF; tw=ctx.measureText(tx).width; ob.w=tw+fs*1.2; ob.h=fs*1.5; break;
    case 'mascot': ob.w=fs*2.3+tw+fs*1.1; ob.h=fs*2.3; break;
    case 'stamp':  var sfs=fitText(ctx,tx,fs*3.4,fs*.95,LBF,800); ob.w=ob.h=fs*4.6; ob._sfs=sfs; break;
    case 'tape':   ob.w=tw+fs*2.2; ob.h=fs*1.8; break;
    default:       ob.w=tw+fs*.4; ob.h=fs*1.3;
  }
  ob._tw=tw; ob._fs=fs;
}
function sigPlace(ob,d){
  if(!ob.anchor)return;
  var c=d.crop, mg=Math.min(c.w,c.h)*.035, ax=ob.anchor.charAt(1), ay=ob.anchor.charAt(0);
  ob.x=ax==='l'?c.x+mg+ob.w/2:(ax==='r'?c.x+c.w-mg-ob.w/2:c.x+c.w/2);
  ob.y=ay==='t'?c.y+mg+ob.h/2:(ay==='b'?c.y+c.h-mg-ob.h/2:c.y+c.h/2);
}
function drawSig(ctx,ob,d){
  sigMeasure(ctx,ob,d); sigPlace(ob,d);
  var P=PK(ob.pk), fs=ob._fs, tx=String(ob.tx||P.sigTx), col=sigColor(ob), w=ob.w, h=ob.h;
  ctx.translate(ob.x,ob.y); if(ob.r)ctx.rotate(deg(ob.r));
  ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.letterSpacing='0px';
  switch(ob.tpl){
    case 'pill':
      ctx.save(); shadow(ctx,fs*.3,fs*.08,'rgba(23,16,30,.25)'); ctx.beginPath(); rrect(ctx,-w/2,-h/2,w,h,h/2); ctx.fillStyle=col; ctx.fill(); ctx.restore();
      var oc=onColor(col); ctx.beginPath(); sigGlyph(ctx,P.glyph,-w/2+fs*.72+fs*.36,fs*.02,fs*.74,fs*.66); ctx.fillStyle=oc; ctx.fill();
      ctx.font='800 '+fs+'px '+LBF; ctx.fillStyle=oc; ctx.fillText(tx,-w/2+fs*.72+fs*.9,fs*.05); break;
    case 'url':
      ctx.font='700 '+fs+'px '+LBF; ctx.save(); shadow(ctx,fs*.28,fs*.06,col==='#FFFFFF'||lum(col)>.5?'rgba(23,16,30,.55)':'rgba(255,255,255,.7)');
      ctx.fillStyle=col; ctx.fillText(tx,-w/2+fs*.6,fs*.04); ctx.restore(); break;
    case 'mascot':
      ctx.save(); shadow(ctx,fs*.3,fs*.08,'rgba(23,16,30,.22)'); ctx.beginPath(); rrect(ctx,-w/2+h*.35,-h*.36,w-h*.35,h*.72,h*.36); ctx.fillStyle='#FFFFFF'; ctx.fill(); ctx.restore();
      var face=STK[P.face], r=h/2;
      ctx.save(); ctx.beginPath(); ctx.arc(-w/2+r,0,r,0,Math.PI*2); ctx.fillStyle=P.tint; ctx.fill();
      if(face){ ctx.clip(); ctx.drawImage(face,-w/2,-r,h,h); } else stkLoad(P.face).then(requestRender,function(){});
      ctx.restore();
      ctx.beginPath(); ctx.arc(-w/2+r,0,r-fs*.06,0,Math.PI*2); ctx.lineWidth=fs*.14; ctx.strokeStyle=col; ctx.stroke();
      ctx.font='800 '+fs+'px '+LBF; ctx.fillStyle=lum(col)>.6?PK(ob.pk).ink:col; ctx.fillText(tx,-w/2+h+fs*.35,fs*.05); break;
    case 'stamp':
      ctx.save(); ctx.rotate(deg(-9)); ctx.globalAlpha*=.9; ctx.strokeStyle=col; ctx.fillStyle=col;
      ctx.beginPath(); ctx.arc(0,0,w*.46,0,Math.PI*2); ctx.lineWidth=fs*.16; ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,w*.38,0,Math.PI*2); ctx.lineWidth=fs*.06; ctx.stroke();
      ctx.font='800 '+ob._sfs+'px '+LBF; ctx.textAlign='center'; ctx.fillText(tx,0,fs*.05);
      for(var i=0;i<2;i++){ ctx.beginPath(); sigGlyph(ctx,P.glyph,0,(i?1:-1)*w*.27,fs*.46,fs*.42); ctx.fill(); }
      ctx.restore(); break;
    case 'tape':
      drawTape(ctx,-w/2,-h/2,w,h,col,'stripe');
      ctx.font='800 '+fs+'px '+LBF; ctx.textAlign='center'; ctx.fillStyle=PK(ob.pk).ink; ctx.fillText(tx,0,fs*.05); break;
    default:
      ctx.font='800 '+fs+'px '+LBF; ctx.save(); shadow(ctx,fs*.3,fs*.07,lum(col)>.5?'rgba(23,16,30,.6)':'rgba(255,255,255,.75)');
      ctx.fillStyle=col; ctx.fillText(tx,-w/2+fs*.2,fs*.04); ctx.restore();
  }
  ctx.textBaseline='alphabetic'; ctx.textAlign='left';
}

/* ── 도형·선·펜 ── */
function dashArr(dash,sw){ return dash==='dash'?[sw*3.2,sw*2.1]:(dash==='dot'?[.001,sw*2.1]:[]); }

/* ── 도형 외곽선 ──────────────────────────────────────────────────────────
   모든 도형을 «촘촘한 꺾은선»(가운데 0,0 · w×h 상자) 하나로 표현한다 —
   매끈하게 그리면 원·하트가 곡선으로 보일 만큼 조밀하고(64~72점, 어긋남 0.3px 미만),
   손그림은 같은 점들을 «낮은 주파수»로 흔들어 손으로 그은 결을 낸다. */
function arcPts(p,cx,cy,rx,ry,a0,a1,n){ for(var i=0;i<=n;i++){ var a=a0+(a1-a0)*i/n; p.push(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry); } }
function shapeSubs(k,w,h,rad){
  var p=[], i, a, t, x, y;
  switch(k){
    case 'ellipse': arcPts(p,0,0,w/2,h/2,0,Math.PI*2*(1-1/64),64); return [p];
    case 'tri': return [[0,-h/2, w/2,h/2, -w/2,h/2]];
    case 'star':
      for(i=0;i<10;i++){ a=-Math.PI/2+i*Math.PI/5; t=i%2?.46:1; p.push(Math.cos(a)*w/2*t,Math.sin(a)*h/2*t); } return [p];
    case 'burst':
      for(i=0;i<22;i++){ a=-Math.PI/2+i*Math.PI/11; t=i%2?.66:1; p.push(Math.cos(a)*w/2*t,Math.sin(a)*h/2*t); } return [p];
    case 'heart': {
      var xs=[], ys=[], mnx=1e9, mxx=-1e9, mny=1e9, mxy=-1e9;
      for(i=0;i<72;i++){ t=i/72*Math.PI*2;
        x=16*Math.pow(Math.sin(t),3);
        y=-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t));
        xs.push(x); ys.push(y); if(x<mnx)mnx=x; if(x>mxx)mxx=x; if(y<mny)mny=y; if(y>mxy)mxy=y; }
      for(i=0;i<72;i++)p.push((xs[i]-(mnx+mxx)/2)/(mxx-mnx)*w,(ys[i]-(mny+mxy)/2)/(mxy-mny)*h);
      return [p]; }
    case 'wave': {
      var n=48; for(i=0;i<=n;i++){ t=i/n; p.push(-w/2+w*t,Math.sin(t*Math.PI*3)*h/2*.86); } return [p]; }
    case 'thought': {
      for(i=0;i<72;i++){ a=i/72*Math.PI*2; t=1+.11*Math.sin(a*7);
        p.push(Math.cos(a)*w/2*t*.94,-h*.11+Math.sin(a)*h*.39*t); }
      var subs=[p];
      [[-.24,.30,.075],[-.35,.44,.045]].forEach(function(q){ var c=[]; arcPts(c,w*q[0],h*q[1],w*q[2],w*q[2],0,Math.PI*2*(1-1/20),20); subs.push(c); });
      return subs; }
    case 'bubble': {
      var bh=h*.8, y0=-h/2, y1=y0+bh, x0=-w/2, x1=w/2, r=Math.min(w,bh)*.2;
      arcPts(p,x1-r,y0+r,r,r,-Math.PI/2,0,6);
      arcPts(p,x1-r,y1-r,r,r,0,Math.PI/2,6);
      p.push(x0+w*.44,y1, x0+w*.26,h/2, x0+w*.20,y1);
      arcPts(p,x0+r,y1-r,r,r,Math.PI/2,Math.PI,6);
      arcPts(p,x0+r,y0+r,r,r,Math.PI,Math.PI*1.5,6);
      return [p]; }
    default: {
      var rr=Math.min(w,h)*(k==='round'?(rad||.2):(rad||0));
      if(rr<=0.01)return [[-w/2,-h/2, w/2,-h/2, w/2,h/2, -w/2,h/2]];
      var ax=w/2-rr, ay=h/2-rr;
      arcPts(p,ax,-ay,rr,rr,-Math.PI/2,0,6);
      arcPts(p,ax,ay,rr,rr,0,Math.PI/2,6);
      arcPts(p,-ax,ay,rr,rr,Math.PI/2,Math.PI,6);
      arcPts(p,-ax,-ay,rr,rr,Math.PI,Math.PI*1.5,6);
      return [p]; }
  }
}
/* 손그림 전에 긴 변을 잘게 나눈다 — 그래야 «자로 그은 직선»이 아니라 살짝 휘는 손 선이 된다 */
function densify(p,closed,maxLen){
  var n=p.length/2, out=[], i, j, x0, y0, x1, y1, d, k;
  if(n<2)return p.slice();
  for(i=0;i<(closed?n:n-1);i++){
    x0=p[i*2]; y0=p[i*2+1]; x1=p[((i+1)%n)*2]; y1=p[((i+1)%n)*2+1];
    out.push(x0,y0);
    d=Math.hypot(x1-x0,y1-y0); k=Math.ceil(d/maxLen);
    for(j=1;j<k;j++)out.push(x0+(x1-x0)*j/k,y0+(y1-y0)*j/k);
  }
  if(!closed)out.push(p[(n-1)*2],p[(n-1)*2+1]);
  return out;
}
function seedOf(id){ var v=2166136261, t=String(id||'x'); for(var i=0;i<t.length;i++){ v^=t.charCodeAt(i); v=(v*16777619)>>>0; } return v||7; }
/* 손 떨림 — 개체 id 로 고정이라 다시 그려도·내보내도 같은 모양이 나온다(닫힌 길은 주기를 맞춰 이음매가 안 생긴다) */
function handPts(p0,closed,amp,seed,maxLen){
  var p=densify(p0,closed,maxLen||9e9), n=p.length/2, out=new Array(p.length), i, u, r=seed/4294967296*Math.PI*2;
  var f1=2+(seed>>>5)%2, f2=5+(seed>>>11)%3, ph1=r, ph2=r*2.7+1.1, ph3=r*1.7+.6, ph4=r*3.3+2.2, ph5=r*1.3, ph6=r*2.1+.9;
  function w(u,pa,pb){ return Math.sin(u*Math.PI*2+pa)*.52+Math.sin(u*Math.PI*2*f1+pb)*.32+Math.sin(u*Math.PI*2*f2+pa*1.7)*.22; }
  for(i=0;i<n;i++){
    u=closed?i/n:i/(n-1||1);
    out[i*2]=p[i*2]+amp*w(u,ph1,ph2);
    out[i*2+1]=p[i*2+1]+amp*w(u,ph3,ph4)*.94;
  }
  if(!closed){ out[0]=p[0]; out[1]=p[1]; out[p.length-2]=p[p.length-2]; out[p.length-1]=p[p.length-1]; }
  else{ out[0]+=amp*.35*Math.cos(ph5); out[1]+=amp*.35*Math.sin(ph6); }
  return out;
}
/* mode: true=닫아 그린다 · false=열린 선 · 'over'=닫힌 길을 살짝 지나치게 그어 손그림 티를 낸다 */
function tracePoly(ctx,p,mode){
  var n=p.length/2, i, e;
  if(n<2)return;
  ctx.moveTo(p[0],p[1]);
  for(i=1;i<n;i++)ctx.lineTo(p[i*2],p[i*2+1]);
  if(mode===true){ ctx.closePath(); return; }
  if(mode==='over'){ e=Math.max(2,Math.round(n*.04)); for(i=0;i<=e;i++)ctx.lineTo(p[(i%n)*2],p[(i%n)*2+1]); }
}
function shapePath(ctx,subs,hand,amp,seed,closed,over,maxLen){
  for(var i=0;i<subs.length;i++){
    var p=hand?handPts(subs[i],closed,amp,seed+i*1013,maxLen):subs[i];
    tracePoly(ctx,p,closed?(over?'over':true):false);
  }
}
function drawShape(ctx,ob){
  ctx.translate(ob.x,ob.y); if(ob.r)ctx.rotate(deg(ob.r));
  var k=ob.k||'rect', subs=shapeSubs(k,ob.w,ob.h,ob.rad), closed=k!=='wave';
  var u=Math.min(ob.w,ob.h), hand=!!ob.hand, amp=hand?Math.max(1.2,u*.022):0, seg=Math.max(6,u/7), sd=seedOf(ob.id), q;
  if(closed&&ob.fill&&ob.fill!=='none'){
    ctx.save(); ctx.globalAlpha*=clamp(ob.fo==null?.22:ob.fo,0,1); ctx.fillStyle=ob.fill;
    ctx.beginPath(); shapePath(ctx,subs,hand,amp,sd,true,false,seg); ctx.fill(); ctx.restore();
  }
  if(ob.sw>0){
    ctx.lineJoin='round'; ctx.lineCap='round'; ctx.strokeStyle=ob.col; ctx.setLineDash(dashArr(ob.dash,ob.sw));
    for(q=0;q<(hand?2:1);q++){
      ctx.save();
      ctx.lineWidth=ob.sw*(q?.8:1); if(q)ctx.globalAlpha*=.5;
      ctx.beginPath(); shapePath(ctx,subs,hand,amp*(q?1.35:1),sd+q*7919,closed,hand,seg); ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);
  }
}
function drawHl(ctx,ob){
  ctx.translate(ob.x,ob.y); if(ob.r)ctx.rotate(deg(ob.r));
  ctx.globalCompositeOperation='multiply'; ctx.globalAlpha*=.62; ctx.fillStyle=ob.col;
  ctx.beginPath();
  if(ob.hand)shapePath(ctx,shapeSubs('round',ob.w,ob.h,.12),true,Math.max(1.5,Math.min(ob.w,ob.h)*.055),seedOf(ob.id),true,false,Math.max(8,Math.min(ob.w,ob.h)/6));
  else rrect(ctx,-ob.w/2,-ob.h/2,ob.w,ob.h,Math.min(ob.w,ob.h)*.12);
  ctx.fill();
}
function drawLine(ctx,ob){
  var dx=ob.x2-ob.x1, dy=ob.y2-ob.y1, len=Math.sqrt(dx*dx+dy*dy)||1, ux=dx/len, uy=dy/len, sw=ob.sw;
  var head=ob.t==='arrow'?(ob.head||'end'):'none', hl=Math.max(sw*3.4,8), hw=Math.max(sw*1.5,5);
  var sx=ob.x1, sy=ob.y1, ex=ob.x2, ey=ob.y2;
  if(head==='end'||head==='both'){ ex-=ux*hl*.8; ey-=uy*hl*.8; }
  if(head==='both'){ sx+=ux*hl*.8; sy+=uy*hl*.8; }
  ctx.lineWidth=sw; ctx.strokeStyle=ob.col; ctx.fillStyle=ob.col; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.setLineDash(dashArr(ob.dash,sw)); ctx.beginPath();
  if(ob.hand){ tracePoly(ctx,handPts([sx,sy,ex,ey],false,Math.max(1.2,len*.018),seedOf(ob.id),Math.max(6,len/14)),false); }
  else{ ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); }
  ctx.stroke(); ctx.setLineDash([]);
  function tip(px,py,vx,vy){ var bx=px-vx*hl, by=py-vy*hl; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(bx-vy*hw,by+vx*hw); ctx.lineTo(bx+vy*hw,by-vx*hw); ctx.closePath(); ctx.lineWidth=sw*.5; ctx.stroke(); ctx.fill(); }
  if(head==='end'||head==='both')tip(ob.x2,ob.y2,ux,uy);
  if(head==='both')tip(ob.x1,ob.y1,-ux,-uy);
}
function drawPen(ctx,ob){
  var p=ob.pts; if(!p||p.length<2)return;
  ctx.lineWidth=ob.sw; ctx.strokeStyle=ob.col; ctx.lineJoin='round'; ctx.lineCap='round';
  if(ob.hl){ ctx.globalCompositeOperation='multiply'; ctx.globalAlpha*=.62; ctx.lineCap='butt'; }
  ctx.beginPath(); ctx.moveTo(p[0],p[1]);
  if(p.length<=4){ ctx.lineTo(p[p.length-2]+.01,p[p.length-1]); }
  else{ for(var i=2;i<p.length-2;i+=2){ ctx.quadraticCurveTo(p[i],p[i+1],(p[i]+p[i+2])/2,(p[i+1]+p[i+3])/2); } ctx.lineTo(p[p.length-2],p[p.length-1]); }
  ctx.stroke();
}
/* 모자이크 — 그 아래까지 합성된 픽셀을 떠서(자기 캔버스 → 임시) 블록/흐림으로 되돌려 놓는다. 크기는 출력 기준이라 미리보기와 결과가 같다 */
function drawMosaic(ctx,ob,s,c){
  var cv=ctx.canvas, bx=(ob.x-ob.w/2-c.x)*s, by=(ob.y-ob.h/2-c.y)*s, bw=ob.w*s, bh=ob.h*s;
  var x0=Math.max(0,Math.floor(bx)), y0=Math.max(0,Math.floor(by)), x1=Math.min(cv.width,Math.ceil(bx+bw)), y1=Math.min(cv.height,Math.ceil(by+bh));
  var w=x1-x0, h=y1-y0; if(w<1||h<1)return;
  var u=Math.min(c.w,c.h)*s, amt=clamp(ob.amt,1,100)/100;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  ctx.beginPath(); if(ob.shape==='ellipse')ctx.ellipse(bx+bw/2,by+bh/2,bw/2,bh/2,0,0,Math.PI*2); else ctx.rect(bx,by,bw,bh); ctx.clip();
  if(ob.mode==='blur'){
    var rad=Math.max(1,u*(.004+.03*amt)), pad=Math.ceil(rad*2.5);
    var sx=Math.max(0,x0-pad), sy=Math.max(0,y0-pad), sw=Math.min(cv.width,x1+pad)-sx, sh=Math.min(cv.height,y1+pad)-sy;
    TMP_A.width=sw; TMP_A.height=sh; var ta=TMP_A.getContext('2d'); ta.clearRect(0,0,sw,sh); ta.drawImage(cv,sx,sy,sw,sh,0,0,sw,sh);
    if(BLUR_OK){ ctx.filter='blur('+rad.toFixed(1)+'px)'; ctx.drawImage(TMP_A,sx,sy); ctx.filter='none'; ctx.drawImage(TMP_A,sx,sy,0,0,0,0,0,0); }
    else{ var kk=Math.max(2,Math.round(rad)); TMP_B.width=Math.max(1,Math.round(sw/kk)); TMP_B.height=Math.max(1,Math.round(sh/kk));
      var tb=TMP_B.getContext('2d'); tb.imageSmoothingQuality='high'; tb.drawImage(TMP_A,0,0,TMP_B.width,TMP_B.height);
      ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.drawImage(TMP_B,sx,sy,sw,sh); }
  }else{
    var blk=Math.max(3,Math.round(u*(.008+.05*amt))), gw=Math.ceil(w/blk), gh=Math.ceil(h/blk);
    TMP_A.width=gw; TMP_A.height=gh; var t2=TMP_A.getContext('2d'); t2.imageSmoothingEnabled=true; t2.imageSmoothingQuality='medium'; t2.clearRect(0,0,gw,gh);
    t2.drawImage(cv,x0,y0,gw*blk,gh*blk,0,0,gw,gh);
    ctx.imageSmoothingEnabled=false; ctx.drawImage(TMP_A,0,0,gw,gh,x0,y0,gw*blk,gh*blk);
  }
  ctx.restore();
}
/* 돋보기 — 원본 자리(점선 원) → 확대 원(흰 테 + 색 테) · 두 원 사이 점선 */
function drawLens(ctx,ob,s,c){
  var cv=ctx.canvas, R=ob.w/2, sr=Math.max(2,ob.sr);
  var sx=(ob.sx-sr-c.x)*s, sy=(ob.sy-sr-c.y)*s, sd=2*sr*s, ts=Math.max(2,Math.ceil(sd));
  TMP_B.width=ts; TMP_B.height=ts; var tb=TMP_B.getContext('2d'); tb.clearRect(0,0,ts,ts); tb.drawImage(cv,sx,sy,sd,sd,0,0,ts,ts);
  var dx=ob.x-ob.sx, dy=ob.y-ob.sy, dist=Math.sqrt(dx*dx+dy*dy)||1, ux=dx/dist, uy=dy/dist, sw=ob.sw;
  ctx.lineWidth=sw; ctx.strokeStyle=ob.col; ctx.lineCap='round';
  ctx.setLineDash([sw*2.4,sw*1.8]);
  if(dist>R+sr){ ctx.beginPath(); ctx.moveTo(ob.sx+ux*sr,ob.sy+uy*sr); ctx.lineTo(ob.x-ux*R,ob.y-uy*R); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(ob.sx,ob.sy,sr,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); shadow(ctx,R*.16,R*.05,'rgba(23,16,30,.3)'); ctx.beginPath(); ctx.arc(ob.x,ob.y,R,0,Math.PI*2); ctx.fillStyle='#FFFFFF'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(ob.x,ob.y,R,0,Math.PI*2); ctx.clip(); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.drawImage(TMP_B,0,0,ts,ts,ob.x-R,ob.y-R,2*R,2*R); ctx.restore();
  ctx.beginPath(); ctx.arc(ob.x,ob.y,R,0,Math.PI*2); ctx.lineWidth=sw*2.2; ctx.strokeStyle='#FFFFFF'; ctx.stroke(); ctx.lineWidth=sw; ctx.strokeStyle=ob.col; ctx.stroke();
}
function drawObj(ctx,ob,s,c,d){
  SC=s;
  ctx.save();
  ctx.setTransform(s,0,0,s,-c.x*s,-c.y*s);
  ctx.globalAlpha=clamp(ob.o==null?1:ob.o,0,1);
  switch(ob.t){
    case 'text': drawText(ctx,ob); break;
    case 'sig': drawSig(ctx,ob,d); break;
    case 'stk':
      var im=STK[ob.src];
      if(im){ ctx.translate(ob.x,ob.y); if(ob.r)ctx.rotate(deg(ob.r)); if(ob.fx)ctx.scale(-1,1); ctx.imageSmoothingQuality='high'; ctx.drawImage(im,-ob.w/2,-ob.h/2,ob.w,ob.h); }
      else stkLoad(ob.src).then(requestRender,function(){});
      break;
    case 'img':
      var a=ASSETS[ob.src]; if(!a)break;
      ctx.translate(ob.x,ob.y); if(ob.r)ctx.rotate(deg(ob.r));
      if(ob.bd){ var bdw=Math.min(ob.w,ob.h)*.045; ctx.save(); shadow(ctx,bdw*1.4,bdw*.4,'rgba(23,16,30,.28)'); ctx.beginPath(); rrect(ctx,-ob.w/2-bdw,-ob.h/2-bdw,ob.w+2*bdw,ob.h+2*bdw,Math.min(ob.w,ob.h)*(ob.rad||0)+bdw); ctx.fillStyle='#FFFFFF'; ctx.fill(); ctx.restore(); }
      if(ob.rad){ ctx.beginPath(); rrect(ctx,-ob.w/2,-ob.h/2,ob.w,ob.h,Math.min(ob.w,ob.h)*ob.rad); ctx.clip(); }
      ctx.imageSmoothingQuality='high'; ctx.drawImage(a.img,-ob.w/2,-ob.h/2,ob.w,ob.h);
      break;
    case 'vec': ctx.translate(ob.x,ob.y); if(ob.r)ctx.rotate(deg(ob.r)); drawVec(ctx,ob.k,ob.w,ob.h,isHex(ob.col)?ob.col:PK(ob.pk).accent,ob.tx,famOf(ob)); break;
    case 'shape': drawShape(ctx,ob); break;
    case 'hl': drawHl(ctx,ob); break;
    case 'line': case 'arrow': drawLine(ctx,ob); break;
    case 'pen': drawPen(ctx,ob); break;
    case 'mosaic': drawMosaic(ctx,ob,s,c); break;
    case 'lens': drawLens(ctx,ob,s,c); break;
  }
  ctx.restore();
}

/* ── 사진층: 방향 → 수평 → 자르기 → 필터+보정(픽셀) ── */
function drawBase(ctx,d,s,full){
  var a=ASSETS[d.base], o=odim(d), c=full?{x:0,y:0,w:o.w,h:o.h}:d.crop, m=d.m;
  ctx.save();
  ctx.setTransform(s,0,0,s,-c.x*s,-c.y*s);
  ctx.translate(o.w/2,o.h/2);
  if(d.st){ ctx.rotate(deg(d.st)); var k=stK(o.w,o.h,d.st); ctx.scale(k,k); }
  ctx.transform(m[0],m[1],m[2],m[3],0,0);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.drawImage(a.img,-a.w/2,-a.h/2,a.w,a.h);
  ctx.restore();
}
function effParams(d){
  var f=byId(FILTERS,d.flt.id).p, t=clamp(d.flt.amt,0,100)/100, A=d.adj;
  function F(k){ return (f[k]||0)*t; }
  function V(k){ return (f[k]||[0,0,0]).map(function(v){ return v*t; }); }
  return {bri:F('bri')+A.bri, con:F('con')+A.con, sat:F('sat')+A.sat, tmp:F('tmp')+A.tmp, hil:A.hil, sha:A.sha,
          shr:F('shr')+A.shr, vig:F('vig')+A.vig, lift:F('lift'), sepia:F('sepia'), grain:F('grain'), sh:V('sh'), hi:V('hi'), auto:d.auto};
}
function isIdentity(P){ return !(P.bri||P.con||P.sat||P.tmp||P.hil||P.sha||P.shr||P.vig||P.lift||P.sepia||P.grain||P.sh[0]||P.sh[1]||P.sh[2]||P.hi[0]||P.hi[1]||P.hi[2]||P.auto); }
function toneLUT(P){
  var L=new Uint8ClampedArray(256), lo=P.auto?P.auto.lo:0, hi=P.auto?P.auto.hi:255;
  var ge=Math.pow(2,-clamp(P.bri,-150,150)/100), cf=P.con>=0?1+P.con/100*1.1:1+Math.max(P.con,-100)/100*.75;
  var hd=clamp(P.hil,-100,100)/100*.4, sd=clamp(P.sha,-100,100)/100*.4, lift=P.lift||0;
  for(var i=0;i<256;i++){
    var x=clamp((i-lo)/Math.max(1,hi-lo),0,1);
    x=Math.pow(x,ge); x=clamp((x-.5)*cf+.5,0,1);
    var th=smooth(.45,1,x); x+=hd*th*(hd>0?(1-x):x);
    var ts=1-smooth(0,.55,x); x+=sd*ts*(sd>0?(1-x):x);
    x=lift+x*(1-lift);
    L[i]=Math.round(clamp(x,0,1)*255);
  }
  return L;
}
function processPixels(cv,P){
  if(isIdentity(P))return;
  var w=cv.width, h=cv.height; if(!w||!h)return;
  var ctx=cv.getContext('2d'), img=ctx.getImageData(0,0,w,h), px=img.data;
  var L=toneLUT(P), sat=1+clamp(P.sat,-100,100)/100, tr=P.tmp/100*28, tg=P.tmp/100*4, tb=-P.tmp/100*28;
  var sh=P.sh, hi=P.hi, split=!!(sh[0]||sh[1]||sh[2]||hi[0]||hi[1]||hi[2]), sep=clamp(P.sepia||0,0,1), gr=(P.grain||0)*255, vig=clamp(P.vig,-100,100)/100;
  var cx=w/2, cy=h/2, rmax=Math.sqrt(cx*cx+cy*cy)||1, VR=vig?new Float32Array(w):null;
  for(var y=0;y<h;y++){
    var dy=(y-cy)/rmax, row=y*w;
    if(vig){ for(var q=0;q<w;q++){ var dx=(q-cx)/rmax; VR[q]=smooth(.42,1.02,Math.sqrt(dx*dx+dy*dy)); } }
    for(var x=0;x<w;x++){
      var i=(row+x)*4; if(px[i+3]===0)continue;
      var r=L[px[i]]+tr, g=L[px[i+1]]+tg, b=L[px[i+2]]+tb;
      var l=.299*r+.587*g+.114*b;
      if(sat!==1){ r=l+(r-l)*sat; g=l+(g-l)*sat; b=l+(b-l)*sat; }
      if(sep){ var r0=r,g0=g,b0=b; r+=(.393*r0+.769*g0+.189*b0-r0)*sep; g+=(.349*r0+.686*g0+.168*b0-g0)*sep; b+=(.272*r0+.534*g0+.131*b0-b0)*sep; }
      if(split){ var lt=clamp(l/255,0,1), ws=1-lt; r+=sh[0]*ws+hi[0]*lt; g+=sh[1]*ws+hi[1]*lt; b+=sh[2]*ws+hi[2]*lt; }
      if(vig){ var vf=VR[x]; if(vig>0){ var k=1-vig*.8*vf; r*=k; g*=k; b*=k; } else { var kk=-vig*.75*vf; r+=(255-r)*kk; g+=(255-g)*kk; b+=(255-b)*kk; } }
      if(gr){ var n=Math.sin(x*12.9898+y*78.233)*43758.5453; n=n-Math.floor(n)-.5; r+=n*gr; g+=n*gr; b+=n*gr; }
      px[i]=r; px[i+1]=g; px[i+2]=b;
    }
  }
  ctx.putImageData(img,0,0);
  if(P.shr)sharpen(cv,clamp(P.shr,-100,100)/100);
}
function sharpen(cv,a){
  var w=cv.width, h=cv.height; if(w<3||h<3||!a)return;
  var ctx=cv.getContext('2d'), img=ctx.getImageData(0,0,w,h), d=img.data, n=w*h, x, y, c;
  var src=new Uint8ClampedArray(d), hs=new Uint16Array(n*3), bl=new Uint16Array(n*3);
  for(y=0;y<h;y++){ var row=y*w;
    for(x=0;x<w;x++){ var xl=x>0?x-1:0, xr=x<w-1?x+1:w-1, o=(row+x)*3;
      for(c=0;c<3;c++)hs[o+c]=src[(row+xl)*4+c]+src[(row+x)*4+c]+src[(row+xr)*4+c]; } }
  for(y=0;y<h;y++){ var yu=(y>0?y-1:0)*w, ym=y*w, yd=(y<h-1?y+1:h-1)*w;
    for(x=0;x<w;x++){ for(c=0;c<3;c++)bl[(ym+x)*3+c]=hs[(yu+x)*3+c]+hs[(ym+x)*3+c]+hs[(yd+x)*3+c]; } }
  var k=a>0?a*1.6:a*.9;
  for(var i=0;i<n;i++){ for(c=0;c<3;c++){ var v=src[i*4+c]; d[i*4+c]=v+(v-bl[i*3+c]/9)*k; } }
  ctx.putImageData(img,0,0);
}
/* 자동 보정 — 원본을 256px 로 줄여 휘도 0.5%·99.5% 분위로 레벨을 편다 */
function computeAuto(){
  var a=ASSETS[DOC.base], k=256/Math.max(a.w,a.h), w=Math.max(1,Math.round(a.w*k)), h=Math.max(1,Math.round(a.h*k));
  TMP_A.width=w; TMP_A.height=h; var x=TMP_A.getContext('2d'); x.clearRect(0,0,w,h); x.drawImage(a.img,0,0,w,h);
  var d=x.getImageData(0,0,w,h).data, hist=new Uint32Array(256), n=0, i;
  for(i=0;i<d.length;i+=4){ if(d[i+3]<8)continue; hist[Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2])]++; n++; }
  var lo=0, hi=255, acc=0;
  for(i=0;i<256;i++){ acc+=hist[i]; if(acc>=n*.005){ lo=i; break; } }
  acc=0; for(i=255;i>=0;i--){ acc+=hist[i]; if(acc>=n*.005){ hi=i; break; } }
  if(hi-lo<40){ lo=0; hi=255; }
  return {lo:Math.min(lo,120),hi:Math.max(hi,135)};
}

/* ── 마스크 ── */
function maskPath(ctx,id,x,y,w,h){
  var i, cx=x+w/2, cy=y+h/2;
  switch(id){
    case 'circle':  ctx.ellipse(cx,cy,w/2,h/2,0,0,Math.PI*2); break;
    case 'rounded': rrect(ctx,x,y,w,h,Math.min(w,h)*.12); break;
    case 'heart':   var s=Math.min(w,h); heartShape(ctx,cx,cy+s*.01,s*.98,s*.94); break;
    case 'arch':    var ry=Math.min(w/2,h*.62); ctx.moveTo(x,y+h); ctx.lineTo(x,y+ry); ctx.ellipse(cx,y+ry,w/2,ry,0,Math.PI,Math.PI*2); ctx.lineTo(x+w,y+h); ctx.closePath(); break;
    case 'cloud':
      [[.5,.62,.44,.32],[.28,.46,.2,.26],[.52,.35,.24,.32],[.75,.47,.2,.25],[.18,.66,.16,.2],[.84,.66,.15,.2]].forEach(function(e){
        ctx.moveTo(x+w*(e[0]+e[2]),y+h*e[1]); ctx.ellipse(x+w*e[0],y+h*e[1],w*e[2],h*e[3],0,0,Math.PI*2); }); break;
    case 'scallop':
      var N=22, rx=w/2, ry=h/2;
      for(i=0;i<=360;i++){ var a=i/360*Math.PI*2, k=1-.075*(1-Math.abs(Math.sin(N*a/2))); var px=cx+Math.cos(a)*rx*k, py=cy+Math.sin(a)*ry*k; if(i)ctx.lineTo(px,py); else ctx.moveTo(px,py); }
      ctx.closePath(); break;
    default: ctx.rect(x,y,w,h);
  }
}
function applyMask(ctx,d,w,h){
  if(d.mask.id==='none')return;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1;
  ctx.globalCompositeOperation='destination-in'; ctx.fillStyle='#000'; ctx.beginPath(); maskPath(ctx,d.mask.id,0,0,w,h); ctx.fill();
  var bg=maskBgCol(d.mask.bg);
  if(bg){ ctx.globalCompositeOperation='destination-over'; ctx.fillStyle=bg; ctx.fillRect(0,0,w,h); }
  ctx.restore();
}

/* ── 액자 ── 사진층을 여백(px) 안에 놓고 테를 그린다 */
function drawFramed(out,layer,d,info){
  var ctx=out.getContext('2d'), W=out.width, H=out.height, s=info.s, pd=info.pd, f=d.frame, col=isHex(f.col)?f.col:'#FFFFFF';
  var ix=Math.round(pd.l*s), iy=Math.round(pd.t*s), iw=layer.width, ih=layer.height, u=Math.min(iw,ih), k=clamp(f.size,0,100)/100, i;
  SC=1; ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,W,H);
  function img(r){ ctx.save(); if(r){ ctx.beginPath(); rrect(ctx,ix,iy,iw,ih,r); ctx.clip(); } ctx.drawImage(layer,ix,iy); ctx.restore(); }
  function tapes(){ [[ix+iw*.1,iy+ih*.02,-32],[ix+iw*.9,iy+ih*.02,32]].forEach(function(t){ ctx.save(); ctx.translate(t[0],t[1]); ctx.rotate(deg(t[2])); var tw=u*.34, th=u*.085; drawTape(ctx,-tw/2,-th/2,tw,th,f.id==='tape'&&col!=='#FFFFFF'?col:pack().sub,'stripe'); ctx.restore(); }); }
  switch(f.id){
    case 'line':
      ctx.drawImage(layer,0,0); var lw=Math.max(1,u*(.004+.014*k)), ins=u*.03+lw/2; ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.strokeRect(ins,ins,W-2*ins,H-2*ins); break;
    case 'margin':
      ctx.fillStyle=col; ctx.fillRect(0,0,W,H); img(u*.018); break;
    case 'polaroid':
      ctx.fillStyle=col; ctx.fillRect(0,0,W,H);
      var gl=ctx.createLinearGradient(0,0,0,H); gl.addColorStop(0,'rgba(255,255,255,0)'); gl.addColorStop(1,'rgba(46,32,56,.05)'); ctx.fillStyle=gl; ctx.fillRect(0,0,W,H);
      ctx.save(); ctx.fillStyle='rgba(23,16,30,.1)'; ctx.fillRect(ix-1,iy-1,iw+2,ih+2); ctx.restore(); img(0);
      if(f.caption){ var cap=f.caption, fb=H-iy-ih, cfs=fb*.36; ctx.font='400 '+cfs+'px "Nanum Pen Script","Gaegu",sans-serif'; ctx.letterSpacing='0px';
        cfs=fitText(ctx,cap,iw*.9,cfs,'"Nanum Pen Script","Gaegu",sans-serif',400); ctx.font='400 '+cfs+'px "Nanum Pen Script","Gaegu",sans-serif';
        ctx.fillStyle=onColor(col)==='#FFFFFF'?'#FFFFFF':BD.plum; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(cap,W/2,iy+ih+fb*.5); ctx.textAlign='left'; ctx.textBaseline='alphabetic'; }
      break;
    case 'scrap':
      ctx.fillStyle=col; ctx.fillRect(0,0,W,H);
      var gs=Math.max(8,u*.045); ctx.strokeStyle=rgba(onColor(col)==='#FFFFFF'?'#FFFFFF':BD.rose,.14); ctx.lineWidth=Math.max(1,u*.0025); ctx.beginPath();
      for(i=gs;i<W;i+=gs){ ctx.moveTo(i,0); ctx.lineTo(i,H); } for(i=gs;i<H;i+=gs){ ctx.moveTo(0,i); ctx.lineTo(W,i); } ctx.stroke();
      ctx.save(); shadow(ctx,u*.03,u*.01,'rgba(46,32,56,.22)'); ctx.fillStyle='#FFFFFF'; var bdd=u*.012; ctx.fillRect(ix-bdd,iy-bdd,iw+2*bdd,ih+2*bdd); ctx.restore();
      img(0); tapes(); break;
    case 'stitch':
      ctx.fillStyle=col; ctx.fillRect(0,0,W,H); img(u*.014);
      var sp=pd.l*s/2; ctx.save(); ctx.beginPath(); rrect(ctx,sp,sp,W-2*sp,H-2*sp,u*.03); ctx.setLineDash([u*.022,u*.016]); ctx.lineCap='round'; ctx.lineWidth=Math.max(1.5,u*.006);
      ctx.strokeStyle=col.toUpperCase()===BD.rose?'#FFFFFF':BD.rose; ctx.stroke(); ctx.restore(); break;
    case 'film':
      ctx.fillStyle='#17101E'; ctx.fillRect(0,0,W,H); img(0);
      var hh=iy*.34, hw=hh*1.3, gap=hw*1.1; ctx.fillStyle='rgba(255,251,252,.9)';
      for(i=gap*.6;i<W-hw;i+=hw+gap){ ctx.beginPath(); rrect(ctx,i,(iy-hh)/2,hw,hh,hh*.22); rrect(ctx,i,H-(iy+hh)/2,hw,hh,hh*.22); ctx.fill(); }
      break;
    case 'heart':
      ctx.fillStyle=col; ctx.fillRect(0,0,W,H); img(u*.016);
      var hs=pd.l*s*.62, hc=col.toUpperCase()===BD.rose?'#FFFFFF':BD.rose;
      [[pd.l*s/2,pd.t*s/2],[W-pd.l*s/2,pd.t*s/2],[pd.l*s/2,H-pd.b*s/2],[W-pd.l*s/2,H-pd.b*s/2]].forEach(function(p,j){
        ctx.beginPath(); heartShape(ctx,p[0],p[1],hs,hs*.92); ctx.fillStyle=j%3===0?hc:BD.pink; ctx.fill(); });
      break;
    case 'tape':
      ctx.drawImage(layer,0,0); tapes(); break;
    case 'round':
      ctx.save(); ctx.beginPath(); rrect(ctx,0,0,W,H,u*(.03+.12*k)); ctx.clip(); ctx.drawImage(layer,0,0); ctx.restore(); break;
    default:
      ctx.drawImage(layer,ix,iy);
  }
  ctx.restore();
}

/* ── 합성 ── s = 문서 px → 출력 px. full = 자르기 화면(창 무시·액자·마스크 없음) */
var BC={key:'',cv:null};   /* 미리보기용 사진층 캐시(보정·필터 끝난 것) */
function baseKey(d,s,full){
  var c=d.crop;
  return [d.base,d.m.join(','),d.st,full?'F':[c.x,c.y,c.w,c.h].map(function(v){ return v.toFixed(1); }).join(','),s.toFixed(5),
          JSON.stringify(d.adj),d.auto?d.auto.lo+'-'+d.auto.hi:'',d.flt.id,d.flt.amt].join('|');
}
function baseLayer(d,s,full,cache){
  var o=odim(d), c=full?{x:0,y:0,w:o.w,h:o.h}:d.crop, w=Math.max(1,Math.round(c.w*s)), h=Math.max(1,Math.round(c.h*s)), key;
  if(cache){ key=baseKey(d,s,full); if(BC.key===key&&BC.cv)return BC.cv; }
  var cv=(cache&&BC.cv)||document.createElement('canvas'); cv.width=w; cv.height=h;
  var ctx=cv.getContext('2d'); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,w,h);
  drawBase(ctx,d,s,full); processPixels(cv,effParams(d));
  if(cache){ BC.key=key; BC.cv=cv; }
  return cv;
}
function frameInfoAt(d,s){ var c=d.crop, pd=framePads(d,c.w,c.h); return {s:s,pd:pd,W:Math.max(1,Math.round((c.w+pd.l+pd.r)*s)),H:Math.max(1,Math.round((c.h+pd.t+pd.b)*s))}; }
function renderDoc(d,s,opt){
  opt=opt||{};
  var full=!!opt.full, o=odim(d), c=full?{x:0,y:0,w:o.w,h:o.h}:d.crop;
  var base=baseLayer(d,s,full,!!opt.cache);
  var layer=opt.layer||document.createElement('canvas'); layer.width=base.width; layer.height=base.height;
  var lx=layer.getContext('2d'); lx.setTransform(1,0,0,1,0,0); lx.globalAlpha=1; lx.globalCompositeOperation='source-over'; lx.clearRect(0,0,layer.width,layer.height); lx.drawImage(base,0,0);
  var sigs=[];
  d.objs.forEach(function(ob){ if(ob.hide||(opt.skip&&opt.skip===ob.id))return; if(ob.t==='sig'){ sigs.push(ob); return; } drawObj(lx,ob,s,c,d); });
  if(!full)applyMask(lx,d,layer.width,layer.height);
  sigs.forEach(function(ob){ drawObj(lx,ob,s,c,d); });   /* 서명은 마스크에 잘리지 않는다 */
  if(full||d.frame.id==='none')return layer;
  var info=frameInfoAt(d,s), out=opt.out||document.createElement('canvas'); out.width=info.W; out.height=info.H;
  drawFramed(out,layer,d,info); return out;
}
/* 원본 비교 — 방향·자르기만(보정·필터·개체·액자 없이) */
function renderOriginal(d,s){
  var c=d.crop, cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(c.w*s)); cv.height=Math.max(1,Math.round(c.h*s));
  drawBase(cv.getContext('2d'),d,s,false); return cv;
}
function hasTransparency(d){ return (d.mask.id!=='none'&&d.mask.bg==='clear')||d.frame.id==='round'; }
function usedFonts(d){
  var s={};
  d.objs.forEach(function(ob){
    if(ob.t==='text'){ var F=fontById(ob.font), wt=(ob.bold&&F.w.length>1)?F.w[F.w.length-1]:F.w[0]; s[wt+'|'+F.fam]=ob.tx||'가'; }
    if(ob.t==='sig'||ob.t==='vec'){ var lf=famOf(ob); s['800|'+lf]=(ob.tx||'')+'봄딩영도'; s['700|'+lf]='a'; }
  });
  if(d.frame.id==='polaroid'&&d.frame.caption)s['400|"Nanum Pen Script","Gaegu",sans-serif']=d.frame.caption;
  return s;
}
function ensureFonts(d){
  if(!(document.fonts&&document.fonts.load))return Promise.resolve();
  var u=usedFonts(d);
  return Promise.all(Object.keys(u).map(function(k){ var p=k.split('|'); return document.fonts.load(p[0]+' 40px '+p[1],u[k]).catch(function(){}); })).then(function(){},function(){});
}
function exportCanvas(){
  var d=DOC, info=outInfo(d), need={};
  d.objs.forEach(function(ob){ if(ob.t==='stk')need[ob.src]=1; if(ob.t==='sig'&&ob.tpl==='mascot')need.face=1; });
  return Promise.all(Object.keys(need).map(function(id){ return stkLoad(id).catch(function(){}); }))
    .then(function(){ return ensureFonts(d); })
    .then(function(){
      var cv=renderDoc(d,info.s,{});
      if(cv.width!==info.W||cv.height!==info.H){ var c2=document.createElement('canvas'); c2.width=info.W; c2.height=info.H; var x2=c2.getContext('2d'); x2.imageSmoothingQuality='high'; x2.drawImage(cv,0,0,info.W,info.H); cv=c2; }
      return {cv:cv,info:info};
    });
}
function exportType(d){
  var f=PREF.fmt; if(f==='png')return 'image/png'; if(f==='jpg')return hasTransparency(d)?'image/png':'image/jpeg';
  var a=ASSETS[d.base]; return (a&&/jpe?g/i.test(a.type)&&!hasTransparency(d))?'image/jpeg':'image/png';
}
function exportBlob(){
  return exportCanvas().then(function(r){
    var type=exportType(DOC), cv=r.cv;
    if(type==='image/jpeg'){ var c2=document.createElement('canvas'); c2.width=cv.width; c2.height=cv.height; var x=c2.getContext('2d'); x.fillStyle='#FFFFFF'; x.fillRect(0,0,c2.width,c2.height); x.drawImage(cv,0,0); cv=c2; }
    return new Promise(function(res){ cv.toBlob(function(b){ res({blob:b,type:type,W:cv.width,H:cv.height,info:r.info}); },type,type==='image/jpeg'?.92:undefined); });
  });
}
function fileName(type){
  var a=ASSETS[DOC.base], nm=safeName(a&&a.name)||'사진', info=outInfo();
  return nm+'_편집_'+info.W+(type==='image/jpeg'?'.jpg':'.png');
}

/* ══════════ 화면 ══════════ */
var api=null, root=null, mounted=false, raf=0, RO=null;
var UI={tool:PREF.tool, zoom:1, panX:0, panY:0, compare:false, space:false};
var VIEW={s:1,fit:1,ox:0,oy:0,cw:0,ch:0};
var LAYER=document.createElement('canvas');
IC.sRect='<rect x="4" y="6" width="16" height="12" rx="1"/>';
IC.sRound='<rect x="4" y="6" width="16" height="12" rx="4.5"/>';
IC.sEllipse='<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>';
IC.sLine='<path d="M5 19 19 5"/>';
IC.sArrow='<path d="M5 19 19 5"/><path d="M10 5h9v9"/>';
IC.sHl='<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M6.5 12h11" stroke-width="4.5" stroke-opacity=".32"/>';
IC.flip='<path d="M12 3v18"/><path d="M8 7 3 12l5 5z"/><path d="m16 7 5 5-5 5z"/>';
var ANC_N={tl:'왼쪽 위',tc:'가운데 위',tr:'오른쪽 위',ml:'왼쪽 가운데',mc:'가운데',mr:'오른쪽 가운데',bl:'왼쪽 아래',bc:'가운데 아래',br:'오른쪽 아래'};
IC.eye='<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>';
IC.eyeOff='<path d="M10.6 6.2A7.8 7.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-3 3.6"/><path d="M6.4 7.6A15 15 0 0 0 2.5 12S6 18 12 18a8.6 8.6 0 0 0 3.8-.9"/><path d="M3 3l18 18"/>';
IC.sTri='<path d="M12 5.2 20.5 19h-17Z"/>';
IC.sStar='<path d="m12 4 2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.8 9.6 9Z"/>';
IC.sHeart='<path d="M12 19.8C9.3 18 4.5 14.4 4.5 10.8A3.8 3.8 0 0 1 12 9a3.8 3.8 0 0 1 7.5 1.8c0 3.6-4.8 7.2-7.5 9Z"/>';
IC.sBubble='<path d="M4 5.5h16v9.8h-8.6L7.4 19v-3.7H4Z"/>';
IC.sCloud='<path d="M8.6 6.2A3.9 3.9 0 0 1 15.8 6a3.4 3.4 0 0 1 1.5 6.4c-.5.3-1 .4-1.6.4H8.3a3.6 3.6 0 0 1 .3-6.6Z"/><circle cx="7.2" cy="17.2" r="1.7"/><circle cx="4.3" cy="20.4" r="1"/>';
IC.sBurst='<path d="m12 3 1.7 2.7 2.9-1.1v3.1l3 .6-1.7 2.6 2.4 1.9-2.9 1.2.6 3.1-3.1-.6L12 21l-1.9-2.5-3.1.6.6-3.1L4.7 15l2.4-1.9-1.7-2.6 3-.6V6.6l2.9 1.1Z"/>';
IC.sWave='<path d="M3 14.5c2.4-6.5 5.6-6.5 8 0s5.6 6.5 8 0"/>';
IC.hand='<path d="M3 18c3-9 7-9 10-4s6 3 8-3"/><path d="M14.5 3.7 20 9.2"/>';
var SHAPE_IC={rect:'sRect',round:'sRound',ellipse:'sEllipse',tri:'sTri',star:'sStar',heart:'sHeart',bubble:'sBubble',thought:'sCloud',burst:'sBurst',wave:'sWave',line:'sLine',arrow:'sArrow',hl:'sHl',lens:'lens',num:'hash'};
function $(id){ return root?root.querySelector('#'+id):null; }

/* ── 조작부 조각 ── */
function sec(title,body,extra){ return '<section class="ph-sec">'+(title?'<div class="ph-st">'+title+(extra||'')+'</div>':'')+body+'</section>'; }
function slider(key,label,min,max,val,step,unit,off){
  var id='phS_'+key.replace(/\W/g,'_');
  return '<div class="ph-sl'+(off?' off':'')+'" data-sl="'+key+'" data-min="'+min+'" data-max="'+max+'"><label for="'+id+'">'+esc(label)+'</label>'+
    '<input type="range" id="'+id+'" min="'+min+'" max="'+max+'" step="'+(step||1)+'" value="'+val+'"'+(off?' disabled':'')+'>'+
    '<span class="ph-nm"><input type="number" min="'+min+'" max="'+max+'" step="'+(step||1)+'" value="'+val+'" aria-label="'+esc(label)+' 값"'+(off?' disabled':'')+'>'+(unit?'<span>'+unit+'</span>':'')+'</span></div>';
}
function chipGroup(key,items,cur){
  return '<div class="ph-seg" role="group" data-chip="'+key+'">'+items.map(function(it){
    var on=String(it.id)===String(cur);
    return '<button type="button" class="chip'+(it.sq?' sq':'')+(on?' on':'')+'" data-v="'+esc(it.id)+'" aria-pressed="'+(on?'true':'false')+'"'+
      (it.t?' title="'+esc(it.t)+'" aria-label="'+esc(it.t)+'"':'')+'>'+(it.ic?ic(it.ic):'')+(it.n?esc(it.n):'')+'</button>';
  }).join('')+'</div>';
}
function colorRow(key,cur,label,opt){
  opt=opt||{};
  var up=String(cur).toUpperCase(), known=SW().some(function(s){ return s.c===up; }), cust=isHex(cur)&&!known;
  var h='<div class="ph-colors" data-color="'+key+'"><div class="ph-crow" role="group" aria-label="'+esc(label)+'">';
  if(opt.none)h+='<button type="button" class="ph-sw none'+(cur==='none'?' on':'')+'" data-c="none" title="없음" aria-label="없음" aria-pressed="'+(cur==='none')+'"></button>';
  if(opt.auto)h+='<button type="button" class="ph-sw'+(cur==='auto'?' on':'')+'" data-c="auto" title="자동" aria-label="자동" aria-pressed="'+(cur==='auto')+'" style="--c:linear-gradient(135deg,#FFFFFF 50%,'+pack().accent+' 50%)"></button>';
  SW().forEach(function(s){ var on=s.c===up; h+='<button type="button" class="ph-sw'+(on?' on':'')+'" style="--c:'+s.c+'" data-c="'+s.c+'" title="'+s.n+'" aria-label="'+s.n+'" aria-pressed="'+on+'"></button>'; });
  h+='</div><div class="ph-hexrow"><span>'+esc(isHex(cur)?swName(cur):(cur==='none'?'없음':'자동'))+'</span>'+
    '<input class="ph-hex" data-hex="'+key+'" type="text" maxlength="7" spellcheck="false" autocomplete="off" value="'+(isHex(cur)?up:'')+'" placeholder="'+(cur==='none'?'없음':(cur==='auto'?'자동':'#000000'))+'" aria-label="'+esc(label)+' HEX 코드">'+
    '<button type="button" class="ph-sw custom'+(cust?' on has':'')+'" style="--cc:'+(isHex(cur)?cur:pack().accent)+'" data-c="custom" title="팔레트에서 고르기" aria-label="'+esc(label)+' 팔레트에서 고르기" aria-pressed="'+cust+'">'+ic('pipette')+'</button>'+
    '<input type="color" class="ph-pick" value="'+(isHex(cur)?cur.toLowerCase():pack().accent.toLowerCase())+'" tabindex="-1" aria-hidden="true"></div></div>';
  return h;
}
function tileGroup(key,items,cur,kind){
  return '<div class="ph-tiles'+(kind==='ic'?' sm':'')+'" role="group" data-tile="'+key+'">'+items.map(function(it){
    var on=it.id===cur;
    return '<button type="button" class="ph-tile'+(on?' on':'')+'" data-v="'+esc(it.id)+'" aria-pressed="'+(on?'true':'false')+'">'+
      (kind==='ic'?'<span class="tv">'+ic(it.ic)+'</span>':'<canvas width="124" height="124" data-pv="'+esc(it.id)+'"></canvas>')+'<b>'+esc(it.n)+'</b></button>';
  }).join('')+'</div>';
}
function actRow(items){ return '<div class="ph-oa">'+items.map(function(it){ return '<button type="button" class="ghost'+(it.warn?' warn':'')+'" data-act="'+it.id+'"'+(it.dis?' disabled':'')+'>'+ic(it.ic)+esc(it.n)+'</button>'; }).join('')+'</div>'; }
function objActions(ob){
  var i=DOC.objs.indexOf(ob), n=DOC.objs.length;
  return actRow([{id:'dup',n:'복제',ic:'dup'},{id:'front',n:'앞으로',ic:'up',dis:i>=n-1},{id:'back',n:'뒤로',ic:'down',dis:i<=0},{id:'del',n:'삭제',ic:'trash',warn:true}]);
}
function objKindName(ob){
  switch(ob.t){
    case 'text': return '텍스트'; case 'sig': return '서명'; case 'stk': return '캐릭터 스티커'; case 'img': return '사진';
    case 'vec': return ob.k==='num'?'번호':'꾸밈 스티커'; case 'shape': return byId(SHAPES,ob.k).n; case 'hl': return '형광 박스';
    case 'line': return '선'; case 'arrow': return '화살표'; case 'pen': return ob.hl?'형광펜 획':'펜 획';
    case 'mosaic': return '가린 영역'; case 'lens': return '돋보기';
  }
  return '개체';
}
/* 고른 개체의 동작·불투명도는 늘 판 맨 위에 둔다 — 목록이 길어도 스크롤 없이 지우고 겹침을 바꾼다 */
function selSec(ob,noRot){ return sec('고른 '+objKindName(ob),objActions(ob)+objCommon(ob,noRot)); }
function objCommon(ob,noRot){
  return slider('obj.o','불투명도',0,100,Math.round((ob.o==null?1:ob.o)*100),1,'%')+(noRot?'':slider('obj.r','회전',-180,180,Math.round(ob.r||0),1,'°'));
}
function toolOfObj(ob){
  if(!ob)return null;
  switch(ob.t){ case 'text': return 'text'; case 'sig': return 'sig'; case 'stk': case 'img': return 'sticker'; case 'vec': return ob.k==='num'?'shape':'sticker';
    case 'pen': return 'draw'; case 'mosaic': return 'mosaic'; default: return 'shape'; }
}
function selObj(tool){ var ob=objById(SEL); return ob&&toolOfObj(ob)===tool?ob:null; }

/* ── 도구별 설정 판 (1) 크기·자르기·필터·보정·액자·마스크·서명 ── */
function panelSize(){
  var info=outInfo(), a=ASSETS[DOC.base], p=DOC.out.preset;
  var items=[{id:'orig',n:'원본'},{id:'693',n:'693 본문'},{id:'1386',n:'1386 본문 2배'},{id:'1000',n:'1000'},{id:'1920',n:'1920'},{id:'custom',n:'직접'}];
  return sec('출력 폭',chipGroup('out.preset',items,p)+
      (p==='custom'?'<div class="ph-row ph-wh"><span class="ph-nm"><input type="number" id="phOutW" min="64" max="'+MAX_SIDE+'" step="1" value="'+Math.round(DOC.out.w)+'" aria-label="출력 폭"><span>px</span></span></div>':'')+
      '<div class="ph-row"><span class="ph-out">결과 <b class="num" id="phOutWH">'+info.W+'×'+info.H+'</b> px'+(info.capped?' · 긴 변 '+MAX_SIDE+' 제한':'')+'</span></div>')+
    sec('원본','<div class="ph-out"><b class="num">'+a.w+'×'+a.h+'</b> px'+(a.shrunk?' · 긴 변 '+MAX_SIDE+'으로 줄여 편집':'')+'</div>');
}
function panelCrop(){
  var c=DOC.crop;
  return sec('비율',chipGroup('crop.ar',CROP_AR,PREF.cropAR))+
    sec('회전·반전',actRow([{id:'rotL',n:'왼쪽 90°',ic:'rotL'},{id:'rotR',n:'오른쪽 90°',ic:'rotR'},{id:'flipH',n:'좌우',ic:'flipH'},{id:'flipV',n:'상하',ic:'flipV'}]))+
    sec('수평 맞춤',slider('st','각도',-45,45,DOC.st,.5,'°'))+
    sec('','<div class="ph-row"><span class="ph-out">자르기 <b class="num" id="phCropWH">'+Math.round(c.w)+'×'+Math.round(c.h)+'</b> px</span></div>');
}
function panelFilter(){
  return sec('필터',tileGroup('flt',FILTERS,DOC.flt.id,'cv'))+
    sec('세기',slider('flt.amt','세기',0,100,DOC.flt.amt,1,'%',DOC.flt.id==='none'));
}
function panelAdjust(){
  return sec('자동 보정',chipGroup('auto',[{id:'on',n:'자동 보정',ic:'wand'}],DOC.auto?'on':''))+
    sec('보정',ADJ.map(function(p){ return slider('adj.'+p.k,p.n,-100,100,DOC.adj[p.k],1,''); }).join(''));
}
function panelFrame(){
  var f=DOC.frame, noCol=f.id==='none'||f.id==='film'||f.id==='round', noSize=f.id==='none'||f.id==='tape';
  return sec('액자',tileGroup('frame',FRAMES,f.id,'cv'))+
    (noCol?'':sec('색',colorRow('frame.col',f.col,'액자 색')))+
    sec('두께',slider('frame.size','두께',0,100,f.size,1,'',noSize))+
    (f.id==='polaroid'?sec('글귀','<input class="f-i" type="text" id="phCaption" maxlength="40" value="'+esc(f.caption||'')+'" placeholder="예: 2026.09 '+esc(pack().n)+'" aria-label="폴라로이드 글귀">'):'');
}
function panelMask(){
  return sec('모양',tileGroup('mask',MASKS,DOC.mask.id,'cv'))+
    sec('바깥',chipGroup('mask.bg',MASK_BG,DOC.mask.bg));
}
function panelSig(){
  var sg=sigObj(), tpl=sg?sg.tpl:PREF.sig.tpl;
  var h=sec('템플릿',tileGroup('sig.tpl',SIG_TPL,sg?tpl:'','cv'),
    sg?'<button type="button" class="ghost warn" data-act="delSig">'+ic('trash')+'빼기</button>':'');
  if(sg){
    h+=sec('글자','<input class="f-i" type="text" id="phSigTx" maxlength="40" value="'+esc(sg.tx||'')+'" aria-label="서명 글자">');
    h+=sec('색',colorRow('sig.col',sg.col,'서명 색',{auto:true}));
    h+=sec('크기·위치',slider('sig.size','크기',6,60,sg.size,1,'')+slider('sig.o','불투명도',10,100,Math.round(sg.o*100),1,'%')+
      '<div class="ph-lbl">자리</div><div class="ph-anc" role="group" aria-label="서명 위치">'+ANCHORS.map(function(a){ var on=sg.anchor===a;
      return '<button type="button" data-anc="'+a+'" aria-pressed="'+on+'" aria-label="'+ANC_N[a]+'" title="'+ANC_N[a]+'"'+(on?' class="on"':'')+'><i></i></button>'; }).join('')+'</div>');
  }
  h+=sec('새 사진',chipGroup('sig.auto',[{id:'on',n:'새 사진에 자동으로 넣기',ic:'check'}],PREF.sig.auto?'on':''));
  return h;
}

/* ── 설정 판 (2) 모자이크·텍스트·스티커·도형·그리기 ── */
function panelMosaic(){
  var ob=selObj('mosaic'), M=ob||PREF.mos;
  var h=ob?selSec(ob):'';
  h+=sec('모양',chipGroup('mos.shape',[{id:'rect',n:'사각형',ic:'sRect'},{id:'ellipse',n:'원형',ic:'sEllipse'}],M.shape))+
    sec('효과',chipGroup('mos.mode',[{id:'pixel',n:'모자이크',ic:'mosaic'},{id:'blur',n:'흐림',ic:'filter'}],M.mode))+
    sec('세기',slider('mos.amt','세기',1,100,M.amt,1,''));
  if(!ob)h+='<div class="ph-hint">사진 위를 끌어서 가릴 영역을 만드세요</div>';
  return h;
}
function panelText(){
  var ob=selObj('text'), P=PREF.text;
  var T=ob?{font:ob.font,st:ob.st,col:ob.col,bg:ob.bg,align:ob.align,bold:ob.bold}:{font:P.font,st:P.style,col:P.col,bg:P.bg,align:P.align,bold:P.bold};
  var F=fontById(T.font), u=unitSize(), pct=ob?Math.round(ob.fs/u*200)/2:Math.round(P.size*200)/2;
  var h=ob?selSec(ob)+sec('내용','<textarea class="f-i" id="phTx" rows="3" maxlength="400" aria-label="텍스트 내용">'+esc(ob.tx)+'</textarea>')
          :sec('','<button type="button" class="ph-photoadd" data-act="addText">'+ic('type')+'텍스트 추가</button>');
  h+=sec('스타일',tileGroup('text.st',TSTYLES,T.st,'cv'));
  h+=sec('글꼴','<select class="f-i" id="phFont" aria-label="글꼴">'+FONTS.map(function(f){ return '<option value="'+f.id+'"'+(f.id===T.font?' selected':'')+'>'+esc(f.n)+'</option>'; }).join('')+'</select>'+
    '<div class="ph-row">'+chipGroup('text.align',[{id:'left',ic:'alignL',t:'왼쪽 정렬',sq:1},{id:'center',ic:'alignC',t:'가운데 정렬',sq:1},{id:'right',ic:'alignR',t:'오른쪽 정렬',sq:1}],T.align)+
    (F.w.length>1?chipGroup('text.bold',[{id:'on',ic:'bold',t:'굵게',sq:1}],T.bold?'on':''):'')+'</div>'+
    slider('text.size','크기',1,40,pct,.5,'%'));
  h+=sec('글자색',colorRow('text.col',T.col,'글자색'));
  var bgl={outline:'외곽선 색',label:'바탕색',marker:'형광펜 색',bubble:'말풍선 색',memo:'종이 색',tape:'테이프 색',band:'띠 색',shadow:'그림자 색',dash:'점선 색',chip:'태그 색',under:'밑줄 색'}[T.st];
  if(bgl)h+=sec(bgl,colorRow('text.bg',T.bg,bgl));
  return h;
}
function stickerGrid(cat){
  if(cat==='bomding'||cat==='yeongdo'){ var P=PK(cat);
    return P.stk.map(function(id){ var n=STK_N[id]||'스티커';
      return '<button type="button" class="ph-sk" data-stk="'+id+'" title="'+esc(n)+'" aria-label="'+esc(P.n+' '+n)+'"><img src="'+ASSET+'stk/'+id+'_t.webp" alt="" decoding="async" draggable="false"></button>'; }).join(''); }
  if(cat==='photo')return '';
  return VEC.map(function(v,i){ return v.c!==cat?'':'<button type="button" class="ph-sk" data-vec="'+i+'" title="'+esc(v.n)+'" aria-label="'+esc(v.n)+'"><canvas width="112" height="112" data-vpv="'+i+'"></canvas></button>'; }).join('');
}
function panelSticker(){
  var cat=PREF.stkCat, ob=selObj('sticker'), h='';
  if(ob){
    var body='';
    if(ob.t==='vec'){
      body+=colorRow('vec.col',ob.col,'색');
      if(ob.k==='pill'||ob.k==='burst'||ob.k==='ribbon'||ob.k==='num')body+='<div class="ph-lbl">글자</div><input class="f-i" type="text" id="phVecTx" maxlength="'+(ob.k==='num'?3:8)+'" value="'+esc(ob.tx)+'" aria-label="스티커 글자">';
    }
    if(ob.t==='stk')body+=chipGroup('stk.fx',[{id:'on',n:'좌우 뒤집기',ic:'flip'}],ob.fx?'on':'');
    if(ob.t==='img')body+=slider('img.rad','모서리',0,50,Math.round((ob.rad||0)*100),1,'%')+'<div class="ph-row">'+chipGroup('img.bd',[{id:'on',n:'흰 테두리',ic:'frame'}],ob.bd?'on':'')+'</div>';
    h+=sec('고른 '+objKindName(ob),objActions(ob)+objCommon(ob)+(body?'<div class="ph-lbl">꾸미기</div>'+body:''));
  }
  h+=sec('',chipGroup('stk.cat',STK_CATS,cat)+'<div class="ph-stk" id="phStk" role="group" aria-label="스티커">'+stickerGrid(cat)+'</div>'+
    (cat==='photo'?'<button type="button" class="ph-photoadd" data-act="photoAdd">'+ic('image')+'사진 파일 넣기</button>':''));
  return h;
}
function shapeKindOf(ob){ if(ob.t==='shape')return ob.k||'rect'; if(ob.t==='vec')return 'num'; return ob.t; }
function swPct(sw){ var u=unitSize(); return Math.round(clamp((sw==null?u*PREF.line.w:sw)/u*1000,1,40)); }
function panelShape(){
  var ob=selObj('shape'), k=ob?shapeKindOf(ob):PREF.shape, L=PREF.line;
  var h=ob?selSec(ob,ob.t==='line'||ob.t==='arrow'||ob.t==='lens'):'';
  h+=sec('도형',tileGroup('shape',SHAPES.map(function(s){ return {id:s.id,n:s.n,ic:SHAPE_IC[s.id]}; }),k,'ic'));
  if(k!=='lens'&&k!=='num')h+=sec('선 느낌',chipGroup('shape.hand',[{id:'off',n:'매끈',ic:'sLine'},{id:'on',n:'손그림',ic:'hand'}],(ob?ob.hand:PREF.hand)?'on':'off'));
  if(!ob)h+='<div class="ph-hint">'+(k==='num'?'누른 자리에 번호를 붙여요':(k==='lens'?'확대할 곳을 끌어서 동그라미로 고르세요':'사진 위를 끌어서 그리세요'))+'</div>';
  if(k==='hl'){
    h+=sec('형광 색',colorRow('hl.col',ob?ob.col:PREF.pen.hlCol,'형광 색'));
  }else if(k==='num'){
    h+=sec('색',colorRow('line.col',ob?ob.col:L.col,'색'))+sec('',actRow([{id:'numReset',n:'번호 1부터 다시',ic:'reset'}]));
  }else{
    h+=sec('선',colorRow('line.col',ob?ob.col:L.col,'선 색')+slider('line.sw','두께',1,40,swPct(ob?ob.sw:null),1,'')+
      (k==='lens'?'':'<div class="ph-row">'+chipGroup('line.dash',[{id:'solid',n:'실선'},{id:'dash',n:'점선'},{id:'dot',n:'점'}],ob?ob.dash:L.dash)+'</div>'));
    if(k==='arrow')h+=sec('화살촉',chipGroup('arrow.head',[{id:'end',n:'한쪽'},{id:'both',n:'양쪽'}],ob?ob.head:'end'));
    if(SHAPE_BOX.indexOf(k)>=0&&canFill(k)){
      var fill=ob?ob.fill:L.fill;
      h+=sec('채우기',colorRow('line.fill',fill,'채우기',{none:true})+slider('line.fo','진하기',0,100,Math.round((ob?ob.fo:L.fo)*100),1,'%',fill==='none'));
    }
    if(k==='lens'&&ob)h+=sec('확대',slider('lens.zoom','배율',1.2,4,Math.round(ob.w/2/ob.sr*10)/10,.1,'×'));
  }
  return h;
}
function panelDraw(){
  var ob=selObj('draw'), mode=PREF.penMode, isHl=mode==='hl';
  var h=ob?sec('고른 '+objKindName(ob),objActions(ob)+slider('obj.o','불투명도',0,100,Math.round((ob.o==null?1:ob.o)*100),1,'%')):'';
  h+=sec('도구',chipGroup('pen.mode',[{id:'pen',n:'펜',ic:'pen'},{id:'hl',n:'형광펜',ic:'marker'},{id:'erase',n:'지우개',ic:'eraser'}],mode));
  if(mode!=='erase')h+=sec('색',colorRow(isHl?'pen.hl':'pen.col',isHl?PREF.pen.hlCol:PREF.pen.col,isHl?'형광펜 색':'펜 색'))+
    sec('두께',slider(isHl?'pen.hlw':'pen.w','두께',1,isHl?120:60,Math.round((isHl?PREF.pen.hlW:PREF.pen.w)*1000),1,''));
  h+='<div class="ph-hint">'+(mode==='erase'?'지나간 획을 지워요':'사진 위를 끌어서 그리세요')+'</div>';
  return h;
}

/* ── 레이어 ── */
var TYPE_IC={text:'type',sig:'sig',stk:'sticker',img:'image',vec:'sticker',hl:'sHl',line:'sLine',arrow:'sArrow',pen:'pen',mosaic:'mosaic',lens:'lens'};
function objIcon(ob){ return (ob.t==='shape'?SHAPE_IC[ob.k]:TYPE_IC[ob.t])||'layers'; }
function objName(ob){
  var i;
  switch(ob.t){
    case 'text': return String(ob.tx||'').split('\n')[0]||'텍스트';
    case 'sig': return '서명 · '+(ob.tx||'');
    case 'stk': for(i=0;i<MASCOT.length;i++)if(MASCOT[i].id===ob.src)return PK(MASCOT[i].pk).n+' · '+MASCOT[i].n; return '캐릭터';
    case 'img': return '사진';
    case 'vec': if(ob.k==='num')return '번호 '+ob.tx; for(i=0;i<VEC.length;i++)if(VEC[i].k===ob.k)return ob.tx||VEC[i].n; return '스티커';
    case 'shape': return byId(SHAPES,ob.k).n;
    case 'hl': return '형광 박스'; case 'line': return '선'; case 'arrow': return '화살표';
    case 'pen': return ob.hl?'형광펜':'펜'; case 'mosaic': return ob.mode==='blur'?'흐림':'모자이크'; case 'lens': return '돋보기';
  }
  return '개체';
}
function renderLayers(){
  var secEl=$('phLaySec'), ul=$('phLays'); if(!secEl||!ul)return;
  var n=DOC?DOC.objs.length:0; secEl.hidden=!n;
  if(!n){ ul.innerHTML=''; return; }
  $('phLayN').textContent=String(n);
  var h='';
  for(var i=n-1;i>=0;i--){
    var ob=DOC.objs[i], on=ob.id===SEL;
    h+='<li class="ph-lay'+(on?' on':'')+(ob.hide?' off':'')+'"><button type="button" class="lsel" data-lsel="'+ob.id+'" aria-pressed="'+on+'"><span class="li">'+ic(objIcon(ob))+'</span><span class="ln">'+esc(objName(ob))+'</span></button>'+
      '<button type="button" class="lb'+(ob.hide?' on':'')+'" data-lmove="hide" data-id="'+ob.id+'" aria-pressed="'+(ob.hide?'true':'false')+'" aria-label="'+(ob.hide?'다시 보이기':'잠깐 숨기기')+'" title="'+(ob.hide?'다시 보이기':'잠깐 숨기기')+'">'+ic(ob.hide?'eyeOff':'eye')+'</button>'+
      '<button type="button" class="lb" data-lmove="up" data-id="'+ob.id+'" aria-label="앞으로" title="앞으로"'+(i>=n-1?' disabled':'')+'>'+ic('up')+'</button>'+
      '<button type="button" class="lb" data-lmove="down" data-id="'+ob.id+'" aria-label="뒤로" title="뒤로"'+(i<=0?' disabled':'')+'>'+ic('down')+'</button></li>';
  }
  ul.innerHTML=h;
}

/* ── 판 그리기 · 타일 미리보기 ── */
var PANELS={size:panelSize,crop:panelCrop,filter:panelFilter,adjust:panelAdjust,frame:panelFrame,sig:panelSig,mosaic:panelMosaic,text:panelText,sticker:panelSticker,shape:panelShape,draw:panelDraw,mask:panelMask};
function focusKey(el){
  var g=el.closest('[data-chip],[data-tile],[data-color],[data-sl]');
  if(el.id)return {id:el.id};
  if(!g)return null;
  var gk=g.getAttribute('data-chip')||g.getAttribute('data-tile')||g.getAttribute('data-color')||g.getAttribute('data-sl');
  return {g:gk,v:el.getAttribute('data-v')||el.getAttribute('data-c')||el.type||''};
}
function restoreFocus(k){
  var pb=$('phPb'); if(!pb||!k)return;
  var el=null;
  if(k.id)el=root.querySelector('#'+k.id);
  else{
    var g=pb.querySelector('[data-chip="'+k.g+'"],[data-tile="'+k.g+'"],[data-color="'+k.g+'"],[data-sl="'+k.g+'"]');
    if(g)el=g.querySelector('[data-v="'+k.v+'"],[data-c="'+k.v+'"]')||g.querySelector('input[type="'+k.v+'"]');
  }
  if(el&&el.focus)try{ el.focus({preventScroll:true}); }catch(e){}
}
var PANEL_T='';
function renderPanel(){
  if(!root)return;
  var t=byId(TOOLS,UI.tool), pb=$('phPb'), sc=$('phScroll');
  $('phPt').textContent=t.full;
  if(!DOC){ pb.innerHTML=''; renderLayers(); syncReset(); return; }
  var same=PANEL_T===UI.tool, top=same?sc.scrollTop:0, a=document.activeElement, fk=(a&&pb.contains(a))?focusKey(a):null;
  PANEL_T=UI.tool;
  pb.innerHTML=PANELS[UI.tool]();
  paintTilePreviews();
  renderLayers(); syncReset();
  sc.scrollTop=top;
  if(fk)restoreFocus(fk);
}
var PV={key:'',cv:null};
function thumbSrc(){
  var c=DOC.crop, key=[DOC.base,DOC.m.join(','),DOC.st,Math.round(c.x),Math.round(c.y),Math.round(c.w),Math.round(c.h)].join('|');
  if(PV.key===key&&PV.cv)return PV.cv;
  var S=124, k=S/Math.min(c.w,c.h), tw=Math.max(1,Math.round(c.w*k)), th=Math.max(1,Math.round(c.h*k));
  var tmp=document.createElement('canvas'); tmp.width=tw; tmp.height=th; drawBase(tmp.getContext('2d'),DOC,k,false);
  var cv=document.createElement('canvas'); cv.width=S; cv.height=S; cv.getContext('2d').drawImage(tmp,(S-tw)/2,(S-th)/2);
  PV.key=key; PV.cv=cv; return cv;
}
function miniDoc(patch){ var d=JSON.parse(snap()); d.objs=[]; for(var k in patch)d[k]=patch[k]; return d; }
function paintTilePreviews(){
  if(!root||!DOC)return;
  var pb=$('phPb'), list=pb.querySelectorAll('canvas[data-pv]'), i;
  paintVecPreviews();
  if(!list.length)return;
  var group=list[0].closest('[data-tile]').getAttribute('data-tile'), th=thumbSrc(), c=DOC.crop;
  for(i=0;i<list.length;i++){
    var cv=list[i], id=cv.getAttribute('data-pv'), x=cv.getContext('2d'), S=cv.width;
    x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,S,S);
    if(group==='flt'){
      x.drawImage(th,0,0,S,S);
      var d0=miniDoc({flt:{id:id,amt:100},adj:{bri:0,con:0,sat:0,tmp:0,hil:0,sha:0,shr:0,vig:0},auto:null});
      processPixels(cv,effParams(d0));
    }else if(group==='frame'||group==='mask'){
      var p={}; if(group==='frame')p.frame={id:id,col:DOC.frame.col,size:DOC.frame.size,caption:''}; else { p.mask={id:id,bg:DOC.mask.bg}; p.frame={id:'none',col:'#FFFFFF',size:50,caption:''}; }
      var d1=miniDoc(p), sq=Math.min(c.w,c.h); d1.crop={x:c.x+(c.w-sq)/2,y:c.y+(c.h-sq)/2,w:sq,h:sq};
      var fi=frameInfoAt(d1,1), s=(S-8)/Math.max(fi.W,fi.H), out=renderDoc(d1,s,{});
      x.drawImage(out,(S-out.width)/2,(S-out.height)/2);
    }else if(group==='text.st'){
      x.drawImage(th,0,0,S,S); x.fillStyle='rgba(23,16,30,.12)'; x.fillRect(0,0,S,S);
      var P0=pack(), st=byId(TSTYLES,id), s0=styleCols(P0,st), ob={t:'text',tx:P0.sigTx,font:st.font||P0.font,fs:30,col:s0.col,bg:s0.bg,st:id,align:'center',bold:true,x:S/2,y:S/2,w:10,h:10,r:0,o:1,pk:P0.id};
      drawObj(x,ob,1,{x:0,y:0,w:S,h:S},DOC);
    }else if(group==='sig.tpl'){
      x.drawImage(th,0,0,S,S);
      var P1=pack(), sg={t:'sig',tpl:id,tx:id==='url'?P1.sigUrl.replace(/^blog\.naver\.com\//,''):P1.sigTx,col:'auto',size:id==='stamp'?42:(id==='mascot'?48:58),o:1,anchor:'mc',x:0,y:0,w:10,h:10,r:0,pk:P1.id};
      drawObj(x,sg,1,{x:0,y:0,w:S,h:S},{crop:{x:0,y:0,w:S,h:S}});
    }
  }
}
function paintVecPreviews(){
  var list=root.querySelectorAll('canvas[data-vpv]');
  for(var i=0;i<list.length;i++){
    var cv=list[i], v=VEC[+cv.getAttribute('data-vpv')], x=cv.getContext('2d'), S=cv.width, pad=S*(v.ar>=2?.04:.12);   /* 가로로 긴 라벨·테이프는 칸 폭을 거의 다 쓴다(글자가 읽히게) */
    var w=v.ar>=1?S-2*pad:(S-2*pad)*v.ar, h=w/v.ar;
    x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,S,S); SC=1;
    x.save(); x.translate(S/2,S/2); drawVec(x,v.k,w,h,vecCol(v.col),v.k==='num'?'1':v.tx,fontById(pack().font).fam); x.restore();
  }
}

/* ══════════ 보기 · 그리기 루프 ══════════
   VIEW.s = 화면 CSS px / 문서 px. 미리보기는 min(1, s×DPR) 배율로 합성해(사진층은 캐시) 캔버스 한 장에 옮긴다. */
var OUTC=document.createElement('canvas');
function contentDims(){
  if(UI.compare)return {w:DOC.crop.w,h:DOC.crop.h};
  if(UI.tool==='crop'){ var o=odim(); return {w:o.w,h:o.h}; }
  var fi=frameInfoAt(DOC,1); return {w:fi.W,h:fi.H};
}
function viewOrigin(){
  var c=DOC.crop;
  if(UI.compare)return {x:c.x,y:c.y};
  if(UI.tool==='crop')return {x:0,y:0};
  var pd=framePads(DOC,c.w,c.h); return {x:c.x-pd.l,y:c.y-pd.t};
}
function d2s(x,y){ var o=viewOrigin(); return [VIEW.ox+(x-o.x)*VIEW.s, VIEW.oy+(y-o.y)*VIEW.s]; }
function s2d(px,py){ var o=viewOrigin(); return [(px-VIEW.ox)/VIEW.s+o.x, (py-VIEW.oy)/VIEW.s+o.y]; }
function requestRender(){ if(!mounted||raf)return; raf=requestAnimationFrame(function(){ raf=0; paint(); }); }
function paint(){
  if(!mounted||!root)return;
  var st=$('phStage'), cv=$('phCanvas');
  if(!DOC){ cv.hidden=true; $('phOv').innerHTML=''; OV.key=''; syncAct(); return; }
  var sw=st.clientWidth, sh=st.clientHeight; if(!sw||!sh)return;
  var dims=contentDims(), pad=sw<520?18:36;
  var fit=Math.max(.01,Math.min((sw-2*pad)/dims.w,(sh-2*pad)/dims.h,2)), vs=fit*UI.zoom, cw=dims.w*vs, ch=dims.h*vs;
  var mx=Math.max(0,(cw-sw)/2+sw*.35), my=Math.max(0,(ch-sh)/2+sh*.35);
  UI.panX=clamp(UI.panX,-mx,mx); UI.panY=clamp(UI.panY,-my,my);
  VIEW.s=vs; VIEW.fit=fit; VIEW.cw=cw; VIEW.ch=ch;
  VIEW.ox=Math.round((sw-cw)/2+UI.panX); VIEW.oy=Math.round((sh-ch)/2+UI.panY);
  var dpr=Math.min(window.devicePixelRatio||1,2), rs=Math.min(1,vs*dpr), long=Math.max(dims.w,dims.h);
  if(long*rs>PREVIEW_MAX)rs=PREVIEW_MAX/long;
  var img=UI.compare?renderOriginal(DOC,rs):renderDoc(DOC,rs,{full:UI.tool==='crop',cache:true,layer:LAYER,out:OUTC});
  if(cv.width!==img.width||cv.height!==img.height){ cv.width=img.width; cv.height=img.height; }
  var x=cv.getContext('2d'); x.setTransform(1,0,0,1,0,0); x.globalAlpha=1; x.globalCompositeOperation='source-over';
  x.clearRect(0,0,cv.width,cv.height); x.drawImage(img,0,0);
  cv.style.left=VIEW.ox+'px'; cv.style.top=VIEW.oy+'px'; cv.style.width=cw+'px'; cv.style.height=ch+'px'; cv.hidden=false;
  $('phCmp').hidden=!UI.compare;
  updateOverlay(); syncAct();
}

/* ── 선택 상자 · 자르기 상자 ── 드래그 중엔 요소를 다시 만들지 않고 위치만 옮긴다(포인터 캡처는 스테이지가 가진다) */
var OV={key:''};
var HPOS={nw:[0,0],n:[.5,0],ne:[1,0],e:[1,.5],se:[1,1],s:[.5,1],sw:[0,1],w:[0,.5]};
var HCUR={nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize'};
function handleKind(ob){
  if(ob.t==='line'||ob.t==='arrow')return 'line';
  if(ob.t==='lens')return 'lens';
  if(ob.t==='mosaic')return 'free0';
  if(ob.t==='shape'||ob.t==='hl')return 'free';
  if(ob.t==='pen')return 'uni0';
  return 'uni';
}
function objBox(ob){
  if(ob.t==='line'||ob.t==='arrow')return lineBox(ob);
  return {x:ob.x,y:ob.y,w:ob.w,h:ob.h,r:ob.r||0};
}
function selHTML(kind){
  if(kind==='line')return '<div class="ph-h pt" data-h="p1"></div><div class="ph-h pt" data-h="p2"></div>';
  var hs=(kind==='free'||kind==='free0')?['nw','n','ne','e','se','s','sw','w']:['nw','ne','se','sw'];
  var h='<div class="ph-sel">'+hs.map(function(k){ return '<div class="ph-h" data-h="'+k+'"></div>'; }).join('');
  if(kind==='free'||kind==='uni')h+='<div class="ph-rl"></div><div class="ph-h r" data-h="rot"></div>';
  h+='</div>';
  if(kind==='lens')h+='<div class="ph-h pt" data-h="src"></div><div class="ph-h" data-h="srcr"></div>';
  return h;
}
function updateOverlay(){
  var ov=$('phOv'); if(!ov)return;
  if(UI.compare||!DOC){ if(OV.key){ ov.innerHTML=''; OV.key=''; } return; }
  if(UI.tool==='crop'){ cropOverlay(ov); return; }
  var ob=objById(SEL);
  if(!ob){ if(OV.key){ ov.innerHTML=''; OV.key=''; } return; }
  var kind=handleKind(ob), key='sel|'+ob.id+'|'+kind;
  if(OV.key!==key){ ov.innerHTML=selHTML(kind); OV.key=key; }
  if(kind==='line'){
    var a=d2s(ob.x1,ob.y1), b=d2s(ob.x2,ob.y2), hs=ov.querySelectorAll('.ph-h');
    hs[0].style.left=a[0]+'px'; hs[0].style.top=a[1]+'px'; hs[0].style.cursor='move';
    hs[1].style.left=b[0]+'px'; hs[1].style.top=b[1]+'px'; hs[1].style.cursor='move';
    return;
  }
  var box=objBox(ob), c=d2s(box.x,box.y), w=Math.max(4,box.w*VIEW.s), h=Math.max(4,box.h*VIEW.s), sel=ov.querySelector('.ph-sel');
  sel.style.left=(c[0]-w/2)+'px'; sel.style.top=(c[1]-h/2)+'px'; sel.style.width=w+'px'; sel.style.height=h+'px';
  sel.style.transformOrigin='50% 50%'; sel.style.transform=box.r?'rotate('+box.r+'deg)':'none';
  Array.prototype.forEach.call(sel.querySelectorAll('.ph-h'),function(el){
    var k=el.getAttribute('data-h');
    if(k==='rot'){ el.style.left='50%'; el.style.top='-30px'; return; }
    var p=HPOS[k]; el.style.left=(p[0]*100)+'%'; el.style.top=(p[1]*100)+'%'; el.style.cursor=box.r?'move':HCUR[k];
  });
  var rl=sel.querySelector('.ph-rl'); if(rl){ rl.style.top='-24px'; rl.style.height='24px'; }
  if(kind==='lens'){
    var sp=d2s(ob.sx,ob.sy), hsrc=ov.querySelector('[data-h="src"]'), hr=ov.querySelector('[data-h="srcr"]');
    hsrc.style.left=sp[0]+'px'; hsrc.style.top=sp[1]+'px'; hsrc.style.cursor='move';
    hr.style.left=(sp[0]+ob.sr*VIEW.s)+'px'; hr.style.top=sp[1]+'px'; hr.style.cursor='ew-resize';
  }
}
function cropOverlay(ov){
  if(OV.key!=='crop'){
    ov.innerHTML='<div class="ph-crop" id="phCrop" data-h="cmove">'+['nw','n','ne','e','se','s','sw','w'].map(function(k){ return '<div class="ph-h" data-h="c'+k+'"></div>'; }).join('')+
      '<span class="ph-cropz num" id="phCropZ"></span></div>';
    OV.key='crop';
  }
  var c=DOC.crop, a=d2s(c.x,c.y), el=$('phCrop');
  el.style.left=a[0]+'px'; el.style.top=a[1]+'px'; el.style.width=(c.w*VIEW.s)+'px'; el.style.height=(c.h*VIEW.s)+'px';
  Array.prototype.forEach.call(el.querySelectorAll('.ph-h'),function(h){ var k=h.getAttribute('data-h').slice(1), p=HPOS[k]; h.style.left=(p[0]*100)+'%'; h.style.top=(p[1]*100)+'%'; h.style.cursor=HCUR[k]; });
  var t=Math.round(c.w)+'×'+Math.round(c.h); $('phCropZ').textContent=t;
  var wh=$('phCropWH'); if(wh)wh.textContent=t;
}

/* ── 내보내기 줄 · 초기화 버튼 상태 ── */
function syncAct(){
  if(!root)return;
  var has=!!DOC, ph=root.querySelector('.ph');
  if(ph)ph.classList.toggle('empty',!has);
  ['phUndo','phRedo','phCompare','phZout','phZin','phFit','phCopy','phSave','phFmt','phOpen'].forEach(function(id){ var b=$(id); if(b)b.disabled=!has; });
  var dz=$('phDz'); if(dz)dz.hidden=has;
  if(!has){ $('phFn').textContent=''; $('phZv').textContent=''; return; }
  $('phUndo').disabled=HI<=0; $('phRedo').disabled=HI>=HIST.length-1;
  $('phZv').textContent=Math.round(VIEW.s*100)+'%';
  var info=outInfo(), type=exportType(DOC);
  $('phFn').textContent=info.W+'×'+info.H+' · '+(type==='image/jpeg'?'JPG':'PNG');
  if($('phFmt').value!==PREF.fmt)$('phFmt').value=PREF.fmt;
  var wh=$('phOutWH'); if(wh)wh.textContent=info.W+'×'+info.H;
}
function resetCan(){
  if(!DOC)return false;
  var o=DOC.objs;
  function any(f){ return o.some(f); }
  switch(UI.tool){
    case 'size': return DOC.out.preset!=='orig';
    case 'crop': var od=odim(); return DOC.st!==0||DOC.m.join(',')!=='1,0,0,1'||DOC.crop.x>.5||DOC.crop.y>.5||Math.abs(DOC.crop.w-od.w)>.5||Math.abs(DOC.crop.h-od.h)>.5;
    case 'filter': return DOC.flt.id!=='none';
    case 'adjust': return !!DOC.auto||ADJ.some(function(p){ return DOC.adj[p.k]!==0; });
    case 'frame': return DOC.frame.id!=='none';
    case 'mask': return DOC.mask.id!=='none';
    case 'sig': return !!sigObj();
    case 'mosaic': return any(function(b){ return b.t==='mosaic'; });
    case 'text': return any(function(b){ return b.t==='text'; });
    case 'sticker': return any(function(b){ return toolOfObj(b)==='sticker'; });
    case 'shape': return any(function(b){ return toolOfObj(b)==='shape'; });
    case 'draw': return any(function(b){ return b.t==='pen'; });
  }
  return false;
}
function syncReset(){ var b=$('phReset'); if(b)b.disabled=!resetCan(); }

/* ── 도구 전환 · 선택 ── */
function stageCursor(){
  var st=$('phStage'); if(!st)return;
  st.classList.toggle('t-make',!!DOC&&!UI.compare&&(UI.tool==='shape'||UI.tool==='mosaic'||UI.tool==='draw'||UI.tool==='text'));
  st.classList.toggle('t-pan',!!UI.space);
  if(!DOC)st.classList.remove('out');
}
/* 커서 되먹임 — 사진 밖에 있으면 «만들기» 커서를 끈다(눌러도 안 만들어지니까) */
function onHover(e){
  var st=$('phStage'); if(!st)return;
  if(!DOC||DRAG||UI.compare||UI.tool==='crop'){ st.classList.remove('out'); return; }
  var p=stageXY(e), d=s2d(p[0],p[1]);
  st.classList.toggle('out',!inPhoto(d[0],d[1]));
}
function setTool(id,keepSel){
  if(!has(TOOLS,id)||!root)return;
  var prev=UI.tool; UI.tool=id; PREF.tool=id; savePrefs();
  if(!keepSel){ var ob=objById(SEL); if(ob&&toolOfObj(ob)!==id)SEL=null; }
  if(prev!==id&&(prev==='crop'||id==='crop')){ UI.zoom=1; UI.panX=0; UI.panY=0; }
  Array.prototype.forEach.call(root.querySelectorAll('.ph-ri'),function(b){ var on=b.getAttribute('data-tool')===id; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  stageCursor(); renderPanel(); requestRender();
  if(id==='text'||id==='sig'||id==='sticker')loadFonts();
}
function select(id){
  SEL=id||null;
  var ob=objById(SEL);
  if(ob&&toolOfObj(ob)!==UI.tool){ setTool(toolOfObj(ob),true); return; }
  renderPanel(); requestRender();
}
var FONTS_P=null;
function loadFonts(){
  if(!(document.fonts&&document.fonts.load))return Promise.resolve();
  if(!FONTS_P){
    var jobs=[];
    FONTS.forEach(function(f){ f.w.forEach(function(w){ jobs.push(document.fonts.load(w+' 32px '+f.fam,'봄딩 가나 Aa1').catch(function(){})); }); });
    PACKS.forEach(function(p){ var lf=fontById(p.font).fam;
      jobs.push(document.fonts.load('800 32px '+lf,'봄딩 영도 추천 BEST').catch(function(){}));
      jobs.push(document.fonts.load('700 32px '+lf,'blog.naver.com').catch(function(){})); });
    FONTS_P=Promise.all(jobs);
  }
  return FONTS_P.then(function(){ if(mounted){ paintTilePreviews(); requestRender(); } });
}

/* ══════════ 조작 ══════════ */
var DRAG=null, SDRAG=null, NUDGE_T=0;
function stageXY(e){ var r=$('phStage').getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; }
function inBox(px,py,ob,tol){ var r=-deg(ob.r||0), dx=px-ob.x, dy=py-ob.y, lx=dx*Math.cos(r)-dy*Math.sin(r), ly=dx*Math.sin(r)+dy*Math.cos(r); return Math.abs(lx)<=ob.w/2+tol&&Math.abs(ly)<=ob.h/2+tol; }
function segDist(px,py,x1,y1,x2,y2){ var dx=x2-x1, dy=y2-y1, l2=dx*dx+dy*dy, t=l2?clamp(((px-x1)*dx+(py-y1)*dy)/l2,0,1):0; return Math.hypot(px-(x1+t*dx),py-(y1+t*dy)); }
function penHit(ob,x,y,tol){
  if(!inBox(x,y,ob,tol))return false;
  var p=ob.pts; if(p.length<=2)return Math.hypot(x-p[0],y-p[1])<=ob.sw/2+tol;
  for(var j=0;j<p.length-2;j+=2)if(segDist(x,y,p[j],p[j+1],p[j+2],p[j+3])<=ob.sw/2+tol)return true;
  return false;
}
function hitObj(x,y,tool){
  var tol=8/VIEW.s;
  for(var i=DOC.objs.length-1;i>=0;i--){
    var ob=DOC.objs[i];
    if(ob.hide)continue;
    if(tool&&toolOfObj(ob)!==tool)continue;
    if(ob.t==='line'||ob.t==='arrow'){ if(segDist(x,y,ob.x1,ob.y1,ob.x2,ob.y2)<=ob.sw/2+tol)return ob; continue; }
    if(ob.t==='pen'){ if(penHit(ob,x,y,tol))return ob; continue; }
    if(ob.t==='lens'){ if(Math.hypot(x-ob.x,y-ob.y)<=ob.w/2+tol||Math.hypot(x-ob.sx,y-ob.sy)<=ob.sr+tol)return ob; continue; }
    if(inBox(x,y,ob,tol))return ob;
  }
  return null;
}
/* ── 사진 밖 ─────────────────────────────────────────────────────────────
   개체는 «자르기 창»(사진으로 남는 부분)에만 그려진다 — 그 밖은 잘려 안 보인다.
   그래서 사진 밖에서 시작한 조작은 아무것도 만들지 않고(선택만 풀고), 옮기는 것도 가운데가 사진 안에 남게 붙든다. */
function inPhoto(x,y){
  if(!DOC)return false;
  var c=DOC.crop;
  return x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h;
}
function clampPt(x,y){
  var c=DOC.crop, m=Math.min(c.w,c.h)*.04;
  return [clamp(x,c.x+m,c.x+c.w-m),clamp(y,c.y+m,c.y+c.h-m)];
}
function keepIn(ob){
  if(!DOC||!ob)return;
  var bx=(ob.t==='line'||ob.t==='arrow')?(ob.x1+ob.x2)/2:ob.x, by=(ob.t==='line'||ob.t==='arrow')?(ob.y1+ob.y2)/2:ob.y;
  var p=clampPt(bx,by);
  if(p[0]!==bx||p[1]!==by)moveBy(ob,p[0]-bx,p[1]-by);
}
function indexOfObj(id){ for(var i=0;i<DOC.objs.length;i++)if(DOC.objs[i].id===id)return i; return -1; }
function moveBy(ob,dx,dy){
  if(ob.t==='line'||ob.t==='arrow'){ ob.x1+=dx; ob.y1+=dy; ob.x2+=dx; ob.y2+=dy; return; }
  if(ob.t==='pen'){ for(var i=0;i<ob.pts.length;i+=2){ ob.pts[i]+=dx; ob.pts[i+1]+=dy; } penBox(ob); return; }
  ob.x+=dx; ob.y+=dy;
  if(ob.t==='lens'){ ob.sx+=dx; ob.sy+=dy; }
  if(ob.t==='sig')ob.anchor=null;
}
/* 잠깐 숨기기 — 아래 깔린 걸 보며 고칠 때. 내보내기에도 안 나온다 */
function hideObj(id){
  var ob=objById(id); if(!ob)return;
  ob.hide=!ob.hide;
  if(ob.hide&&SEL===id)SEL=null;
  commit(); renderPanel(); requestRender();
}
function delObj(id){ var i=indexOfObj(id); if(i<0)return; DOC.objs.splice(i,1); if(SEL===id)SEL=null; commit(); renderPanel(); requestRender(); }
function dupObj(id){
  var ob=objById(id); if(!ob||ob.t==='sig')return;
  var c=clone(ob), off=Math.max(8,unitSize()*.03); c.id=uid(); moveBy(c,off,off);
  if(c.t==='vec'&&c.k==='num')c.tx=String(DOC.num++);
  DOC.objs.splice(indexOfObj(id)+1,0,c); select(c.id); commit();
}
function moveZ(id,dir){
  var i=indexOfObj(id), j=i+dir; if(i<0||j<0||j>=DOC.objs.length)return;
  var t=DOC.objs[i]; DOC.objs[i]=DOC.objs[j]; DOC.objs[j]=t; commit(); renderPanel(); requestRender();
}
function viewCenterDoc(){
  var st=$('phStage'), d=s2d(st.clientWidth/2,st.clientHeight/2), c=DOC.crop, step=unitSize()*.06;
  var x=clamp(d[0],c.x+c.w*.1,c.x+c.w*.9), y=clamp(d[1],c.y+c.h*.1,c.y+c.h*.9);
  for(var k=0;k<8;k++){
    var busy=DOC.objs.some(function(o){ return typeof o.x==='number'&&Math.abs(o.x-x)<2&&Math.abs(o.y-y)<2; });
    if(!busy)break;
    x=clamp(x+step,c.x+c.w*.05,c.x+c.w*.95); y=clamp(y+step,c.y+c.h*.05,c.y+c.h*.95);
  }
  return [x,y];
}
function addTextAt(x,y,tx){
  var ob=mkText(x,y,tx); measureText(ob); DOC.objs.push(ob); SEL=ob.id;
  if(UI.tool!=='text')setTool('text',true); else{ renderPanel(); requestRender(); }
  commit();
  setTimeout(function(){ var ta=$('phTx'); if(ta){ ta.focus({preventScroll:true}); ta.select(); } },30);
}
function addMascot(id,x,y){
  return stkLoad(id).then(function(im){
    if(!DOC)return; var p=x==null?viewCenterDoc():[x,y], ob=mkStk(id,p[0],p[1],im);
    DOC.objs.push(ob); select(ob.id); commit();
  },function(){ if(api)api.toast('스티커를 불러오지 못했어요',{kind:'err'}); });
}
function addVec(i,x,y){ var v=VEC[i]; if(!v||!DOC)return; var p=x==null?viewCenterDoc():[x,y], ob=mkVec(v,p[0],p[1]); DOC.objs.push(ob); select(ob.id); commit(); }
function addSig(tpl){
  if(!DOC)return; var sg=sigObj();
  if(!sg){ sg=mkSig(); DOC.objs.push(sg); }
  if(tpl){ var SP=PK(sg.pk);
    if(tpl==='url'&&sg.tx===SP.sigTx){ sg.tx=SP.sigUrl; PREF.sig.text=sg.tx; }
    if(tpl!=='url'&&sg.tx===SP.sigUrl){ sg.tx=SP.sigTx; PREF.sig.text=sg.tx; }
    sg.tpl=tpl; PREF.sig.tpl=tpl; savePrefs(); }
  if(sg.tpl==='mascot')stkLoad(PK(sg.pk).face).then(requestRender,function(){});
  SEL=sg.id; if(UI.tool!=='sig')setTool('sig',true); else renderPanel();
  commit(); requestRender(); loadFonts();
}

/* 자르기 — 비율이 있으면 고정점(반대 모서리·변 가운데)을 기준으로 맞추고, 사진 밖으로 나가면 같은 비율로 줄인다 */
function fitRectInBounds(x0,y0,x1,y1,ax,ay,W,H){
  var k=1;
  if(x0<0&&ax>x0)k=Math.min(k,ax/(ax-x0));
  if(x1>W&&x1>ax)k=Math.min(k,(W-ax)/(x1-ax));
  if(y0<0&&ay>y0)k=Math.min(k,ay/(ay-y0));
  if(y1>H&&y1>ay)k=Math.min(k,(H-ay)/(y1-ay));
  k=Math.max(0,k);
  return [ax+(x0-ax)*k,ay+(y0-ay)*k,ax+(x1-ax)*k,ay+(y1-ay)*k];
}
function cropResize(c0,h,d,ar){
  var o=odim(), MIN=16, x0=c0.x, y0=c0.y, x1=c0.x+c0.w, y1=c0.y+c0.h, px=clamp(d[0],0,o.w), py=clamp(d[1],0,o.h);
  if(h.indexOf('w')>=0)x0=Math.min(px,x1-MIN);
  if(h.indexOf('e')>=0)x1=Math.max(px,x0+MIN);
  if(h.indexOf('n')>=0)y0=Math.min(py,y1-MIN);
  if(h.indexOf('s')>=0)y1=Math.max(py,y0+MIN);
  if(ar){
    var w=x1-x0, hh=y1-y0, ax, ay, cx=c0.x+c0.w/2, cy=c0.y+c0.h/2;
    if(h==='n'||h==='s'){ w=hh*ar; x0=cx-w/2; x1=cx+w/2; ax=cx; ay=h==='n'?y1:y0; }
    else if(h==='e'||h==='w'){ hh=w/ar; y0=cy-hh/2; y1=cy+hh/2; ax=h==='w'?x1:x0; ay=cy; }
    else{
      if(w/hh>ar)hh=w/ar; else w=hh*ar;
      if(h.indexOf('w')>=0){ x0=x1-w; ax=x1; } else { x1=x0+w; ax=x0; }
      if(h.indexOf('n')>=0){ y0=y1-hh; ay=y1; } else { y1=y0+hh; ay=y0; }
    }
    var f=fitRectInBounds(x0,y0,x1,y1,ax,ay,o.w,o.h); x0=f[0]; y0=f[1]; x1=f[2]; y1=f[3];
  }
  return clampCrop({x:x0,y:y0,w:x1-x0,h:y1-y0},o.w,o.h);
}
function cropFromDrag(d0,d,ar){
  var o=odim(), ax=clamp(d0[0],0,o.w), ay=clamp(d0[1],0,o.h), bx=clamp(d[0],0,o.w), by=clamp(d[1],0,o.h), w=Math.abs(bx-ax), h=Math.abs(by-ay);
  if(ar){ if(w/Math.max(h,1e-6)>ar)h=w/ar; else w=h*ar; }
  var sx=bx<ax?-1:1, sy=by<ay?-1:1, x0=Math.min(ax,ax+sx*w), x1=Math.max(ax,ax+sx*w), y0=Math.min(ay,ay+sy*h), y1=Math.max(ay,ay+sy*h);
  if(ar){ var f=fitRectInBounds(x0,y0,x1,y1,ax,ay,o.w,o.h); x0=f[0]; y0=f[1]; x1=f[2]; y1=f[3]; }
  return {x:x0,y:y0,w:x1-x0,h:y1-y0};
}
/* 상자 크기 — 반대편 손잡이를 고정. 균등(글자·스티커·서명·펜·돋보기)은 비율 유지, 도형은 Shift 로 유지 */
function doResize(ob,o0,hk,d,kind,shift){
  var r=deg(o0.r||0), cos=Math.cos(r), sin=Math.sin(r);
  var hx=hk.indexOf('e')>=0?1:(hk.indexOf('w')>=0?-1:0), hy=hk.indexOf('s')>=0?1:(hk.indexOf('n')>=0?-1:0);
  var dx=d[0]-o0.x, dy=d[1]-o0.y, lx=dx*cos+dy*sin, ly=-dx*sin+dy*cos;
  var ax=-hx*o0.w/2, ay=-hy*o0.h/2, MIN=8/VIEW.s, w=o0.w, h=o0.h;
  var keep=(kind==='uni'||kind==='uni0'||kind==='lens')||(shift&&hx&&hy);
  if(keep&&hx&&hy){ var k=Math.max((lx-ax)*hx/o0.w,(ly-ay)*hy/o0.h,MIN/Math.min(o0.w,o0.h)); w=o0.w*k; h=o0.h*k; }
  else{ if(hx)w=Math.max(MIN,(lx-ax)*hx); if(hy)h=Math.max(MIN,(ly-ay)*hy); }
  var cxl=hx?ax+hx*w/2:0, cyl=hy?ay+hy*h/2:0, nx=o0.x+cxl*cos-cyl*sin, ny=o0.y+cxl*sin+cyl*cos, k2=w/o0.w;
  switch(ob.t){
    case 'text': ob.fs=Math.max(4,o0.fs*k2); ob.x=nx; ob.y=ny; return;
    case 'sig': ob.size=clamp(o0.size*k2,6,60); ob.anchor=null; ob.x=nx; ob.y=ny; return;
    case 'pen':
      var awx=o0.x+ax*cos-ay*sin, awy=o0.y+ax*sin+ay*cos;
      for(var i=0;i<o0.pts.length;i+=2){ ob.pts[i]=awx+(o0.pts[i]-awx)*k2; ob.pts[i+1]=awy+(o0.pts[i+1]-awy)*k2; }
      ob.sw=Math.max(1,o0.sw*k2); penBox(ob); return;
    case 'lens': ob.w=ob.h=Math.max(MIN,o0.w*k2); ob.x=nx; ob.y=ny; return;
    default: ob.w=w; ob.h=h; ob.x=nx; ob.y=ny;
  }
}
function snapAngle(ang,shift){ if(shift)return Math.round(ang/15)*15; var s=Math.round(ang/45)*45; return Math.abs(ang-s)<4?s:ang; }
function startDrag(e,o){ DRAG=o; DRAG.pid=e.pointerId; DRAG.changed=false; try{ $('phStage').setPointerCapture(e.pointerId); }catch(er){} }
function onDown(e){
  if(!DOC||UI.compare||e.button===2)return;
  var st=$('phStage'), p=stageXY(e), d=s2d(p[0],p[1]), hEl=e.target.closest?e.target.closest('[data-h]'):null, hk=hEl?hEl.getAttribute('data-h'):null;
  try{ st.focus({preventScroll:true}); }catch(er){}
  if(e.button===1||UI.space){ startDrag(e,{k:'pan',sx:p[0],sy:p[1],px:UI.panX,py:UI.panY}); st.classList.add('panning'); e.preventDefault(); return; }
  if(UI.tool==='crop'){
    var c=clone(DOC.crop);
    if(hk&&hk!=='cmove')startDrag(e,{k:'cropH',h:hk.slice(1),c0:c});
    else if(hk==='cmove')startDrag(e,{k:'cropMove',c0:c,d0:d});
    else startDrag(e,{k:'cropNew',c0:c,d0:d});
    e.preventDefault(); return;
  }
  var sel=objById(SEL);
  if(sel&&hk){
    if(hk==='rot')startDrag(e,{k:'rot',id:sel.id});
    else if(hk==='p1'||hk==='p2'||hk==='srcr')startDrag(e,{k:hk,id:sel.id});
    else if(hk==='src')startDrag(e,{k:'src',id:sel.id,o0:clone(sel),d0:d});
    else startDrag(e,{k:'resize',h:hk,id:sel.id,o0:clone(sel),kind:handleKind(sel)});
    e.preventDefault(); return;
  }
  if(!inPhoto(d[0],d[1])){                       /* 사진 밖 — 만들지 않는다(잘려서 안 보이는 자리) */
    if(SEL)select(null);
    if(UI.zoom>1){ startDrag(e,{k:'pan',sx:p[0],sy:p[1],px:UI.panX,py:UI.panY}); st.classList.add('panning'); }
    return;
  }
  if(UI.tool==='draw'){
    if(sel&&sel.t==='pen'&&inBox(d[0],d[1],sel,4/VIEW.s)){ startDrag(e,{k:'move',id:sel.id,o0:clone(sel),d0:d}); e.preventDefault(); return; }
    if(PREF.penMode==='erase'){ startDrag(e,{k:'erase'}); eraseAt(d); }
    else{ var pn=mkPen([d[0],d[1]],PREF.penMode==='hl'); DOC.objs.push(pn); if(SEL){ SEL=null; OV.key='x'; } startDrag(e,{k:'pen',id:pn.id,last:p}); DRAG.changed=true; requestRender(); }
    e.preventDefault(); return;
  }
  var making=UI.tool==='shape'||UI.tool==='mosaic'||UI.tool==='text';
  var hit=hitObj(d[0],d[1],making?UI.tool:null);   /* 만드는 도구에선 같은 종류만 잡는다 — 다른 개체 위에서 시작해도 새로 만든다 */
  if(hit){
    if(hit.id!==SEL)select(hit.id);
    startDrag(e,{k:'move',id:hit.id,o0:clone(hit),d0:d});
    e.preventDefault(); return;
  }
  if(UI.tool==='shape'){
    if(PREF.shape==='num'){ var nb=mkShape('num',d[0],d[1],d[0],d[1]); DOC.objs.push(nb); select(nb.id); commit(); e.preventDefault(); return; }
    startDrag(e,{k:'make',what:PREF.shape,d0:d}); e.preventDefault(); return;
  }
  if(UI.tool==='mosaic'){ startDrag(e,{k:'make',what:'mosaic',d0:d}); e.preventDefault(); return; }
  if(UI.tool==='text'){ addTextAt(d[0],d[1]); e.preventDefault(); return; }
  if(SEL)select(null);
  if(UI.zoom>1){ startDrag(e,{k:'pan',sx:p[0],sy:p[1],px:UI.panX,py:UI.panY}); st.classList.add('panning'); }
}
function onMove(e){
  if(!DRAG||!DOC||e.pointerId!==DRAG.pid)return;
  var p=stageXY(e), d=s2d(p[0],p[1]), ob=DRAG.id?objById(DRAG.id):null, sh=e.shiftKey;
  switch(DRAG.k){
    case 'pan': UI.panX=DRAG.px+(p[0]-DRAG.sx); UI.panY=DRAG.py+(p[1]-DRAG.sy); requestRender(); return;
    case 'cropMove':
      var o=odim(), c0=DRAG.c0; DOC.crop={x:clamp(c0.x+d[0]-DRAG.d0[0],0,o.w-c0.w),y:clamp(c0.y+d[1]-DRAG.d0[1],0,o.h-c0.h),w:c0.w,h:c0.h};
      DRAG.changed=true; requestRender(); return;
    case 'cropH': DOC.crop=cropResize(DRAG.c0,DRAG.h,d,arOf(PREF.cropAR)); DRAG.changed=true; requestRender(); return;
    case 'cropNew':
      if(Math.hypot((d[0]-DRAG.d0[0])*VIEW.s,(d[1]-DRAG.d0[1])*VIEW.s)<6&&!DRAG.changed)return;
      var nc=cropFromDrag(DRAG.d0,d,arOf(PREF.cropAR)); if(nc.w>=16&&nc.h>=16){ DOC.crop=nc; DRAG.changed=true; requestRender(); } return;
  }
  if(DRAG.k==='erase'){ eraseAt(d); return; }
  if(DRAG.k==='make'){
    var d0=DRAG.d0;
    if(!ob){
      if(Math.hypot((d[0]-d0[0])*VIEW.s,(d[1]-d0[1])*VIEW.s)<5)return;
      ob=DRAG.what==='mosaic'?mkMosaic(d0[0],d0[1],d[0],d[1]):(DRAG.what==='lens'?mkLens(d0[0],d0[1],Math.hypot(d[0]-d0[0],d[1]-d0[1])):mkShape(DRAG.what,d0[0],d0[1],d[0],d[1]));
      DOC.objs.push(ob); DRAG.id=ob.id; SEL=ob.id;
    }
    if(ob.t==='line'||ob.t==='arrow'){
      var ex=d[0], ey=d[1];
      if(sh){ var a=Math.round(Math.atan2(ey-d0[1],ex-d0[0])/(Math.PI/4))*(Math.PI/4), L=Math.hypot(ex-d0[0],ey-d0[1]); ex=d0[0]+Math.cos(a)*L; ey=d0[1]+Math.sin(a)*L; }
      ob.x2=ex; ob.y2=ey;
    }else if(ob.t==='lens'){
      var fr=mkLens(d0[0],d0[1],Math.max(6/VIEW.s,Math.hypot(d[0]-d0[0],d[1]-d0[1]))); ob.sr=fr.sr; ob.x=fr.x; ob.y=fr.y; ob.w=fr.w; ob.h=fr.h;
    }else{
      var x0=Math.min(d0[0],d[0]), y0=Math.min(d0[1],d[1]), w=Math.abs(d[0]-d0[0]), h=Math.abs(d[1]-d0[1]);
      if(sh){ var m=Math.max(w,h); w=h=m; x0=d[0]<d0[0]?d0[0]-m:d0[0]; y0=d[1]<d0[1]?d0[1]-m:d0[1]; }
      ob.w=Math.max(4/VIEW.s,w); ob.h=Math.max(4/VIEW.s,h); ob.x=x0+ob.w/2; ob.y=y0+ob.h/2;
    }
    DRAG.changed=true; requestRender(); return;
  }
  if(!ob)return;
  switch(DRAG.k){
    case 'pen':
      var evs=(e.getCoalescedEvents&&e.getCoalescedEvents())||[e];
      for(var q=0;q<evs.length;q++){ var cp=stageXY(evs[q]); if(Math.hypot(cp[0]-DRAG.last[0],cp[1]-DRAG.last[1])<1.5)continue; DRAG.last=cp; var cd=s2d(cp[0],cp[1]); ob.pts.push(cd[0],cd[1]); }
      penBox(ob); requestRender(); return;
    case 'move':
      var o0=DRAG.o0, mx=d[0]-DRAG.d0[0], my=d[1]-DRAG.d0[1];
      if(!DRAG.changed&&Math.abs(mx*VIEW.s)<2&&Math.abs(my*VIEW.s)<2)return;
      var cur=clone(o0); cur.id=ob.id; moveBy(cur,mx,my);
      if(cur.t!=='line'&&cur.t!=='arrow'&&cur.t!=='pen'){
        var cr=DOC.crop, tol=6/VIEW.s, ccx=cr.x+cr.w/2, ccy=cr.y+cr.h/2;
        if(Math.abs(cur.x-ccx)<tol){ if(cur.t==='lens')cur.sx+=ccx-cur.x; cur.x=ccx; }
        if(Math.abs(cur.y-ccy)<tol){ if(cur.t==='lens')cur.sy+=ccy-cur.y; cur.y=ccy; }
      }
      keepIn(cur);
      for(var key in cur)ob[key]=cur[key];
      DRAG.changed=true; requestRender(); return;
    case 'resize': doResize(ob,DRAG.o0,DRAG.h,d,DRAG.kind,sh); DRAG.changed=true; requestRender(); return;
    case 'rot': ob.r=normAng(snapAngle(Math.atan2(d[1]-ob.y,d[0]-ob.x)*180/Math.PI+90,sh)); DRAG.changed=true; requestRender(); return;
    case 'p1': case 'p2':
      var fx=DRAG.k==='p1'?ob.x2:ob.x1, fy=DRAG.k==='p1'?ob.y2:ob.y1, px2=d[0], py2=d[1];
      if(sh){ var an=Math.round(Math.atan2(py2-fy,px2-fx)/(Math.PI/4))*(Math.PI/4), ln=Math.hypot(px2-fx,py2-fy); px2=fx+Math.cos(an)*ln; py2=fy+Math.sin(an)*ln; }
      if(DRAG.k==='p1'){ ob.x1=px2; ob.y1=py2; } else { ob.x2=px2; ob.y2=py2; }
      DRAG.changed=true; requestRender(); return;
    case 'src': ob.sx=DRAG.o0.sx+d[0]-DRAG.d0[0]; ob.sy=DRAG.o0.sy+d[1]-DRAG.d0[1]; DRAG.changed=true; requestRender(); return;
    case 'srcr': ob.sr=Math.max(4/VIEW.s,Math.hypot(d[0]-ob.sx,d[1]-ob.sy)); DRAG.changed=true; requestRender(); return;
  }
}
function onUp(e){
  if(!DRAG||(e.pointerId!==DRAG.pid&&e.type!=='lostpointercapture'))return;
  var dr=DRAG; DRAG=null;
  var st=$('phStage'); if(st){ st.classList.remove('panning'); try{ st.releasePointerCapture(dr.pid); }catch(er){} }
  if(dr.k==='pan'||!DOC)return;
  if(dr.k==='make'&&!dr.id)return;
  if(dr.k==='pen'){ commit(); renderLayers(); syncReset(); return; }
  if(dr.changed){ commit(); renderPanel(); }
  requestRender();
}
function eraseAt(d){
  var tol=12/VIEW.s, n=DOC.objs.length;
  DOC.objs=DOC.objs.filter(function(ob){ return !(ob.t==='pen'&&penHit(ob,d[0],d[1],tol)); });
  if(DOC.objs.length!==n){ if(SEL&&!objById(SEL))SEL=null; DRAG.changed=true; requestRender(); }
}
function zoomAt(z,px,py){
  if(!DOC||!root)return;
  var st=$('phStage'); if(px==null){ px=st.clientWidth/2; py=st.clientHeight/2; }
  z=clamp(z,.25,8); var d=s2d(px,py);
  UI.zoom=z;
  var vs=VIEW.fit*z, dims=contentDims(), o=viewOrigin();
  UI.panX=(px-(d[0]-o.x)*vs)-(st.clientWidth-dims.w*vs)/2;
  UI.panY=(py-(d[1]-o.y)*vs)-(st.clientHeight-dims.h*vs)/2;
  requestRender();
}
function onWheel(e){
  if(!DOC)return;
  if(e.ctrlKey||e.metaKey){ e.preventDefault(); var p=stageXY(e); zoomAt(UI.zoom*Math.exp(-e.deltaY*.0022),p[0],p[1]); return; }
  if(UI.zoom>1){ e.preventDefault(); UI.panX-=e.deltaX; UI.panY-=e.deltaY; requestRender(); }
}
function onDbl(e){
  if(!DOC||UI.tool==='crop')return;
  var p=stageXY(e), d=s2d(p[0],p[1]), hit=hitObj(d[0],d[1]);
  if(!hit||(hit.t!=='text'&&hit.t!=='sig'))return;
  select(hit.id);
  setTimeout(function(){ var t=$(hit.t==='text'?'phTx':'phSigTx'); if(t){ t.focus({preventScroll:true}); t.select(); } },30);
}
/* 스티커를 판에서 사진 위로 끌어 놓기(마우스·펜). 터치는 탭 = 넣기 */
function onSkDown(e){
  var sk=e.target.closest?e.target.closest('.ph-sk'):null;
  if(!sk||e.button!==0||e.pointerType==='touch'||!DOC)return;
  SDRAG={el:sk,x:e.clientX,y:e.clientY,pid:e.pointerId,ghost:null,moved:false};
  document.addEventListener('pointermove',onSkMove); document.addEventListener('pointerup',onSkUp); document.addEventListener('pointercancel',onSkUp);
}
function onSkMove(e){
  if(!SDRAG||e.pointerId!==SDRAG.pid)return;
  if(!SDRAG.moved&&Math.hypot(e.clientX-SDRAG.x,e.clientY-SDRAG.y)<6)return;
  if(!SDRAG.moved){
    SDRAG.moved=true;
    var g=document.createElement('div'); g.className='ph-ghost';
    var src=SDRAG.el.querySelector('img,canvas');
    if(src){ var cl=src.cloneNode(true); if(cl.tagName==='CANVAS')cl.getContext('2d').drawImage(src,0,0); g.appendChild(cl); }
    document.body.appendChild(g); SDRAG.ghost=g;
  }
  SDRAG.ghost.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)';
  var st=$('phStage'); if(st){ var r=st.getBoundingClientRect(); st.classList.toggle('over',e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom); }
  e.preventDefault();
}
function onSkUp(e){
  if(!SDRAG||e.pointerId!==SDRAG.pid)return;
  var s=SDRAG; SDRAG=null;
  document.removeEventListener('pointermove',onSkMove); document.removeEventListener('pointerup',onSkUp); document.removeEventListener('pointercancel',onSkUp);
  if(s.ghost&&s.ghost.parentNode)s.ghost.parentNode.removeChild(s.ghost);
  var st=$('phStage'); if(!st||!s.moved||e.type==='pointercancel'){ if(st)st.classList.remove('over'); return; }
  st.classList.remove('over');
  var r=st.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
  s.el.__drop=Date.now();
  var d=s2d(e.clientX-r.left,e.clientY-r.top);
  if(!inPhoto(d[0],d[1])){ if(api)api.toast('사진 위에 놓아 주세요'); return; }
  if(s.el.hasAttribute('data-stk'))addMascot(s.el.getAttribute('data-stk'),d[0],d[1]); else addVec(+s.el.getAttribute('data-vec'),d[0],d[1]);
}
function onKey(e){
  if(!mounted||!DOC||!root)return;
  if(document.querySelector('.back'))return;
  var t=e.target, typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);
  if(typing)return;
  var a=document.activeElement, st=$('phStage'), inTool=root.contains(a)||a===document.body||!a;
  if(!inTool)return;
  var mod=e.ctrlKey||e.metaKey, k=e.key, onStage=a===st||a===document.body||!a||a===$('phCanvas');
  if(mod&&(k==='z'||k==='Z')){ e.preventDefault(); if(e.shiftKey)redo(); else undo(); return; }
  if(mod&&(k==='y'||k==='Y')){ e.preventDefault(); redo(); return; }
  if(!onStage)return;
  var ob=objById(SEL);
  if(k===' '){ if(!UI.space){ UI.space=true; stageCursor(); } e.preventDefault(); return; }
  if((k==='Delete'||k==='Backspace')&&ob){ e.preventDefault(); delObj(ob.id); return; }
  if(mod&&(k==='d'||k==='D')&&ob){ e.preventDefault(); dupObj(ob.id); return; }
  if(k==='Escape'&&SEL){ e.preventDefault(); select(null); return; }
  if((k==='['||k===']')&&ob){ e.preventDefault(); moveZ(ob.id,k===']'?1:-1); return; }
  if(k.indexOf('Arrow')===0&&ob){
    e.preventDefault();
    var step=(e.shiftKey?10:1)/VIEW.s;
    moveBy(ob,k==='ArrowLeft'?-step:(k==='ArrowRight'?step:0),k==='ArrowUp'?-step:(k==='ArrowDown'?step:0));
    keepIn(ob); requestRender(); clearTimeout(NUDGE_T); NUDGE_T=setTimeout(function(){ if(DOC){ commit(); renderPanel(); } },350);
  }
}
function onKeyUp(e){ if(e.key===' '&&UI.space){ UI.space=false; stageCursor(); } }

/* ══════════ 설정 판 반응 ══════════ 판 전체에 위임 리스너 한 벌(마운트 때) — 판을 다시 그려도 끊기지 않는다 */
var TXT_T=0;
function commitSoon(){ clearTimeout(TXT_T); TXT_T=setTimeout(function(){ if(DOC){ commit(); renderLayers(); syncReset(); } },500); }
function setSlider(key,v,final){
  if(!DOC)return;
  var ob=objById(SEL), u=unitSize(), sg=sigObj();
  switch(key){
    case 'st': DOC.st=clamp(v,-45,45); break;
    case 'flt.amt': DOC.flt.amt=clamp(v,0,100); break;
    case 'frame.size': DOC.frame.size=clamp(v,0,100); PREF.frame.size=DOC.frame.size; savePrefs(); break;
    case 'mos.amt': PREF.mos.amt=clamp(v,1,100); savePrefs(); if(ob&&ob.t==='mosaic')ob.amt=PREF.mos.amt; break;
    case 'obj.o': if(ob)ob.o=clamp(v,0,100)/100; break;
    case 'obj.r': if(ob)ob.r=normAng(v); break;
    case 'text.size': if(ob&&ob.t==='text')ob.fs=Math.max(4,u*v/100); else{ PREF.text.size=clamp(v,1,40)/100; savePrefs(); } break;
    case 'sig.size': PREF.sig.size=clamp(v,6,60); savePrefs(); if(sg)sg.size=PREF.sig.size; break;
    case 'sig.o': PREF.sig.o=clamp(v,10,100); savePrefs(); if(sg)sg.o=PREF.sig.o/100; break;
    case 'line.sw': if(ob&&ob.t!=='pen'&&typeof ob.sw==='number')ob.sw=Math.max(1,u*v/1000); else{ PREF.line.w=clamp(v,1,40)/1000; savePrefs(); } break;
    case 'line.fo': if(isShape(ob))ob.fo=clamp(v,0,100)/100; else{ PREF.line.fo=clamp(v,0,100)/100; savePrefs(); } break;
    case 'lens.zoom': if(ob&&ob.t==='lens')ob.sr=ob.w/2/clamp(v,1.2,4); break;
    case 'img.rad': if(ob&&ob.t==='img')ob.rad=clamp(v,0,50)/100; break;
    case 'pen.w': PREF.pen.w=clamp(v,1,60)/1000; savePrefs(); if(ob&&ob.t==='pen'&&!ob.hl)ob.sw=Math.max(1,u*PREF.pen.w); break;
    case 'pen.hlw': PREF.pen.hlW=clamp(v,1,120)/1000; savePrefs(); if(ob&&ob.t==='pen'&&ob.hl)ob.sw=Math.max(1,u*PREF.pen.hlW); break;
    default: if(key.indexOf('adj.')===0)DOC.adj[key.slice(4)]=clamp(Math.round(v),-100,100);
  }
  requestRender();
  if(final){ commit(); syncReset(); if(key==='frame.size'||key==='st')paintTilePreviews(); }
}
function colorOf(key){
  var ob=objById(SEL), sg=sigObj();
  switch(key){
    case 'frame.col': return DOC.frame.col;
    case 'sig.col': return sg?sg.col:PREF.sig.col;
    case 'text.col': return ob&&ob.t==='text'?ob.col:PREF.text.col;
    case 'text.bg': return ob&&ob.t==='text'?ob.bg:PREF.text.bg;
    case 'vec.col': return ob&&ob.t==='vec'?ob.col:'';
    case 'line.col': return ob&&isHex(ob.col)&&ob.t!=='hl'&&ob.t!=='pen'?ob.col:PREF.line.col;
    case 'line.fill': return isShape(ob)?ob.fill:PREF.line.fill;
    case 'hl.col': return ob&&ob.t==='hl'?ob.col:PREF.pen.hlCol;
    case 'pen.col': return PREF.pen.col;
    case 'pen.hl': return PREF.pen.hlCol;
  }
  return '';
}
function applyColor(key,hex){
  var ob=objById(SEL), sg=sigObj();
  switch(key){
    case 'frame.col': DOC.frame.col=hex; PREF.frame.col=hex; break;
    case 'sig.col': if(sg)sg.col=hex; PREF.sig.col=hex; break;
    case 'text.col': if(ob&&ob.t==='text')ob.col=hex; else PREF.text.col=hex; break;
    case 'text.bg': if(ob&&ob.t==='text')ob.bg=hex; else PREF.text.bg=hex; break;
    case 'vec.col': if(ob&&ob.t==='vec')ob.col=hex; break;
    case 'line.col': if(ob&&(isShape(ob)||ob.t==='line'||ob.t==='arrow'||ob.t==='lens'||(ob.t==='vec'&&ob.k==='num')))ob.col=hex; PREF.line.col=hex; break;
    case 'line.fill': if(isShape(ob))ob.fill=hex; else PREF.line.fill=hex; break;
    case 'hl.col': if(ob&&ob.t==='hl')ob.col=hex; PREF.pen.hlCol=hex; break;
    case 'pen.col': PREF.pen.col=hex; if(ob&&ob.t==='pen'&&!ob.hl)ob.col=hex; break;
    case 'pen.hl': PREF.pen.hlCol=hex; if(ob&&ob.t==='pen'&&ob.hl)ob.col=hex; break;
  }
  savePrefs();
}
function syncColorRow(group,cur){
  if(!group)return;
  var up=String(cur).toUpperCase(), known=SW().some(function(s){ return s.c===up; }), cust=isHex(cur)&&!known;
  Array.prototype.forEach.call(group.querySelectorAll('.ph-sw'),function(b){
    var c=b.getAttribute('data-c'), on=c==='custom'?cust:c.toUpperCase()===up;
    b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');
    if(c==='custom'){ b.classList.toggle('has',cust); if(isHex(cur))b.style.setProperty('--cc',cur); }
  });
  var row=group.querySelector('.ph-hexrow');
  if(row&&row.classList.contains('ph-hexrow')){
    row.querySelector('span').textContent=isHex(cur)?swName(cur):(cur==='none'?'없음':'자동');
    var hx=row.querySelector('.ph-hex');
    if(document.activeElement!==hx){ hx.value=isHex(cur)?up:''; hx.classList.remove('bad'); }
    hx.placeholder=cur==='none'?'없음':(cur==='auto'?'자동':'#000000');
  }
}
function colorDone(key){
  commit();
  if(key==='line.fill')renderPanel();
  else if(key==='frame.col'&&UI.tool==='frame')paintTilePreviews();
}
function onChip(key,v){
  var ob=objById(SEL);
  switch(key){
    case 'out.preset': DOC.out.preset=v; if(v!=='custom'&&v!=='orig')DOC.out.w=+v; PREF.out=v; if(v!=='orig')PREF.outW=DOC.out.w; savePrefs(); commit(); renderPanel(); break;
    case 'crop.ar': PREF.cropAR=v; savePrefs(); if(v!=='free')fitCropAR(arOf(v)); commit(); renderPanel(); break;
    case 'auto': DOC.auto=DOC.auto?null:computeAuto(); commit(); renderPanel(); break;
    case 'mask.bg': DOC.mask.bg=v; PREF.mask.bg=v; savePrefs(); commit(); renderPanel(); break;
    case 'sig.auto': PREF.sig.auto=!PREF.sig.auto; savePrefs(); renderPanel(); break;
    case 'mos.shape': PREF.mos.shape=v; savePrefs(); if(ob&&ob.t==='mosaic'){ ob.shape=v; commit(); } renderPanel(); break;
    case 'mos.mode': PREF.mos.mode=v; savePrefs(); if(ob&&ob.t==='mosaic'){ ob.mode=v; commit(); } renderPanel(); break;
    case 'text.align': PREF.text.align=v; savePrefs(); if(ob&&ob.t==='text'){ ob.align=v; commit(); } renderPanel(); break;
    case 'text.bold': var nb=ob&&ob.t==='text'?!ob.bold:!PREF.text.bold; PREF.text.bold=nb; savePrefs(); if(ob&&ob.t==='text'){ ob.bold=nb; commit(); } renderPanel(); break;
    case 'stk.cat': PREF.stkCat=v; savePrefs(); renderPanel(); break;
    case 'stk.fx': if(ob&&ob.t==='stk'){ ob.fx=!ob.fx; commit(); renderPanel(); } break;
    case 'img.bd': if(ob&&ob.t==='img'){ ob.bd=!ob.bd; commit(); renderPanel(); } break;
    case 'line.dash': PREF.line.dash=v; savePrefs(); if(ob&&typeof ob.dash==='string'){ ob.dash=v; commit(); } renderPanel(); break;
    case 'arrow.head': if(ob&&ob.t==='arrow'){ ob.head=v; commit(); } renderPanel(); break;
    case 'pen.mode': PREF.penMode=v; savePrefs(); renderPanel(); stageCursor(); break;
    case 'shape.hand': var hv=v==='on'; PREF.hand=hv; savePrefs(); if(ob&&(isShape(ob)||ob.t==='hl'||ob.t==='line'||ob.t==='arrow')){ ob.hand=hv; commit(); } renderPanel(); break;
  }
  requestRender();
}
function onTile(key,v){
  var ob=objById(SEL);
  switch(key){
    case 'flt': DOC.flt.id=v; if(v!=='none'&&!DOC.flt.amt)DOC.flt.amt=100; commit(); renderPanel(); break;
    case 'frame': DOC.frame.id=v; commit(); renderPanel(); break;
    case 'mask': DOC.mask.id=v; commit(); renderPanel(); break;
    case 'sig.tpl': addSig(v); return;
    case 'text.st':
      var st=byId(TSTYLES,v);
      function restyle(t,fontKey){ var P=PK(t.pk||PREF.pack), prev=t.st!==undefined?t.st:t.style, sc=styleCols(P,st);
        if(t.st!==undefined)t.st=v; else t.style=v;
        t.col=sc.col; t.bg=sc.bg;
        if(st.font)t[fontKey]=st.font; else if(prev==='memo'&&t[fontKey]==='gaegu')t[fontKey]=P.font; }
      if(ob&&ob.t==='text'){ restyle(ob,'font'); commit(); }
      restyle(PREF.text,'font'); savePrefs(); renderPanel(); loadFonts(); break;
    case 'shape': PREF.shape=v; savePrefs(); if(ob)SEL=null; renderPanel(); break;
  }
  requestRender();
}
function onAct(act){
  var ob=objById(SEL);
  switch(act){
    case 'rotR': orientDoc(ROT_R); break;
    case 'rotL': orientDoc(ROT_L); break;
    case 'flipH': orientDoc(FLIP_H); break;
    case 'flipV': orientDoc(FLIP_V); break;
    case 'addText': var c=viewCenterDoc(); addTextAt(c[0],c[1]); return;
    case 'photoAdd': var f=$('phPhoto'); f.value=''; f.click(); return;
    case 'delSig': var sg=sigObj(); if(sg)delObj(sg.id); return;
    case 'dup': if(ob)dupObj(ob.id); return;
    case 'del': if(ob)delObj(ob.id); return;
    case 'front': if(ob)moveZ(ob.id,1); return;
    case 'back': if(ob)moveZ(ob.id,-1); return;
    case 'numReset': DOC.num=1; commit(); api.toast('다음 번호는 1부터 붙어요'); return;
    default: return;
  }
  commit(); renderPanel(); requestRender();
}
function doReset(){
  if(!DOC||!resetCan())return;
  var removed=0, tool=byId(TOOLS,UI.tool);
  function drop(f){ var n=DOC.objs.length; DOC.objs=DOC.objs.filter(function(b){ return !f(b); }); removed=n-DOC.objs.length; if(SEL&&!objById(SEL))SEL=null; }
  switch(UI.tool){
    case 'size': DOC.out.preset='orig'; break;
    case 'crop': var M=DOC.m; orientDoc([M[0],M[2],M[1],M[3]]); DOC.st=0; var od=odim(); DOC.crop={x:0,y:0,w:od.w,h:od.h}; PREF.cropAR='free'; savePrefs(); break;
    case 'filter': DOC.flt={id:'none',amt:100}; break;
    case 'adjust': ADJ.forEach(function(p){ DOC.adj[p.k]=0; }); DOC.auto=null; break;
    case 'frame': DOC.frame.id='none'; break;
    case 'mask': DOC.mask.id='none'; break;
    case 'sig': drop(function(b){ return b.t==='sig'; }); break;
    case 'mosaic': drop(function(b){ return b.t==='mosaic'; }); break;
    case 'text': drop(function(b){ return b.t==='text'; }); break;
    case 'sticker': drop(function(b){ return toolOfObj(b)==='sticker'; }); break;
    case 'shape': drop(function(b){ return toolOfObj(b)==='shape'; }); DOC.num=1; break;
    case 'draw': drop(function(b){ return b.t==='pen'; }); break;
  }
  commit(); renderPanel(); requestRender();
  api.toast(removed?tool.full+' '+removed+'개를 지웠어요':tool.full+josa(tool.full,'을','를')+' 처음으로 되돌렸어요',{action:'되돌리기',onAction:undo});
}
function bindPanel(){
  var pb=$('phPb');
  pb.addEventListener('click',function(e){
    if(!DOC)return;
    var b;
    if((b=e.target.closest('.ph-sk'))){ if(Date.now()-(b.__drop||0)<500)return; if(b.hasAttribute('data-stk'))addMascot(b.getAttribute('data-stk')); else addVec(+b.getAttribute('data-vec')); return; }
    if((b=e.target.closest('[data-chip] .chip'))){ onChip(b.parentNode.getAttribute('data-chip'),b.getAttribute('data-v')); return; }
    if((b=e.target.closest('[data-tile] .ph-tile'))){ onTile(b.parentNode.getAttribute('data-tile'),b.getAttribute('data-v')); return; }
    if((b=e.target.closest('[data-color] .ph-sw'))){
      var g=b.closest('[data-color]'), key=g.getAttribute('data-color'), c=b.getAttribute('data-c');
      if(c==='custom'){ var pi=g.querySelector('.ph-pick'); pi.value=isHex(colorOf(key))?colorOf(key).toLowerCase():pack().accent.toLowerCase(); pi.click(); return; }
      applyColor(key,c); syncColorRow(g,c); requestRender(); colorDone(key); return;
    }
    if((b=e.target.closest('[data-anc]'))){ var sg=sigObj(); if(sg){ sg.anchor=b.getAttribute('data-anc'); PREF.sig.anchor=sg.anchor; savePrefs(); commit(); renderPanel(); requestRender(); } return; }
    if((b=e.target.closest('[data-act]'))){ onAct(b.getAttribute('data-act')); return; }
  });
  pb.addEventListener('input',function(e){
    if(!DOC)return;
    var t=e.target, sl=t.closest('.ph-sl'), ob=objById(SEL), g, h;
    if(sl){
      var min=+sl.getAttribute('data-min'), max=+sl.getAttribute('data-max'), v=parseFloat(t.value);
      if(!isFinite(v))return;
      var rng=sl.querySelector('input[type=range]'), nm=sl.querySelector('input[type=number]');
      if(t===nm){ if(v<min||v>max)return; rng.value=v; } else nm.value=v;
      setSlider(sl.getAttribute('data-sl'),v,false); return;
    }
    if(t.classList.contains('ph-pick')){ g=t.closest('[data-color]'); h=normHex(t.value); if(g&&h){ applyColor(g.getAttribute('data-color'),h); syncColorRow(g,h); requestRender(); } return; }
    if(t.classList.contains('ph-hex')){ h=normHex(t.value); if(h){ var key=t.getAttribute('data-hex'); g=pb.querySelector('[data-color="'+key+'"]'); applyColor(key,h); syncColorRow(g,h); requestRender(); } return; }
    switch(t.id){
      case 'phTx': if(ob&&ob.t==='text'){ ob.tx=t.value; measureText(ob); requestRender(); commitSoon(); } return;
      case 'phSigTx': var sg=sigObj(); if(sg){ sg.tx=t.value; PREF.sig.text=t.value; savePrefs(); requestRender(); commitSoon(); } return;
      case 'phVecTx': if(ob&&ob.t==='vec'){ ob.tx=t.value; requestRender(); commitSoon(); } return;
      case 'phCaption': DOC.frame.caption=t.value; PREF.frame.caption=t.value; savePrefs(); requestRender(); commitSoon(); return;
      case 'phOutW': var w=parseInt(t.value,10); if(w>=64&&w<=MAX_SIDE){ DOC.out.w=w; PREF.outW=w; savePrefs(); syncAct(); commitSoon(); } return;
    }
  });
  pb.addEventListener('change',function(e){
    if(!DOC)return;
    var t=e.target, sl=t.closest('.ph-sl'), ob=objById(SEL);
    if(sl){
      var min=+sl.getAttribute('data-min'), max=+sl.getAttribute('data-max'), rng=sl.querySelector('input[type=range]'), nm=sl.querySelector('input[type=number]'), v=parseFloat(t.value);
      if(!isFinite(v))v=parseFloat(rng.value);
      v=clamp(v,min,max); rng.value=v; nm.value=v;
      setSlider(sl.getAttribute('data-sl'),v,true); return;
    }
    if(t.classList.contains('ph-pick')){ var gk=t.closest('[data-color]'); if(gk)colorDone(gk.getAttribute('data-color')); return; }
    if(t.classList.contains('ph-hex')){
      var key=t.getAttribute('data-hex'), h=normHex(t.value);
      if(h){ t.classList.remove('bad'); colorDone(key); return; }
      var cur=colorOf(key); t.value=isHex(cur)?cur.toUpperCase():''; t.classList.add('bad'); setTimeout(function(){ t.classList.remove('bad'); },900); return;
    }
    if(t.id==='phFont'){
      if(ob&&ob.t==='text'){ ob.font=t.value; commit(); } else{ PREF.text.font=t.value; savePrefs(); }
      renderPanel(); loadFonts().then(function(){ if(ob&&ob.t==='text'){ measureText(ob); requestRender(); } });
      return;
    }
    if(t.id==='phOutW'){ var w=clamp(parseInt(t.value,10)||DOC.out.w,64,MAX_SIDE); t.value=w; DOC.out.w=w; PREF.outW=w; savePrefs(); commit(); renderPanel(); }
  });
  pb.addEventListener('keydown',function(e){
    var t=e.target;
    if(e.key==='Enter'&&t.tagName==='INPUT'&&(t.type==='number'||t.type==='text')){ e.preventDefault(); t.blur(); }
  });
  pb.addEventListener('pointerdown',onSkDown);
  $('phLays').addEventListener('click',function(e){
    if(!DOC)return;
    var b=e.target.closest('[data-lsel],[data-lmove]'); if(!b)return;
    if(b.hasAttribute('data-lsel')){ select(b.getAttribute('data-lsel')); return; }
    var id=b.getAttribute('data-id'), mv=b.getAttribute('data-lmove');
    if(mv==='hide')hideObj(id); else moveZ(id,mv==='up'?1:-1);
  });
  $('phLayH').addEventListener('click',function(){
    var se=$('phLaySec'), open=se.classList.contains('closed');
    se.classList.toggle('closed',!open); $('phLayH').setAttribute('aria-expanded',open?'true':'false');
    PREF.lay=open; savePrefs();
  });
  $('phReset').addEventListener('click',doReset);
  $('phPks').addEventListener('click',function(e){
    var b=e.target.closest('[data-pack]'); if(!b)return;
    setPack(b.getAttribute('data-pack'));
  });
}
/* 작성자 디자인 바꾸기 — 앞으로 만들 것의 기본값만 바뀐다(올린 개체는 그대로) */
function setPack(id){
  if(!has(PACKS,id)||id===PREF.pack)return;
  applyPack(id);
  Array.prototype.forEach.call(root.querySelectorAll('.ph-pk'),function(b){ var on=b.getAttribute('data-pack')===id; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  var sg=sigObj();
  if(sg){ var P=pack(); sg.pk=id; sg.col=P.accent; if(sg.tx===PK(id==='bomding'?'yeongdo':'bomding').sigTx||sg.tx===PK(id==='bomding'?'yeongdo':'bomding').sigUrl)sg.tx=sg.tpl==='url'?P.sigUrl:P.sigTx;
    if(sg.tpl==='mascot')stkLoad(P.face).then(requestRender,function(){});
    commit(); }
  renderPanel(); requestRender(); loadFonts();
  if(api)api.toast(pack().n+' 디자인으로 바꿨어요 · 이미 올린 건 그대로예요');
}

/* ══════════ 틀 · 열기 · 내보내기 · 마운트 ══════════ */
function onDocChanged(pushed){
  if(!root)return;
  if(pushed){ syncAct(); syncReset(); renderLayers(); }
  else{ BC.key=''; PV.key=''; renderPanel(); requestRender(); }
}
function shellHTML(){
  return '<div class="ph empty">'+
    '<nav class="ph-rail" id="phRail" aria-label="편집 도구">'+TOOLS.map(function(t){ var on=t.id===UI.tool;
      return '<button type="button" class="ph-ri'+(on?' on':'')+'" data-tool="'+t.id+'" aria-pressed="'+(on?'true':'false')+'" aria-label="'+esc(t.full)+'" title="'+esc(t.full)+'">'+ic(t.ic)+'<b>'+esc(t.n)+'</b></button>'; }).join('')+'</nav>'+
    '<section class="ph-stage" id="phStage" aria-label="편집 화면" tabindex="-1">'+
      '<canvas class="ph-cv" id="phCanvas" hidden></canvas>'+
      '<div class="ph-ov" id="phOv"></div>'+
      '<div class="ph-cmp" id="phCmp" hidden>원본</div>'+
      '<div class="ph-dz" id="phDz" role="button" tabindex="0" aria-label="사진 열기">'+
        '<div class="ph-dz-in">'+ic('upload')+'<b>사진을 끌어 놓거나 클릭</b><span>Ctrl+V 로 붙여넣기</span>'+
        '<button type="button" class="ghost" id="phResume" hidden>'+ic('restore')+'<span>이어서 편집</span></button></div></div>'+
      '<input type="file" id="phFile" accept="image/*" hidden><input type="file" id="phPhoto" accept="image/*" hidden>'+
    '</section>'+
    '<div class="ph-act" id="phAct">'+
      '<button type="button" class="ph-ib" id="phUndo" aria-label="되돌리기" title="되돌리기 (Ctrl+Z)">'+ic('undo')+'</button>'+
      '<button type="button" class="ph-ib" id="phRedo" aria-label="다시 하기" title="다시 하기 (Ctrl+Shift+Z)">'+ic('redo')+'</button>'+
      '<span class="ph-vsep"></span>'+
      '<button type="button" class="ph-ib" id="phCompare" aria-label="원본 비교(누르는 동안)" title="누르는 동안 원본">'+ic('compare')+'</button>'+
      '<button type="button" class="ph-ib" id="phZout" aria-label="축소" title="축소">'+ic('zout')+'</button>'+
      '<span class="ph-zv num" id="phZv" aria-live="polite"></span>'+
      '<button type="button" class="ph-ib" id="phZin" aria-label="확대" title="확대 (Ctrl+휠)">'+ic('zin')+'</button>'+
      '<button type="button" class="ph-ib" id="phFit" aria-label="화면에 맞춤" title="화면에 맞춤">'+ic('fit')+'</button>'+
      '<span class="ph-vsep"></span>'+
      '<button type="button" class="ph-ib" id="phOpen" aria-label="다른 사진 열기" title="다른 사진 열기">'+ic('image')+'</button>'+
      '<span class="sp"></span>'+
      '<span class="ph-fn num" id="phFn"></span>'+
      '<select class="f-i ph-fmt" id="phFmt" aria-label="저장 형식"><option value="auto">자동 형식</option><option value="png">PNG</option><option value="jpg">JPG</option></select>'+
      '<button type="button" class="ghost cp" id="phCopy" aria-label="클립보드 복사" title="클립보드 복사">'+ic('copy')+'<span class="lb">복사</span></button>'+
      '<button type="button" class="cta" id="phSave"><span>저장</span><span class="knob">'+ic('download')+'</span></button>'+
    '</div>'+
    '<aside class="ph-panel" id="phPanel" aria-label="도구 설정">'+
      '<div class="ph-ph"><b class="ph-pt" id="phPt"></b>'+
        '<div class="ph-pks" id="phPks" role="group" aria-label="작성자 디자인">'+PACKS.map(function(p){ var on=p.id===PREF.pack;
          return '<button type="button" class="ph-pk'+(on?' on':'')+'" data-pack="'+p.id+'" aria-pressed="'+(on?'true':'false')+'" title="'+esc(p.n)+' 디자인" aria-label="'+esc(p.n)+' 디자인"><img src="'+ASSET+'stk/'+p.face+'.webp" alt="" decoding="async" draggable="false"></button>'; }).join('')+'</div>'+
        '<button type="button" class="ghost" id="phReset">'+ic('reset')+'초기화</button></div>'+
      '<div class="ph-scroll" id="phScroll"><div class="ph-pb" id="phPb"></div></div>'+
      '<section class="ph-laysec'+(PREF.lay?'':' closed')+'" id="phLaySec" hidden>'+
        '<button type="button" class="ph-layh" id="phLayH" aria-expanded="'+(PREF.lay?'true':'false')+'" aria-controls="phLays">'+ic('layers')+'레이어<span class="d num" id="phLayN"></span><span class="cv">'+ic('down')+'</span></button>'+
        '<ul class="ph-lays" id="phLays"></ul></section>'+
    '</aside>'+
  '</div>';
}
function enterDoc(){
  if(!root)return;
  stageCursor(); renderPanel(); requestRender(); loadFonts();
  DOC.objs.forEach(function(o){ if(o.t==='sig'&&o.tpl==='mascot')stkLoad(PK(o.pk).face).then(requestRender,function(){}); });
}
function openBlob(blob,name){
  if(!blob||!/^image\//.test(blob.type||'')){ if(api)api.toast('이미지 파일만 열 수 있어요',{kind:'err'}); return Promise.resolve(false); }
  return addAsset(blob,name,'base').then(function(id){
    var first=!DOC;
    DOC=newDoc(id); SEL=null; UI.zoom=1; UI.panX=0; UI.panY=0; BC.key=''; PV.key='';
    if(PREF.sig.auto)DOC.objs.push(mkSig());
    if(first||!HIST.length){ resetHistory(); autosave(); } else commit();
    if(api){
      if(ASSETS[id].shrunk)api.toast('긴 변 '+MAX_SIDE+'px 로 줄여서 편집해요');
      else if(!first)api.toast('다른 사진을 열었어요',{action:'되돌리기',onAction:undo});
    }
    if(root){ onDocChanged(true); enterDoc(); }
    return true;
  },function(){ if(api)api.toast('이미지를 읽지 못했어요',{kind:'err'}); return false; });
}
function addPhotoBlob(blob,name,x,y){
  if(!blob||!/^image\//.test(blob.type||''))return Promise.resolve(null);
  return addAsset(blob,name,'photo').then(function(id){
    if(!DOC)return null;
    var p=x==null?viewCenterDoc():[x,y], ob=mkPhoto(id,p[0],p[1]);
    DOC.objs.push(ob); PREF.stkCat='photo'; savePrefs(); select(ob.id); commit();
    return ob.id;
  },function(){ if(api)api.toast('이미지를 읽지 못했어요',{kind:'err'}); return null; });
}
function hasFiles(e){ var t=e.dataTransfer&&e.dataTransfer.types; return !!t&&Array.prototype.indexOf.call(t,'Files')>=0; }
function onPaste(e){
  if(!mounted||!root)return;
  var t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
  if(document.querySelector('.back'))return;
  var items=(e.clipboardData&&e.clipboardData.items)||[];
  for(var i=0;i<items.length;i++){
    if(items[i].kind!=='file'||!/^image\//.test(items[i].type))continue;
    e.preventDefault();
    var f=items[i].getAsFile(), nm=f.name&&f.name!=='image.png'?f.name:'붙여넣은_이미지.png';
    if(!DOC){ openBlob(f,nm); return; }
    addPhotoBlob(f,nm).then(function(id){
      if(id&&api)api.toast('사진을 위에 얹었어요',{action:'새 사진으로 열기',onAction:function(){ var ob=objById(id); if(ob){ DOC.objs.splice(indexOfObj(id),1); SEL=null; } openBlob(f,nm); }});
    });
    return;
  }
}
var BUSY=false;
function setBusy(on){ BUSY=on; ['phSave','phCopy'].forEach(function(id){ var b=$(id); if(b){ b.disabled=on||!DOC; b.setAttribute('aria-busy',on?'true':'false'); } }); }
function doSave(){
  if(!DOC||BUSY)return;
  setBusy(true);
  exportBlob().then(function(r){
    if(!r.blob){ api.toast('이미지를 만들지 못했어요',{kind:'err'}); return; }
    var name=fileName(r.type), a=document.createElement('a');
    a.href=URL.createObjectURL(r.blob); a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(a.href); },4000);
    api.toast(name+' · '+r.W+'×'+r.H+' · '+fmtBytes(r.blob.size)+' 저장');
  }).catch(function(){ api.toast('저장하지 못했어요',{kind:'err'}); }).then(function(){ setBusy(false); });
}
function doCopy(){
  if(!DOC||BUSY)return;
  if(!(navigator.clipboard&&navigator.clipboard.write&&window.ClipboardItem)){ api.toast('이 브라우저는 이미지 복사를 지원하지 않아요 · 저장을 쓰세요',{kind:'err'}); return; }
  setBusy(true);
  /* 클립보드는 PNG 만 받는다. 크롬은 사용자 동작 안에서 ClipboardItem 에 Promise 를 넘겨야 허용한다 */
  var pr=exportCanvas().then(function(r){ return new Promise(function(res,rej){ r.cv.toBlob(function(b){ if(b)res(b); else rej(new Error('blob')); },'image/png'); }); });
  var item; try{ item=new ClipboardItem({'image/png':pr}); }catch(er){ item=null; }
  (item?navigator.clipboard.write([item]):pr.then(function(b){ return navigator.clipboard.write([new ClipboardItem({'image/png':b})]); }))
    .then(function(){ return pr; })
    .then(function(b){ api.toast('클립보드에 복사했어요 · '+fmtBytes(b.size)+' · 네이버 에디터에 붙여넣기'); })
    .catch(function(){ api.toast('클립보드 복사가 막혔어요 · 저장을 쓰세요',{kind:'err'}); })
    .then(function(){ setBusy(false); });
}
function checkSaved(){
  savedInfo().then(function(rec){
    if(!rec||DOC||!root)return;
    var b=$('phResume'); if(!b)return;
    var d=new Date(rec.t), when=(d.getMonth()+1)+'.'+d.getDate()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    b.querySelector('span').textContent='이어서 편집 · '+(rec.name?safeName(rec.name).slice(0,18)+' · ':'')+when;
    b.hidden=false;
    b.onclick=function(ev){
      ev.stopPropagation(); b.disabled=true;
      loadSaved(rec).then(function(doc){ DOC=doc; SEL=null; UI.zoom=1; UI.panX=0; UI.panY=0; BC.key=''; PV.key=''; resetHistory(); onDocChanged(true); enterDoc(); },
        function(){ b.disabled=false; api.toast('이어서 편집할 작업을 읽지 못했어요',{kind:'err'}); });
    };
  });
}
function bindShell(){
  var st=$('phStage'), dz=$('phDz'), file=$('phFile'), photo=$('phPhoto'), ph=root.querySelector('.ph'), cmp=$('phCompare');
  function pick(){ file.value=''; file.click(); }
  dz.addEventListener('click',function(e){ if(e.target.closest('#phResume'))return; pick(); });
  dz.addEventListener('keydown',function(e){ if(e.target!==dz)return; if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pick(); } });
  file.addEventListener('change',function(){ var f=file.files&&file.files[0]; if(f)openBlob(f,f.name); });
  photo.addEventListener('change',function(){ var f=photo.files&&photo.files[0]; if(f)addPhotoBlob(f,f.name); });
  $('phOpen').addEventListener('click',pick);
  $('phRail').addEventListener('click',function(e){ var b=e.target.closest('.ph-ri'); if(b&&DOC)setTool(b.getAttribute('data-tool')); });
  st.addEventListener('pointerdown',onDown);
  st.addEventListener('pointermove',onMove);
  st.addEventListener('pointermove',onHover);
  st.addEventListener('pointerleave',function(){ st.classList.remove('out'); });
  st.addEventListener('pointerup',onUp);
  st.addEventListener('pointercancel',onUp);
  st.addEventListener('lostpointercapture',function(e){ if(DRAG&&e.pointerId===DRAG.pid)onUp(e); });
  st.addEventListener('wheel',onWheel,{passive:false});
  st.addEventListener('dblclick',onDbl);
  ph.addEventListener('dragover',function(e){ if(!hasFiles(e))return; e.preventDefault(); e.dataTransfer.dropEffect='copy'; var inSt=st.contains(e.target); st.classList.toggle('over',inSt&&!!DOC); dz.classList.toggle('over',inSt); });
  ph.addEventListener('dragleave',function(e){ if(!ph.contains(e.relatedTarget)){ st.classList.remove('over'); dz.classList.remove('over'); } });
  ph.addEventListener('drop',function(e){
    if(!hasFiles(e))return; e.preventDefault(); st.classList.remove('over'); dz.classList.remove('over');
    var f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(!f)return;
    if(!DOC||!st.contains(e.target)){ openBlob(f,f.name); return; }
    var p=stageXY(e), d=clampPt.apply(null,s2d(p[0],p[1])); addPhotoBlob(f,f.name,d[0],d[1]);
  });
  $('phUndo').addEventListener('click',undo);
  $('phRedo').addEventListener('click',redo);
  $('phZin').addEventListener('click',function(){ zoomAt(UI.zoom*1.25); });
  $('phZout').addEventListener('click',function(){ zoomAt(UI.zoom/1.25); });
  $('phFit').addEventListener('click',function(){ UI.zoom=1; UI.panX=0; UI.panY=0; requestRender(); });
  $('phFmt').addEventListener('change',function(){ PREF.fmt=this.value; savePrefs(); syncAct(); });
  $('phCopy').addEventListener('click',doCopy);
  $('phSave').addEventListener('click',doSave);
  function cmpOn(){ if(!DOC||UI.compare)return; UI.compare=true; cmp.classList.add('on'); stageCursor(); requestRender(); }
  function cmpOff(){ if(!UI.compare)return; UI.compare=false; cmp.classList.remove('on'); stageCursor(); requestRender(); }
  cmp.addEventListener('pointerdown',function(e){ if(e.button!==0)return; e.preventDefault(); cmpOn(); try{ cmp.setPointerCapture(e.pointerId); }catch(er){} });
  cmp.addEventListener('pointerup',cmpOff); cmp.addEventListener('pointercancel',cmpOff); cmp.addEventListener('lostpointercapture',cmpOff);
  cmp.addEventListener('keydown',function(e){ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); cmpOn(); } });
  cmp.addEventListener('keyup',function(e){ if(e.key===' '||e.key==='Enter')cmpOff(); });
  cmp.addEventListener('blur',cmpOff);
  cmp.addEventListener('click',function(e){ e.preventDefault(); });
}
function mount(host,a){
  api=a; root=host; mounted=true; OV.key='';
  if(!document.getElementById('phCss')){ var s=document.createElement('style'); s.id='phCss'; s.textContent=CSS; document.head.appendChild(s); }
  if(!document.getElementById('phGf')){ var lk=document.createElement('link'); lk.id='phGf'; lk.rel='stylesheet'; lk.href=GF_URL; document.head.appendChild(lk); }
  if(!document.getElementById('phNs')&&!document.querySelector('link[href*="nanumsquare.css"]')){ var ln=document.createElement('link'); ln.id='phNs'; ln.rel='stylesheet'; ln.href=NS_URL; document.head.appendChild(ln); }
  host.innerHTML=shellHTML();
  bindShell(); bindPanel();
  document.addEventListener('keydown',onKey); document.addEventListener('keyup',onKeyUp); document.addEventListener('paste',onPaste);
  if('ResizeObserver' in window){ RO=new ResizeObserver(function(){ requestRender(); }); RO.observe($('phStage')); }
  else window.addEventListener('resize',requestRender);
  renderPanel();
  if(DOC)enterDoc(); else{ syncAct(); checkSaved(); }
}
function unmount(){
  mounted=false;
  if(raf){ cancelAnimationFrame(raf); raf=0; }
  clearTimeout(NUDGE_T); clearTimeout(TXT_T);
  if(DOC&&HIST.length&&HIST[HI]!==snap())commit();
  document.removeEventListener('keydown',onKey); document.removeEventListener('keyup',onKeyUp); document.removeEventListener('paste',onPaste);
  if(RO){ RO.disconnect(); RO=null; } else window.removeEventListener('resize',requestRender);
  if(SDRAG){ if(SDRAG.ghost&&SDRAG.ghost.parentNode)SDRAG.ghost.parentNode.removeChild(SDRAG.ghost); SDRAG=null; document.removeEventListener('pointermove',onSkMove); document.removeEventListener('pointerup',onSkUp); document.removeEventListener('pointercancel',onSkUp); }
  DRAG=null; UI.compare=false; UI.space=false; OV.key=''; root=null;
}

window.SseudamTools.photo={
  mount:mount, unmount:unmount,
  /* 헤드리스 검증용 — 사용자 UI 와 무관 */
  __test:{
    setImageURL:function(u,n){ return fetch(u).then(function(r){ return r.blob(); }).then(function(b){ return openBlob(b,n||'test.png'); }); },
    addPhotoURL:function(u){ return fetch(u).then(function(r){ return r.blob(); }).then(function(b){ return addPhotoBlob(b,'photo.png'); }); },
    state:function(){
      if(!DOC)return {doc:false,tool:UI.tool};
      return {doc:true,tool:UI.tool,sel:SEL,crop:clone(DOC.crop),m:DOC.m.slice(),st:DOC.st,odim:odim(),adj:clone(DOC.adj),auto:DOC.auto,flt:clone(DOC.flt),
        frame:clone(DOC.frame),mask:clone(DOC.mask),out:outInfo(),preset:DOC.out.preset,num:DOC.num,
        objs:DOC.objs.map(function(o){ return {id:o.id,t:o.t,k:o.k,x:o.x,y:o.y,w:o.w,h:o.h,r:o.r,o:o.o,st:o.st,tpl:o.tpl,anchor:o.anchor,tx:o.tx,fs:o.fs,size:o.size,sw:o.sw,hl:o.hl,
          x1:o.x1,y1:o.y1,x2:o.x2,y2:o.y2,sx:o.sx,sy:o.sy,sr:o.sr,n:o.pts?o.pts.length/2:0,col:o.col,bg:o.bg,src:o.src,font:o.font,shape:o.shape,mode:o.mode,fx:o.fx,pk:o.pk,hand:o.hand}; }),
        hist:{i:HI,n:HIST.length},view:{s:VIEW.s,ox:VIEW.ox,oy:VIEW.oy,zoom:UI.zoom,fit:VIEW.fit},
        pref:{fmt:PREF.fmt,shape:PREF.shape,pen:PREF.penMode,stkCat:PREF.stkCat,cropAR:PREF.cropAR,sigAuto:PREF.sig.auto,pack:PREF.pack,hand:PREF.hand,
          textCol:PREF.text.col,textBg:PREF.text.bg,lineCol:PREF.line.col,penCol:PREF.pen.col,hlCol:PREF.pen.hlCol,sigTx:PREF.sig.text}};
    },
    d2c:function(x,y){ var r=$('phStage').getBoundingClientRect(), p=d2s(x,y); return {x:r.left+p[0],y:r.top+p[1]}; },
    paint:function(){ paint(); return true; },
    exportInfo:function(){ return exportBlob().then(function(r){ return {size:r.blob.size,type:r.type,W:r.W,H:r.H,name:fileName(r.type)}; }); },
    exportRegion:function(x,y,w,h){ return exportCanvas().then(function(r){
      var c=r.cv.getContext('2d'), d=c.getImageData(x,y,w,h).data, n=0, s=0, s2=0, a0=0;
      for(var i=0;i<d.length;i+=4){ var v=(d[i]+d[i+1]+d[i+2])/3; s+=v; s2+=v*v; n++; if(d[i+3]<8)a0++; }
      var m=s/n; return {W:r.cv.width,H:r.cv.height,mean:Math.round(m),vari:Math.round(s2/n-m*m),clear:a0/n,px:[d[0],d[1],d[2],d[3]]}; }); },
    inPhoto:function(x,y){ return inPhoto(x,y); },
    select:function(id){ select(id); return SEL; }, setTool:function(id){ setTool(id); return UI.tool; },
    undo:function(){ undo(); return HI; }, redo:function(){ redo(); return HI; },
    addText:function(tx){ var c=viewCenterDoc(); addTextAt(c[0],c[1],tx); return SEL; },
    addMascot:function(id){ return addMascot(id).then(function(){ return SEL; }); },
    addVec:function(i){ addVec(i); return SEL; },
    addSig:function(tpl){ addSig(tpl); return SEL; },
    fontsReady:function(){ return loadFonts().then(function(){ return true; }); },
    clearSaved:function(){ clearTimeout(saveT); return idbReq('readwrite',function(st){ return st.delete('cur'); }).then(function(){ return true; },function(){ return false; }); },
    savedInfo:function(){ return savedInfo().then(function(r){ return r?{name:r.name,t:r.t,objs:r.doc.objs.length}:null; }); },
    flushSave:function(){ clearTimeout(saveT); var rec={v:1,t:Date.now(),doc:JSON.parse(snap()),assets:{},name:(ASSETS[DOC.base]||{}).name||''};
      usedAssets(DOC).forEach(function(id){ var a=ASSETS[id]; if(a&&a.blob)rec.assets[id]={blob:a.blob,name:a.name,type:a.type,kind:a.kind}; });
      return idbReq('readwrite',function(st){ return st.put(rec,'cur'); }).then(function(){ return true; }); },
    reset:function(){ DOC=null; SEL=null; HIST=[]; HI=-1; UI.zoom=1; UI.panX=0; UI.panY=0; OV.key=''; if(root){ var ov=$('phOv'); if(ov)ov.innerHTML=''; renderPanel(); paint(); checkSaved(); } return true; },
    mascots:MASCOT.map(function(m){ return m.id; }), vecCount:VEC.length, tools:TOOLS.map(function(t){ return t.id; }),
    packs:PACKS.map(function(p){ return p.id; }), setPack:function(id){ setPack(id); return PREF.pack; },
    stkCats:STK_CATS.map(function(c){ return c.id; }),
    filters:FILTERS.map(function(f){ return f.id; }), frames:FRAMES.map(function(f){ return f.id; }), masks:MASKS.map(function(f){ return f.id; }),
    styles:TSTYLES.map(function(f){ return f.id; }), sigs:SIG_TPL.map(function(f){ return f.id; }), shapes:SHAPES.map(function(f){ return f.id; })
  }
};
})();
