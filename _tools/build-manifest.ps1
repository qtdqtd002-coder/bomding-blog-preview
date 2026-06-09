# build-manifest.ps1 — manifest.json 단일 진실원천 재생성 (인프라팀)
# 정책: 글 HTML은 git이 단일 진실원천. 매 발행마다 이 스크립트로 manifest를 "처음부터" 재생성한다.
#   - created : 최초 등록일 = 그 파일의 첫 커밋(--diff-filter=A) 시각  ← 목록 표기·정렬 기준
#   - updated : 마지막 수정일 = 그 파일의 마지막 커밋 시각
#   - date    : 구버전 index.html 호환용 별칭(= created)
# 검증: 디스크에 커밋된 봄딩/영도 글이 전부 manifest에 들어갔는지 확인하고, 누락이 있으면 빨간 경고 + 비정상 종료.
#       (예전에 새 글 2편이 manifest에서 빠졌던 사고 재발 방지)
# 실행: pwsh -File _tools\build-manifest.ps1   또는   powershell -File _tools\build-manifest.ps1
$ErrorActionPreference = "Stop"
# 콘솔/네이티브 인자 인코딩을 UTF-8로 고정(한글 경로·git 인자 안전). 런처(bash 경유 등)와 무관하게 일관 동작.
try { $OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$base = Split-Path -Parent $PSScriptRoot   # = BlogPreview 루트

# ★발행 시작 시 '발행됨' 자동 검증(2026-06-04, 인프라실)★
#   매 발행마다 모든 글의 작성팀 직원(작성자)을 판별하고, 그 작성자의 실제 블로그(네이버/티스토리)에서
#   제목을 조회해 게시 여부를 검토 → published.json 을 재생성한다. 그 뒤 아래에서 그 결과를 읽어
#   manifest/posts.json 의 published 플래그를 굽는다. 즉 PC팀(사이트)·모바일팀(PWA·앤드로이드 앱)이
#   어떤 글을 발행하든 같은 검증을 거쳐 '발행됨' 딤드+라벨이 자동 반영된다(단일 진실원천).
#   - 네트워크 실패 등으로 검증이 실패해도 기존 published.json 으로 폴백(빌드는 계속).
#   - 끄려면: 환경변수 SKIP_PUBLISH_CHECK=1 (오프라인/CI 등).
if($env:SKIP_PUBLISH_CHECK -ne "1"){
  $chk = Join-Path $PSScriptRoot "check-published.ps1"
  if(Test-Path $chk){
    Write-Host "▶ 발행됨 자동 검증 실행(check-published.ps1) — 작성자별 실제 블로그 대조…" -ForegroundColor Cyan
    try {
      & $chk
      if($LASTEXITCODE -and $LASTEXITCODE -ne 0){ Write-Host "⚠ check-published 종료코드 $LASTEXITCODE — 기존 published.json 으로 진행" -ForegroundColor Yellow }
    } catch {
      Write-Host "⚠ 발행됨 검증 실패 — 기존 published.json 으로 폴백: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  } else { Write-Host "⚠ check-published.ps1 없음 — 발행됨 자동 검증 건너뜀(기존 published.json 사용)" -ForegroundColor Yellow }
} else { Write-Host "ℹ SKIP_PUBLISH_CHECK=1 — 발행됨 자동 검증 건너뜀(기존 published.json 사용)" -ForegroundColor DarkGray }

# 발행됨(실제 블로그 게시 확인) 집합 로드 — published.json 의 publishedRels(글 rel 경로 목록).
#   check-published.ps1(위)이 발행 때마다 자동 갱신한다. (수동 보정도 가능 — 같은 파일이 단일 진실원천.)
#   이 재빌드로 사이트·PWA·안드로이드가 같은 소스(manifest/posts.json 의 published 플래그)에서 '발행됨'을 표시한다.
$pubSet = New-Object System.Collections.Generic.HashSet[string]
$pubFile = Join-Path $base "published.json"
if(Test-Path $pubFile){
  try {
    $pj = Get-Content $pubFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach($rel in @($pj.publishedRels)){ if($rel){ [void]$pubSet.Add(([string]$rel).Trim()) } }
  } catch { Write-Host "⚠ published.json 파싱 실패 — 발행됨 플래그 없이 진행: $($_.Exception.Message)" -ForegroundColor Yellow }
}

function Strip([string]$h){
  if($null -eq $h){return ""}
  $t = $h -replace '(?s)<[^>]+>',''
  $t = $t -replace '&nbsp;',' ' -replace '&amp;','&' -replace '&lt;','<' -replace '&gt;','>' -replace '&quot;','"' -replace '&#39;',"'"
  return ($t -replace '\s+',' ').Trim()
}
function GitDate([string]$fmtArgs, [string]$file){
  # %ad = author date; 첫 커밋이면 --diff-filter=A 로 추가 시점만
  $out = & git -C $base log @($fmtArgs -split ' ') --date=format:"%Y-%m-%d %H:%M:%S" -- $file
  return $out
}

# 1) 글 파일 수집 — 봄딩/영도/겜더쿠/연봄 하위의 커밋된 *.html 만 (index, _접두 폴더 제외)
$files = git -C $base ls-files "봄딩/*.html" "영도/*.html" "겜더쿠/*.html" "연봄/*.html"
$map = [ordered]@{}
$missing = @()

foreach($f in $files){
  $segs = $f -split '/'
  if($segs | Where-Object { $_ -like '_*' -or $_ -like '.*' }){ continue }
  # 티스토리 '붙여넣기·발행 소스'(_티스토리_, 겜더쿠·연봄)는 사이트 목록에 띄우지 않음 — 발행용 본문이라 글 카드 아님
  # (_워드프레스_는 2026-06-09 연봄 티스토리 전환으로 폐기됐으나, 혹시 남은 레거시 파일 대비 필터 유지)
  if($f -match '_티스토리_' -or $f -match '_워드프레스_'){ continue }

  $full = Join-Path $base ($f -replace '/','\')
  if(-not (Test-Path $full)){ continue }
  $html = [System.IO.File]::ReadAllText($full,[System.Text.Encoding]::UTF8)

  # 최초 등록일(created) = 첫 커밋, 마지막 수정일(updated) = 최신 커밋
  $created = (& git -C $base log --diff-filter=A --follow --format="%ad" --date=format:"%Y-%m-%d %H:%M:%S" -- $f | Select-Object -Last 1)
  $updated = (& git -C $base log -1 --format="%ad" --date=format:"%Y-%m-%d %H:%M:%S" -- $f)
  if([string]::IsNullOrWhiteSpace($created)){ $created = $updated }
  # 커밋 안 된 글은 git 날짜가 비어버림 → 빈 날짜로 발행되는 사고 방지(검증에서 잡음)
  if([string]::IsNullOrWhiteSpace($created)){ $missing += "등록일 비어있음(먼저 커밋 후 재생성 필요): $f" }

  $title=""; $cat=""; $excerpt=""
  $m=[regex]::Match($html,'(?is)<h1[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>(.*?)</h1>'); if($m.Success){$title=Strip $m.Groups[1].Value}
  $m=[regex]::Match($html,'(?is)<div[^>]*class="[^"]*\bcat\b[^"]*"[^>]*>(.*?)</div>'); if($m.Success){$cat=Strip $m.Groups[1].Value}
  $m=[regex]::Match($html,'(?is)<p[^>]*>(.*?)</p>'); if($m.Success){$ex=Strip $m.Groups[1].Value; if($ex.Length -gt 110){$ex=$ex.Substring(0,110).TrimEnd()+'…'}; $excerpt=$ex}

  $len=0; foreach($pp in [regex]::Matches($html,'(?is)<p[^>]*>(.*?)</p>')){ $len += (Strip $pp.Groups[1].Value).Length }
  $readmin=[math]::Max(1,[math]::Ceiling($len/350.0))

  $author=$segs[0]
  $group = if($segs.Count -ge 3){$segs[1]}else{""}
  if([string]::IsNullOrWhiteSpace($title)){ $title = if($segs.Count -ge 3){$segs[2]}else{$segs[-1]}; $missing += "제목없음: $f" }

  $isPub = $pubSet.Contains($f)
  $map[$f]=[ordered]@{ created=$created; updated=$updated; date=$created; title=$title; cat=$cat; excerpt=$excerpt; author=$author; group=$group; readmin=$readmin; published=$isPub }
}

# 2) 검증 — 디스크의 모든 글이 manifest에 들어갔는지 (누락=사고)
$onDisk = (Get-ChildItem -Path (Join-Path $base "봄딩"),(Join-Path $base "영도"),(Join-Path $base "겜더쿠"),(Join-Path $base "연봄") -Recurse -Filter *.html -ErrorAction SilentlyContinue |
           ForEach-Object { $_.FullName.Substring($base.Length).TrimStart('\','/') -replace '\\','/' })
foreach($d in $onDisk){
  if($d -match '_티스토리_' -or $d -match '_워드프레스_'){ continue }   # 붙여넣기·발행 소스는 목록 비대상 → 누락 검증에서 제외
  if(-not $map.Contains($d)){ $missing += "manifest 누락(디스크에만 존재, 커밋 필요): $d" }
}

# ★안전장치: 글이 0편이면(= git ls-files가 환경문제로 빈 결과를 냈을 가능성) manifest를 덮어쓰지 않는다.
#   (예전 사고: bash 경유 실행 시 빈 맵으로 manifest.json/posts.json이 {}로 날아감 → 데이터 소실)
if($map.Count -eq 0){
  Write-Host "✗ 수집된 글이 0편입니다. manifest를 덮어쓰지 않고 중단합니다(환경/실행 문제 의심 — 네이티브 PowerShell에서 재실행 권장)." -ForegroundColor Red
  exit 3
}

# 3) 기록 — manifest.json(구버전 호환, 경로키 맵) + posts.json(신버전, 배열: 런타임 GitHub API 불필요)
[System.IO.File]::WriteAllText((Join-Path $base "manifest.json"), ($map | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))

$arr = @()
foreach($k in $map.Keys){
  $e = $map[$k]
  $arr += [ordered]@{ rel=$k; author=$e.author; group=$e.group; title=$e.title; cat=$e.cat;
                      excerpt=$e.excerpt; created=$e.created; updated=$e.updated; readmin=$e.readmin; published=$e.published }
}
# 단일 원소도 배열로 직렬화(JSON.parse가 항상 array를 받도록); PS5.1엔 -AsArray가 없어 수동 보정
$json = ConvertTo-Json @($arr) -Depth 5
if($arr.Count -le 1){ $json = "[" + ($json -replace '^\s*\[?|\]?\s*$','') + "]" }
[System.IO.File]::WriteAllText((Join-Path $base "posts.json"), $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("✓ manifest.json + posts.json 재생성: {0}편" -f $map.Count) -ForegroundColor Green
$map.GetEnumerator() | ForEach-Object { Write-Host ("   [{0}] {1}" -f $_.Value.created, $_.Key) }

if($missing.Count){
  Write-Host "`n⚠ 점검 필요 항목:" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
  exit 2
}
Write-Host "`n✓ 검증 통과: 디스크의 모든 글이 manifest에 반영됨." -ForegroundColor Green
