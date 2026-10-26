# Domissi Hermanos — fotos por producto.
# Lee las fotos de cargar-fotos/ (nombre = código del producto, ej. "1234.jpg" o "1234 barra 8mm.jpg"),
# las achica a 1400 px como JPG en assets/productos/fotos/<código>.jpg y regenera js/product-photos.js.
# Lo lanza "cargar-fotos/ACTUALIZAR FOTOS.bat". Solo usa lo que trae Windows (PowerShell + System.Drawing).
# La carpeta de salida la maneja este script: si se borra una foto de cargar-fotos/, se borra también de la web.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$src    = Join-Path $root "cargar-fotos"
$out    = Join-Path $root "assets\productos\fotos"
$jsFile = Join-Path $root "js\product-photos.js"
$data   = Join-Path $root "js\products-data.js"
$MAX    = 1400
$QUALITY = 82
$exts   = @(".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif", ".tiff")

if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

# Códigos y descripciones de los productos activos (para avisar si una foto no corresponde a ningún producto)
$products = @{}
$text = [IO.File]::ReadAllText($data, [Text.Encoding]::UTF8)
foreach ($m in [regex]::Matches($text, '\[(\d+),"((?:[^"\\]|\\.)*)"')) { $products[$m.Groups[1].Value] = $m.Groups[2].Value }

$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encParams = New-Object Drawing.Imaging.EncoderParameters 1
$encParams.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), ([long]$QUALITY)

function Save-Resized($inPath, $outPath) {
  $img = [Drawing.Image]::FromFile($inPath)
  try {
    # Fotos de celular: respetar la orientación EXIF
    if ($img.PropertyIdList -contains 0x0112) {
      switch ([int]$img.GetPropertyItem(0x0112).Value[0]) {
        3 { $img.RotateFlip([Drawing.RotateFlipType]::Rotate180FlipNone) }
        6 { $img.RotateFlip([Drawing.RotateFlipType]::Rotate90FlipNone) }
        8 { $img.RotateFlip([Drawing.RotateFlipType]::Rotate270FlipNone) }
      }
    }
    $scale = [Math]::Min(1.0, $MAX / [Math]::Max($img.Width, $img.Height))
    $w = [int][Math]::Round($img.Width * $scale); $h = [int][Math]::Round($img.Height * $scale)
    $bmp = New-Object Drawing.Bitmap $w, $h
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.Clear([Drawing.Color]::White)  # PNG con transparencia → fondo blanco
    $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose()
    $bmp.Save($outPath, $jpeg, $encParams)
    $bmp.Dispose()
  } finally { $img.Dispose() }
}

$photos = [ordered]@{}
$nuevas = 0; $avisos = @()
$files = Get-ChildItem -Path $src -File | Where-Object { $exts -contains $_.Extension.ToLower() } | Sort-Object Name
foreach ($f in $files) {
  if ($f.BaseName -notmatch '^\s*(\d+)') { $avisos += "  - '$($f.Name)': el nombre no empieza con un código de producto. No se usó."; continue }
  $code = [string][int]$Matches[1]
  if (-not $products.ContainsKey($code)) { $avisos += "  - '$($f.Name)': no hay ningún producto activo con código $code. No se usó."; continue }
  if ($photos.Contains($code)) { $avisos += "  - '$($f.Name)': ya hay otra foto para el código $code. Se usó solo la primera."; continue }
  $dest = Join-Path $out "$code.jpg"
  # La copia web lleva la misma fecha que el original: si difiere (foto nueva o reemplazada, aunque sea más vieja), se regenera
  if (-not (Test-Path $dest) -or (Get-Item $dest).LastWriteTime -ne $f.LastWriteTime) {
    try { Save-Resized $f.FullName $dest; (Get-Item $dest).LastWriteTime = $f.LastWriteTime; $nuevas++; Write-Host "  + $code  $($products[$code])" }
    catch { $avisos += "  - '$($f.Name)': no se pudo abrir la imagen ($($_.Exception.Message))."; continue }
  }
  $photos[$code] = "assets/productos/fotos/$code.jpg?v=" + $f.LastWriteTime.ToString("yyyyMMddHHmmss")
}

# Fotos que ya no están en cargar-fotos/: se sacan de la web
$borradas = 0
Get-ChildItem -Path $out -File -Filter *.jpg | Where-Object { -not $photos.Contains($_.BaseName) } | ForEach-Object { Remove-Item $_.FullName; $borradas++ }

$lines = @($photos.Keys | ForEach-Object { '  "' + $_ + '": "' + $photos[$_] + '"' })
$js = "/* Domissi Hermanos — fotos por producto (código → imagen).`r`n" +
      "   ARCHIVO GENERADO por cargar-fotos/ACTUALIZAR FOTOS.bat (tools/fotos.ps1). No editar a mano. */`r`n" +
      "window.DOMISSI_PHOTOS = {" + $(if ($lines.Count) { "`r`n" + ($lines -join ",`r`n") + "`r`n" } else { "" }) + "};`r`n"
[IO.File]::WriteAllText($jsFile, $js, (New-Object Text.UTF8Encoding $false))

# Nueva versión en productos.html para que los navegadores no sigan usando la lista vieja guardada en caché
$page = Join-Path $root "productos.html"
$html = [IO.File]::ReadAllText($page, [Text.Encoding]::UTF8)
$html = [regex]::Replace($html, 'js/product-photos\.js(\?v=[^"]*)?"', 'js/product-photos.js?v=' + (Get-Date -Format "yyyyMMddHHmmss") + '"')
[IO.File]::WriteAllText($page, $html, (New-Object Text.UTF8Encoding $false))

Write-Host ""
Write-Host "Listo. Productos con foto: $($photos.Count)  (nuevas o cambiadas: $nuevas, quitadas: $borradas)"
if ($avisos.Count) { Write-Host ""; Write-Host "Revisar:" -ForegroundColor Yellow; $avisos | ForEach-Object { Write-Host $_ -ForegroundColor Yellow } }
Write-Host ""
Write-Host "Para publicar, subí al hosting: la carpeta assets/productos/fotos/, js/product-photos.js y productos.html"
