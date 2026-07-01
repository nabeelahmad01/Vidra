Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\Nabil_Ahmad\Desktop\Vidra\Vidra.png"
$resDir = "C:\Users\Nabil_Ahmad\Desktop\Vidra\app\android\app\src\main\res"

if (-not (Test-Path $sourcePath)) {
    Write-Error "Source icon not found at $sourcePath"
    exit 1
}

# Standard mipmap folders and sizes
$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

# Function to resize and save
function Resize-Image {
    param (
        [string]$sourceFile,
        [string]$destFile,
        [int]$width,
        [int]$height
    )
    
    $srcImg = [System.Drawing.Image]::FromFile($sourceFile)
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # High-quality interpolation and rendering options
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $g.DrawImage($srcImg, 0, 0, $width, $height)
    
    # Save image
    $bmp.Save($destFile, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Cleanup
    $g.Dispose()
    $bmp.Dispose()
    $srcImg.Dispose()
}

# Process each folder
foreach ($folder in $sizes.Keys) {
    $size = $sizes[$folder]
    $folderPath = Join-Path $resDir $folder
    
    if (-not (Test-Path $folderPath)) {
        New-Item -ItemType Directory -Force -Path $folderPath | Out-Null
    }
    
    # Output file paths
    $squarePath = Join-Path $folderPath "ic_launcher.png"
    $roundPath = Join-Path $folderPath "ic_launcher_round.png"
    
    # Generate square and round assets
    Write-Host "Generating launcher icons for $folder ($size x $size)..."
    Resize-Image -sourceFile $sourcePath -destFile $squarePath -width $size -height $size
    Resize-Image -sourceFile $sourcePath -destFile $roundPath -width $size -height $size
}

Write-Host "Android launcher icons generated successfully!"
