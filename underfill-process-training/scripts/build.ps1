# scripts/build.ps1 - Unified build
$srcDir  = Join-Path $PSScriptRoot "..\src"
$outDir  = Join-Path $PSScriptRoot "..\_site"
$null = New-Item -ItemType Directory -Path $outDir -Force
$outFile = Join-Path $outDir "index.html"

# Build teaching index.html
$html = Get-Content -Raw (Join-Path $srcDir "index.html")
$css  = Get-Content -Raw (Join-Path $srcDir "css\style.css")
$js   = Get-Content -Raw (Join-Path $srcDir "js\app.js")
$css = $css -replace '/\*[\s\S]*?\*/', ''
$css = $css -replace '\s+', ' '
$css = $css -replace '\s*([{}:;,])\s*', '$1'
$css = $css.Trim()
$js = $js -replace '//[^\n]*', ''
$js = $js -replace '/\*[\s\S]*?\*/', ''
$js = $js -replace '\s+', ' '
$js = $js.Trim()
$html = $html -replace '<link rel="stylesheet" href="css/style\.css" />', "<style>$css</style>"
$html = $html -replace '<script src="js/app\.js"></script>', "<script>$js</script>"
Set-Content -Path $outFile -Value $html -Encoding UTF8
Write-Output 'Built index.html'

# Copy simulation.html
Copy-Item -Path (Join-Path $PSScriptRoot "..\simulation.html") -Destination (Join-Path $outDir "simulation.html") -Force
Write-Output 'Copied simulation.html'

# Copy js/ (B project 9 modules)
Copy-Item -Path (Join-Path $PSScriptRoot "..\js") -Destination $outDir -Recurse -Force
Write-Output 'Copied js/'

# Copy css/ (B project dark theme)
Copy-Item -Path (Join-Path $PSScriptRoot "..\css") -Destination $outDir -Recurse -Force
Write-Output 'Copied css/'

# Copy A project simulation assets
$simJsSrc  = Join-Path $srcDir "js\simulation"
$simJsDst  = Join-Path $outDir "src\js\simulation"
$simCssSrc = Join-Path $srcDir "css\simulation.css"
$simCssDst = Join-Path $outDir "src\css\simulation.css"
$null = New-Item -ItemType Directory -Path (Split-Path $simCssDst -Parent) -Force
$null = New-Item -ItemType Directory -Path $simJsDst -Force
Copy-Item -Path $simCssSrc -Destination $simCssDst -Force
Copy-Item -Path "$simJsSrc\*" -Destination $simJsDst -Recurse -Force
Write-Output 'Copied simulation assets'
Write-Output 'Build complete: _site/ ready'
exit 0

