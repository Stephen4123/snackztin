Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\user\Downloads\Choco-Shop\uploads\choco-1795357882540-491298133.png"
$destPathJpg = "c:\Users\user\Downloads\Choco-Shop\og-logo.jpg"
$destPathPng = "c:\Users\user\Downloads\Choco-Shop\og-logo.png"

$srcImage = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Output "Source Dimensions: $($srcImage.Width) x $($srcImage.Height)"

# 1200 x 630 Canvas
$targetW = 1200
$targetH = 630

$bmp = New-Object System.Drawing.Bitmap($targetW, $targetH)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# Determine background color from top-left pixel of source image
$cornerPixel = $srcImage.GetPixel(10, 10)
$bgColor = [System.Drawing.Color]::FromArgb(255, $cornerPixel.R, $cornerPixel.G, $cornerPixel.B)
Write-Output "Background color: R=$($cornerPixel.R) G=$($cornerPixel.G) B=$($cornerPixel.B)"

$brush = New-Object System.Drawing.SolidBrush($bgColor)
$graphics.FillRectangle($brush, 0, 0, $targetW, $targetH)

# Scale source image to fit comfortably inside 1200x630 with some breathing room padding
$scale = [Math]::Min(($targetW * 0.90) / $srcImage.Width, ($targetH * 0.85) / $srcImage.Height)
$drawW = [int]($srcImage.Width * $scale)
$drawH = [int]($srcImage.Height * $scale)
$drawX = [int](($targetW - $drawW) / 2)
$drawY = [int](($targetH - $drawH) / 2)

$graphics.DrawImage($srcImage, $drawX, $drawY, $drawW, $drawH)

# Save as JPEG with 88% quality
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatDescription -eq "JPEG" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]88)

$bmp.Save($destPathJpg, $encoder, $encoderParams)
$bmp.Save($destPathPng, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bmp.Dispose()
$srcImage.Dispose()
$brush.Dispose()

$jpgSize = (Get-Item $destPathJpg).Length
$pngSize = (Get-Item $destPathPng).Length
Write-Output "Created $destPathJpg ($jpgSize bytes)"
Write-Output "Created $destPathPng ($pngSize bytes)"
