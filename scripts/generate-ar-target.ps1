# Generates the MindAR tracking target for the Main Altar station.
#
# Run:  powershell -ExecutionPolicy Bypass -File scripts/generate-ar-target.ps1
# Out:  public/ar/targets/main-altar-target.png
#
# WHY THIS LOOKS THE WAY IT DOES
#
# MindAR does not "see" a picture; it extracts feature points - corners and
# high-contrast junctions - and matches those against the camera. So the
# artwork is designed for the matcher first and the eye second:
#
#  * ASYMMETRIC on purpose. A rose window, the obvious liturgical choice, is
#    radially symmetric and therefore the WORST case: it matches itself at
#    several rotations, so the tracker cannot tell which way up it is and the
#    content flips. Nothing here mirrors or repeats at any angle.
#  * Feature density spread over the whole panel, not pooled in the middle.
#    Tracking survives partial occlusion only if features exist near every
#    edge - a hand over the centre should not kill it.
#  * Hard edges and high contrast. Gradients and soft shapes yield few stable
#    corners.
#  * No large flat areas, which contribute nothing to match against.
#  * Text, which is exceptionally corner-rich, and doubles as the label that
#    tells a pilgrim what they are pointing at.
#  * Matte colours. Printed gloss blows out under a phone torch and the
#    features disappear in the glare.

Add-Type -AssemblyName System.Drawing

$W = 1200
$H = 1600

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

function New-Brush([int]$r, [int]$gr, [int]$b) {
  New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, $r, $gr, $b))
}
function New-Pen([int]$r, [int]$gr, [int]$b, [single]$w) {
  New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, $r, $gr, $b)), $w
}

$cream = New-Brush 242 239 230
$navy  = New-Brush 28 44 86
$gold  = New-Brush 185 139 69
$ink   = New-Brush 20 23 31
$rust  = New-Brush 179 84 63

$g.FillRectangle($cream, 0, 0, $W, $H)

# --- Border: deliberately uneven widths, so no edge matches another --------
$g.FillRectangle($navy, 0, 0, $W, 26)
$g.FillRectangle($navy, 0, ($H - 44), $W, 44)
$g.FillRectangle($navy, 0, 0, 18, $H)
$g.FillRectangle($navy, ($W - 34), 0, 34, $H)

# --- Top-left: chevrons of varying height ---------------------------------
$y = 70
# NOTE: not $h. PowerShell variables are case-INSENSITIVE, so a loop
# variable named $h silently overwrites $H, the page height.
foreach ($chev in 34, 22, 46, 28, 38) {
  $pts = @(
    (New-Object System.Drawing.Point(60, $y)),
    (New-Object System.Drawing.Point(200, ($y + $chev))),
    (New-Object System.Drawing.Point(340, $y)),
    (New-Object System.Drawing.Point(340, ($y + 14))),
    (New-Object System.Drawing.Point(200, ($y + $chev + 14))),
    (New-Object System.Drawing.Point(60, ($y + 14)))
  )
  $g.FillPolygon($navy, $pts)
  $y += $chev + 30
}

# --- Top-right: arc wedges at irregular angles ----------------------------
$cx = 940; $cy = 150
foreach ($spec in @(@(200, 34, 300), @(242, 18, 250), @(272, 41, 205), @(320, 25, 160))) {
  $start = $spec[0]; $sweep = $spec[1]; $rad = $spec[2]
  $rect = New-Object System.Drawing.Rectangle(($cx - $rad), ($cy - $rad), ($rad * 2), ($rad * 2))
  $g.FillPie($gold, $rect, $start, $sweep)
}
$g.FillEllipse($navy, ($cx - 40), ($cy - 40), 80, 80)
$g.FillEllipse($cream, ($cx - 17), ($cy - 17), 34, 34)

# --- The cross: off-centre, with asymmetric inlay -------------------------
$crossX = 300
$g.FillRectangle($navy, $crossX, 430, 150, 640)     # upright
$g.FillRectangle($navy, ($crossX - 170), 610, 490, 132) # arm, longer to the left
$g.FillRectangle($gold, ($crossX + 30), 470, 28, 210)
$g.FillRectangle($gold, ($crossX + 84), 700, 22, 300)
$g.FillRectangle($gold, ($crossX - 120), 648, 150, 24)
$g.FillRectangle($rust, ($crossX + 196), 660, 92, 34)
$g.FillEllipse($cream, ($crossX + 44), 604, 62, 62)
$g.FillEllipse($ink, ($crossX + 60), 620, 30, 30)

# --- Right column: squares and diamonds, no two the same ------------------
$y = 470
foreach ($spec in @(@(74, 0), @(46, 1), @(92, 0), @(58, 1), @(38, 0), @(80, 1))) {
  $size = $spec[0]; $isDiamond = $spec[1]
  $x = 760 + ($size % 40)
  if ($isDiamond -eq 1) {
    $half = $size / 2
    $pts = @(
      (New-Object System.Drawing.Point(($x + $half), $y)),
      (New-Object System.Drawing.Point(($x + $size), ($y + $half))),
      (New-Object System.Drawing.Point(($x + $half), ($y + $size))),
      (New-Object System.Drawing.Point($x, ($y + $half)))
    )
    $g.FillPolygon($rust, $pts)
  } else {
    $g.FillRectangle($navy, $x, $y, $size, $size)
    $g.FillRectangle($gold, ($x + 10), ($y + 10), ($size - 20), ($size - 20))
  }
  $y += $size + 34
}

# --- Scattered triangles, irregular placement -----------------------------
foreach ($t in @(@(120, 1180, 54), @(620, 1120, 38), @(880, 1010, 66), @(430, 1230, 44), @(1010, 1180, 30))) {
  $x = $t[0]; $yy = $t[1]; $s = $t[2]
  $pts = @(
    (New-Object System.Drawing.Point($x, ($yy + $s))),
    (New-Object System.Drawing.Point(($x + ($s / 2)), $yy)),
    (New-Object System.Drawing.Point(($x + $s), ($yy + $s)))
  )
  $g.FillPolygon($ink, $pts)
}

# --- Rules of differing thickness -----------------------------------------
$g.FillRectangle($gold, 70, 1290, 1050, 9)
$g.FillRectangle($navy, 70, 1312, 640, 5)
$g.FillRectangle($rust, 70, 1326, 320, 3)

# --- Text: corner-rich, and it tells the pilgrim what this is -------------
$fTitle = New-Object System.Drawing.Font("Georgia", 74, [System.Drawing.FontStyle]::Bold)
$fSub   = New-Object System.Drawing.Font("Georgia", 27, [System.Drawing.FontStyle]::Italic)
$fMeta  = New-Object System.Drawing.Font("Consolas", 20, [System.Drawing.FontStyle]::Regular)

$g.DrawString("MAIN ALTAR", $fTitle, $navy, 64, 1352)
$g.DrawString("Mary Help of Christians Parish", $fSub, $ink, 70, 1456)
$g.DrawString("MAYPAJO . CALOOCAN . MHCP-ALTAR", $fMeta, $gold, 72, 1508)

$g.Dispose()

$outDir = Join-Path $PSScriptRoot "..\public\ar\targets"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$outFile = Join-Path $outDir "main-altar-target.png"

$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$size = [math]::Round((Get-Item $outFile).Length / 1KB)
Write-Output ("Wrote {0}  ({1}x{2}, {3} KB)" -f $outFile, $W, $H, $size)
