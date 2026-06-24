# ============================================================
#  verify-live.ps1 (2026-06-25) — 발행 후 'GitHub Pages 라이브 반영'을 실제로 검증하는 게이트.
#
#  배경: push 성공 ≠ 발행 완료.
#   2026-06-25 사고 — legacy Pages 빌드가 콘텐츠 문제 없이 간헐 "Page build failed"로 실패해
#   git push는 됐는데 사이트는 전날에 멈춤. 트렌드 루틴은 'push 성공'만 보고 '발행됨' 마커를
#   찍었고, 이후 catch-up이 마커를 보고 영영 SKIP → 트렌드 탭에 글이 안 보였다.
#   (근본 수정으로 배포는 Actions(.github/workflows/deploy-pages.yml)로 전환했고, 이 도구는
#    그 위에 얹는 2차 안전망이다 — 배포가 또 어떤 이유로 실패해도 '발행됨'으로 오판하지 않게.)
#
#  하는 일:
#   1) 주어진 경로들이 라이브에서 실제 200으로 떨어질 때까지 폴링(캐시버스트 쿼리 부착).
#   2) (선택) 특정 파일 본문에 기대 문자열이 포함되는지 확인(예: trend.json 에 오늘 날짜).
#   3) 타임아웃까지 미반영이면 Actions 배포를 1회 재실행하고 한 번 더 대기.
#   4) 끝내 미반영이면 exit 1 → 호출측(루틴/드레이너)이 '발행됨' 마커 기록을 보류하게.
#
#  사용:
#    powershell -NoProfile -ExecutionPolicy Bypass -File verify-live.ps1 `
#      -Paths '_trend/봄딩/2026-06-25.html','_trend/영도/2026-06-25.html' `
#      -Contains '2026-06-25' -ContainsPath '_trend/trend.json'
#
#  종료코드: 0 = 라이브 반영 확인  /  1 = 타임아웃·재배포 후에도 미반영(발행 미완료로 취급)
# ============================================================
param(
  [Parameter(Mandatory)][string[]]$Paths,                                  # repo-상대 경로(한글 가능)
  [string]$Site         = 'https://qtdqtd002-coder.github.io/bomding-blog-preview',
  [string]$Repo         = 'qtdqtd002-coder/bomding-blog-preview',
  [string]$Workflow     = 'deploy-pages.yml',
  [string]$Contains     = '',                                              # (선택) 본문에 있어야 할 문자열
  [string]$ContainsPath = '',                                             # (선택) 위 문자열을 확인할 repo-상대 경로
  [int]$TimeoutSec      = 300,                                            # 1차 대기 한도(초)
  [int]$PollSec         = 12,
  [switch]$Quiet
)
$ErrorActionPreference = 'Continue'
# PS 5.1 기본 TLS는 1.0이라 GitHub(Pages/Actions, TLS 1.2+ 강제) 연결이 조용히 실패한다 →
# Invoke-WebRequest이 throw돼 '라이브 미반영'으로 오판. 명시적으로 TLS 1.2 활성화.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
$gh = if (Test-Path 'C:\Program Files\GitHub CLI\gh.exe') { 'C:\Program Files\GitHub CLI\gh.exe' } else { 'gh' }
function Log([string]$m) { if (-not $Quiet) { Write-Output "[verify-live] $m" } }

# 콤마로 합쳐 넘어온 경로(powershell -File 호출 시 배열이 단일 문자열로 들어오는 경우)도 안전하게 분해.
$Paths = @($Paths | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

# 한글/공백 경로를 세그먼트별 URL 인코딩.
function Enc([string]$rel) {
  (($rel.TrimStart('/')) -split '/' | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
}
$siteRoot = $Site.TrimEnd('/')
function Cb { [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() }

# 모든 경로 200 + (지정 시) ContainsPath 본문에 Contains 포함이면 $true.
function Test-AllLive {
  foreach ($p in $Paths) {
    $u = "$siteRoot/$(Enc $p)?cb=$(Cb)"
    try {
      $r = Invoke-WebRequest -Uri $u -Method Head -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
      if ($r.StatusCode -ne 200) { return $false }
    } catch { return $false }
  }
  if ($Contains -and $ContainsPath) {
    $u = "$siteRoot/$(Enc $ContainsPath)?cb=$(Cb)"
    try {
      $r = Invoke-WebRequest -Uri $u -TimeoutSec 25 -UseBasicParsing -ErrorAction Stop
      if ([string]$r.Content -notlike "*$Contains*") { return $false }
    } catch { return $false }
  }
  return $true
}

Log "검증 시작 — 경로 $($Paths.Count)개$(if($Contains){" + '$Contains' 포함체크"}) (타임아웃 ${TimeoutSec}s)."
$deadline    = (Get-Date).AddSeconds($TimeoutSec)
$retriggered = $false
while ($true) {
  if (Test-AllLive) {
    Log "✓ 라이브 반영 확인 — 전 경로 200$(if($Contains){" · '$Contains' 노출"})."
    exit 0
  }
  if ((Get-Date) -ge $deadline) {
    if (-not $retriggered) {
      Log "타임아웃(${TimeoutSec}s) 라이브 미반영 — Actions 배포 재실행 후 1회 더 대기."
      & $gh workflow run $Workflow -R $Repo 2>&1 | ForEach-Object { Log "  gh: $_" }
      $retriggered = $true
      $deadline    = (Get-Date).AddSeconds($TimeoutSec)
      Start-Sleep -Seconds 15
      continue
    }
    Log "✗ 재배포 후에도 라이브 미반영 — '발행 미완료'로 보고. 점검: https://github.com/$Repo/actions"
    exit 1
  }
  Start-Sleep -Seconds $PollSec
}
