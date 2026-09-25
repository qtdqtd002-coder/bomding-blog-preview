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
#   - ★2026-09-23(감사 F#8): ① 네이버 200 + 빈 postList(0제목)는 «성공한 빈 목록»이 아니라 조회 실패다(fetchOk=false → 기존 목록 유지).
#     ② 새 publishedRels 가 직전 파일 대비 50% 이상 줄면 기록을 거부하고(exit 3) 기존 파일을 유지한다 — 의도된 대량 해제는 -Force 로만.
#   - ★2026-09-25(전수조사 항목 14 · 09-16 «영도 발주→라이브 전환율 감사» 의 본문 n-gram 판정법 이식): titleRewrite 작성자(영도)는
#     제목 매칭이 구조적으로 0 에 수렴하므로, **제목에서 안 걸린 초안만** 라이브 최근 -BodyN(20)편 본문(m.blog.naver.com/<id>/<logNo> 의
#     se-main-container — 영도 fetch-howto §3 과 같은 경로·UA, 새 접근 방식 아님)과 «한글·영숫자만 남긴 정규화 → 글자 -BodyGram(6)-gram
#     집합 중첩(양방향 = |A∩B|/min)» 으로 2차 판정한다. 임계 -BodyThreshold 0.10 — 감사 실측이 매칭 20.5~34.5% vs 무관 0.2~2.1% 로
#     갈려 중간값이 없다(n=6). 봄딩 등 다른 작성자는 종전 제목 bigram(Jaccard≥0.70) 그대로. 가산 전용 — 제목 결과를 지우지 않는다.
#     본문 fetch 실패(HTTP 오류·본문 못 찾음)는 그 편만 건너뛴다(제목 조회 실패와 달리 기존 목록엔 영향 0). -NoBody 로 끌 수 있다.
#
# 실행:  powershell -ExecutionPolicy Bypass -File _tools\check-published.ps1
# 옵션:  -Threshold 0.70  -MaxPages 14  -Strict  -DryRun  -Force(급감 가드 강행)
#        -BodyN 20  -BodyThreshold 0.10  -BodyGram 6  -NoBody(본문 2차 매칭 끔 · 추가 네트워크 0)   ★2026-09-25
param(
  [double]$Threshold = 0.70,   # 제목 거의 동일만 발행으로 확정(문자 bigram overlap-coefficient)
  [int]$MaxPages = 14,         # 네이버 글목록 API 페이지 수(14p ≈ 약 1년치)
  [switch]$Strict,             # 켜면 매칭 결과만 반영(기존 확인분 union 보존 안 함)
  [switch]$DeepTistory,        # ★켜면 티스토리 RSS(20편)+sitemap 전체 글 og:title 수집(백로그 1회 catch-up용, 글마다 1 fetch라 느림). 기본 OFF=RSS만(빠름).
  [switch]$DryRun,             # 켜면 published.json 을 쓰지 않고 진단만 출력
  [switch]$Force,              # ★2026-09-23: 발행확인 편수가 직전 파일 대비 절반 아래로 «급감»해도 기록을 강행(의도된 대량 해제일 때만)
  [int]$BodyN = 20,            # ★2026-09-25: titleRewrite 작성자(영도)의 라이브 본문 fetch 편수(글목록 최신순 · 네트워크 최소)
  [double]$BodyThreshold = 0.10, # ★2026-09-25: 본문 n-gram 중첩 임계(09-16 감사: 매칭 20.5~34.5% vs 무관 0.2~2.1% — 10% 로 갈림)
  [int]$BodyGram = 6,          # ★2026-09-25: 글자 n-gram 길이(감사 기준 n=6)
  [switch]$NoBody              # ★2026-09-25: 본문 2차 매칭 끄기(제목만 · 추가 네트워크 0)
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
  # ★titleRewrite: 저자가 우리 제목을 그대로 쓰지 않고 새로 쓰는 작성자.
  #   제목 유사도 판정이 구조적으로 무의미하므로 '미게시 추정'이 아니라 '판정 보류'로 뺀다(§6 진단 출력).
  #   2026-08-08 사용자 확인: 영도는 제목·본문을 크게 고쳐서 게시한다.
  "영도"   = @{ kind = "naver";   id = "kkodug9"; titleRewrite = $true }
  "겜더쿠" = @{ kind = "tistory"; id = "quetermoney" }
  "연봄"   = @{ kind = "tistory"; id = "bom-ding"    }   # 2026-06-11 주소 확정(bom-ding.tistory.com)
  "하루살이" = @{ kind = "naver";   id = "harusale-"  }   # 2026-07-22 신설(blog.naver.com/harusale-)
}

