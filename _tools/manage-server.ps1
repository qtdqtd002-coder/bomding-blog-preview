# manage-server.ps1 — 쓰담 PC 로컬 글 관리 서버 (인프라실)
# 목적: 브라우저 관리 페이지(manage.html)에서 "미발행 불필요 글"을 골라 삭제한다.
#       삭제 = 그 글 폴더(본문 HTML + 이미지 + 티스토리 붙여넣기본)를 git에서 제거 →
#              build-manifest.ps1 재생성 → 커밋 → push. 사이트/앱에서 사라진다(히스토리엔 남아 복구 가능).
# 안전:
#   - 127.0.0.1 에만 바인딩 + IsLocal 검사 → 외부에서 접근 불가(개인 PC 전용).
#   - 발행된 글(posts.json published=true 또는 published.json publishedRels)은 삭제 거부.
#   - 경로조작(.., 절대경로, 작성자 폴더 밖) 차단. 한 폴더에 다른 글이 섞여 있으면 폴더가 아닌 해당 HTML만 삭제.
#   - 삭제 전 git ls-files 글 수>0 사전점검(환경 이상 시 중단 → 데이터 사고 방지).
# 실행: powershell -ExecutionPolicy Bypass -File _tools\manage-server.ps1   (런처: 쓰담-글관리.bat)
param(
  [int]$Port = 8787,
  [switch]$NoBrowser
)
$ErrorActionPreference = "Stop"
try { $OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$base     = Split-Path -Parent $PSScriptRoot          # = BlogPreview 루트
$baseFull = [System.IO.Path]::GetFullPath($base)
$htmlFile = Join-Path $PSScriptRoot "manage.html"
$buildScript = Join-Path $PSScriptRoot "build-manifest.ps1"
$utf8 = New-Object System.Text.UTF8Encoding($false)

# ---- 공통 헬퍼 ----
function Read-Json([string]$path){
  if(-not (Test-Path $path)){ return $null }
  try { return (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}
# 발행됨 집합(rel 경로) — published.json publishedRels
function Get-PublishedSet(){
  $set = New-Object System.Collections.Generic.HashSet[string]
  $pj = Read-Json (Join-Path $base "published.json")
  if($pj){ foreach($r in @($pj.publishedRels)){ if($r){ [void]$set.Add(([string]$r).Trim()) } } }
  return $set
}
# rel(슬래시 경로)의 부모 = 그 글의 폴더(leaf) 경로(슬래시)
function Parent-Rel([string]$rel){
  $segs = $rel -split '/'
  if($segs.Count -le 1){ return "" }
  return ($segs[0..($segs.Count-2)] -join '/')
}

# ---- /api/list 데이터 구성 ----
function Build-List(){
  $posts = @(Read-Json (Join-Path $base "posts.json"))
  $pub = Get-PublishedSet
  $out = @()
  foreach($p in $posts){
    $rel = ([string]$p.rel).Trim()
    if(-not $rel){ continue }
    $relDir = Parent-Rel $rel
    $fullDir = Join-Path $base ($relDir -replace '/','\')
    $sizeKB = $null; $fileCount = $null
    if($relDir -and (Test-Path $fullDir)){
      $files = Get-ChildItem -LiteralPath $fullDir -Recurse -File -ErrorAction SilentlyContinue
      if($files){ $sizeKB = [math]::Round((($files | Measure-Object Length -Sum).Sum)/1024.0,0); $fileCount = $files.Count }
    }
    $isPub = ([bool]$p.published) -or $pub.Contains($rel)
    $out += [ordered]@{
      rel=$rel; author=[string]$p.author; group=[string]$p.group; title=[string]$p.title;
      cat=[string]$p.cat; created=[string]$p.created; published=$isPub; sizeKB=$sizeKB; fileCount=$fileCount
    }
  }
  return @{ posts = $out }
}

# ---- 삭제 처리 ----
function Do-Delete([string]$relIn){
  $log = New-Object System.Collections.ArrayList
  function L($m){ [void]$log.Add($m); Write-Host "   $m" }

  $rel = ([string]$relIn).Trim() -replace '\\','/'
  # 1) 검증
  if([string]::IsNullOrWhiteSpace($rel)){ return @{ ok=$false; error="rel 누락"; log=$log } }
  if($rel -match '\.\.' -or $rel -match '^[a-zA-Z]:' -or $rel.StartsWith('/')){ return @{ ok=$false; error="허용되지 않는 경로"; log=$log } }
  if($rel -notmatch '\.html$'){ return @{ ok=$false; error="HTML 글만 삭제 가능"; log=$log } }

  $posts = @(Read-Json (Join-Path $base "posts.json"))
  $post = $posts | Where-Object { ([string]$_.rel).Trim() -eq $rel } | Select-Object -First 1
  if(-not $post){ return @{ ok=$false; error="목록에 없는 글: $rel"; log=$log } }

  # 2) 발행 가드
  $pub = Get-PublishedSet
  if(([bool]$post.published) -or $pub.Contains($rel)){
    return @{ ok=$false; error="발행된 글은 삭제할 수 없습니다."; log=$log }
  }

  # 3) 삭제 대상 결정: 같은 폴더(leaf)에 다른 '목록 글'이 없으면 폴더째, 있으면 해당 HTML만
  $relDir = Parent-Rel $rel
  $sameDir = @($posts | Where-Object { (Parent-Rel (([string]$_.rel).Trim())) -eq $relDir })
  $folderMode = ($relDir -ne "") -and ($sameDir.Count -le 1)
  $target = if($folderMode){ $relDir } else { $rel }
  L ("삭제 대상: {0} ({1})" -f $target, $(if($folderMode){'폴더 통째'}else{'HTML 단독 — 폴더에 다른 글 있음'}))

  # 경로 안전: 최종 실제경로가 base 안인지
  $targetFs = Join-Path $base ($target -replace '/','\')
  $targetFull = [System.IO.Path]::GetFullPath($targetFs)
  if(-not $targetFull.StartsWith($baseFull, [System.StringComparison]::OrdinalIgnoreCase)){
    return @{ ok=$false; error="경로 안전 검사 실패"; log=$log }
  }

  # 4) 사전점검: git ls-files 글 수>0 (환경 이상 시 중단)
  $pre = @(& git -C $base ls-files "봄딩/*.html" "영도/*.html" "겜더쿠/*.html")
  if($pre.Count -eq 0){ return @{ ok=$false; error="사전점검 실패: git에서 글을 0편으로 인식(환경 이상). 중단."; log=$log } }
  L ("사전점검 OK: git 인식 글 {0}편" -f $pre.Count)

  # 5) git rm (추적 파일 제거+스테이징). 수정/untracked 영향 없이 강제. 미추적 잔여는 디스크에서 정리.
  $rmOut = (& git -C $base rm -r -f --ignore-unmatch -- $target 2>&1 | Out-String).Trim()
  if($rmOut){ L ("git rm: " + ($rmOut -replace '\s+',' ')) }
  if(Test-Path $targetFull){
    Remove-Item -LiteralPath $targetFull -Recurse -Force -ErrorAction SilentlyContinue
    L "디스크 잔여(미추적) 정리"
  }
  # 폴더 모드면 비게 된 상위(group) 폴더도 정리
  if($folderMode){
    $parentGroupFs = Split-Path $targetFull -Parent
    if((Test-Path $parentGroupFs) -and -not (Get-ChildItem -LiteralPath $parentGroupFs -Force -ErrorAction SilentlyContinue)){
      Remove-Item -LiteralPath $parentGroupFs -Force -ErrorAction SilentlyContinue
      L "빈 상위 폴더 정리"
    }
  }

  # 6) manifest 재생성 (자식 네이티브 PowerShell, 발행검증은 건너뜀=빠르고 네트워크 불필요)
  $env:SKIP_PUBLISH_CHECK = "1"
  $bm = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $buildScript 2>&1 | Out-String)
  $bmExit = $LASTEXITCODE
  Remove-Item Env:\SKIP_PUBLISH_CHECK -ErrorAction SilentlyContinue
  L ("build-manifest 종료코드 {0}" -f $bmExit)
  if($bmExit -eq 3){ return @{ ok=$false; error="manifest 재생성 중단(글 0편 감지). 푸시하지 않음."; log=$log; detail=$bm } }

  # 7) 커밋 (메시지는 파일로 전달 → 한글 안전) + 인덱스 파일 스테이징
  & git -C $base add -- "manifest.json" "posts.json" | Out-Null
  $msgFile = Join-Path $env:TEMP ("sseudam-del-" + [guid]::NewGuid().ToString("N") + ".txt")
  [System.IO.File]::WriteAllText($msgFile, ("글 삭제: " + ([string]$post.title) + "`n`nrel: " + $rel), $utf8)
  $cmOut = (& git -C $base commit -F $msgFile 2>&1 | Out-String).Trim()
  Remove-Item -LiteralPath $msgFile -Force -ErrorAction SilentlyContinue
  L ("git commit: " + (($cmOut -split "`n")[0]))
  if($cmOut -match 'nothing to commit'){ return @{ ok=$false; error="변경 사항이 없습니다(이미 삭제됨?)."; log=$log } }

  # 8) push
  $pushOut = (& git -C $base push origin HEAD:main 2>&1 | Out-String).Trim()
  $pushed = ($LASTEXITCODE -eq 0)
  L ("git push: " + $(if($pushed){'성공'}else{'실패 — ' + ($pushOut -replace '\s+',' ')}))

  return @{ ok=$true; pushed=$pushed; target=$target; folderMode=$folderMode; log=$log; pushOut=$pushOut }
}

# ---- HTTP 응답 헬퍼 ----
function Send-Bytes($ctx, [byte[]]$bytes, [string]$ctype, [int]$status=200){
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = $ctype
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}
function Send-Json($ctx, $obj, [int]$status=200){
  # log(ArrayList) 등은 JSON 직렬화 시 단순 배열로 — 깊이 충분히
  $json = $obj | ConvertTo-Json -Depth 8
  Send-Bytes $ctx ($utf8.GetBytes($json)) "application/json; charset=utf-8" $status
}

# ---- 서버 기동 ----
$prefix = "http://127.0.0.1:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() }
catch { Write-Host "✗ 포트 $Port 바인딩 실패: $($_.Exception.Message)" -ForegroundColor Red; Write-Host "  다른 포트로: powershell -File _tools\manage-server.ps1 -Port 8899" -ForegroundColor Yellow; exit 1 }

$url = $prefix
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║   쓰담 · 글 관리 서버 (PC 로컬 전용)          ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ("   주소 : {0}" -f $url) -ForegroundColor Cyan
Write-Host  "   종료 : 이 창에서 Ctrl + C" -ForegroundColor DarkGray
Write-Host ("   리포 : {0}" -f $base) -ForegroundColor DarkGray
Write-Host ""

if(-not $NoBrowser){ try { Start-Process $url } catch {} }

while($listener.IsListening){
  try {
    $ctx = $listener.GetContext()
  } catch { break }
  try {
    # 로컬 요청만 허용(외부 차단 이중 안전장치)
    if(-not $ctx.Request.IsLocal){ Send-Bytes $ctx ([byte[]](0)) "text/plain" 403; continue }

    $pathName = $ctx.Request.Url.AbsolutePath
    $method = $ctx.Request.HttpMethod

    if($method -eq "GET" -and ($pathName -eq "/" -or $pathName -eq "/index.html")){
      if(Test-Path $htmlFile){
        Send-Bytes $ctx ([System.IO.File]::ReadAllBytes($htmlFile)) "text/html; charset=utf-8"
      } else { Send-Bytes $ctx ($utf8.GetBytes("manage.html 없음")) "text/plain; charset=utf-8" 500 }
      continue
    }

    if($method -eq "GET" -and $pathName -eq "/api/list"){
      Send-Json $ctx (Build-List)
      continue
    }

    if($method -eq "POST" -and $pathName -eq "/api/delete"){
      $reader = New-Object System.IO.StreamReader($ctx.Request.InputStream, [System.Text.Encoding]::UTF8)
      $bodyText = $reader.ReadToEnd(); $reader.Close()
      $rel = ""
      try { $b = $bodyText | ConvertFrom-Json; $rel = [string]$b.rel } catch {}
      Write-Host ("▶ 삭제 요청: {0}" -f $rel) -ForegroundColor Yellow
      $res = Do-Delete $rel
      $res.log = @($res.log)   # ArrayList → array
      if($res.ok){ Write-Host "✓ 처리 완료" -ForegroundColor Green } else { Write-Host ("✗ 거부/실패: {0}" -f $res.error) -ForegroundColor Red }
      Send-Json $ctx $res ($(if($res.ok){200}else{400}))
      continue
    }

    if($method -eq "GET" -and $pathName -eq "/favicon.ico"){ Send-Bytes $ctx ([byte[]]@()) "image/x-icon" 204; continue }

    Send-Bytes $ctx ($utf8.GetBytes("not found")) "text/plain; charset=utf-8" 404
  } catch {
    try { Send-Json $ctx @{ ok=$false; error=("서버 오류: " + $_.Exception.Message) } 500 } catch {}
    Write-Host ("! 처리 중 예외: {0}" -f $_.Exception.Message) -ForegroundColor Red
  }
}
$listener.Stop()
