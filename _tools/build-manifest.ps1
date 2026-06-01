# build-manifest.ps1 — manifest.json 단일 진실원천 재생성 (인프라팀)
# 정책: 글 HTML은 git이 단일 진실원천. 매 발행마다 이 스크립트로 manifest를 "처음부터" 재생성한다.
#   - created : 최초 등록일 = 그 파일의 첫 커밋(--diff-filter=A) 시각  ← 목록 표기·정렬 기준
#   - updated : 마지막 수정일 = 그 파일의 마지막 커밋 시각
#   - date    : 구버전 index.html 호환용 별칭(= created)
# 검증: 디스크에 커밋된 봄딩/영도 글이 전부 manifest에 들어갔는지 확인하고, 누락이 있으면 빨간 경고 + 비정상 종료.
#       (예전에 새 글 2편이 manifest에서 빠졌던 사고 재발 방지)
# 실행: pwsh -File _tools\build-manifest.ps1   또는   powershell -File _tools\build-manifest.ps1
$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $PSScriptRoot   # = BlogPreview 루트

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

# 1) 글 파일 수집 — 봄딩/영도 하위의 커밋된 *.html 만 (index, _접두 폴더 제외)
$files = git -C $base ls-files "봄딩/*.html" "영도/*.html"
$map = [ordered]@{}
$missing = @()

foreach($f in $files){
  $segs = $f -split '/'
  if($segs | Where-Object { $_ -like '_*' -or $_ -like '.*' }){ continue }

  $full = Join-Path $base ($f -replace '/','\')
  if(-not (Test-Path $full)){ continue }
  $html = [System.IO.File]::ReadAllText($full,[System.Text.Encoding]::UTF8)

  # 최초 등록일(created) = 첫 커밋, 마지막 수정일(updated) = 최신 커밋
  $created = (& git -C $base log --diff-filter=A --follow --format="%ad" --date=format:"%Y-%m-%d %H:%M:%S" -- $f | Select-Object -Last 1)
  $updated = (& git -C $base log -1 --format="%ad" --date=format:"%Y-%m-%d %H:%M:%S" -- $f)
  if([string]::IsNullOrWhiteSpace($created)){ $created = $updated }

  $title=""; $cat=""; $excerpt=""
  $m=[regex]::Match($html,'(?is)<h1[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>(.*?)</h1>'); if($m.Success){$title=Strip $m.Groups[1].Value}
  $m=[regex]::Match($html,'(?is)<div[^>]*class="[^"]*\bcat\b[^"]*"[^>]*>(.*?)</div>'); if($m.Success){$cat=Strip $m.Groups[1].Value}
  $m=[regex]::Match($html,'(?is)<p[^>]*>(.*?)</p>'); if($m.Success){$ex=Strip $m.Groups[1].Value; if($ex.Length -gt 110){$ex=$ex.Substring(0,110).TrimEnd()+'…'}; $excerpt=$ex}

  $len=0; foreach($pp in [regex]::Matches($html,'(?is)<p[^>]*>(.*?)</p>')){ $len += (Strip $pp.Groups[1].Value).Length }
  $readmin=[math]::Max(1,[math]::Ceiling($len/350.0))

  $author=$segs[0]
  $group = if($segs.Count -ge 3){$segs[1]}else{""}
  if([string]::IsNullOrWhiteSpace($title)){ $title = if($segs.Count -ge 3){$segs[2]}else{$segs[-1]}; $missing += "제목없음: $f" }

  $map[$f]=[ordered]@{ created=$created; updated=$updated; date=$created; title=$title; cat=$cat; excerpt=$excerpt; author=$author; group=$group; readmin=$readmin }
}

# 2) 검증 — 디스크의 모든 글이 manifest에 들어갔는지 (누락=사고)
$onDisk = (Get-ChildItem -Path (Join-Path $base "봄딩"),(Join-Path $base "영도") -Recurse -Filter *.html -ErrorAction SilentlyContinue |
           ForEach-Object { (Resolve-Path $_.FullName -Relative).TrimStart('.','\') -replace '\\','/' })
foreach($d in $onDisk){
  if(-not $map.Contains($d)){ $missing += "manifest 누락(디스크에만 존재, 커밋 필요): $d" }
}

# 3) 기록
[System.IO.File]::WriteAllText((Join-Path $base "manifest.json"), ($map | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("✓ manifest.json 재생성: {0}편" -f $map.Count) -ForegroundColor Green
$map.GetEnumerator() | ForEach-Object { Write-Host ("   [{0}] {1}" -f $_.Value.created, $_.Key) }

if($missing.Count){
  Write-Host "`n⚠ 점검 필요 항목:" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
  exit 2
}
Write-Host "`n✓ 검증 통과: 디스크의 모든 글이 manifest에 반영됨." -ForegroundColor Green