# ★2026-09-25: 네이버 글목록(PostTitleListAsync)에서 제목과 함께 받은 logNo(페이지 순 = 최신순).
#   본문 2차 매칭이 «최근 -BodyN 편»을 고를 때 쓴다 — 목록 조회는 이미 하던 것이라 추가 네트워크 0.
$script:NaverLogNos = @{}

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
# ★2026-09-23(F#8②) — 급감 가드. 직전 파일에 N편이 있었는데 새 결과가 N×(1-MinDrop) 미만이면 «조회 오류»로 본다(기록 거부).
#   직전이 비어 있으면(첫 생성) 언제나 통과. 반환 = $true(기록 가능) / $false(거부).
function Test-RelsPlausible([int]$prevCount,[int]$newCount,[double]$MinDrop=0.5){
  if($prevCount -le 0){ return $true }
  return ([double]$newCount -ge ([double]$prevCount * (1.0 - $MinDrop)))
}

# ── ★2026-09-25 본문 n-gram 2차 매칭(영도) — 09-16 감사 «본문 n-gram 판정법» 이식 ──
# 글자 n-gram 집합(정규화 문자열 → 길이 n 창). Bigrams 와 같은 꼴, n 만 다르다.
function Ngrams([string]$norm,[int]$n){
  $set = New-Object System.Collections.Generic.HashSet[string]
  if($norm.Length -lt $n){ return ,$set }   # ★«,$set» — 컬렉션을 그대로 반환하면 파이프라인이 원소로 풀어 Object[] 가 된다(HashSet 유지)
  $last = $norm.Length - $n
  for($i=0; $i -le $last; $i++){ [void]$set.Add($norm.Substring($i,$n)) }
  return ,$set
}
# 양방향 중첩 = |A∩B| / min(|A|,|B|) (= max(|A∩B|/|A|, |A∩B|/|B|)). 영도는 초안을 20~35% 만 남기고 재작성하므로 «초안 쪽 포함률»이
# 신호이고, 라이브가 초안보다 짧게 잘렸을 땐 «라이브 쪽 포함률»이 신호다 — 둘 중 큰 쪽. (New-Object 에 컬렉션을 넘기면 풀리므로 UnionWith 로 복사)
function BodyOverlap($a,$b){
  if($a.Count -eq 0 -or $b.Count -eq 0){ return 0.0 }
  $tmp = New-Object System.Collections.Generic.HashSet[string]
  $tmp.UnionWith([System.Collections.Generic.HashSet[string]]$a)
  $tmp.IntersectWith([System.Collections.Generic.HashSet[string]]$b)
  $den = [Math]::Min($a.Count, $b.Count)
  return ([double]$tmp.Count / [double]$den)
}
# 초안 HTML → .post 본문 정규화 문자열. 네이버 위젯 서랍(#npBtn·#copy·안내문)은 preflight.py WIDGET_MARKS 와 같은 표식에서 자른다.
function Get-DraftBodyNorm([string]$html){
  # ★순서가 중요하다 — preflight.py split_post_copy 와 같이 «script·style·주석을 먼저 지우고» 그 다음 위젯 표식에서 자른다.
  #   초안 <style> 안 주석에 «네이버 붙여넣기 위젯» 이 있어 먼저 자르면 CSS 3KB 만 남는다(2026-09-25 실측 — 초안 정규화 머리가 CSS 토큰이었고 중첩 0.9%).
  $t = [regex]::Replace($html,'(?is)<(script|style)[^>]*>.*?</\1>',' ')
  $t = [regex]::Replace($t,'(?s)<!--.*?-->',' ')
  $cut = $t.Length
  foreach($mk in @('id="npBtn"',"id='npBtn'",'id="copy"',"id='copy'",'네이버 붙여넣기 위젯')){
    $i = $t.IndexOf($mk); if($i -ge 0 -and $i -lt $cut){ $cut = $i }
  }
  $t = $t.Substring(0,$cut)
  $t = [regex]::Replace($t,'(?s)<[^>]+>',' ')
  return (Norm $t)
}
# 라이브 글 본문(모바일 페이지 · 로그인 불필요 · 영도 fetch-howto §3 과 같은 URL·UA). se-main-container 부터 공감/공유 영역(social_plugin) 앞까지.
# 끝 표식이 없으면 나머지 전부를 쓴다(중첩식이 min 분모라 꼬리 잡음은 판정을 흔들지 않는다). 실패는 '' — 호출부가 그 편만 건너뛴다.
function Get-NaverBodyNorm([string]$blogId,[string]$logNo){
  $u = "https://m.blog.naver.com/$blogId/$logNo"
  $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 25 -Headers @{ "User-Agent"="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"; "Referer"="https://m.blog.naver.com/$blogId" }
  $html = $r.Content
  $start = $html.IndexOf('class="se-main-container"')
  if($start -lt 0){ return "" }
  $start = $html.IndexOf('>',$start); if($start -lt 0){ return "" }
  $end = $html.Length
  foreach($mk in @('social_plugin_property','class="_checkVisible','id="footer"','class="post_footer')){
    $i = $html.IndexOf($mk,$start); if($i -ge 0 -and $i -lt $end){ $end = $i }
  }
  $t = $html.Substring($start,$end-$start)
  $t = [regex]::Replace($t,'(?is)<(script|style)[^>]*>.*?</\1>',' ')
  $t = [regex]::Replace($t,'(?s)<[^>]+>',' ')
  return (Norm $t)
}

