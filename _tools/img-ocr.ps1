# img-ocr.ps1 - Windows built-in OCR (Windows.Media.Ocr) for official notice images. LLM cost 0.
# Copy of _glossary/dokkaebi forum_ocr.ps1 (2026-10-09) made generic on 2026-10-26 for _tools/notice-ocr.py.
# ASCII-only on purpose (PS 5.1 parses non-BOM files as ANSI).
#   powershell -NoProfile -ExecutionPolicy Bypass -File img-ocr.ps1 -ImgDir <dir> [-Scales 2,3] [-Lang ko|en]
# For every image in ImgDir writes <file>.ocr.txt (UTF-8, no BOM): 'SIZE WxH', then per scale a '--- xN' block of recognized lines.
# Small UI text (10~13px) is misread at 1x, so the image is upscaled first. Two scales are kept because each misreads different glyphs
# (measured 2026-10-09 on guide 7951: x2 and x3 each recover '22:00' in cells the other garbles) - recall matters more than neatness.
param(
    [Parameter(Mandatory = $true)][string]$ImgDir,
    [string]$Scales = '2,3',
    [string]$Lang = 'ko'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.RandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
[void][Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($op, [Type]$type) {
    $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    $t.Wait(-1) | Out-Null
    $t.Result
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language $Lang))
if ($null -eq $engine) { Write-Output "ERR no OCR engine for language $Lang"; exit 2 }
$maxDim = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
$utf8 = New-Object System.Text.UTF8Encoding($false)
$ok = 0; $bad = 0
$files = @(Get-ChildItem -LiteralPath $ImgDir -File | Where-Object { $_.Extension -match '^\.(png|jpe?g|gif|bmp|webp)$' })
foreach ($f in $files) {
    $out = $f.FullName + '.ocr.txt'
    try {
        $sf = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
        $st = Await ($sf.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($st)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $w = [int]$dec.PixelWidth; $h = [int]$dec.PixelHeight
        $buf = New-Object System.Collections.Generic.List[string]
        $buf.Add("SIZE " + $w + "x" + $h)
        foreach ($sc in ($Scales -split ',')) {
            $s = [double]$sc
            if ($w * $s -gt $maxDim) { $s = $maxDim / $w }
            if ($h * $s -gt $maxDim) { $s = $maxDim / $h }
            $tr = New-Object Windows.Graphics.Imaging.BitmapTransform
            $tr.ScaledWidth = [uint32][math]::Max(1, [math]::Floor($w * $s))
            $tr.ScaledHeight = [uint32][math]::Max(1, [math]::Floor($h * $s))
            $tr.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant
            $bmp = Await ($dec.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $tr, [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
            $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
            $buf.Add("--- x" + $sc.Trim())
            foreach ($ln in $res.Lines) { $buf.Add($ln.Text) }
            $bmp.Dispose()
        }
        [IO.File]::WriteAllText($out, (($buf -join "`n") + "`n"), $utf8)
        $st.Dispose()
        $ok++
    }
    catch {
        [IO.File]::WriteAllText($out, ("ERR " + $_.Exception.Message + "`n"), $utf8)
        $bad++
    }
}
Write-Output ("OCR ok=" + $ok + " fail=" + $bad + " dir=" + $ImgDir)
if ($bad -gt 0) { exit 1 } else { exit 0 }
