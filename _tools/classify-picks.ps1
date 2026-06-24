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
# 실행:
#   powershell -ExecutionPolicy Bypass -File _tools\classify-picks.ps1 -Writer 겜더쿠 -CandidatesFile cand.txt
#   (CandidatesFile = 후보 제목 한 줄에 하나. 상태 이모지·[목적라벨]·괄호 메모는 자동 제거)
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
function Clean-Pick([string]$raw){
  $t = $raw
  $t = ($t -replace '[\uD800-\uDFFF]','')          # 서러게이트(이모지) 제거
  $t = ($t -replace '🆕|🔄|✅|🟡|⚠|📨|📋|⏳','')
  $t = ($t -replace '\[[^\]]*\]','')               # [목적라벨] 제거
  $t = ($t -replace '\([^)]*\)','')                # (괄호 메모) 제거 — 날짜·D-day·근거
  $t = ($t -replace '[—–].*$','')                  # 엠/엔 대시(— –) 뒤 부연만 제거. ·,-,| 는 제목 내 구분자라 보존
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
  return @($hit)         # 항상 배열로(빈 HashSet 이 $null 로 언롤되는 PS 함정 방지). 멤버십은 -contains 로.
}
function Inter-Count($a,$b){ $n=0; foreach($x in @($a)){ if(@($b) -contains $x){ $n++ } }; return $n }
function Shared-Hard($a,$b){ $r=@(); foreach($x in @($a)){ if((@($b) -contains $x) -and ($HARD -contains $x)){ $r+=$x } }; return $r }

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

# ── published.json 로드 → 작성자 발행주제(게임·토픽) 목록 ──
$pubFile = Join-Path $Base "published.json"
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

# ── trend.json 로드 → 작성자 직전 픽(날짜별) ──
$trendFile = Join-Path $Base "_trend\trend.json"
$prevByDate = @()   # 최신순: @{ date; picks=@(@{clean;norm;bg;kw;gameGuess}) }
if(Test-Path $trendFile){
  $tj = Get-Content $trendFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $exclD = if([string]::IsNullOrWhiteSpace($ExcludeDate)){ $TODAY } else { $ExcludeDate }
  $issues = @($tj.issues) | Where-Object { $_.writer -eq $Writer -and ([string]$_.date) -ne $exclD }
  $issues = $issues | Sort-Object -Property date -Descending | Select-Object -First $PrevIssues
  foreach($is in $issues){
    $ps = @()
    foreach($p in @($is.picks)){
      $c = Clean-Pick ([string]$p); $cn = Norm $c
      $ps += [pscustomobject]@{ clean=$c; norm=$cn; bg=(Bigrams $cn); kw=(Find-Keywords $cn) }
    }
    $prevByDate += [pscustomobject]@{ date=[string]$is.date; picks=$ps }
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

# ── 분류 ──
#   트랙 헤더 줄(예: "#확장" / "=== 발굴 ===" / "[단편]")은 분류 대상이 아니라 이후 픽의 트랙을 지정한다.
$results = @()
$curTrack = ''
foreach($raw in $rawCands){
  $hdr = $raw.Trim()
  if($hdr -match '^[#=\-\[\s]*(확장|발굴|단편|기어)[\]\s=]*$'){ $curTrack = $Matches[1]; continue }
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
    # 판정 점수: 게임 앵커가 있어야 의미. 앵커×(키워드 겹침 + combo)
    $isPub = $false; $tier = "none"
    if($anchor -ge 0.7){
      if(($sharedHard.Count -ge 1) -or ($sharedAll -ge 2) -or ($combo.jac -ge 0.45)){ $isPub=$true; $tier="published" }
      elseif($sharedAll -eq 1){ $tier="review" }
    } elseif($combo.jac -ge 0.50){ $isPub=$true; $tier="published" }   # 게임명이 약해도 제목 자체가 거의 동일
    $score = [Math]::Round( ($anchor*0.5 + $combo.jac*0.3 + [Math]::Min($sharedAll,3)/3.0*0.2), 3)
    if($score -gt $bestPubScore){
      $bestPubScore = $score
      $bestPub = [pscustomobject]@{ rel=$pt.rel; game=$pt.game; topic=$pt.topic; anchor=[Math]::Round($anchor,2); jac=[Math]::Round($combo.jac,2); ovl=[Math]::Round($combo.ovl,2); sharedHard=$sharedHard; shared=$sharedAll; tier=$tier; isPub=$isPub }
    }
  }

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
  $failedHit = $null
  foreach($ft in $failedTopics){
    $ovF = JacOvl $ft.bg $cbg
    $anchorF = Game-Anchor $ft.game $cn $cbg
    $sharedF = Inter-Count $ft.kw $ckw
    if(($ovF.jac -ge 0.5) -or ($ovF.ovl -ge 0.7 -and $sharedF -ge 1) -or ($anchorF -ge 0.7 -and $sharedF -ge 2)){
      $failedHit = $ft; break
    }
  }

  # 3) 상태 확정(우선순위: failed > published > review > carried > new)
  $status = "new"; $reason = "직전 브리핑에 없던 신규"
  if($failedHit){
    $status = "failed"
    $rc = if($failedHit.reasonCat){ " [$($failedHit.reasonCat)]" } else { "" }
    $reason = "이미 발행요청 실패한 주제(재추천 금지)$rc — `"$($failedHit.topic)`": $($failedHit.reason)"
  } elseif($bestPub -and $bestPub.isPub){
    $status = "published"
    $reason = "발행완료: $($bestPub.game)/$($bestPub.topic) (anchor=$($bestPub.anchor), jac=$($bestPub.jac), 공유키워드=$([string]::Join('·',$bestPub.sharedHard)))"
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
    failedMatch = $(if($failedHit){ $failedHit.topic }else{$null})
    failedCat = $(if($failedHit){ $failedHit.reasonCat }else{$null})
    reason = $reason
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
  publishedCount = @($pubTopics).Count
  prevIssues = @($prevByDate | ForEach-Object { $_.date })
  failedBlocklist = @($failedTopics | ForEach-Object { $_.topic })
  results = $results
  diversity = $diversity
  rule = "❌failed=이미 발행요청 실패한 주제(하드 드롭·재추천 금지) · ✅발행완료=추천 제외(→최근발행) · 🟡review=기본 제외(새 각도 근거시 채택) · 🔄이월/🆕신규=추천 가능. failed-requests+published.json+trend.json 결정론 대조. + 게임다양성: 트랙별 같은 게임 ≤2개(over2 비면 OK)."
}
$json = $summary | ConvertTo-Json -Depth 6
Write-Output $json

if($Pretty){
  Write-Host "`n── [$Writer] 후보 분류 (오늘 $TODAY) ──" -ForegroundColor Cyan
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
