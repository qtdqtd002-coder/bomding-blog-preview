# classify-picks.ps1 — 트렌드 '오늘 쓸 글 5선' 후보 결정론적 dedup 분류기 (데이터 분석실, 2026-06-10)
#
# 왜 만들었나(문제):
#   트렌드 브리핑 5선이 "이미 발행한 주제"를 매일 🔄(이월·미발행)로 재추천하는 결함.
#   원인 = published.json(폴더경로)과 픽(서술형 문장) 대조를 LLM 눈대중으로 시켜 자동 6시 실행에서 매번 누락.
#   예: 픽 "메이플 플래닛 공략 클러스터 허브" ↔ 발행완료 "겜더쿠/메이플 플래닛/0_공략 총정리 허브".
#
# 무엇을(해결):
#   작성자별 후보 픽을 ① published.json(발행완료 글) ② trend.json(직전 브리핑 픽) 과 '결정론적'으로 대조해
#   각 후보에 상태를 매긴다 → 브리핑 생성 에이전트는 이 출력을 '근거'로 5선을 구성(눈대중 금지).
#     ✅ published  = 발행완료(같은 작성자 실제 블로그에 이미 있는 글) → 5선에서 제외, '최근 발행' 띠로.
#     🟡 review     = 같은 게임·약한 겹침(새 각도일 수 있음) → 기본 제외, 데스크노트에 '새 각도' 한 줄 근거 달면 채택 허용.
#     🔄 carried    = 직전 브리핑에도 있던 이월·미발행(N일째) → 🆕와 함께 5선 채움.
#     🆕 new        = 직전에 없던 신규.
#   매칭은 '게임 앵커(게임명이 후보에 들어있나) + 타입 키워드 겹침(허브/리세마라/티어표/빌드/공략/쿠폰 등)'으로,
#   서술형↔폴더명 표기차에 강건하게(재현율 우선 — 재추천을 놓치지 않게). 애매하면 review로 띄워 사람이 판단.
#
# ★2026-09-12 v2 — 데스크 «이미 다룬 글» 경고 오탐 수정 (사용자 신고: 09-11 판 경고 12건이 대부분 무관한 글을 가리켰다)
#   원인 3가지가 겹쳤다.
#   ⑴ Find-Keywords 의 빈 결과가 호출부에서 $null 로 풀리고 Inter-Count 가 $null 끼리를 «공유 키워드 1개»로 셌다
#      → 키워드 없는 후보는 같은 게임의 «키워드 없는 글»(예: 「소림사의 구원자 칭호」)에 무조건 🟡review.
#   ⑵ 데스크 후보 줄 «게임 | 제목» 을 통째로 제목으로 읽어, 게임명이 늘 게임 앵커를 채웠다.
#   ⑶ Clean-Pick 이 «—» 뒤를 버렸다. 옛 브리핑은 «제목 — 부연»이었지만 데스크 제목은 핵심이 «—» 뒤에 있다
#      → 핵심어가 잘려 진짜 관련 글(「무릉도장 총정리」)은 못 찾고 무관한 글이 대신 걸렸다.
#   고친 것.
#   ⑴ Inter-Count·Shared-Hard 는 $null 을 세지 않는다.
#   ⑵ «게임 | 제목»(또는 «게임<TAB>제목») 줄 = «데스크 모드». 게임은 `_glossary/_aliases.json` 으로 표준화해
#      «같은 게임 글»만 보고(메이플플래닛≠메이플스토리 · 배틀그라운드≠배틀그라운드 모바일 — 머리어로 묶지 않는다),
#      제목은 자르지 않고 «내용어»(무릉도장·혼테일처럼 그 게임 글 가운데 드물게 나오는 낱말)로 대조한다.
#      게임 자리가 «아기 …»처럼 육아 제품군이면 «제품군 핵심»(흔한 말을 뺀 이름 — 「놀이방매트」)이 글 제목에 통째로
#      들어 있을 때만 같은 밭으로 본다(속성어 소음·인증이나 더 넓은 말 「아기침대」로는 걸지 않는다).
#      라이브 제목 대조는 «—» 앞(옛 규칙)과 제목 전체를 둘 다 보되, 그 제목이 다른 게임 글이면 건너뛴다.
#   ⑶ 결과에 matchedTitle(실제 글 제목)·sharedWords(겹친 낱말)를 싣는다 → 데스크 coverage[] 는 이 값을 그대로 쓴다.
#   구분자 없는 옛 줄은 종전 규칙 그대로 돈다(⑴만 적용).
#   검증 = 지난 13판(306항목) × 봄딩·영도를 옛/새 버전으로 돌려 한 줄씩 대조 + 회귀 게이트 _tools/test-classify-picks.cjs.
#
# 실행:
#   powershell -ExecutionPolicy Bypass -File _tools\classify-picks.ps1 -Writer 봄딩 -CandidatesFile cand.txt
#   (CandidatesFile = 한 줄에 하나. 데스크는 «게임 | 제목». 옛 형식은 상태 이모지·[목적라벨]·괄호 메모 자동 제거)
#   결과 = JSON(stdout). -Pretty 면 사람이 보기 좋은 표도 같이.
param(
  [Parameter(Mandatory=$true)][string]$Writer,
  [string]$CandidatesFile,                 # 없으면 STDIN 한 줄씩
  [string]$Base,                            # BlogPreview 루트(비우면 스크립트 위치에서 추론)
  [int]$PrevIssues = 6,                     # 직전 브리핑 몇 개까지 거슬러 🔄 N일째 셀지
  [string]$ExcludeDate,                      # 이 날짜의 trend.json 이슈는 직전 비교에서 제외(재생성 중인 오늘자 자기참조 차단). 비우면 오늘.
  [string]$FailedFile,                       # 실패 주제 블로클리스트(비우면 _trend\_failed-requests.json)
  [string]$FailedApi = "https://34.139.184.70.sslip.io/requests?status=failed",  # -RefreshFailed 시 갱신원
  [switch]$RefreshFailed,                     # 켜면 백엔드에서 실패목록을 새로 받아 캐시 갱신(네트워크 실패 시 기존 캐시 사용)
  [switch]$RefreshPublished,                  # 켜면 dedup 전에 check-published.ps1 으로 실제 라이브 블로그를 새로 조회→published.json+_live-titles.json 갱신(stale 재추천 차단). 네트워크 실패 시 기존 파일 사용
  [int]$RefreshMaxAgeMin = 20,                # -RefreshPublished: published.json 이 이 분(分) 안에 이미 갱신됐으면 재조회 생략(작성자 4회 연속 호출 시 라이브 1회만)
  [switch]$Pretty
)
$ErrorActionPreference = "Stop"
if([string]::IsNullOrWhiteSpace($Base)){
  $sr = $PSScriptRoot
  if([string]::IsNullOrWhiteSpace($sr)){ $sr = Split-Path -Parent $MyInvocation.MyCommand.Path }
  $Base = Split-Path -Parent $sr
}
$TODAY = (Get-Date -Format 'yyyy-MM-dd')
try { $OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue

# ── 정규화(check-published.ps1과 동일 규칙: 한글/영숫자만, 소문자) ──
function Norm([string]$s){
  if($null -eq $s){ return "" }
  $t = [System.Net.WebUtility]::HtmlDecode($s)
  $t = $t.ToLowerInvariant()
  $t = ($t -replace '[^\p{IsHangulSyllables}\p{IsHangulJamo}a-z0-9]','')
  return $t
}
function Bigrams([string]$norm){
  $set = New-Object System.Collections.Generic.HashSet[string]
  if($norm.Length -le 1){ if($norm.Length -eq 1){ [void]$set.Add($norm) }; return $set }
  for($i=0; $i -lt $norm.Length-1; $i++){ [void]$set.Add($norm.Substring($i,2)) }
  return $set
}
function JacOvl($a,$b){
  if($a.Count -eq 0 -or $b.Count -eq 0){ return @{ jac=0.0; ovl=0.0 } }
  $inter = 0; foreach($x in $a){ if($b.Contains($x)){ $inter++ } }
  $union = $a.Count + $b.Count - $inter
  $jac = if($union -gt 0){ [double]$inter/[double]$union } else { 0.0 }
  $den = [Math]::Min($a.Count, $b.Count)
  $ovl = if($den -gt 0){ [double]$inter/[double]$den } else { 0.0 }
  return @{ jac=$jac; ovl=$ovl }
}

# ── 후보 픽 정리: 선두 상태 이모지·[목적라벨]·(괄호 메모)·꼬리표 제거하고 핵심 제목만 ──
function Clean-Pick([string]$raw, [switch]$KeepDash){
  $t = $raw
  $t = ($t -replace '[\uD800-\uDFFF]','')          # 서러게이트(이모지) 제거
  $t = ($t -replace '🆕|🔄|✅|🟡|⚠|📨|📋|⏳','')
  $t = ($t -replace '\[[^\]]*\]','')               # [목적라벨] 제거
  $t = ($t -replace '\([^)]*\)','')                # (괄호 메모) 제거 — 날짜·D-day·근거
  if($KeepDash){ $t = ($t -replace '[—–]',' ') }   # ★데스크 제목은 «—» 뒤가 핵심이라 자르지 않는다(2026-09-12)
  else { $t = ($t -replace '[—–].*$','') }         # 옛 브리핑: 엠/엔 대시(— –) 뒤 부연만 제거. ·,-,| 는 제목 내 구분자라 보존
  return $t.Trim()
}

# ── 타입 키워드(게임명을 뺀 '글 종류/클러스터' 시그니처) ──
#   hard = 하나만 같은 게임에서 겹쳐도 '같은 글'로 볼 만큼 변별력 큰 것.
$HARD = @('허브','리세마라','티어표','교배표','조합표','쿠폰코드','리그스타터','스킬트리','사냥터','내부링크','클러스터')
$SOFT = @('총정리','티어','빌드','공략','쿠폰','사전예약','첫인상','출시','조합','교배','가이드','초보','정착','큐브','잠재능력','메소','경매장','어센던시','트레이드','맵핑','선물','호감','파트너육성','지역제패','미리보기','프리뷰','우선순위','순위','비교','추천','정보','업데이트','쇼케이스','콜라보','확률','천장','픽업','리뉴얼','리메이크','직업','보스','레이드','이벤트','보상','로드맵','패치')
$KEYWORDS = $HARD + $SOFT
function Find-Keywords([string]$norm){
  $hit = New-Object System.Collections.Generic.HashSet[string]
  if([string]::IsNullOrEmpty($norm)){ return @() }
  foreach($k in $KEYWORDS){ if($norm.Contains((Norm $k))){ [void]$hit.Add($k) } }
  return @($hit)         # ★빈 결과는 호출부에서 $null 이 된다(@() 를 return 해도 파이프라인이 풀어 버린다) → Inter-Count·Shared-Hard 가 $null 을 거른다(2026-09-12)
}
# ★$null 은 세지 않는다(2026-09-12) — 키워드 없는 후보와 키워드 없는 글이 «공유 키워드 1개»로 잡혀 🟡review 가 쏟아졌다.
function Inter-Count($a,$b){ $n=0; foreach($x in @($a)){ if($null -ne $x -and (@($b) -contains $x)){ $n++ } }; return $n }
function Shared-Hard($a,$b){ $r=@(); foreach($x in @($a)){ if($null -ne $x -and (@($b) -contains $x) -and ($HARD -contains $x)){ $r+=$x } }; return $r }

# ── 단일유형 패밀리(2026-06-25) — '게임당 사실상 한 편'인 글 유형. 표기차(티어표↔티어↔리세마라 우선순위)로 같은 글이
#   🟡review 로 새 나가 '새 각도'로 재발행 → 라이브 중복/요청실패 되던 루프홀을 막는다. 같은 게임 + 같은 단일유형 = 자기잠식 → ✅published 하드드롭.
#   ★주의: 보스·직업·조합·교배처럼 '게임당 여러 편(엔티티별)'인 유형은 여기 넣지 않는다(서로 다른 글이라 over-drop 위험).
$SINGLETON_FAMILIES = @(
  @('티어','티어표','티어리스트','리세마라','우선순위','픽업','순위'),  # 티어/리세마라/픽업 우선순위 = 한 편
  @('쿠폰','쿠폰코드','쿠폰번호'),                                       # 쿠폰 모음 = 한 편
  @('허브','공략모음','종합공략','올인원')                                # 클러스터 허브 = 한 편
)
function Family-Match([string]$candNorm,[string]$pubNorm){
  if([string]::IsNullOrEmpty($candNorm) -or [string]::IsNullOrEmpty($pubNorm)){ return $false }
  foreach($fam in $SINGLETON_FAMILIES){
    $inC=$false; $inP=$false
    foreach($w in $fam){ $wn=(Norm $w); if($wn.Length -ge 2){ if($candNorm.Contains($wn)){ $inC=$true }; if($pubNorm.Contains($wn)){ $inP=$true } } }
    if($inC -and $inP){ return $true }
  }
  return $false
}

# ── 게임 앵커: 발행주제의 게임명이 후보 안에 사실상 들어있나 ──
#   (a) 정규화 게임명이 후보에 substring, 또는 (b) 게임명 bigram이 후보에 ovl>=0.7 포함
function Game-Anchor([string]$gameNorm,[string]$candNorm,$candBg){
  if([string]::IsNullOrEmpty($gameNorm)){ return 0.0 }
  if($gameNorm.Length -ge 2 -and $candNorm.Contains($gameNorm)){ return 1.0 }   # 게임명 전체 포함 → 완전 앵커
  $gb = Bigrams $gameNorm
  $s = JacOvl $gb $candBg
  $best = $s.ovl    # 게임명 bigram이 후보에 얼마나 포함되나
  # 부분(프랜차이즈 머리) 앵커: 게임명 앞 3음절이 후보에 그대로 있으면 같은 프랜차이즈로 0.8
  #   (영문/한글 표기차로 전체는 안 맞아도 '메이플…','삼국지…' 등 머리어로 충돌 포착 → 최소 review)
  if($gameNorm.Length -ge 3){
    $head = $gameNorm.Substring(0,3)
    if($candNorm.Contains($head) -and $best -lt 0.8){ $best = 0.8 }
  }
  return $best
}

# ── 게임/프랜차이즈 다양성(2026-06-24 신설) ──
#   같은 게임·프랜차이즈가 한 트랙에 3개 이상이면 '쏠림'으로 경고(스킬 규칙: 같은 게임 ≤2개/트랙).
#   머리어가 같은 계열(메이플랜드/메이플플래닛/메이플월드/메이플스토리 = '메이플')은 한 묶음으로 카운트.
$FranchiseHeads = @('메이플','포켓몬','리니지','던전앤파이터','로스트아크','블루아카이브','명일방주','원신','붕괴','니케','우마무스메','삼국지','팰월드','젠존제','젠레스','명조','일랜시아','패스오브엑자일','디아블로','발로란트','오버워치','리그오브레전드','발더스게이트','스타듀밸리','데드오어얼라이브')
$StaticGames = @('메이플스토리','메이플랜드','메이플플래닛','메이플월드','메이크드라마','템빨용사','솔인챈트','GTA6','DOA6','MSI','LCK','챔피언스','띠부씰','이환','영원한도시','롤','POE2')
# Game-Of  = 정확히 같은 게임(가장 긴 known-game 매칭). 메이플랜드 ≠ 메이플플래닛 (다른 게임).
#   → 다양성 '하드 게이트'는 이 정확한 게임 기준 ≤2개/트랙(사용자: 동일한 게임 도배 방지).
function Game-Of([string]$candNorm){
  if([string]::IsNullOrEmpty($candNorm)){ return '' }
  $best=''; $bestLen=0
  foreach($g in @($script:KnownGames)){ $gn=(Norm $g); if($gn.Length -ge 2 -and $candNorm.Contains($gn) -and $gn.Length -gt $bestLen){ $best=$g; $bestLen=$gn.Length } }
  return $best
}
# Franchise-Of = 프랜차이즈 머리어(메이플 계열은 한 묶음). 한 트랙 절반(5+) 넘으면 '소프트' 경고(정보).
#   겜더쿠는 메이플 4종이 메인이라 머리어 묶음은 하드 게이트가 아니라 참고용.
function Franchise-Of([string]$candNorm){
  if([string]::IsNullOrEmpty($candNorm)){ return '' }
  foreach($h in @($script:FranchiseHeads)){ $hn=(Norm $h); if($hn.Length -ge 2 -and $candNorm.Contains($hn)){ return $h } }
  return (Game-Of $candNorm)
}

# ════ 데스크 모드 도구(2026-09-12) ════════════════════════════════════════════════
#   데스크 후보 «게임 | 제목» 전용. 옛 줄(구분자 없음)은 아래 도구를 쓰지 않는다.
$DESK_DF_MAX   = 2      # 같은 게임 글 가운데 이 수 이하에만 나오는 낱말 = «내용어»
$DESK_DF_RATIO = 0.2    #   …또는 그 게임 글의 20% 이하에만 나오는 낱말(「스킬트리」처럼 직업 글마다 나오는 말은 제외된다)

# 게임 별칭 색인 — core-games.cjs·glossary-lint.py 와 같은 파일. 없거나 깨지면 정규화 이름으로만 비교한다.
$script:GameAlias  = @{}                                              # Norm(표기·폴더) → Norm(표준명)
$script:AliasCanon = New-Object System.Collections.Generic.HashSet[string]
$aliasFile = Join-Path (Split-Path -Parent $Base) "_glossary\_aliases.json"
if(Test-Path $aliasFile){
  try {
    $aj = Get-Content $aliasFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach($g in @($aj.games)){
      $ck = Norm ([string]$g.canon)
      if($ck.Length -lt 2){ continue }
      [void]$script:AliasCanon.Add($ck)
      foreach($a in (@($g.canon) + @($g.aliases) + @($g.folders))){
        $ak = Norm ([string]$a)
        if($ak.Length -ge 2 -and -not $script:GameAlias.ContainsKey($ak)){ $script:GameAlias[$ak] = $ck }
      }
    }
  } catch {}
}
function Game-Key([string]$name){
  $k = Norm $name
  if($k -and $script:GameAlias.ContainsKey($k)){ return [string]$script:GameAlias[$k] }
  return $k
}
# 등록된 게임 표기(별칭 색인 + 이 작성자 글 폴더 + 정적 목록) — 데스크 준비 단계에서 채운다
$script:RegisteredGameKeys = New-Object System.Collections.Generic.HashSet[string]
# 같은 게임인가 — 표준 키가 같거나 · 한쪽이 «다른 쪽 + 숫자»(블리즈컨↔블리즈컨2026) ·
#   또는 긴 쪽이 «등록 안 된 데스크 표기»일 때만 짧은 쪽과 같은 게임(「우마무스메 프리티 더비」↔ 폴더 「우마무스메」).
#   ★긴 쪽이 따로 등록된 게임이면 다른 게임이다: 배틀그라운드≠배틀그라운드모바일 · 마비노기≠마비노기이터니티.
function Same-Game([string]$a,[string]$b){
  if([string]::IsNullOrEmpty($a) -or [string]::IsNullOrEmpty($b)){ return $false }
  if($a -ceq $b){ return $true }
  $long = $a; $short = $b
  if($b.Length -gt $a.Length){ $long = $b; $short = $a }
  if(($short.Length -lt 2) -or -not $long.StartsWith($short, [System.StringComparison]::Ordinal)){ return $false }
  if($long.Substring($short.Length) -match '^\d+$'){ return $true }
  return (($short.Length -ge 3) -and -not $script:RegisteredGameKeys.Contains($long))
}
$script:GameWordsCache = @{}
function Get-GameWords([string]$gk){
  if([string]::IsNullOrEmpty($gk)){ return ,([string[]]@()) }
  if(-not $script:GameWordsCache.ContainsKey($gk)){
    $l = New-Object System.Collections.Generic.List[string]
    [void]$l.Add($gk)
    foreach($k in @($script:GameAlias.Keys)){ if(([string]$script:GameAlias[$k] -ceq $gk) -and ([string]$k -cne $gk)){ [void]$l.Add([string]$k) } }
    $script:GameWordsCache[$gk] = $l.ToArray()
  }
  return ,([string[]]$script:GameWordsCache[$gk])
}
# 게임 이름 조각인가(「메이플플래닛」의 「메이플」·「플래닛」) — 내용어에서 뺀다
function Is-GameWord([string]$tok, [string[]]$gameWords){
  if($tok.Length -lt 2 -or -not $gameWords){ return $false }
  foreach($g in $gameWords){
    if($g.Length -lt 2){ continue }
    if($g.Contains($tok)){ return $true }
    if($g.Length -ge 3 -and $tok.Contains($g)){ return $true }
  }
  return $false
}
function Strip-GameNorm([string]$norm, [string[]]$gameWords){
  $t = $norm
  foreach($g in @($gameWords | Sort-Object -Property Length -Descending)){ if($g.Length -ge 2){ $t = $t.Replace($g, '') } }
  return $t
}

# 흔한 말 — desk-dedup.cjs STOP 과 같은 뿌리 + 제목 상투구·시점·플랫폼 말 + 어느 게임에나 있는 명사(레벨·챔피언·스킨·소환…).
#   게임마다 다른 시스템 명사(보스·경매장·길드 등)는 넣지 않는다 — 빈도(DF) 필터가 거른다.
$stopText = @'
업데이트 이벤트 게임 출시 공개 시작 오픈 신규 추가 변경 개편 안내 공지 패치 시즌 콜라보 쿠폰 보상 확률 정보 공략 가이드 추천 정리 비교 후기 리뷰 방법 총정리 최신 오늘 내일 이번 지금 여기 그리고 하지만 예정 진행 적용 종료 획득 사용 확인 전체 대한 위한 없는 있는 되는 하는 무엇 어떻게 얼마나 아기 유아 신생아 육아 제품 브랜드 순위 가격 인증 안전
완전 모음 목록 리스트 한눈에 요약 핵심 필수 꿀팁 기준 체크리스트 준비물 준비 이유 차이 선택 고르는 소개 설명 분석 해설 체험 첫인상 미리보기 프리뷰 예고 소식 발표 공식 뉴스
올해 이번주 주말 매일 매주 기간 일정 날짜 시간 시각 마감 다음 이후 이전 직후 처음 최초 최근 신작
모바일 콘솔 스팀 한국 국내 글로벌 해외 서버 정식 사전 사전예약 사전등록 예약 출시일 발매 발매일 할인 무료 유료 패키지 한정 구매 결제 과금
바뀐 바뀌는 달라진 달라지는 생긴 새로 추가된 열린 나온 나오는 가능 받는 받기 얻는 얻기 모으는 쓰는 좋은 많이 가장 제일 정말 진짜 오히려 여전히 드디어 이제 다시 뭐가 다를까 어디서 언제 누구
유저 플레이 버전 모드 콘텐츠 컨텐츠 시스템 봄딩 영도 index html pc ps xbox switch 스위치 닌텐도 steam dlc 플랫폼
레벨 직업 스킬 캐릭터 아이템 장비 무기 퀘스트 파티 전투 등급 능력치 스탯 챔피언 유닛 영웅 몬스터 요원 스킨 코스튬 위키 공식위키 나무위키
너프 버프 상향 하향 소환 뽑기 가챠
번째 만에 만의 어떤 우리 전에 할까 맞나 고르는법 확인법 하는법 보는법 쓰는법 사는법 구성
아기방 유아용 어린이 아동 키즈 돌아기 영아 아이
픽업 티어 티어리스트 우선순위 공략모음 종합공략 올인원
'@
$script:STOP = New-Object System.Collections.Generic.HashSet[string]
foreach($w in ($stopText -split '\s+')){ if($w){ [void]$script:STOP.Add($w.ToLowerInvariant()) } }
$script:HARDSET = New-Object System.Collections.Generic.HashSet[string]
foreach($w in $HARD){ [void]$script:HARDSET.Add($w) }
# 조사·접미 — 긴 것부터. 떼고 남은 말이 2글자 이상일 때만 뗀다(「도끼만」→「도끼」, 「코스트별」→「코스트」)
$JOSA = @('에서는','으로는','에게서','까지는','부터는','이라도','에서','에게','으로','까지','부터','보다','처럼','이나','이랑','한테','라는','이란','은','는','이','가','을','를','의','에','로','와','과','도','만','나','랑','별','당','씩','들')
function Strip-Josa([string]$t){
  foreach($j in $JOSA){ if(($t.Length -ge ($j.Length + 2)) -and $t.EndsWith($j, [System.StringComparison]::Ordinal)){ return $t.Substring(0, $t.Length - $j.Length) } }
  return $t
}
# 흔한 말이거나 흔한 말 둘을 붙여 쓴 말인가(「정식출시」=정식+출시) — «통째로 들어 있나» 대조에서는 세지 않는다
#   (양쪽 제목에 같은 낱말로 있으면 센다 — 「사전구매」는 사전+구매지만 같은 글을 가르는 말이다)
function Is-StopCompound([string]$t){
  if($script:STOP.Contains($t)){ return $true }
  for($k = 2; $k -le $t.Length - 2; $k++){
    if($script:STOP.Contains($t.Substring(0, $k)) -and $script:STOP.Contains($t.Substring($k))){ return $true }
  }
  return $false
}
# 내용어 = 한글/영숫자 덩어리 − 조사 − 흔한 말 − 게임 이름 조각 − 유형어(HARD) − 번호 조각(18.1d·p2w).
#   이웃한 두 덩어리를 붙인 «짝»도 넣는다 — 「미지의 여정」과 「미지의여정」이 서로 닿게.
function Content-Tokens([string]$text, [string[]]$gameWords){
  $singles = New-Object System.Collections.Generic.HashSet[string]
  $pairs = @{}
  if(-not [string]::IsNullOrWhiteSpace($text)){
    $s = ([System.Net.WebUtility]::HtmlDecode($text)).ToLowerInvariant()
    $prev = $null
    foreach($m in [regex]::Matches($s, '[가-힣]+|[a-z0-9]+')){
      $c = $m.Value
      if($c -match '\d'){ $prev = $null; continue }       # 숫자가 섞인 조각(18·1d·ps5·p2w)은 내용어가 아니다
      $st = Strip-Josa $c
      $isGame = Is-GameWord $st $gameWords
      if($isGame){
        # 게임명이 붙어 쓰인 덩어리(「롤토체스아이템조합표」)는 게임명만 떼고 남은 말을 살린다
        $rest = Strip-GameNorm $st $gameWords
        if($rest.Length -ge 2 -and $rest -cne $st){ $c = $rest; $st = Strip-Josa $rest; $isGame = Is-GameWord $st $gameWords }
      }
      $plain = ($st.Length -ge 2) -and (-not $isGame) -and (-not $script:STOP.Contains($st)) -and (-not $script:HARDSET.Contains($st))
      if($plain){ [void]$singles.Add($st) }
      if(($null -ne $prev) -and (-not $isGame) -and (-not $prev.game) -and ($plain -or $prev.plain)){
        foreach($pp in @(($prev.raw + $c), ($prev.st + $st))){
          if($pp.Length -ge 4 -and -not $pairs.ContainsKey($pp)){ $pairs[$pp] = @($prev.st, $st) }
        }
      }
      $prev = [pscustomobject]@{ raw=$c; st=$st; game=$isGame; plain=$plain }
    }
  }
  return [pscustomobject]@{ singles=$singles; pairs=$pairs }
}
# 육아 제품군의 «핵심» = 흔한 말(아기·유아·아기방…)을 뺀 나머지를 붙인 것 — 「아기 놀이방매트」→「놀이방매트」, 「아기 기저귀 가방」→「기저귀가방」
function Category-Core([string]$cat){
  $parts = @()
  foreach($m in [regex]::Matches(([System.Net.WebUtility]::HtmlDecode($cat)).ToLowerInvariant(), '[가-힣]+|[a-z0-9]+')){
    if($script:STOP.Contains($m.Value) -or $script:STOP.Contains((Strip-Josa $m.Value))){ continue }
    $parts += $m.Value
  }
  return ($parts -join '')
}
$script:DeskDocs   = New-Object System.Collections.Generic.List[object]
$script:DocsByGame = @{}
$script:DFgame     = @{}
function Is-Distinct([string]$tok, [string]$gk){
  $b = $null; if($gk -and $script:DFgame.ContainsKey($gk)){ $b = $script:DFgame[$gk] }
  if($null -eq $b){ return $true }
  $c = 0; if($b.df.ContainsKey($tok)){ $c = [int]$b.df[$tok] }
  if($c -le $DESK_DF_MAX){ return $true }
  return (([double]$c / [double][Math]::Max(1, $b.n)) -le $DESK_DF_RATIO)
}
# 후보 ↔ 같은 게임 글 공유 내용어(드문 말만). 낱말로 이미 잡힌 짝은 두 번 세지 않는다.
#   붙여 쓴 복합어는 «4글자 이상 낱말이 상대 제목(공백 없앤 것)에 통째로 들어 있나»로 한 번 더 본다(「데이브 더 다이버」↔「데이브더다이버」).
function Shared-Content($ct, $dt, [string]$gk, [string]$candNos, [string]$docNos){
  $single = New-Object System.Collections.Generic.List[string]
  foreach($t in $ct.singles){ if($dt.singles.Contains($t) -and (Is-Distinct $t $gk)){ [void]$single.Add($t) } }
  $extra = New-Object System.Collections.Generic.List[string]
  foreach($p in @($ct.pairs.Keys)){
    $ps = [string]$p
    if(-not ($dt.pairs.ContainsKey($ps) -or $dt.singles.Contains($ps))){ continue }
    $parts = $ct.pairs[$ps]
    if($single.Contains([string]$parts[0]) -or $single.Contains([string]$parts[1])){ continue }
    if(-not $extra.Contains($ps) -and (Is-Distinct $ps $gk)){ [void]$extra.Add($ps) }
  }
  foreach($t in $ct.singles){ if(-not $single.Contains($t) -and -not $extra.Contains($t) -and $dt.pairs.ContainsKey($t) -and (Is-Distinct $t $gk)){ [void]$extra.Add($t) } }
  if($candNos){ foreach($t in $dt.singles){ if(($t.Length -ge 4) -and -not $single.Contains($t) -and -not $extra.Contains($t) -and $candNos.Contains($t) -and -not (Is-StopCompound $t) -and (Is-Distinct $t $gk)){ [void]$extra.Add($t) } } }
  if($docNos){ foreach($t in $ct.singles){ if(($t.Length -ge 4) -and -not $single.Contains($t) -and -not $extra.Contains($t) -and $docNos.Contains($t) -and -not (Is-StopCompound $t) -and (Is-Distinct $t $gk)){ [void]$extra.Add($t) } } }
  return ,([string[]](@($single) + @($extra)))
}
# 라이브 제목의 게임 = 제목에서 가장 앞에 나오는 게임 표기(같은 자리면 긴 것 — 「두근두근타운 데이브더다이버 콜라보」는 두근두근타운).
#   3글자 이하 표기는 낱말 머리에서만 인정(「이환」이 「…이 환영」에 걸리지 않게).
$script:KnownGameKeys = @()
function Detect-GameKey([string]$raw){
  $n = Norm $raw
  if([string]::IsNullOrEmpty($n)){ return '' }
  $words = $null
  $best = ''; $bestIdx = [int]::MaxValue
  foreach($k in $script:KnownGameKeys){
    $idx = $n.IndexOf($k, [System.StringComparison]::Ordinal)
    if(($idx -lt 0) -or ($idx -gt $bestIdx) -or (($idx -eq $bestIdx) -and ($k.Length -le $best.Length))){ continue }
    if($k.Length -le 3){
      if($null -eq $words){ $words = @([regex]::Matches(([System.Net.WebUtility]::HtmlDecode($raw)).ToLowerInvariant(), '[가-힣a-z0-9]+') | ForEach-Object { $_.Value }) }
      $ok = $false; foreach($w in $words){ if($w.StartsWith($k, [System.StringComparison]::Ordinal)){ $ok = $true; break } }
      if(-not $ok){ continue }
    }
    $best = $k; $bestIdx = $idx
  }
  if(-not $best){ return '' }
  if($script:GameAlias.ContainsKey($best)){ return [string]$script:GameAlias[$best] }
  return $best
}
# 게임 자리가 육아 제품군인가(데스크 parenting 칸은 game 에 «아기 가습기» 같은 제품군을 쓴다)
function Is-CategoryGame([string]$game, [string]$gk){
  if($gk -and $script:AliasCanon.Contains($gk)){ return $false }
  return (([string]$game).Trim() -match '^(아기|유아|유아용|신생아|어린이|키즈|아동|돌아기|임산부|산모|출산)')
}
# «게임 | 제목» / «게임<TAB>제목» 해석 — desk-dedup.cjs 와 같은 규칙(게임 자리 30자 이하)
function Split-DeskLine([string]$raw){
  $t = ([string]$raw).Trim()
  if(-not $t){ return $null }
  $parts = @($t -split '\t|\s*\|\s*')
  if($parts.Count -ge 2){
    $g = ([string]$parts[0]).Trim()
    if($g.Length -gt 0 -and $g.Length -le 30){
      $ti = ((@($parts[1..($parts.Count-1)])) -join ' ').Trim()
      if($ti){ return [pscustomobject]@{ game=$g; title=$ti } }
    }
  }
  return $null
}
function Docs-ForGame([string]$gk){
  $out = New-Object System.Collections.Generic.List[object]
  if([string]::IsNullOrEmpty($gk)){ return ,$out }
  foreach($k in @($script:DocsByGame.Keys)){ if(Same-Game $gk ([string]$k)){ foreach($d in $script:DocsByGame[$k]){ [void]$out.Add($d) } } }
  return ,$out
}
# 라이브 제목과 거의 같은가(종전 규칙) — 가장 닮은 1건.
#   $candGame 을 주면(데스크 모드) 이름이 이어지는 «다른 게임»의 라이브 제목은 건너뛴다 — 짧은 «—» 앞 문장이
#   «배틀그라운드 …콜라보» 처럼 게임명+흔한 말만으로 «배틀그라운드 모바일 …콜라보» 에 붙는 것을 막는다.
#   ★이름이 안 이어지는 게임(창세기전 외전 ↔ 창세기전 서풍의 광시곡)이나, 후보 제목이 그 게임 이름을 직접 쓴 경우는 종전대로 대조한다.
function Live-Hit($candBg, [string]$candGame, [string]$candTitleNos){
  $hit = $null; $bestJac = 0.0
  foreach($lt in $liveTitles){
    if($candGame -and $lt.gk){
      $lg = [string]$lt.gk
      $variant = $lg.StartsWith($candGame, [System.StringComparison]::Ordinal) -or $candGame.StartsWith($lg, [System.StringComparison]::Ordinal)
      if($variant -and -not (Same-Game $candGame $lg) -and -not ($candTitleNos -and $candTitleNos.Contains($lg))){ continue }
    }
    $sc = JacOvl $lt.bg $candBg
    $inter = 0; foreach($x in $candBg){ if($lt.bg.Contains($x)){ $inter++ } }
    $isLive = ($sc.jac -ge 0.45) -or ($sc.ovl -ge 0.60 -and $sc.jac -ge 0.30 -and $inter -ge 6)
    if($isLive -and $sc.jac -gt $bestJac){
      $bestJac = $sc.jac
      $hit = [pscustomobject]@{ title=$lt.raw; jac=[Math]::Round($sc.jac,2); ovl=[Math]::Round($sc.ovl,2); inter=$inter }
    }
  }
  return $hit
}
# 실패 블로클리스트와 강하게 겹치나(종전 규칙)
function Failed-Hit([string]$candNorm, $candBg, $candKw){
  foreach($ft in $failedTopics){
    $ovF = JacOvl $ft.bg $candBg
    $anchorF = Game-Anchor $ft.game $candNorm $candBg
    $sharedF = Inter-Count $ft.kw $candKw
    if(($ovF.jac -ge 0.5) -or ($ovF.ovl -ge 0.7 -and $sharedF -ge 1) -or ($anchorF -ge 0.7 -and $sharedF -ge 2)){ return $ft }
  }
  return $null
}

# ── (선택) 발행상태 라이브 갱신 ── -RefreshPublished: dedup 직전에 실제 블로그를 새로 조회해 published.json+_live-titles.json 을 신선하게.
#   왜: published.json 은 평소 발행시점(build-manifest)에만 갱신 → 브리핑(00시) 때 stale → 방금 발행한 글이 목록에 없어 재추천되는 사고.
#   신선도 가드: 이미 $RefreshMaxAgeMin 분 안에 갱신됐으면 재조회 생략(작성자마다 호출돼도 라이브 조회는 회당 1회). 네트워크 실패 → 기존 파일 사용(거짓 게이트 금지).
$pubFile = Join-Path $Base "published.json"
$refreshNote = ""
if($RefreshPublished){
  $needRefresh = $true
  if(Test-Path $pubFile){
    $ageMin = ((Get-Date) - (Get-Item $pubFile).LastWriteTime).TotalMinutes
    if($ageMin -lt $RefreshMaxAgeMin){ $needRefresh = $false; $refreshNote = ("published.json 이 {0:0}분 전 갱신됨 — 라이브 재조회 생략" -f $ageMin) }
  }
  if($needRefresh){
    $chk = Join-Path $PSScriptRoot "check-published.ps1"
    if(Test-Path $chk){
      try {
        & $chk *> $null    # 라이브 조회 + published.json/_live-titles.json 재생성. 모든 스트림 억제(stdout JSON 오염 방지)
        $refreshNote = "라이브 블로그 재조회 완료(published.json+_live-titles.json 갱신)"
      } catch {
        $refreshNote = ("라이브 재조회 실패 — 기존 published.json 사용: {0}" -f $_.Exception.Message)
      }
    } else { $refreshNote = "check-published.ps1 미발견 — 기존 published.json 사용" }
  }
}

# ── published.json 로드 → 작성자 발행주제(게임·토픽) 목록 ──
$pubTopics = @()   # @{ game; topic; gameNorm; comboNorm; comboBg; kw; rel }
if(Test-Path $pubFile){
  $pj = Get-Content $pubFile -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach($rel in @($pj.publishedRels)){
    $segs = ([string]$rel) -split '/'
    if($segs.Count -lt 2){ continue }
    if($segs[0] -ne $Writer){ continue }
    $game  = if($segs.Count -ge 2){ $segs[1] } else { "" }
    $topic = if($segs.Count -ge 3){ $segs[2] } else { "" }
    $comboNorm = Norm ("$game $topic")
    $pubTopics += [pscustomobject]@{
      game=$game; topic=$topic; rel=$rel
      gameNorm = (Norm $game)
      comboNorm = $comboNorm
      comboBg = (Bigrams $comboNorm)
      kw = (Find-Keywords (Norm "$game $topic"))
    }
  }
}

# ── _live-titles.json 로드 → 작성자 실제 라이브 발행 제목(원문) ──
#   published.json(레포 폴더 경로)이 못 잡는 케이스 보완: 레포에 글 파일이 없거나 폴더명이 다른데 이미 라이브에 발행된 글.
#   후보 제목을 '실제 발행된 제목'과 직접 bigram 대조 → 강하게 겹치면 ✅published 하드 드롭(재추천 차단).
$liveFile = Join-Path $Base "_trend\_live-titles.json"
$liveTitles = @()   # @{ raw; norm; bg; (데스크 모드면) gk }
if(Test-Path $liveFile){
  try {
    $lj = Get-Content $liveFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $arr = @()
    if($lj.byAuthor -and ($lj.byAuthor.PSObject.Properties.Name -contains $Writer)){ $arr = @($lj.byAuthor.$Writer) }
    foreach($t in $arr){
      $tn = Norm ([string]$t)
      if($tn.Length -lt 2){ continue }
      $liveTitles += [pscustomobject]@{ raw=[string]$t; norm=$tn; bg=(Bigrams $tn) }
    }
  } catch {}
}

# ── 알려진 게임 사전 구축(발행이력 + 정적 + 겜더쿠 포트폴리오) → 다양성 집계용 ──
$script:FranchiseHeads = $FranchiseHeads
$kg = New-Object System.Collections.Generic.List[string]
foreach($pt in $pubTopics){ if($pt.game){ [void]$kg.Add([string]$pt.game) } }
foreach($g in $StaticGames){ [void]$kg.Add($g) }
foreach($h in $FranchiseHeads){ [void]$kg.Add($h) }   # 단일게임 프랜차이즈(젠존제·명조 등)는 머리어=게임명
$gjf = Join-Path $Base "_trend\_gemdeokku-games.json"
if(Test-Path $gjf){
  try {
    $gj = Get-Content $gjf -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach($m in @($gj.main)){ if($m.game){ [void]$kg.Add([string]$m.game) } }
    foreach($s in @($gj.sub)){ if($s.game){ [void]$kg.Add([string]$s.game) } }
    foreach($c in @($gj.candidates)){ if($c.game){ [void]$kg.Add([string]$c.game) } }
  } catch {}
}
$script:KnownGames = @($kg | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -Unique)

# ── trend.json 로드 → 직전 추천(날짜별) ──
#   ★2026-08-14 스키마 2 대응: 트렌드가 '작성자별 브리핑(issues[].picks)' 에서
#     '작성자 무관 일간 토픽 데스크(editions[].sections[].items[].title)' 로 바뀌었다.
#     새 스키마엔 writer 필드가 없다(작성자는 발주 시점에 정해진다) → 작성자 필터 없이 전 항목을 직전 추천으로 본다.
#     이월(🔄) 판정의 의미는 그대로다: "데스크가 이미 며칠째 밀고 있는 주제인가".
#   옛 issues 스키마도 계속 읽는다(archive 된 과거 파일로 회귀 검증할 수 있게).
#   ★2026-09-12: 항목의 game 도 읽고, 자르지 않은 제목(full*)도 같이 둔다 — 데스크 모드는 같은 게임끼리·제목 전체로 대조한다.
$trendFile = Join-Path $Base "_trend\trend.json"
$prevByDate = @()   # 최신순: @{ date; picks=@(@{clean;norm;bg;kw;fullBg;fullKw;gk}) }
if(Test-Path $trendFile){
  $tj = Get-Content $trendFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $exclD = if([string]::IsNullOrWhiteSpace($ExcludeDate)){ $TODAY } else { $ExcludeDate }
  $days = @()   # @{ date; titles=@(@{title;game}) }
  if($tj.editions){
    foreach($ed in @($tj.editions)){
      if(-not $ed.date -or ([string]$ed.date) -eq $exclD){ continue }
      $titles = @()
      foreach($sec in @($ed.sections)){ foreach($item in @($sec.items)){ if($item.title){ $titles += [pscustomobject]@{ title=[string]$item.title; game=[string]$item.game } } } }
      $days += [pscustomobject]@{ date=[string]$ed.date; titles=$titles }
    }
  } else {
    foreach($is in @($tj.issues)){
      if($is.writer -ne $Writer -or ([string]$is.date) -eq $exclD){ continue }
      $days += [pscustomobject]@{ date=[string]$is.date; titles=@($is.picks | ForEach-Object { [pscustomobject]@{ title=[string]$_; game='' } }) }
    }
  }
  $days = $days | Sort-Object -Property date -Descending | Select-Object -First $PrevIssues
  foreach($d in $days){
    $ps = @()
    foreach($p in @($d.titles)){
      $c = Clean-Pick ([string]$p.title); $cn = Norm $c
      $cf = Norm (Clean-Pick ([string]$p.title) -KeepDash)
      $ps += [pscustomobject]@{ clean=$c; norm=$cn; bg=(Bigrams $cn); kw=(Find-Keywords $cn); fullBg=(Bigrams $cf); fullKw=(Find-Keywords $cf); gk=(Game-Key ([string]$p.game)) }
    }
    $prevByDate += [pscustomobject]@{ date=$d.date; picks=$ps }
  }
}

# ── 실패 주제 블로클리스트 로드(2026-06-24) — 이미 발행요청 실패한 주제 재추천 차단 ──
#   백엔드 GET /requests?status=failed 스냅샷(_trend\_failed-requests.json). 같은 작성자가 이미 실패한 주제와
#   강하게 겹치면 ❌failed로 하드 드롭 → 중복·자기잠식·전제오류 주제가 발주로 재유입되는 걸 사전 차단.
$failedFileP = if([string]::IsNullOrWhiteSpace($FailedFile)){ Join-Path $Base "_trend\_failed-requests.json" } else { $FailedFile }
if($RefreshFailed){
  try {
    $resp = Invoke-WebRequest -Uri $FailedApi -TimeoutSec 12 -UseBasicParsing
    $arr = $resp.Content | ConvertFrom-Json
    if($arr){
      $slim = @($arr | ForEach-Object { [pscustomobject]@{ writer=$_.writer; topic=$_.topic; purpose=$_.purpose; reason=(([string]$_.error) -replace '\s+',' ') } })
      ([ordered]@{ updated=$TODAY; count=$slim.Count; failed=$slim } | ConvertTo-Json -Depth 5) | Set-Content -Path $failedFileP -Encoding UTF8
    }
  } catch { }   # 네트워크 실패 → 기존 캐시 사용(거짓 게이트 금지)
}
$failedTopics = @()
if(Test-Path $failedFileP){
  try {
    $fj = Get-Content $failedFileP -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach($f in @($fj.failed)){
      if([string]::IsNullOrWhiteSpace($f.topic)){ continue }
      if(-not $f.writer){ continue }                       # writer 빈값(null 요청)은 오탐 방지로 제외
      if(([string]$f.writer) -ne $Writer){ continue }       # 작성자 단위 dedup
      $tn = Norm ([string]$f.topic)
      $failedTopics += [pscustomobject]@{
        topic=[string]$f.topic; norm=$tn; bg=(Bigrams $tn); kw=(Find-Keywords $tn)
        game=(Game-Of $tn); reason=([string]$f.reason); reasonCat=([string]$f.reasonCat)
      }
    }
  } catch { }
}

# ── 후보 읽기 ──
$rawCands = @()
if($CandidatesFile){ $rawCands = Get-Content -Path $CandidatesFile -Encoding UTF8 | Where-Object { $_.Trim() -ne "" } }
else { $rawCands = @($input) | Where-Object { $_.Trim() -ne "" } }

# ── 데스크 모드 준비(2026-09-12): «게임 | 제목» 줄이 하나라도 있으면 작성자 글을 문서로 만들고 게임별 낱말 빈도를 센다 ──
$parsed = @()
foreach($raw in @($rawCands)){ $parsed += [pscustomobject]@{ raw=[string]$raw; desk=(Split-DeskLine ([string]$raw)) } }
$deskCount = @($parsed | Where-Object { $null -ne $_.desk }).Count
if($deskCount -gt 0){
  # 등록된 게임 표기 = 별칭 색인 + 이 작성자 글 폴더 + 정적 목록(Same-Game 이 «따로 등록된 긴 이름»을 가려내는 데 쓴다)
  foreach($k in @($script:GameAlias.Keys)){ [void]$script:RegisteredGameKeys.Add([string]$k) }
  foreach($k in $script:AliasCanon){ [void]$script:RegisteredGameKeys.Add([string]$k) }
  foreach($pt in $pubTopics){ $n = Norm $pt.game; if($n.Length -ge 2){ [void]$script:RegisteredGameKeys.Add($n) } }
  foreach($g in $StaticGames){ $n = Norm $g; if($n.Length -ge 2){ [void]$script:RegisteredGameKeys.Add($n) } }
  # 알려진 게임 표기(라이브 제목의 게임 추정용) = 등록 표기 + (4글자 이상) 머리어 + 오늘 후보의 게임
  $kk = New-Object System.Collections.Generic.HashSet[string]
  foreach($k in $script:RegisteredGameKeys){ [void]$kk.Add([string]$k) }
  foreach($h in $FranchiseHeads){ $n = Norm $h; if($n.Length -ge 4){ [void]$kk.Add($n) } }
  foreach($pc in $parsed){ if($null -ne $pc.desk){ $n = Norm $pc.desk.game; if($n.Length -ge 2){ [void]$kk.Add($n) } } }
  $script:KnownGameKeys = @($kk | Sort-Object -Property Length -Descending)

  # 폴더 글의 표시 제목 = posts.json 제목(없으면 «게임 주제»)
  $titleByRel = @{}
  $postsFile = Join-Path $Base "posts.json"
  if(Test-Path $postsFile){
    try {
      $postsAll = Get-Content $postsFile -Raw -Encoding UTF8 | ConvertFrom-Json
      foreach($p in @($postsAll)){ if($p.rel -and $p.title){ $titleByRel[[string]$p.rel] = [string]$p.title } }
    } catch {}
  }
  foreach($pt in $pubTopics){
    $segs = ([string]$pt.rel) -split '/'
    $topicText = if($segs.Count -ge 4){ [string]$segs[2] } else { '' }
    $title = if($titleByRel.ContainsKey([string]$pt.rel)){ [string]$titleByRel[[string]$pt.rel] } else { ("{0} {1}" -f $pt.game, $topicText).Trim() }
    $gk = Game-Key ([string]$pt.game)
    $gw = Get-GameWords $gk
    $tn = Strip-GameNorm (Norm $title) $gw
    [void]$script:DeskDocs.Add([pscustomobject]@{
      kind='folder'; rel=[string]$pt.rel; game=[string]$pt.game; topic=$topicText; title=$title; gk=$gk
      tok=(Content-Tokens ("$title $topicText") $gw); tnorm=$tn; nos=(Norm ("$title $topicText")); bg=(Bigrams $tn); kw=(Find-Keywords (Norm ("$title $topicText")))
    })
  }
  foreach($lt in $liveTitles){
    $gk = Detect-GameKey $lt.raw
    $lt | Add-Member -NotePropertyName gk -NotePropertyValue $gk -Force     # Live-Hit 가 «다른 게임 글»을 건너뛸 때 쓴다
    $gw = Get-GameWords $gk
    $title = [System.Net.WebUtility]::HtmlDecode($lt.raw)
    $tn = Strip-GameNorm $lt.norm $gw
    [void]$script:DeskDocs.Add([pscustomobject]@{
      kind='live'; rel=$null; game=''; topic=''; title=$title; gk=$gk
      tok=(Content-Tokens $title $gw); tnorm=$tn; nos=$lt.norm; bg=(Bigrams $tn); kw=(Find-Keywords $lt.norm)
    })
  }
  # 낱말 빈도(DF) — 게임별. 같은 글이 폴더·라이브로 두 번 들어가도 비율 기준이라 함께 늘어난다.
  foreach($d in $script:DeskDocs){
    if(-not $d.gk){ continue }
    if(-not $script:DFgame.ContainsKey($d.gk)){ $script:DFgame[$d.gk] = [pscustomobject]@{ n=0; df=@{} } }
    if(-not $script:DocsByGame.ContainsKey($d.gk)){ $script:DocsByGame[$d.gk] = New-Object System.Collections.Generic.List[object] }
    [void]$script:DocsByGame[$d.gk].Add($d)
    $b = $script:DFgame[$d.gk]
    $b.n = $b.n + 1
    $keys = New-Object System.Collections.Generic.HashSet[string]
    foreach($t in $d.tok.singles){ [void]$keys.Add($t) }
    foreach($t in @($d.tok.pairs.Keys)){ [void]$keys.Add([string]$t) }
    foreach($t in $keys){ if($b.df.ContainsKey($t)){ $b.df[$t] = [int]$b.df[$t] + 1 } else { $b.df[$t] = 1 } }
  }
}

# ── 데스크 모드 분류 — 후보 1줄 ──
function Classify-Desk($dk, [string]$raw){
  $cg = [string]$dk.game
  $ctitle = Clean-Pick ([string]$dk.title) -KeepDash
  $htitle = Clean-Pick ([string]$dk.title)            # «—» 앞(옛 규칙) — 라이브·실패 대조는 두 길이를 다 본다
  $cgk = Game-Key $cg
  $isCat = Is-CategoryGame $cg $cgk
  $cgw = if($isCat){ [string[]]@() } else { Get-GameWords $cgk }
  $ctn = Strip-GameNorm (Norm $ctitle) $cgw
  $cbgT = Bigrams $ctn
  $ckwT = Find-Keywords (Norm $ctitle)
  $titleBg = Bigrams (Norm $ctitle)

  # 1) 관련 글 — 가장 강한 1건
  #  · 게임: 같은 게임 글과 대조.
  #    ✅published = 제목 유사도≥0.45, 또는 제목 유사도≥0.25 이면서 (드문 내용어 2+ · 내용어 1 + 같은 유형어/단일유형)
  #                  ★제목이 안 닮았으면 공유어가 많아도 «사실상 같은 글»로 올리지 않는다(도감 «구조 읽는 법» ≠ 도감 «속성치 비교»)
  #    🟡review    = 드문 내용어 1 · 같은 유형어(스킬트리·사냥터 등) · 단일유형(티어/쿠폰/허브)
  #  · 육아: 제품군 핵심이 글 제목에 통째로 들어 있으면 🟡review(제목까지 거의 같으면 ✅published). 게임 글은 보지 않는다.
  $best = $null
  if($isCat){
    $core = Category-Core $cg
    if($core.Length -ge 2){
      foreach($d in $script:DeskDocs){
        if($d.gk -and $script:AliasCanon.Contains([string]$d.gk)){ continue }
        if(-not ([string]$d.nos).Contains($core)){ continue }
        $jj = JacOvl $d.bg $cbgT
        $tier = if($jj.jac -ge 0.45){ 'published' } else { 'review' }
        $rank = $(if($tier -eq 'published'){ 2000 } else { 1000 }) + [int][Math]::Round($jj.jac * 19) + $(if($d.kind -eq 'folder'){ 0.5 } else { 0 })
        if(($null -eq $best) -or ($rank -gt $best.rank)){
          $best = [pscustomobject]@{ doc=$d; tier=$tier; shared=[string[]]@($core); hard=@(); fam=$false; jac=[Math]::Round($jj.jac,2); rank=$rank }
        }
      }
    }
  } else {
    $ctok = Content-Tokens $ctitle $cgw
    $cnos = Norm $ctitle
    foreach($d in (Docs-ForGame $cgk)){
      $sh = Shared-Content $ctok $d.tok ([string]$d.gk) $cnos ([string]$d.nos)
      $jj = JacOvl $d.bg $cbgT
      $hard = @(Shared-Hard $d.kw $ckwT)
      $fam = Family-Match $ctn $d.tnorm
      $tier = 'none'
      if(($jj.jac -ge 0.45) -or (($jj.jac -ge 0.25) -and (($sh.Count -ge 2) -or (($sh.Count -ge 1) -and (($hard.Count -ge 1) -or $fam))))){ $tier = 'published' }
      elseif(($sh.Count -ge 1) -or ($hard.Count -ge 1) -or $fam){ $tier = 'review' }
      if($tier -eq 'none'){ continue }
      # 같은 등급이면: 공유 내용어(고유 이름) > 단일유형(티어·쿠폰·허브) > 유형어 > 제목 유사도
      #   ★단일유형 가산은 내용어 1개보다 작게 — 「픽업」 같은 흔한 유형어가 「호토리」 같은 고유 이름을 이기지 않게
      $rank = $(if($tier -eq 'published'){ 2000 } else { 1000 }) + ($sh.Count * 100) + $(if($fam){ 80 } else { 0 }) + $(if($hard.Count -ge 1){ 60 } else { 0 }) + [int][Math]::Round($jj.jac * 19) + $(if($d.kind -eq 'folder'){ 0.5 } else { 0 })
      if(($null -eq $best) -or ($rank -gt $best.rank)){
        $best = [pscustomobject]@{ doc=$d; tier=$tier; shared=$sh; hard=$hard; fam=$fam; jac=[Math]::Round($jj.jac,2); rank=$rank }
      }
    }
  }

  # 2) 라이브 제목과 거의 같은가 — 제목 전체와 «—» 앞을 둘 다(종전 규칙 · 다른 게임으로 확인된 제목은 제외)
  $liveHit = Live-Hit (Bigrams (Norm ("$cg $ctitle"))) $cgk (Norm $ctitle)
  $liveHead = Live-Hit (Bigrams (Norm ("$cg $htitle"))) $cgk (Norm $ctitle)
  if(($null -ne $liveHead) -and (($null -eq $liveHit) -or ($liveHead.jac -gt $liveHit.jac))){ $liveHit = $liveHead }

  # 3) 지난 데스크 판 → 🔄 (같은 게임끼리만 · 제목 전체)
  $daysList = @()
  foreach($pd in $prevByDate){
    $hit = $false
    foreach($pp in $pd.picks){
      if($cgk -and $pp.gk -and -not (Same-Game $cgk ([string]$pp.gk))){ continue }
      $c2 = JacOvl $pp.fullBg $titleBg
      $sk = Inter-Count $pp.fullKw $ckwT
      if(($c2.jac -ge 0.5) -or ($c2.ovl -ge 0.75 -and $sk -ge 1)){ $hit = $true; break }
    }
    if($hit){ $daysList += $pd.date }
  }

  # 0) 실패 블로클리스트(최우선) — 제목 전체와 «—» 앞을 둘 다
  $fullNorm = Norm ("$cg $ctitle"); $headNorm = Norm ("$cg $htitle")
  $failedHit = Failed-Hit $fullNorm (Bigrams $fullNorm) (Find-Keywords $fullNorm)
  if($null -eq $failedHit){ $failedHit = Failed-Hit $headNorm (Bigrams $headNorm) (Find-Keywords $headNorm) }

  # 상태 확정(우선순위: failed > published[라이브/같은 게임 글] > review > carried > new)
  $status = "new"; $reason = "지난 판·발행 글과 겹치는 것 없음"
  $mTitle = $null; $mRel = $null; $mPub = $null; $words = [string[]]@()
  if($failedHit){
    $status = "failed"
    $rc = if($failedHit.reasonCat){ " [$($failedHit.reasonCat)]" } else { "" }
    $reason = "이미 발행요청 실패한 주제(재추천 금지)$rc — `"$($failedHit.topic)`": $($failedHit.reason)"
  } elseif($liveHit){
    $status = "published"
    $mTitle = [System.Net.WebUtility]::HtmlDecode($liveHit.title)
    $reason = "라이브 블로그에 이미 발행됨(실제 제목과 동일/유사) — `"$mTitle`" (jac=$($liveHit.jac), ovl=$($liveHit.ovl))"
  } elseif($best){
    $status = $best.tier
    $mTitle = [string]$best.doc.title; $mRel = $best.doc.rel
    if($best.doc.kind -eq 'folder'){ $mPub = "$($best.doc.game)/$($best.doc.topic)" }
    $words = [string[]]$best.shared
    $why = @()
    if($best.shared.Count -gt 0){ $why += ($(if($isCat){ "제품군 " } else { "공유어 " }) + ($best.shared -join '·')) }
    if(@($best.hard).Count -gt 0){ $why += ("유형 " + (@($best.hard) -join '·')) }
    if($best.fam){ $why += "단일유형(티어/쿠폰/허브)" }
    if($best.jac -ge 0.45){ $why += "제목 유사도 $($best.jac)" }
    $whyTxt = ($why -join ' · ')
    if($isCat){ $p1 = "같은 제품군에 사실상 같은 글"; $p2 = "같은 제품군 글(새 각도 가능)" } else { $p1 = "같은 게임에 사실상 같은 글"; $p2 = "같은 게임 관련 글(새 각도 가능)" }
    if($status -eq 'published'){ $reason = "$p1 — 「$mTitle」 ($whyTxt)" }
    else { $reason = "$p2 — 「$mTitle」 ($whyTxt) — 채택하려면 '새 각도' 근거 명시" }
  } elseif($daysList.Count -ge 1){
    $status = "carried"
    $reason = "이월: 직전 $($daysList.Count)개 판에 등장(최근 $($daysList[0]))"
  }
  $chip = switch($status){ "failed"{"❌"} "published"{"✅"} "review"{"🟡"} "carried"{"🔄"} default{"🆕"} }
  return [pscustomobject]@{
    pick = "$cg | $ctitle"
    raw = $raw.Trim()
    track = ''
    game = $cg
    franchise = (Franchise-Of (Norm $cg))
    status = $status
    chip = $chip
    carryDays = $(if($daysList.Count -ge 1){ $daysList.Count + 1 } else { $null })
    matchedPublished = $mPub
    matchedTitle = $mTitle
    matchedRel = $mRel
    sharedWords = $words
    liveMatch = $(if($liveHit){ $mTitle } else { $null })
    failedMatch = $(if($failedHit){ $failedHit.topic } else { $null })
    failedCat = $(if($failedHit){ $failedHit.reasonCat } else { $null })
    reason = $reason
    mode = $(if($isCat){ 'desk-category' } else { 'desk' })
  }
}

# ── 분류 ──
#   트랙 헤더 줄(예: "#확장" / "=== 발굴 ===" / "[단편]")은 분류 대상이 아니라 이후 픽의 트랙을 지정한다.
#   ★«게임 | 제목» 줄은 데스크 모드(Classify-Desk), 그 밖의 줄은 아래 종전 규칙.
$results = @()
$curTrack = ''
foreach($pc in $parsed){
  $raw = $pc.raw
  $hdr = $raw.Trim()
  if($hdr -match '^[#=\-\[\s]*(확장|발굴|단편|기어)[\]\s=]*$'){ $curTrack = $Matches[1]; continue }
  if($null -ne $pc.desk){ $results += (Classify-Desk $pc.desk $raw); continue }
  $clean = Clean-Pick $raw
  $cn = Norm $clean
  $cbg = Bigrams $cn
  $ckw = Find-Keywords $cn

  # 1) 발행완료 대조(최고 점수 1건)
  $bestPub = $null; $bestPubScore = -1.0
  foreach($pt in $pubTopics){
    $anchor = Game-Anchor $pt.gameNorm $cn $cbg
    $combo  = JacOvl $pt.comboBg $cbg
    $sharedHard = @(Shared-Hard $pt.kw $ckw)
    $sharedAll  = Inter-Count $pt.kw $ckw
    # 판정 점수: 게임 앵커가 있어야 의미. 앵커×(키워드 겹침 + combo + 단일유형 패밀리)
    $famMatch = Family-Match $cn $pt.comboNorm
    $isPub = $false; $tier = "none"
    if($anchor -ge 0.7){
      if(($sharedHard.Count -ge 1) -or ($sharedAll -ge 2) -or ($combo.jac -ge 0.45) -or $famMatch){ $isPub=$true; $tier="published" }
      elseif($sharedAll -eq 1){ $tier="review" }
    } elseif($combo.jac -ge 0.50){ $isPub=$true; $tier="published" }   # 게임명이 약해도 제목 자체가 거의 동일
    $score = [Math]::Round( ($anchor*0.5 + $combo.jac*0.3 + [Math]::Min($sharedAll,3)/3.0*0.2), 3)
    if($score -gt $bestPubScore){
      $bestPubScore = $score
      $bestPub = [pscustomobject]@{ rel=$pt.rel; game=$pt.game; topic=$pt.topic; anchor=[Math]::Round($anchor,2); jac=[Math]::Round($combo.jac,2); ovl=[Math]::Round($combo.ovl,2); sharedHard=$sharedHard; shared=$sharedAll; tier=$tier; isPub=$isPub; famMatch=$famMatch }
    }
  }

  # 1.5) 라이브 제목 직접 대조 — 실제 발행된 제목과 거의 동일하면 ✅published(레포 폴더가 없어도 잡음)
  #   판정: jac>=0.45(제목 거의 동일) 또는 (ovl>=0.60 & jac>=0.30 & 교집합 bigram>=6)(후보가 라이브 제목에 거의 포함).
  #   교집합 floor(>=6)로 일반어/짧은 제목 오매칭 차단. 재현율 우선(이미 라이브에 있는 글이라 드롭이 안전).
  $liveHit = Live-Hit $cbg ''

  # 2) 직전 픽 대조 → 🔄 N일째(연속 일수)
  $carried = $false; $daysList = @()
  foreach($d in $prevByDate){
    $hit = $false
    foreach($pp in $d.picks){
      $a2 = 0.0
      # 같은 게임 추정: 후보·이전픽 둘 다의 키워드/머리어 겹침으로
      $combo2 = JacOvl $pp.bg $cbg
      $sharedK = Inter-Count $pp.kw $ckw
      if(($combo2.jac -ge 0.5) -or ($combo2.ovl -ge 0.75 -and $sharedK -ge 1)){ $hit=$true; break }
    }
    if($hit){ $daysList += $d.date }
  }
  if($daysList.Count -ge 1){ $carried = $true }
  # 연속성: 가장 최근 날짜부터 끊김 없이 이어진 일수(단순히 등장 횟수로 근사 — N일째 표기용)
  $carryN = $daysList.Count + 1   # 오늘 포함 N일째

  # 0) 실패 블로클리스트 대조(최우선) — 같은 작성자가 이미 발행요청 실패한 주제와 강하게 겹치면 드롭
  $failedHit = Failed-Hit $cn $cbg $ckw

  # 3) 상태 확정(우선순위: failed > published[라이브/폴더] > review > carried > new)
  $status = "new"; $reason = "직전 브리핑에 없던 신규"
  if($failedHit){
    $status = "failed"
    $rc = if($failedHit.reasonCat){ " [$($failedHit.reasonCat)]" } else { "" }
    $reason = "이미 발행요청 실패한 주제(재추천 금지)$rc — `"$($failedHit.topic)`": $($failedHit.reason)"
  } elseif($liveHit){
    $status = "published"
    $reason = "라이브 블로그에 이미 발행됨(실제 제목과 동일/유사) — `"$($liveHit.title)`" (jac=$($liveHit.jac), ovl=$($liveHit.ovl))"
  } elseif($bestPub -and $bestPub.isPub){
    $status = "published"
    $famTxt = if($bestPub.famMatch){ "·단일유형동일(티어/쿠폰/허브)" } else { "" }
    $reason = "발행완료: $($bestPub.game)/$($bestPub.topic) (anchor=$($bestPub.anchor), jac=$($bestPub.jac), 공유키워드=$([string]::Join('·',$bestPub.sharedHard))$famTxt)"
  } elseif($bestPub -and $bestPub.tier -eq "review"){
    $status = "review"
    $reason = "같은 게임 약한 겹침(새 각도 가능): $($bestPub.game)/$($bestPub.topic) — 채택하려면 '새 각도' 근거 명시"
  } elseif($carried){
    $status = "carried"
    $reason = "이월: 직전 $($daysList.Count)개 브리핑에 등장(최근 $($daysList[0]))"
  }
  $chip = switch($status){ "failed"{"❌"} "published"{"✅"} "review"{"🟡"} "carried"{"🔄"} default{"🆕"} }

  $results += [pscustomobject]@{
    pick = $clean
    raw = $raw.Trim()
    track = $curTrack
    game = (Game-Of $cn)
    franchise = (Franchise-Of $cn)
    status = $status
    chip = $chip
    carryDays = $(if($carried){$carryN}else{$null})
    matchedPublished = $(if($bestPub -and ($bestPub.isPub -or $bestPub.tier -eq 'review')){ "$($bestPub.game)/$($bestPub.topic)" }else{$null})
    matchedTitle = $(if($liveHit){ $liveHit.title }else{$null})
    matchedRel = $(if($bestPub -and ($bestPub.isPub -or $bestPub.tier -eq 'review')){ $bestPub.rel }else{$null})
    sharedWords = [string[]]@()
    liveMatch = $(if($liveHit){ $liveHit.title }else{$null})
    failedMatch = $(if($failedHit){ $failedHit.topic }else{$null})
    failedCat = $(if($failedHit){ $failedHit.reasonCat }else{$null})
    reason = $reason
    mode = 'legacy'
  }
}

# ── 게임 다양성 집계(트랙별) ── 하드: 정확히 같은 게임 ≤2 / 소프트: 한 프랜차이즈가 트랙 절반(5+) 초과 ──
$byTrackGame = @{}; $byTrackFran = @{}
foreach($r in $results){
  $tk = if([string]::IsNullOrWhiteSpace($r.track)){ '전체' } else { $r.track }
  $gm = if([string]::IsNullOrWhiteSpace($r.game)){ '기타' } else { $r.game }
  $fr = if([string]::IsNullOrWhiteSpace($r.franchise)){ '기타' } else { $r.franchise }
  if(-not $byTrackGame.ContainsKey($tk)){ $byTrackGame[$tk] = @{} }
  if(-not $byTrackGame[$tk].ContainsKey($gm)){ $byTrackGame[$tk][$gm] = 0 }
  $byTrackGame[$tk][$gm]++
  if(-not $byTrackFran.ContainsKey($tk)){ $byTrackFran[$tk] = @{} }
  if(-not $byTrackFran[$tk].ContainsKey($fr)){ $byTrackFran[$tk][$fr] = 0 }
  $byTrackFran[$tk][$fr]++
}
$diversity = @()
foreach($tk in $byTrackGame.Keys){
  $dist = @(); $over = @()
  foreach($gm in $byTrackGame[$tk].Keys){
    $c = $byTrackGame[$tk][$gm]
    $dist += [pscustomobject]@{ game=$gm; count=$c }
    if($gm -ne '기타' -and $c -ge 3){ $over += "$gm×$c" }   # 하드: 같은 게임 3개 이상 = 위반
  }
  $franSoft = @()
  foreach($fr in $byTrackFran[$tk].Keys){
    $c = $byTrackFran[$tk][$fr]
    if($fr -ne '기타' -and $c -ge 5){ $franSoft += "$fr×$c" }  # 소프트: 한 프랜차이즈가 트랙 절반 초과
  }
  $diversity += [pscustomobject]@{
    track = $tk
    distribution = @($dist | Sort-Object -Property count -Descending)
    over2 = $over                         # 하드 위반(같은 게임 3+): 비어야 통과
    franchiseHeavy = $franSoft            # 소프트 경고(프랜차이즈 5+): 정보
    ok = ($over.Count -eq 0)
  }
}

# ── 출력 ──
$summary = [ordered]@{
  writer = $Writer
  date = $TODAY
  refreshed = $(if($RefreshPublished){ $refreshNote } else { "(라이브 미갱신 — -RefreshPublished 미사용)" })
  publishedCount = @($pubTopics).Count
  liveTitleCount = @($liveTitles).Count
  deskLines = $deskCount
  deskDocs = $script:DeskDocs.Count
  aliasGames = $script:AliasCanon.Count
  prevIssues = @($prevByDate | ForEach-Object { $_.date })
  failedBlocklist = @($failedTopics | ForEach-Object { $_.topic })
  results = $results
  diversity = $diversity
  rule = "❌failed=이미 발행요청 실패한 주제(하드 드롭·재추천 금지) · ✅발행완료=추천 제외(→최근발행, 라이브 제목 직접대조+published.json 폴더대조) · 🟡review=기본 제외(새 각도 근거시 채택) · 🔄이월/🆕신규=추천 가능. failed-requests+published.json+_live-titles.json+trend.json 결정론 대조. + 게임다양성: 트랙별 같은 게임 ≤2개(over2 비면 OK). ★«게임 | 제목» 줄=데스크 모드: 같은 게임 글과만 대조(별칭 색인) · 드문 내용어(sharedWords)로 판정 · 육아는 제품군 핵심으로 대조 · matchedTitle=coverage 에 그대로 쓸 실제 글 제목."
}
$json = $summary | ConvertTo-Json -Depth 6
Write-Output $json

if($Pretty){
  Write-Host "`n── [$Writer] 후보 분류 (오늘 $TODAY) ──" -ForegroundColor Cyan
  if($RefreshPublished){ Write-Host ("  발행상태: {0} · 라이브 제목 {1}개 대조" -f $refreshNote, @($liveTitles).Count) -ForegroundColor DarkGray }
  foreach($r in $results){
    $col = switch($r.status){ "failed"{"Magenta"} "published"{"Red"} "review"{"Yellow"} "carried"{"DarkYellow"} default{"Green"} }
    Write-Host ("{0} [{1}] {2}" -f $r.chip, $r.status, $r.pick) -ForegroundColor $col
    Write-Host ("      └ {0}" -f $r.reason) -ForegroundColor DarkGray
  }
  $fail = @($results | Where-Object { $_.status -eq 'failed' }).Count
  $pub = @($results | Where-Object { $_.status -eq 'published' }).Count
  $rev = @($results | Where-Object { $_.status -eq 'review' }).Count
  Write-Host ("`n→ 추천 제외 권고: ❌{0}(실패재추천) ✅{1}(발행완료) 🟡{2}(검토) / 추천 가능: {3}" -f $fail, $pub, $rev, ($results.Count-$fail-$pub-$rev)) -ForegroundColor Cyan
  Write-Host "`n── 게임 다양성(트랙별 · 하드: 같은 게임 ≤2 / 소프트: 프랜차이즈 ≤4) ──" -ForegroundColor Cyan
  foreach($d in $diversity){
    $distStr = (($d.distribution | ForEach-Object { "{0}×{1}" -f $_.game, $_.count }) -join ", ")
    Write-Host ("[{0}] {1}" -f $d.track, $distStr) -ForegroundColor DarkGray
    if(-not $d.ok){ Write-Host ("   ⚠ 같은 게임 쏠림 — {0} (다른 게임으로 교체 필요)" -f ($d.over2 -join ", ")) -ForegroundColor Red }
    if(@($d.franchiseHeavy).Count -gt 0){ Write-Host ("   · 프랜차이즈 편중(참고) — {0}" -f ($d.franchiseHeavy -join ", ")) -ForegroundColor DarkYellow }
  }
}
