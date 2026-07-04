# ============================================================
#  verify-trend-paths.ps1 (2026-07-04) — trend.json의 모든 issues[].file 경로가
#  실제 로컬 파일로 resolve되는지 검증하는 발행 전 게이트.
#
#  배경: 2026-07-04 트렌드 탭 404 재발.
#   생성 파이프라인이 오늘 4편의 file 값을 `_trend/` 접두어 없이(`봄딩/2026-07-04.html`)
#   써서, index.html(루트 기준 상대링크)이 루트 블로그글 폴더를 가리켜 404가 났다.
#   index.html 렌더에 접두어 방어 정규화(trendFile())를 넣었지만, 그건 라이브 증상만
#   가린다. 이 도구는 소스(trend.json)에서 잘못된 경로를 push 전에 잡는 결정적 가드다.
#
#  하는 일:
#   1) trend.json 로드 → 각 issue의 file 을 검사.
#      - 비어 있으면        → writer/date 로 조립한 기대경로로 판정.
#      - `_trend/` 접두어 없으면 → 접두어 부여한 기대경로로 판정(＝버그).
#   2) 각 기대경로가 로컬 디스크에 실제 존재하는지 확인.
#   3) -Fix 지정 시 원본 텍스트에서 `"file"` 값만 타깃 치환해 접두어를 복원한다
#      (ConvertTo-Json 재직렬화를 쓰지 않아 한글이 \uXXXX 로 깨지지 않음).
#   4) 하나라도 접두어 누락 또는 미존재면 exit 1(-Fix 로 전부 고쳐졌으면 exit 0).
#
#  사용:
#    powershell -NoProfile -ExecutionPolicy Bypass -File verify-trend-paths.ps1          # 검증만(read-only)
#    powershell -NoProfile -ExecutionPolicy Bypass -File verify-trend-paths.ps1 -Fix     # 접두어 누락 자동 복원
#
#  종료코드: 0 = 전 경로 정상(또는 -Fix 로 전부 복원)  /  1 = 접두어 누락·미존재 잔존
# ============================================================
param(
  [string]$TrendJson = "$PSScriptRoot\..\_trend\trend.json",
  [switch]$Fix,
  [switch]$Quiet
)
$ErrorActionPreference = 'Stop'
function Log([string]$m) { if (-not $Quiet) { Write-Output "[verify-trend-paths] $m" } }

if (-not (Test-Path $TrendJson)) { Log "✗ trend.json 없음: $TrendJson"; exit 1 }
$base = Split-Path (Split-Path $TrendJson -Parent) -Parent   # BlogPreview\
$raw  = Get-Content $TrendJson -Raw -Encoding UTF8
try { $j = $raw | ConvertFrom-Json } catch { Log "✗ trend.json 파싱 실패: $($_.Exception.Message)"; exit 1 }
$issues = @($j.issues)
if (-not $issues.Count) { Log "issues 비어 있음 — 검증 대상 없음(정상)."; exit 0 }

$missingPrefix = @()   # 접두어 누락(＝오늘 재발한 버그)
$notFound      = @()   # 기대경로가 로컬에 없음
foreach ($it in $issues) {
  $f = [string]$it.file
  $expected = $null
  if ([string]::IsNullOrWhiteSpace($f)) {
    if ($it.writer -and $it.date) { $expected = "_trend/$($it.writer)/$($it.date).html"; $missingPrefix += @{ it = $it; from = '(빈값)'; to = $expected } }
    else { $notFound += "(file 빈값·writer/date 없음) $($it.writer)/$($it.date)"; continue }
  }
  elseif ($f -notmatch '^_trend/') {
    $expected = '_trend/' + ($f -replace '^\.?/+','')
    $missingPrefix += @{ it = $it; from = $f; to = $expected }
  }
  else { $expected = $f }

  $local = Join-Path $base ($expected -replace '/','\')
  if (-not (Test-Path $local)) { $notFound += $expected }
}

if (-not $missingPrefix.Count -and -not $notFound.Count) { Log "✓ 전 $($issues.Count)개 issue의 file 경로 정상(`_trend/` 접두어 + 로컬 존재)."; exit 0 }

foreach ($m in $missingPrefix) { Log "⚠ 접두어 누락: '$($m.from)' → '$($m.to)' (writer=$($m.it.writer) date=$($m.it.date))" }
foreach ($n in $notFound)      { Log "⚠ 로컬 파일 없음: $n" }

if ($Fix -and $missingPrefix.Count) {
  # 원본 텍스트에서 "file": "<from>" 만 타깃 치환(전체 재직렬화 회피 → 한글 보존).
  $new = $raw
  foreach ($m in $missingPrefix) {
    if ($m.from -eq '(빈값)') { continue }   # 빈값은 문자열 앵커가 없어 안전 치환 불가 → 미존재로 보고
    $fromEsc = [regex]::Escape($m.from)
    $pat = '("file"\s*:\s*")' + $fromEsc + '(")'
    $new = [regex]::Replace($new, $pat, ('${1}' + $m.to.Replace('$','$$') + '${2}'))
  }
  if ($new -ne $raw) {
    Set-Content -Path $TrendJson -Value $new -Encoding UTF8 -NoNewline
    Log "✓ -Fix: 접두어 누락 $($missingPrefix.Count)건 복원 후 저장. 재검증 실행 권장."
    # 재검증: 남은 미존재가 없으면 통과.
    & $PSCommandPath -TrendJson $TrendJson -Quiet:$Quiet
    exit $LASTEXITCODE
  }
}

Log "✗ file 경로 문제 잔존 — 접두어누락 $($missingPrefix.Count) · 미존재 $($notFound.Count). (-Fix 로 접두어 자동복원 가능)"
exit 1
