# verify-reopen-live.ps1 — 갱신본이 라이브 사이트 «작성 글» 목록에 실제로 뜨는지 확인 (2026-11-09)
#   사용자 «앞으로 갱신글 요청해서 작성완료하면 작성글 리스트에 뜨는지까지 확인해서».
#   index.html isLive 와 같은 판정: (라이브 reopen.json 에 rel) 그리고 (백엔드 /hidden 에 rel 없음) 그리고 (라이브 posts.json 에 rel).
#   reopen 은 «발행됨·수동 발행완료»를 이기고, 아카이브(/hidden)는 reopen 을 이긴다 — 그래서 셋 다 본다.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File verify-reopen-live.ps1 -Rels '<rel>|<rel>' [-Site <url>] [-Tries 6] [-WaitSec 30]
#   출력: rel 마다 REOPEN_OK <rel> / REOPEN_FAIL <rel> :: <사유>.  exit 0 = 전부 뜸 · 1 = 하나라도 안 뜸 · 2 = 인자 오류
#   드레이너(drain.ps1 5.6)가 Kind=improve 발행 뒤 자동 실행한다. 손으로 다시 돌려도 된다(읽기만 한다).
param(
  [Parameter(Mandatory=$true)][string]$Rels,
  [string]$Site = 'https://qtdqtd002-coder.github.io/bomding-blog-preview',
  [int]$Tries = 6,
  [int]$WaitSec = 30
)
$ErrorActionPreference = 'Stop'
$want = @($Rels -split '\|' | ForEach-Object { ([string]$_ -replace '\\','/').Trim().TrimStart('/') } | Where-Object { $_ })
if ($want.Count -eq 0) { Write-Output 'REOPEN_FAIL (인자) :: -Rels 가 비었다'; exit 2 }
$Site = $Site.TrimEnd('/')

function Get-Json([string]$url, [hashtable]$hdr) {
  $r = Invoke-WebRequest -Uri $url -Headers $hdr -TimeoutSec 30 -UseBasicParsing
  $ms = New-Object System.IO.MemoryStream; $r.RawContentStream.CopyTo($ms)
  $txt = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())   # 5.1 의 Content 는 charset 이 없으면 Latin-1 로 읽는다 — 바이트로 직접
  return ($txt | ConvertFrom-Json)
}

$cfgPath = 'C:\Users\qtdqt\Desktop\Claude\blog-company-backend\.runner.config.json'
$api = $null
if (Test-Path $cfgPath) { try { $c = [System.IO.File]::ReadAllText($cfgPath) | ConvertFrom-Json; if ($c.baseUrl) { $api = ([string]$c.baseUrl).TrimEnd('/') } } catch {} }

$state = @{}
for ($i = 1; $i -le $Tries; $i++) {
  $ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  $posts = $null; $reopen = $null; $hidden = $null; $err = @()
  try { $posts  = @(Get-Json "$Site/posts.json?ts=$ts" @{}) | ForEach-Object { $_ } } catch { $err += "posts.json 못 읽음($($_.Exception.Message))" }
  try { $reopen = Get-Json "$Site/reopen.json?ts=$ts" @{} } catch { $err += "reopen.json 못 읽음($($_.Exception.Message))" }
  if ($api) { try { $hidden = Get-Json "$api/hidden?ts=$ts" @{} } catch { $err += "백엔드 /hidden 못 읽음($($_.Exception.Message))" } }
  else { $err += '백엔드 설정 없음(.runner.config.json) — 아카이브 여부 판정 불가' }

  $postSet = @{}; foreach ($p in @($posts)) { if ($p -and $p.rel) { $postSet[[string]$p.rel] = 1 } }
  $roSet = @{}; foreach ($x in @($reopen.rels)) { $rr = if ($x -is [string]) { $x } else { [string]$x.rel }; if ($rr) { $roSet[$rr] = 1 } }
  $hidSet = @{}; foreach ($x in @($hidden.rels)) { if ($x) { $hidSet[[string]$x] = 1 } }

  $allOk = $true
  foreach ($rel in $want) {
    $why = @()
    if (-not $posts) { $why += 'posts.json 없음' } elseif (-not $postSet.ContainsKey($rel)) { $why += '라이브 posts.json 에 없음(배포 전이거나 경로 불일치)' }
    if (-not $reopen) { $why += 'reopen.json 없음' } elseif (-not $roSet.ContainsKey($rel)) { $why += '라이브 reopen.json 에 없음(배포 전이거나 등록 실패)' }
    if ($hidden -and $hidSet.ContainsKey($rel)) { $why += '아카이브됨(/hidden) — reopen 을 이긴다' }
    if (-not $hidden) { $why += '아카이브 여부 미확인' }
    $state[$rel] = $why
    if ($why.Count -gt 0) { $allOk = $false }
  }
  if ($allOk) { break }
  if ($i -lt $Tries) { Start-Sleep -Seconds $WaitSec }
}

$fail = 0
foreach ($rel in $want) {
  if ($state[$rel].Count -eq 0) { Write-Output "REOPEN_OK $rel — 작성 글 목록 맨 위에 «갱신»으로 뜬다" }
  else { $fail++; Write-Output ("REOPEN_FAIL $rel :: " + ($state[$rel] -join ' · ')) }
}
if ($err.Count -gt 0) { Write-Output ('  참고: ' + ($err -join ' · ')) }
exit $(if ($fail -gt 0) { 1 } else { 0 })