# ── 네이버: 글 제목 전체 수집(카테고리 무관 — categoryNo=0) ──
function Get-NaverTitles([string]$blogId,[int]$pages){
  $titles = New-Object System.Collections.Generic.List[string]
  $logNos = New-Object System.Collections.Generic.List[string]   # ★2026-09-25: 본문 2차 매칭용(제목과 같은 응답에서)
  for($p=1; $p -le $pages; $p++){
    $api = "https://blog.naver.com/PostTitleListAsync.naver?blogId=$blogId&viewdate=&currentPage=$p&categoryNo=0&countPerPage=30"
    $a = Invoke-WebRequest -Uri $api -UseBasicParsing -TimeoutSec 20 -Headers @{ "User-Agent"="Mozilla/5.0"; "Referer"="https://blog.naver.com/$blogId" }
    $j = $a.Content | ConvertFrom-Json
    if(-not $j.postList -or $j.postList.Count -eq 0){ break }
    foreach($pl in $j.postList){
      $titles.Add([System.Web.HttpUtility]::UrlDecode([string]$pl.title))
      if($pl.logNo){ [void]$logNos.Add([string]$pl.logNo) }
    }
  }
  # ★2026-09-23(F#8①) — 0제목 fetch 는 실패다. 네이버는 차단·오류 때도 200 + 빈 postList 를 줄 수 있어, 이걸 성공으로 보면
  #   -Strict 에서 전부 drop · 기본 모드에서도 라이브 제목 스냅샷(_live-titles.json)이 빈 값으로 덮인다. 호출부 catch 가 fetchOk=false 로 받는다.
  if($titles.Count -eq 0){ throw ("네이버 {0}: 제목 0개(HTTP 200 + 빈 postList) — 조회 실패로 처리" -f $blogId) }
  $script:NaverLogNos[$blogId] = $logNos
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
  if($titles.Count -eq 0){ throw ("티스토리 {0}: RSS 제목 0개 — 조회 실패로 처리(2026-09-23 F#8①)" -f $blogId) }
  return $titles
}

# ── 1) 글 파일 수집(build-manifest 와 동일 규칙) ──
# ★2026-08-04: 김복리 작성자 폐지 — AUTHORS·수집 목록에서 제거(2026-07-22에 메운 갭 자체가 소멸).
$files = git -C $base ls-files "봄딩/*.html" "영도/*.html" "겜더쿠/*.html" "연봄/*.html" "하루살이/*.html"
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

