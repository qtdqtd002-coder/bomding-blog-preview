# build-ops.ps1 — 쓰담 관리 surface(L3) 집계 빌더
# 역할: ① lessons/*.md(L5 구조화 교훈)를 파싱해 lessons-index.json(쿼리용) 생성
#       ② registry.json + .bc-outbox 상태를 집계해 dashboard.json 생성
# 출력 JSON은 UTF-8 no-BOM(브라우저/노드 JSON.parse 호환, published.json 관례 동일)
# PowerShell 5.1. 이 스크립트 본체는 UTF-8 BOM로 저장(한글 리터럴 안전).
$ErrorActionPreference = "Stop"

$lessonsDir = "C:\Users\qtdqt\.claude\shared\blog-writing\lessons"
$opsDir     = "C:\Users\qtdqt\Desktop\Claude\BlogPreview\_ops"
$registry   = Join-Path $opsDir "registry.json"
$outbox     = "C:\Users\qtdqt\Desktop\Claude\.bc-outbox"

function Write-JsonNoBom($obj, $path) {
  $json = $obj | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))
}

# ── ① lessons 파싱 → lessons-index.json ──
$rx = [regex]'^- \[(?<date>\d{4}-\d{2}-\d{2})\]\[scope:(?<scope>[^\]]*)\]\[status:(?<status>[^\]]*)\]\[hits:(?<hits>\d+)\]\s*(?<body>.*)$'
$records = New-Object System.Collections.ArrayList
if (Test-Path $lessonsDir) {
  Get-ChildItem $lessonsDir -Filter *.md | Where-Object { $_.Name -ne "README.md" } | ForEach-Object {
    $lane = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    Get-Content $_.FullName -Encoding UTF8 | ForEach-Object {
      $m = $rx.Match($_)
      if ($m.Success) {
        $body = $m.Groups['body'].Value
        $guard = ""
        $gm = [regex]::Match($body, '\{guard:(?<g>[^}]*)\}')
        if ($gm.Success) { $guard = $gm.Groups['g'].Value.Trim(); $body = $body.Substring(0, $gm.Index).Trim() }
        $parts = $body -split '⇒'
        $trigger = ($parts[0] -replace '^\s*trigger:\s*','').Trim()
        $mistake = if ($parts.Count -gt 1) { ($parts[1] -replace '^\s*mistake:\s*','').Trim() } else { "" }
        $rule    = if ($parts.Count -gt 2) { ($parts[2] -replace '^\s*rule:\s*','').Trim() } else { "" }
        [void]$records.Add([ordered]@{
          lane=$lane; date=$m.Groups['date'].Value; scope=$m.Groups['scope'].Value;
          status=$m.Groups['status'].Value; hits=[int]$m.Groups['hits'].Value;
          trigger=$trigger; mistake=$mistake; rule=$rule; guard=$guard
        })
      }
    }
  }
}
Write-JsonNoBom @{ generated="(stamp on commit)"; count=$records.Count; lessons=$records } (Join-Path $lessonsDir "lessons-index.json")

# ── ② 집계 → dashboard.json ──
$byStatus = @{}; $records | ForEach-Object { $s=$_.status; if(-not $byStatus.ContainsKey($s)){$byStatus[$s]=0}; $byStatus[$s]++ }
$repeatWatch = @($records | Where-Object { $_.hits -ge 2 } | Sort-Object hits -Descending | ForEach-Object { [ordered]@{ lane=$_.lane; scope=$_.scope; hits=$_.hits; trigger=$_.trigger; guard=$_.guard } })

$emp = @{}; $byTeam=@{}; $byType=@{}; $built=0; $pending=0
if (Test-Path $registry) {
  $reg = Get-Content $registry -Encoding UTF8 -Raw | ConvertFrom-Json
  $reg.employees.PSObject.Properties | ForEach-Object {
    $v = $_.Value
    if(-not $byTeam.ContainsKey($v.team)){$byTeam[$v.team]=0}; $byTeam[$v.team]++
    if(-not $byType.ContainsKey($v.type)){$byType[$v.type]=0}; $byType[$v.type]++
    if ($v.status -eq "built"){$built++} else {$pending++}
  }
  $emp = [ordered]@{ total=($reg.employees.PSObject.Properties|Measure-Object).Count; built=$built; pending=$pending; byTeam=$byTeam; byType=$byType }
}

$outDone=0;$outPending=0;$outFailed=0
if (Test-Path $outbox) {
  if (Test-Path (Join-Path $outbox "_done"))   { $outDone   = @(Get-ChildItem (Join-Path $outbox "_done") -Directory -ErrorAction SilentlyContinue).Count }
  if (Test-Path (Join-Path $outbox "_failed")) { $outFailed = @(Get-ChildItem (Join-Path $outbox "_failed") -Directory -ErrorAction SilentlyContinue).Count }
  $outPending = @(Get-ChildItem $outbox -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '^(_done|_failed|\.staging)$' }).Count
}

Write-JsonNoBom ([ordered]@{
  generated="(stamp on commit)"
  employees=$emp
  lessons=[ordered]@{ total=$records.Count; byStatus=$byStatus; repeatWatch=$repeatWatch }
  outbox=[ordered]@{ done=$outDone; pending=$outPending; failed=$outFailed }
}) (Join-Path $opsDir "dashboard.json")

Write-Host ("build-ops 완료 — lessons {0}건(승격대기 {1}) · 직원 built {2}/{3} · 아웃박스 done {4}/pending {5}/failed {6}" -f `
  $records.Count, @($records|Where-Object{$_.status -eq '승격대기'}).Count, $built, ($built+$pending), $outDone, $outPending, $outFailed)
