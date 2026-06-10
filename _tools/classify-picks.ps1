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

# ── 후보 읽기 ──
$rawCands = @()
if($CandidatesFile){ $rawCands = Get-Content -Path $CandidatesFile -Encoding UTF8 | Where-Object { $_.Trim() -ne "" } }
else { $rawCands = @($input) | Where-Object { $_.Trim() -ne "" } }

# ── 분류 ──
$results = @()
foreach($raw in $rawCands){
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

  # 3) 상태 확정(우선순위: published > review > carried > new)
  $status = "new"; $reason = "직전 브리핑에 없던 신규"
  if($bestPub -and $bestPub.isPub){
    $status = "published"
    $reason = "발행완료: $($bestPub.game)/$($bestPub.topic) (anchor=$($bestPub.anchor), jac=$($bestPub.jac), 공유키워드=$([string]::Join('·',$bestPub.sharedHard)))"
  } elseif($bestPub -and $bestPub.tier -eq "review"){
    $status = "review"
    $reason = "같은 게임 약한 겹침(새 각도 가능): $($bestPub.game)/$($bestPub.topic) — 채택하려면 '새 각도' 근거 명시"
  } elseif($carried){
    $status = "carried"
    $reason = "이월: 직전 $($daysList.Count)개 브리핑에 등장(최근 $($daysList[0]))"
  }
  $chip = switch($status){ "published"{"✅"} "review"{"🟡"} "carried"{"🔄"} default{"🆕"} }

  $results += [pscustomobject]@{
    pick = $clean
    raw = $raw.Trim()
    status = $status
    chip = $chip
    carryDays = $(if($carried){$carryN}else{$null})
    matchedPublished = $(if($bestPub -and ($bestPub.isPub -or $bestPub.tier -eq 'review')){ "$($bestPub.game)/$($bestPub.topic)" }else{$null})
    reason = $reason
  }
}

# ── 출력 ──
$summary = [ordered]@{
  writer = $Writer
  date = $TODAY
  publishedCount = @($pubTopics).Count
  prevIssues = @($prevByDate | ForEach-Object { $_.date })
  results = $results
  rule = "✅발행완료=5선 제외(→최근발행 띠) · 🟡review=기본 제외(새 각도 근거시 채택) · 🔄이월/🆕신규=5선. published.json+trend.json 결정론 대조."
}
$json = $summary | ConvertTo-Json -Depth 6
Write-Output $json

if($Pretty){
  Write-Host "`n── [$Writer] 후보 분류 (오늘 $TODAY) ──" -ForegroundColor Cyan
  foreach($r in $results){
    $col = switch($r.status){ "published"{"Red"} "review"{"Yellow"} "carried"{"DarkYellow"} default{"Green"} }
    Write-Host ("{0} [{1}] {2}" -f $r.chip, $r.status, $r.pick) -ForegroundColor $col
    Write-Host ("      └ {0}" -f $r.reason) -ForegroundColor DarkGray
  }
  $pub = @($results | Where-Object { $_.status -eq 'published' }).Count
  $rev = @($results | Where-Object { $_.status -eq 'review' }).Count
  Write-Host ("`n→ 5선 제외 권고: ✅{0} 🟡{1} / 5선 가능: {2}" -f $pub, $rev, ($results.Count-$pub-$rev)) -ForegroundColor Cyan
}
