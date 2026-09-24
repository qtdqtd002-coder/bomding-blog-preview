# desk-classify.ps1 — classify-picks.ps1 «동기 1회» 실행 래퍼 (2026-09-23 신설 · 감사 E#3 · 데스크 [B-0] 전용 · LLM 0)
#
# 왜 만들었나
#   09-15·09-21(×2) 데스크 회차가 [B] classify-picks 를 «백그라운드»로 띄우고 «완료를 기다리는 중»으로 턴을 끝내 그날 판이 비었다(14회 중 3회).
#   직접 원인은 경로 조립에서 역슬래시가 먹힌 것(`_tools\classify-picks.ps1` → `_toolsclassify-picks.ps1` 즉사 · desk lessons L93)이고,
#   구조 원인은 «오래 걸리니 백그라운드로»라는 SKILL 지시 자체였다. 이 래퍼는
#     ⑴ 정방향 슬래시 «절대경로»를 스스로 만든다(호출자가 경로를 조립하지 않는다)
#     ⑵ 동기(포그라운드)로 돌리고 timeout 을 스스로 건다(기본 540초 — 도구 호출 상한 600초 안)
#     ⑶ 작성자마다 exit code · 출력 바이트 · JSON 유효성 · 결과 건수 · 출력 파일 경로를 «한 줄 JSON» 으로 돌려준다
#   메인 세션은 이 한 줄만 읽으면 된다 — 기다릴 것도, 폴링할 것도, 파일 크기를 잴 것도 없다.
#
# 실행
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:/Users/qtdqt/Desktop/Claude/BlogPreview/_tools/desk-classify.ps1 `
#     -Writers "봄딩,영도" -CandidatesFile _tmp/candidates.txt [-ExcludeDate 2026-09-23] [-OutDir _tmp] [-PrevIssues 14] [-NoRefresh] [-TimeoutSec 540]
#   → stdout 마지막 줄 = {"ok":true,"lines":31,"writers":[{"writer":"봄딩","exit":0,"bytes":49627,"valid":true,"results":31,"ms":81234,"out":"C:/…/_tmp/classify-봄딩-20260923.json",…},…]}
#   exit code = 0(전원 exit 0 + JSON 유효 + 출력 있음) · 1(하나라도 실패·timeout·빈 출력·후보 파일 없음)
#   -NoRefresh = -RefreshPublished/-RefreshFailed 를 붙이지 않는다(네트워크 0 · 테스트 픽스처용). 데스크 회차는 붙인다(기본).
#   상대경로(-CandidatesFile · -OutDir)는 BlogPreview 루트 기준으로 절대화한다.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Writers,
  [Parameter(Mandatory=$true)][string]$CandidatesFile,
  [string]$OutDir = '',
  [string]$ExcludeDate = '',
  [int]$PrevIssues = 14,
  [switch]$NoRefresh,
  [int]$TimeoutSec = 540
)
$ErrorActionPreference = 'Continue'
try { $OutputEncoding = New-Object System.Text.UTF8Encoding($false); [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}

function Fwd([string]$p) { return ($p -replace '\\', '/') }
function AbsPath([string]$p, [string]$baseDir) {
  if ([string]::IsNullOrWhiteSpace($p)) { return '' }
  if ([System.IO.Path]::IsPathRooted($p)) { return Fwd ([System.IO.Path]::GetFullPath($p)) }
  return Fwd ([System.IO.Path]::GetFullPath((Join-Path $baseDir $p)))
}
# PS5.1 ConvertTo-Json 은 한글을 \uXXXX 로 이스케이프한다 — 경로·작성자명을 읽기 쉽게 되돌린다(따옴표는 \" 그대로라 JSON 유효성 유지)
function Unescape-Json([string]$json) {
  return [regex]::Replace($json, '\\u([0-9a-fA-F]{4})', { param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 16) })
}
function Emit($obj, [int]$code) {
  Write-Output (Unescape-Json (($obj | ConvertTo-Json -Compress -Depth 6)))
  exit $code
}

$toolsDir = Fwd $PSScriptRoot
$base     = Fwd (Split-Path -Parent $PSScriptRoot)
$script   = "$toolsDir/classify-picks.ps1"
if ([string]::IsNullOrWhiteSpace($ExcludeDate)) { $ExcludeDate = Get-Date -Format 'yyyy-MM-dd' }
if ([string]::IsNullOrWhiteSpace($OutDir)) { $OutDir = "$base/_tmp" }
$OutDir = AbsPath $OutDir $base
$cand   = AbsPath $CandidatesFile $base
$stamp  = ($ExcludeDate -replace '-', '')

$result = [ordered]@{ ok = $false; script = $script; candidates = $cand; excludeDate = $ExcludeDate; prevIssues = $PrevIssues; refresh = (-not $NoRefresh); timeoutSec = $TimeoutSec; lines = 0; writers = @() }
if (-not (Test-Path $script)) { $result.error = "classify-picks.ps1 없음: $script"; Emit $result 1 }
if (-not (Test-Path $cand))   { $result.error = "후보 파일 없음: $cand"; Emit $result 1 }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$result.lines = @(Get-Content $cand -Encoding UTF8 | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') }).Count
if ($result.lines -le 0) { $result.error = "후보 파일이 비었다: $cand"; Emit $result 1 }

$allOk = $true
foreach ($w in ($Writers -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
  $out = "$OutDir/classify-$w-$stamp.json"
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $script + '"'),
               '-Writer', $w, '-CandidatesFile', ('"' + $cand + '"'), '-PrevIssues', $PrevIssues, '-ExcludeDate', $ExcludeDate)
  if (-not $NoRefresh) { $argList += @('-RefreshPublished', '-RefreshFailed') }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'powershell.exe'
  $psi.Arguments = ($argList -join ' ')
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $psi.StandardErrorEncoding  = New-Object System.Text.UTF8Encoding($false)
  $psi.WorkingDirectory = $base
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $rec = [ordered]@{ writer = $w; exit = $null; bytes = 0; valid = $false; results = 0; ms = 0; out = $out; timedOut = $false; stderrTail = '' }
  try {
    $p = [System.Diagnostics.Process]::Start($psi)
    $soTask = $p.StandardOutput.ReadToEndAsync()
    $seTask = $p.StandardError.ReadToEndAsync()
    if (-not $p.WaitForExit($TimeoutSec * 1000)) {
      $rec.timedOut = $true
      try { $p.Kill() } catch {}
      $p.WaitForExit()
    }
    $so = [string]$soTask.Result; $se = [string]$seTask.Result
    $rec.exit = $p.ExitCode
    if ($so) { $so = $so.TrimStart([char]0xFEFF) }
    [System.IO.File]::WriteAllText($out, $so, (New-Object System.Text.UTF8Encoding($false)))
    $rec.bytes = (Get-Item $out).Length
    if ($se) { $t = ($se -replace '\s+', ' ').Trim(); if ($t.Length -gt 300) { $t = $t.Substring($t.Length - 300) }; $rec.stderrTail = $t }
    try { $j = $so | ConvertFrom-Json; if ($j -and ($null -ne $j.results)) { $rec.valid = $true; $rec.results = @($j.results).Count } } catch { $rec.valid = $false }
  } catch {
    $rec.exit = -1; $rec.stderrTail = [string]$_.Exception.Message
  }
  $rec.ms = [int]$sw.ElapsedMilliseconds
  if ($rec.exit -ne 0 -or -not $rec.valid -or $rec.bytes -le 0 -or $rec.timedOut) { $allOk = $false }
  $result.writers += [pscustomobject]$rec
}
$result.ok = $allOk
Emit $result $(if ($allOk) { 0 } else { 1 })
