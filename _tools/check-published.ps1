# check-published.ps1 — '발행됨' 자동 검증기 (인프라팀, 2026-06-04)
# 목적: 발행을 시작할 때마다 BlogPreview 안의 모든 글에 대해
#   ① 글의 작성팀 직원(작성자=최상위 폴더: 봄딩/영도/겜더쿠/연봄)을 판별하고
#   ② 그 작성자의 "실제 블로그"(네이버 봄딩=bomding/영도=kkodug9, 티스토리 겜더쿠=quetermoney/연봄=bom-ding)에서 제목을 수집해
#   ③ 정규화 토큰(문자 bigram) 매칭으로 실제 게시 여부를 검토한 뒤
#   ④ published.json(publishedRels)을 "처음부터" 재생성한다.
#  → build-manifest.ps1 이 이 published.json 을 읽어 manifest.json/posts.json 의 published 플래그를 굽고,
#    사이트(index.html)·PWA(app.js)·안드로이드 앱(manifest.json)이 같은 소스에서 딤드+'발행됨' 라벨을 단다(단일 진실원천).
#
# 왜 만들었나: 이전엔 publishedRels 를 사람이 수동 갱신 → 실제 블로그엔 올라갔는데 목록에 못 넣어 누락되는 사고
#   (예: 봄딩 '이삭토스트 포켓몬 메탈뱃지' 글). 이제 발행 때마다 실제 블로그를 조회해 자동 검토한다.
#
# 안전 원칙(네트워크 실패에 강건):
#   - 어떤 작성자의 블로그 조회가 "통째로 실패"하면 그 작성자의 기존 발행 목록은 건드리지 않는다(오검출로 딤드가 풀리는 사고 방지).
#   - 매칭 false-negative 로 이미 발행 확인된 글이 빠지지 않도록, 기존 확인분은 합집합(union)으로 보존한다.
#     (블로그에서 실제로 글이 내려간 드문 경우엔 -Strict 로 재계산만 반영.)
#
# 실행:  powershell -ExecutionPolicy Bypass -File _tools\check-published.ps1
# 옵션:  -Threshold 0.70  -MaxPages 14  -Strict  -DryRun
param(
  [double]$Threshold = 0.70,   # 제목 거의 동일만 발행으로 확정(문자 bigram overlap-coefficient)
  [int]$MaxPages = 14,         # 네이버 글목록 API 페이지 수(14p ≈ 약 1년치)
  [switch]$Strict,             # 켜면 매칭 결과만 반영(기존 확인분 union 보존 안 함)
  [switch]$DeepTistory,        # ★켜면 티스토리 RSS(20편)+sitemap 전체 글 og:title 수집(백로그 1회 catch-up용, 글마다 1 fetch라 느림). 기본 OFF=RSS만(빠름).
  [switch]$DryRun              # 켜면 published.json 을 쓰지 않고 진단만 출력
)
$ErrorActionPreference = "Stop"
try { $OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue

$base   = Split-Path -Parent $PSScriptRoot   # = BlogPreview 루트
$pubFile = Join-Path $base "published.json"

# 작성자(최상위 폴더) → 실제 블로그 매핑 (staff-registry 정본과 동일)
#   kind: naver = PostTitleListAsync 페이지네이션 / tistory = RSS
$AUTHORS = @{
  "봄딩"   = @{ kind = "naver";   id = "bomding"     }
  "영도"   = @{ kind = "naver";   id = "kkodug9"     }
  "겜더쿠" = @{ kind = "tistory"; id = "quetermoney" }
  "연봄"   = @{ kind = "tistory"; id = "bom-ding"    }   # 2026-06-11 주소 확정(bom-ding.tistory.com)
}

# ── 정규화: 한글/영숫자만 남기고 소문자화(공백·문장부호·이모지 제거) ──
function Norm([string]$s){
  if($null -eq $s){ return "" }
  $t = [System.Net.WebUtility]::HtmlDecode($s)
  $t = $t.ToLowerInvariant()
  # 한글 음절·자모 + 영숫자만 남김
  $t = ($t -replace '[^\p{IsHangulSyllables}\p{IsHangulJamo}a-z0-9]','')
  return $t
}
# 문자 bigram 집합
function Bigrams([string]$norm){
  $set = New-Object System.Collections.Generic.HashSet[string]
  if($norm.Length -le 1){ if($norm.Length -eq 1){ [void]$set.Add($norm) }; return $set }
  for($i=0; $i -lt $norm.Length-1; $i++){ [void]$set.Add($norm.Substring($i,2)) }
  return $set
}
# Jaccard = |A∩B| / |A∪B|  — '제목 거의 동일'을 판정(프랜차이즈명·일반어만 겹치는 오매칭을 합집합이 눌러줌)
# overlap-coefficient = |A∩B| / min(|A|,|B|) — 보조 지표(블로그 SEO 패딩으로 길어진 정탐 보강용)
function Scores($a,$b){
  if($a.Count -eq 0 -or $b.Count -eq 0){ return @{ jac=0.0; ovl=0.0 } }
  $inter = 0; foreach($x in $a){ if($b.Contains($x)){ $inter++ } }
  $union = $a.Count + $b.Count - $inter
  $jac = if($union -gt 0){ [double]$inter / [double]$union } else { 0.0 }
  $den = [Math]::Min($a.Count, $b.Count)
  $ovl = if($den -gt 0){ [double]$inter / [double]$den } else { 0.0 }
  return @{ jac=$jac; ovl=$ovl }
}

# ── 네이버: 글 제목 전체 수집(카테고리 무관 — categoryNo=0) ──
function Get-NaverTitles([string]$blogId,[int]$pages){
  $titles = New-Object System.Collections.Generic.List[string]
  for($p=1; $p -le $pages; $p++){
    $api = "https://blog.naver.com/PostTitleListAsync.naver?blogId=$blogId&viewdate=&currentPage=$p&categoryNo=0&countPerPage=30"
    $a = Invoke-WebRequest -Uri $api -UseBasicParsing -TimeoutSec 20 -Headers @{ "User-Agent"="Mozilla/5.0"; "Referer"="https://blog.naver.com/$blogId" }
    $j = $a.Content | ConvertFrom-Json
    if(-not $j.postList -or $j.postList.Count -eq 0){ break }
    foreach($pl in $j.postList){ $titles.Add([System.Web.HttpUtility]::UrlDecode([string]$pl.title)) }
  }
  return $titles
}
# ── 티스토리: RSS 제목 수집 (+ -DeepTistory 시 sitemap 전체 글 og:title 보강) ──
function Get-TistoryTitles([string]$blogId,[bool]$deep=$false){
  $titles = New-Object System.Collections.Generic.List[string]
  $seen = New-Object System.Collections.Generic.HashSet[string]
  # (a) RSS(최근 ~20편, 1 fetch — 기본·빠름)
  $url = "https://$blogId.tistory.com/rss"
  $a = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 -Headers @{ "User-Agent"="Mozilla/5.0" }
  [xml]$xml = $a.Content
  foreach($item in $xml.rss.channel.item){
    $tt = $item.title
    if($tt -is [System.Xml.XmlElement]){ $tt = $tt.'#cdata-section'; if(-not $tt){ $tt = $item.title.InnerText } }
    if($tt){ $s=[string]$tt; if($seen.Add($s)){ $titles.Add($s) } }
  }
  # (b) -DeepTistory: sitemap 전체 글 URL(/숫자)의 og:title까지 수집해 RSS 20편 한계를 보완(백로그 catch-up).
  #     글마다 1 fetch라 느려서 매 발행 기본 OFF — 연봄처럼 라이브가 RSS 윈도우보다 많이 쌓여 발행 과소집계된 작성자 정정 시 수동 -DeepTistory.
  if($deep){
    try {
      $sm = Invoke-WebRequest -Uri "https://$blogId.tistory.com/sitemap.xml" -UseBasicParsing -TimeoutSec 20 -Headers @{ "User-Agent"="Mozilla/5.0" }
      [xml]$sx = $sm.Content
      $locs = @($sx.urlset.url | ForEach-Object { [string]$_.loc } | Where-Object { $_ -match '/\d+$' })
      $cap = 300; $i = 0
      foreach($loc in $locs){
        if($i -ge $cap){ break }; $i++
        try {
          $pg = Invoke-WebRequest -Uri $loc -UseBasicParsing -TimeoutSec 15 -Headers @{ "User-Agent"="Mozilla/5.0" }
          $mt = [regex]::Match($pg.Content,'(?is)<meta[^>]+property="og:title"[^>]+content="([^"]*)"')
          if(-not $mt.Success){ $mt = [regex]::Match($pg.Content,'(?is)<title>(.*?)</title>') }
          if($mt.Success){ $t = ([System.Net.WebUtility]::HtmlDecode($mt.Groups[1].Value).Trim() -replace '\s*::.*$',''); if($t -and $seen.Add($t)){ $titles.Add($t) } }
        } catch {}
        Start-Sleep -Milliseconds 110
      }
      Write-Host ("  ↳ [{0}] -DeepTistory: sitemap 글 {1}개 og:title 보강(RSS 합산 {2}개)" -f $blogId, $i, $titles.Count) -ForegroundColor DarkCyan
    } catch { Write-Host "  ⚠ [$blogId] sitemap 보강 실패(무시, RSS만 사용): $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  return $titles
}

# ── 1) 글 파일 수집(build-manifest 와 동일 규칙) ──
$files = git -C $base ls-files "봄딩/*.html" "영도/*.html" "겜더쿠/*.html" "연봄/*.html"
$posts = @()
foreach($f in $files){
  $segs = $f -split '/'
  if($segs | Where-Object { $_ -like '_*' -or $_ -like '.*' }){ continue }
  if($f -match '_티스토리_'){ continue }   # 붙여넣기 소스는 글 카드 아님
  $full = Join-Path $base ($f -replace '/','\')
  if(-not (Test-Path $full)){ continue }
  $html = [System.IO.File]::ReadAllText($full,[System.Text.Encoding]::UTF8)
  $title = ""
  $m = [regex]::Match($html,'(?is)<h1[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>(.*?)</h1>')
  if($m.Success){ $title = ($m.Groups[1].Value -replace '(?s)<[^>]+>','') }
  else {   # ★2026-06-26: class 없는 <h1>(연봄 미리보기 등) fallback. 없으면 제목이 topic 폴더명으로 떨어져 라이브 제목과 불일치→발행 과소집계되던 버그(연봄 매칭 3→20편).
    $m = [regex]::Match($html,'(?is)<h1[^>]*>(.*?)</h1>')
    if($m.Success){ $title = ($m.Groups[1].Value -replace '(?s)<[^>]+>','') }
  }
  # 폴더 주제 세그먼트(제목 비었을 때 fallback + 보조 매칭 후보)
  $topic = if($segs.Count -ge 3){ $segs[2] } else { $segs[-1] }
  if([string]::IsNullOrWhiteSpace($title)){ $title = $topic }
  $posts += [pscustomobject]@{
    rel    = $f
    author = $segs[0]
    title  = $title
    topic  = $topic
  }
}

# ── 2) 작성자별 블로그 제목 수집 ──
$authorTitles = @{}     # author → bigram 집합 리스트
$authorRawTitles = @{}  # author → 실제 라이브 제목(원문) — _trend\_live-titles.json 으로 보존(트렌드 dedup 가 직접 대조)
$fetchOk      = @{}     # author → 조회 성공 여부
foreach($author in ($posts | Select-Object -ExpandProperty author -Unique)){
  $meta = $AUTHORS[$author]
  if(-not $meta){ Write-Host "⚠ 미등록 작성자 '$author' — 블로그 매핑 없음, 발행검증 건너뜀" -ForegroundColor Yellow; $fetchOk[$author]=$false; continue }
  try {
    $raw = if($meta.kind -eq "naver"){ Get-NaverTitles $meta.id $MaxPages } else { Get-TistoryTitles $meta.id $DeepTistory }
    $bg = @(); foreach($t in $raw){ $n = Norm $t; if($n.Length -ge 2){ $bg += ,(Bigrams $n) } }
    $authorTitles[$author] = $bg
    $authorRawTitles[$author] = @($raw | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -ne "" })
    $fetchOk[$author] = $true
    Write-Host ("✓ [{0}] {1} 블로그 제목 {2}개 수집" -f $author, $meta.id, $raw.Count) -ForegroundColor Green
  } catch {
    $fetchOk[$author] = $false
    Write-Host ("✗ [{0}] {1} 블로그 조회 실패 — 이 작성자는 기존 발행목록 유지: {2}" -f $author, $meta.id, $_.Exception.Message) -ForegroundColor Red
  }
}

# ── 3) 매칭 → rel별 발행 여부 판정 ──
#   판정 규칙(오탐/누락 동시 억제):
#     · 주(主) 지표 = Jaccard. 제목이 거의 동일하면 합집합이 작아 높게 나온다. ($JacTh 이상이면 발행)
#     · 보조 = overlap-coefficient. 블로그 제목이 SEO로 길어진 정탐을 구제하되, 일반어/프랜차이즈만
#       겹치는 오매칭을 막기 위해 'overlap이 매우 높고(>= $OvlTh) 동시에 Jaccard도 어느 정도(>= $OvlJacFloor)'일 때만 인정.
$JacTh      = 0.70   # 제목 거의 동일 (★2026-07-01 0.55→0.70: 같은 시리즈 제목 오탐 방지. 예 '메이플 제논 육성 가이드' vs '아델 육성 가이드' jac 0.60이 0.55를 넘어 미게시 글이 발행됨 처리→메인뷰서 숨던 사고. 자기매칭은 ~0.95라 0.70로 분리, 기존 확인분은 union 보존이라 드롭 없음)
$OvlTh      = 0.92   # 사이트 제목이 블로그 제목에 거의 그대로 포함(SEO 패딩 정탐 구제)
$OvlJacFloor= 0.40   # 단, 합집합 기준으로도 최소한의 동일성은 있어야(일반어 오매칭 차단)
$matched = @{}    # rel → @{ jac; ovl; pub }  (조회 성공 작성자에 한해)
foreach($pst in $posts){
  if(-not $fetchOk[$pst.author]){ continue }   # 조회 실패 작성자는 판정 보류
  $cand = @($pst.title, $pst.topic) | Where-Object { $_ } | Select-Object -Unique
  $bestJac = 0.0; $bestOvl = 0.0
  foreach($c in $cand){
    $cb = Bigrams (Norm $c)
    foreach($bt in $authorTitles[$pst.author]){
      $sc = Scores $cb $bt
      # 같은 블로그 제목 1개에 대한 (jac,ovl) 쌍 단위로 평가 — 서로 다른 제목의 jac/ovl을 섞지 않음
      if($sc.jac -gt $bestJac){ $bestJac = $sc.jac }
      if($sc.ovl -gt $bestOvl -and $sc.jac -ge $OvlJacFloor){ $bestOvl = $sc.ovl }
    }
  }
  $pub = ($bestJac -ge $JacTh) -or ($bestOvl -ge $OvlTh)
  $matched[$pst.rel] = @{ jac=$bestJac; ovl=$bestOvl; pub=$pub }
}

# ── 4) 기존 published.json 로드 ──
$prev = @{}
$prevList = @()
if(Test-Path $pubFile){
  try {
    $pj = Get-Content $pubFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach($r in @($pj.publishedRels)){ if($r){ $prevList += ([string]$r).Trim() } }
  } catch { Write-Host "⚠ 기존 published.json 파싱 실패 — 빈 목록에서 시작: $($_.Exception.Message)" -ForegroundColor Yellow }
}
foreach($r in $prevList){ $prev[$r] = $true }
$relByAuthor = @{}
foreach($pst in $posts){ $relByAuthor[$pst.rel] = $pst.author }

# ── 5) 새 publishedRels 산출 ──
$newSet = New-Object System.Collections.Generic.HashSet[string]
$added = @(); $kept = @(); $dropped = @()

# (a) 매칭으로 새로 확정
foreach($rel in $matched.Keys){
  if($matched[$rel].pub){
    [void]$newSet.Add($rel)
    if(-not $prev.ContainsKey($rel)){ $added += ("{0}  (jac={1:0.00} ovl={2:0.00})" -f $rel, $matched[$rel].jac, $matched[$rel].ovl) }
  }
}
# (b) 기존 확인분 보존 규칙
foreach($rel in $prevList){
  $author = $relByAuthor[$rel]
  $authorFetched = ($author -and $fetchOk.ContainsKey($author) -and $fetchOk[$author])
  if($newSet.Contains($rel)){ continue }
  if(-not $authorFetched){
    # 조회 실패(또는 디스크에서 사라진 rel)한 작성자 → 기존 발행 표시 유지
    [void]$newSet.Add($rel); $kept += "$rel  (작성자 블로그 조회실패/보류 — 유지)"
  } elseif(-not $Strict){
    # 조회는 됐지만 이번 매칭에선 임계 미만 → false-negative 보호 위해 기본 유지(union)
    [void]$newSet.Add($rel); $kept += "$rel  (이번 매칭 임계미만이나 기존 확인분 보존)"
  } else {
    # -Strict: 실제 블로그에서 더는 매칭 안 됨 → 발행 해제
    $dropped += "$rel  (Strict: 블로그에서 매칭 안 됨 → 발행 해제)"
  }
}

$finalRels = @($newSet) | Sort-Object

# ── 6) 진단 출력 ──
Write-Host "`n── 발행검증 결과 ──" -ForegroundColor Cyan
Write-Host ("총 글 {0}편 / 발행확인 {1}편 (Jaccard>={2:0.00} 또는 overlap>={3:0.00}&jac>={4:0.00})" -f $posts.Count, $finalRels.Count, $JacTh, $OvlTh, $OvlJacFloor)
if($added.Count){   Write-Host "`n[새로 발행확인 추가]" -ForegroundColor Green; $added   | ForEach-Object { Write-Host "  + $_" -ForegroundColor Green } }
if($kept.Count){    Write-Host "`n[기존 유지]" -ForegroundColor DarkGray; $kept    | ForEach-Object { Write-Host "  = $_" -ForegroundColor DarkGray } }
if($dropped.Count){ Write-Host "`n[발행 해제]" -ForegroundColor Yellow; $dropped | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
# 미발행(블로그 조회는 됐으나 매칭 안 된 글) — 참고용
$unpub = @()
foreach($pst in $posts){
  if($fetchOk[$pst.author] -and -not $newSet.Contains($pst.rel)){ $m=$matched[$pst.rel]; $unpub += ("{0}  (jac={1:0.00} ovl={2:0.00})" -f $pst.rel, $m.jac, $m.ovl) }
}
if($unpub.Count){ Write-Host "`n[미발행(블로그 미게시 추정)]" -ForegroundColor DarkGray; $unpub | ForEach-Object { Write-Host "  · $_" -ForegroundColor DarkGray } }

# ── 6.5) 라이브 제목 보존 → _trend\_live-titles.json (트렌드 dedup 가 실제 발행 제목과 직접 대조) ──
#   왜: 트렌드 추천 dedup(classify-picks.ps1)이 '레포 폴더 경로'(published.json)뿐 아니라 '실제 라이브 블로그 제목'과도
#   직접 대조해야, 레포에 글 파일이 없거나 폴더명이 다른 라이브 글까지 재추천을 막을 수 있다(2026-06-25 신설).
#   조회 실패 작성자는 기존 라이브 제목을 보존(거짓 공백 방지). no-BOM UTF-8(JS·PS 양쪽 소비 가능).
if(-not $DryRun){
  try {
    $trendDir = Join-Path $base "_trend"
    if(-not (Test-Path $trendDir)){ New-Item -ItemType Directory -Path $trendDir -Force | Out-Null }
    $liveFile = Join-Path $trendDir "_live-titles.json"
    $byAuthor = [ordered]@{}
    # 기존 보존분 로드(조회 실패 작성자용)
    if(Test-Path $liveFile){
      try {
        $lj = Get-Content $liveFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if($lj.byAuthor){ foreach($p in $lj.byAuthor.PSObject.Properties){ $byAuthor[$p.Name] = @($p.Value) } }
      } catch {}
    }
    foreach($author in $AUTHORS.Keys){
      if($fetchOk.ContainsKey($author) -and $fetchOk[$author] -and $authorRawTitles.ContainsKey($author)){
        $byAuthor[$author] = @($authorRawTitles[$author])   # 이번 조회 성공 → 최신으로 덮어쓰기
      }
      # 조회 실패/미수행 → 기존 $byAuthor[$author] 유지(없으면 키 없음)
    }
    $liveOut = [ordered]@{
      _comment = "실제 라이브 블로그 제목 스냅샷(네이버 PostTitleListAsync 전체 카테고리 + 티스토리 RSS). check-published.ps1 이 발행/dedup 시 갱신. 트렌드 추천 dedup(classify-picks.ps1)이 후보를 이 실제 제목과 직접 대조해 '이미 라이브에 발행된 주제' 재추천을 차단. 티스토리 RSS 는 최근 ~20편만 — 과거 글은 published.json(union 보존)이 보완."
      updatedAt = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
      byAuthor = $byAuthor
    }
    $liveJson = $liveOut | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($liveFile, $liveJson, (New-Object System.Text.UTF8Encoding($false)))
    $cnt = (@($byAuthor.Keys) | ForEach-Object { @($byAuthor[$_]).Count } | Measure-Object -Sum).Sum
    Write-Host ("✓ _live-titles.json 갱신: {0}작성자 / 라이브 제목 {1}개 → {2}" -f @($byAuthor.Keys).Count, $cnt, $liveFile) -ForegroundColor Green
  } catch {
    Write-Host ("⚠ _live-titles.json 기록 실패(무시 가능 — published.json 으로 fallback): {0}" -f $_.Exception.Message) -ForegroundColor Yellow
  }
}

if($DryRun){ Write-Host "`n(DryRun) published.json 미기록." -ForegroundColor Yellow; exit 0 }

# ── 7) published.json 기록 ──
$today = (& git -C $base log -1 --format="%ad" --date=format:"%Y-%m-%d" 2>$null)
if([string]::IsNullOrWhiteSpace($today)){ $today = "" }
$out = [ordered]@{
  _comment = "실제 블로그(네이버 봄딩=bomding/영도=kkodug9, 티스토리 겜더쿠=quetermoney/연봄=bom-ding) 게시 확인된 글. check-published.ps1 이 발행 시작 시 자동 재생성(작성자별 블로그 제목 조회→정규화 bigram 매칭). 사이트는 딤드+'발행됨' 라벨."
  checkedAt = $today
  method = ("작성자별 실제 블로그 제목 수집(네이버 PostTitleListAsync 전체 카테고리 + 티스토리 RSS) → 정규화 문자 bigram 매칭. 발행 판정 = Jaccard>={0:0.00} 또는 (overlap-coefficient>={1:0.00} 그리고 Jaccard>={2:0.00}). 제목 거의 동일만 확정 — 프랜차이즈명/일반어만 겹치는 오매칭 차단. 조회 실패 작성자는 기존 확인분 유지." -f $JacTh, $OvlTh, $OvlJacFloor)
  publishedRels = $finalRels
}
$json = $out | ConvertTo-Json -Depth 5
# no-BOM UTF-8: published.json 은 JS(fetch().json())·PowerShell(-Encoding UTF8) 양쪽이 소비하는 데이터 파일.
#   BOM 을 넣으면 일부 JSON 파서(ConvertFrom-Json 등)가 선두 BOM 에서 실패한다 → BOM 없이 기록.
[System.IO.File]::WriteAllText($pubFile, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("`n✓ published.json 재생성: {0}편 발행확인 → {1}" -f $finalRels.Count, $pubFile) -ForegroundColor Green