# ── 3.5) ★2026-09-25 본문 n-gram 2차 매칭 — titleRewrite 작성자(영도)만. 제목에서 안 걸린 초안 ↔ 라이브 최근 $BodyN 편 본문 ──
#   방법 = 쓰담/docs/2026-09-16_영도_발주-라이브발행_전환율_감사.md «방법» 4항 그대로(한글·영숫자 정규화 → 글자 n-gram 집합 중첩 · 양방향).
#   가산 전용: 여기서 pub=$true 로 뒤집을 뿐 제목 매칭 결과를 지우지 않는다. 본문 fetch 가 통째로 실패해도 §5(b) union 보존은 그대로다.
$bodyInfo = @{}   # author → @{ tried; fetched; cands; matched; failed }
if(-not $NoBody){
  foreach($author in ($posts | Select-Object -ExpandProperty author -Unique)){
    $meta = $AUTHORS[$author]
    if(-not $meta -or -not $meta.titleRewrite -or $meta.kind -ne "naver"){ continue }
    if(-not $fetchOk[$author]){ continue }
    $logs = @(); if($script:NaverLogNos.ContainsKey($meta.id)){ $logs = @($script:NaverLogNos[$meta.id] | Select-Object -First $BodyN) }
    $cands = @($posts | Where-Object { $_.author -eq $author -and $matched.ContainsKey($_.rel) -and -not $matched[$_.rel].pub })
    $info = @{ tried=$logs.Count; fetched=0; cands=$cands.Count; matched=0; failed=@() }
    if($logs.Count -eq 0 -or $cands.Count -eq 0){ $bodyInfo[$author] = $info; continue }
    # (a) 라이브 본문 → n-gram 집합 (편당 1 fetch · 300ms 간격 · 200자 미만은 본문 못 찾은 것으로 본다)
    $live = @()
    foreach($ln in $logs){
      try {
        $nb = Get-NaverBodyNorm $meta.id $ln
        if($nb.Length -ge 200){ $live += ,@{ logNo=$ln; set=(Ngrams $nb $BodyGram); len=$nb.Length }; $info.fetched = $info.fetched + 1 }
        else { $info.failed += ("{0}(본문 {1}자)" -f $ln, $nb.Length) }
      } catch { $info.failed += ("{0}({1})" -f $ln, $_.Exception.Message) }
      Start-Sleep -Milliseconds 300
    }
    # (b) 초안 .post 본문 ↔ 각 라이브 본문 중첩 — 최고점이 임계 이상이면 발행 확정
    foreach($pst in $cands){
      $full = Join-Path $base ($pst.rel -replace '/','\')
      if(-not (Test-Path $full)){ continue }
      $dn = Get-DraftBodyNorm ([System.IO.File]::ReadAllText($full,[System.Text.Encoding]::UTF8))
      $ds = Ngrams $dn $BodyGram
      if($ds.Count -lt 200){ continue }
      $best = 0.0; $bestNo = ""
      foreach($lv in $live){ $sc = BodyOverlap $ds $lv.set; if($sc -gt $best){ $best = $sc; $bestNo = $lv.logNo } }
      $matched[$pst.rel].body = $best; $matched[$pst.rel].logNo = $bestNo
      if($best -ge $BodyThreshold){ $matched[$pst.rel].pub = $true; $matched[$pst.rel].via = "body"; $info.matched = $info.matched + 1 }
    }
    $bodyInfo[$author] = $info
    Write-Host ("✓ [{0}] 본문 2차 매칭: 라이브 최근 {1}편 중 본문 {2}편 수집 · 제목 미매칭 초안 {3}편 대조 · 본문으로 확정 {4}편 (n={5} · 임계 {6:P0})" -f $author, $info.tried, $info.fetched, $info.cands, $info.matched, $BodyGram, $BodyThreshold) -ForegroundColor Green
    if($info.failed.Count){ Write-Host ("  ⚠ 본문 못 받은 라이브 글 {0}편: {1}" -f $info.failed.Count, (($info.failed | Select-Object -First 5) -join ', ')) -ForegroundColor Yellow }
  }
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
    if(-not $prev.ContainsKey($rel)){
      if($matched[$rel].via -eq "body"){ $added += ("{0}  (본문 {1}-gram={2:P1} ↔ logNo {3})" -f $rel, $BodyGram, $matched[$rel].body, $matched[$rel].logNo) }
      else { $added += ("{0}  (jac={1:0.00} ovl={2:0.00})" -f $rel, $matched[$rel].jac, $matched[$rel].ovl) }
    }
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
Write-Host ("총 글 {0}편 / 발행확인 {1}편 (Jaccard>={2:0.00} 또는 overlap>={3:0.00}&jac>={4:0.00}{5})" -f $posts.Count, $finalRels.Count, $JacTh, $OvlTh, $OvlJacFloor, $(if($NoBody){""}else{(" · 영도 본문 {0}-gram>={1:0.00}" -f $BodyGram, $BodyThreshold)}))
# ★2026-09-25: 작성자별 전후(직전 파일 → 이번 결과) — 본문 2차 매칭 효과를 한눈에(-DryRun 보고용 · 기록과 무관).
$byPrev = @{}; foreach($r in $prevList){ $a0 = ($r -split '/')[0]; if(-not $byPrev.ContainsKey($a0)){ $byPrev[$a0] = 0 }; $byPrev[$a0] = $byPrev[$a0] + 1 }
$byNew  = @{}; foreach($r in $finalRels){ $a0 = ($r -split '/')[0]; if(-not $byNew.ContainsKey($a0)){ $byNew[$a0] = 0 }; $byNew[$a0] = $byNew[$a0] + 1 }
$byTot  = @{}; foreach($pst in $posts){ if(-not $byTot.ContainsKey($pst.author)){ $byTot[$pst.author] = 0 }; $byTot[$pst.author] = $byTot[$pst.author] + 1 }
foreach($a0 in ($byTot.Keys | Sort-Object)){
  $bi = $bodyInfo[$a0]
  $tail = if($bi){ (" · 본문 2차: 라이브 {0}편 수집 / 초안 {1}편 대조 / 확정 {2}편" -f $bi.fetched, $bi.cands, $bi.matched) } else { "" }
  $pv = if($byPrev.ContainsKey($a0)){ $byPrev[$a0] } else { 0 }
  $nw = if($byNew.ContainsKey($a0)){ $byNew[$a0] } else { 0 }
  Write-Host ("  {0,-6} 글 {1,4}편 · 발행확인 {2,4} → {3,4}{4}" -f $a0, $byTot[$a0], $pv, $nw, $tail)
}
if($added.Count){   Write-Host "`n[새로 발행확인 추가]" -ForegroundColor Green; $added   | ForEach-Object { Write-Host "  + $_" -ForegroundColor Green } }
if($kept.Count){    Write-Host "`n[기존 유지]" -ForegroundColor DarkGray; $kept    | ForEach-Object { Write-Host "  = $_" -ForegroundColor DarkGray } }
if($dropped.Count){ Write-Host "`n[발행 해제]" -ForegroundColor Yellow; $dropped | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
# 미발행(블로그 조회는 됐으나 매칭 안 된 글) — 참고용
# ★2026-08-08 — '미발행 추정'과 '판정 불가'를 분리한다.
#   사고: 영도 66편 중 12편만 매칭돼 게재율 18%로 보고됐는데, 사용자 확인 결과 **미게재가 아니라
#   저자가 제목·본문을 크게 고쳐서 게시**하고 있었다. 이 지표는 제목 유사도라 **제목을 새로 쓰는
#   작성자에겐 구조적으로 0에 수렴**한다 — "미게시 추정"이라는 라벨 자체가 오진단이었다.
#   ⇒ titleRewrite 작성자는 '판정 보류'로 분리해 표기한다. publishedRels 는 건드리지 않는다
#      (근거 없이 발행으로 처리하면 반대 방향 거짓이 된다 — 우리는 '모른다'가 정답이다).
$rewriteAuthors = @($AUTHORS.Keys | Where-Object { $AUTHORS[$_].titleRewrite })
$unpub = @(); $undetermined = @()
foreach($pst in $posts){
  if($fetchOk[$pst.author] -and -not $newSet.Contains($pst.rel)){
    $m=$matched[$pst.rel]
    $bodyTag = if($null -ne $m.body){ (" body={0:P1}" -f $m.body) } else { "" }
    $line = ("{0}  (jac={1:0.00} ovl={2:0.00}{3})" -f $pst.rel, $m.jac, $m.ovl, $bodyTag)
    if($rewriteAuthors -contains $pst.author){ $undetermined += $line } else { $unpub += $line }
  }
}
if($unpub.Count){ Write-Host "`n[미발행(블로그 미게시 추정)]" -ForegroundColor DarkGray; $unpub | ForEach-Object { Write-Host "  · $_" -ForegroundColor DarkGray } }
if($undetermined.Count){
  Write-Host ("`n[판정 보류 — 제목 재작성형 작성자({0}). 이 지표로는 게재 여부를 알 수 없다]" -f ($rewriteAuthors -join ',')) -ForegroundColor Yellow
  Write-Host "  ※ 게재율로 읽지 말 것. 낮은 매칭률은 '안 올렸다'가 아니라 '제목이 달라 못 잰다'는 뜻이다." -ForegroundColor Yellow
  Write-Host ("  ※ ★2026-09-25 본문 2차 매칭(라이브 최근 {0}편 창)에서도 안 걸린 글이다 — 창 밖(오래된 글)이거나 아직 미게시. body= 는 창 안 최고 중첩률." -f $BodyN) -ForegroundColor Yellow
  $undetermined | ForEach-Object { Write-Host "  ? $_" -ForegroundColor DarkYellow }
}

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

# ── 6.9) 급감 가드(★2026-09-23 F#8②) — 직전 파일 대비 −50% 이상이면 기록 거부·경고(기존 파일 유지) ──
$plausible = Test-RelsPlausible $prevList.Count $finalRels.Count 0.5
$dropRatio = $(if($prevList.Count -gt 0){ [double]$finalRels.Count / [double]$prevList.Count } else { 1.0 })
if($DryRun){
  if(-not $plausible){ Write-Host ("`n(DryRun) ⛔ 급감 가드에 걸린다: 발행확인 {0}편 → {1}편(직전 대비 {2:P0}) — LIVE 였다면 기록 거부(exit 3)" -f $prevList.Count, $finalRels.Count, $dropRatio) -ForegroundColor Red }
  else { Write-Host ("`n(DryRun) 급감 가드 통과: {0}편 → {1}편(직전 대비 {2:P0})" -f $prevList.Count, $finalRels.Count, $dropRatio) -ForegroundColor DarkGray }
  Write-Host "(DryRun) published.json 미기록." -ForegroundColor Yellow; exit 0
}
if(-not $Force -and -not $plausible){
  Write-Host ("`n⛔ published.json 기록 거부: 발행확인 {0}편 → {1}편(직전 대비 {2:P0}) — 절반 아래로 급감한 결과는 조회 오류로 본다. 기존 파일을 유지한다. 의도된 대량 해제면 -Force." -f $prevList.Count, $finalRels.Count, $dropRatio) -ForegroundColor Red
  exit 3
}

# ── 7) published.json 기록 ──
$today = (& git -C $base log -1 --format="%ad" --date=format:"%Y-%m-%d" 2>$null)
if([string]::IsNullOrWhiteSpace($today)){ $today = "" }
$out = [ordered]@{
  _comment = "실제 블로그(네이버 봄딩=bomding/영도=kkodug9, 티스토리 겜더쿠=quetermoney/연봄=bom-ding) 게시 확인된 글. check-published.ps1 이 발행 시작 시 자동 재생성(작성자별 블로그 제목 조회→정규화 bigram 매칭). 사이트는 딤드+'발행됨' 라벨."
  checkedAt = $today
  method = (("작성자별 실제 블로그 제목 수집(네이버 PostTitleListAsync 전체 카테고리 + 티스토리 RSS) → 정규화 문자 bigram 매칭. 발행 판정 = Jaccard>={0:0.00} 또는 (overlap-coefficient>={1:0.00} 그리고 Jaccard>={2:0.00}). 제목 거의 동일만 확정 — 프랜차이즈명/일반어만 겹치는 오매칭 차단. 조회 실패 작성자는 기존 확인분 유지." -f $JacTh, $OvlTh, $OvlJacFloor) + $(if($NoBody){ " 본문 2차 매칭 꺼짐(-NoBody)." } else { (" 제목 재작성형 작성자(영도)는 제목 미매칭 글을 라이브 최근 {0}편 본문(m.blog.naver.com se-main-container)과 정규화 글자 {1}-gram 집합 중첩(양방향 |A∩B|/min)>={2:0.00} 로 2차 확정(2026-09-25 · 09-16 감사 방법)." -f $BodyN, $BodyGram, $BodyThreshold) }))
  publishedRels = $finalRels
}
$json = $out | ConvertTo-Json -Depth 5
# no-BOM UTF-8: published.json 은 JS(fetch().json())·PowerShell(-Encoding UTF8) 양쪽이 소비하는 데이터 파일.
#   BOM 을 넣으면 일부 JSON 파서(ConvertFrom-Json 등)가 선두 BOM 에서 실패한다 → BOM 없이 기록.
[System.IO.File]::WriteAllText($pubFile, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("`n✓ published.json 재생성: {0}편 발행확인 → {1}" -f $finalRels.Count, $pubFile) -ForegroundColor Green
