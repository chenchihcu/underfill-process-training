# scripts/build.ps1
# Minify CSS/JS and inline into single index.html for production

$srcDir  = Join-Path $PSScriptRoot "..\src"
$outDir  = Join-Path $PSScriptRoot "..\_site"
$null = New-Item -ItemType Directory -Path $outDir -Force
$outFile = Join-Path $outDir "index.html"

$html = Get-Content -Raw (Join-Path $srcDir "index.html")
$css  = Get-Content -Raw (Join-Path $srcDir "css\style.css")
$js   = Get-Content -Raw (Join-Path $srcDir "js\app.js")

# Minify CSS
$css = $css -replace '/\*[\s\S]*?\*/', ''
$css = $css -replace '\s+', ' '
$css = $css -replace '\s*([{}:;,])\s*', '$1'
$css = $css.Trim()

# Minify JS
$js = $js -replace '//[^\n]*', ''
$js = $js -replace '/\*[\s\S]*?\*/', ''
$js = $js -replace '\s+', ' '
$js = $js -replace '\s*([{}();,=+\-*/<>!])\s*', '$1'
$js = $js.Trim()

# Inline into HTML
$html = $html -replace '<link rel="stylesheet" href="css/style.css" />', "<style>$css</style>"
$html = $html -replace '<script src="js/app.js"></script>', "<script>$js</script>"

Set-Content -Path $outFile -Value $html -Encoding UTF8

# Copy simulation.html (ES module, no minification)
$simFile = Join-Path $outDir "simulation.html"
Copy-Item -Path (Join-Path $PSScriptRoot "..\simulation.html") -Destination $simFile -Force

# Copy simulation CSS/JS directories
$simJsSrc = Join-Path $srcDir "js\simulation"
$simJsDst = Join-Path $outDir "src\js\simulation"
$simCssSrc = Join-Path $srcDir "css\simulation.css"
$simCssDst = Join-Path $outDir "src\css\simulation.css"

# Ensure output directories exist
$null = New-Item -ItemType Directory -Path (Split-Path $simCssDst -Parent) -Force
$null = New-Item -ItemType Directory -Path $simJsDst -Force

# Copy CSS
Copy-Item -Path $simCssSrc -Destination $simCssDst -Force

# Copy JS recursively using robocopy
robocopy $simJsSrc $simJsDst /E /NDL /NJH /NJS /NP /NS 2>$null
# robocopy exit code 1 means success (files copied), treat as 0
if ($LASTEXITCODE -ge 2) { Write-Error "robocopy failed with exit $LASTEXITCODE"; exit 1 }

Write-Output "Built: $outFile ($([math]::Round((Get-Item $outFile).Length/1KB, 1)) KB)"
Write-Output "Copied: simulation.html + assets"
