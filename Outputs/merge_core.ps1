# merge_core.ps1 - Core merge: index.html, simulation.html, build.ps1, deploy.yml

$srcA = "C:\Users\user\Documents\Underfill\docs\reference\underfill-process-training"
$srcB = "C:\Users\user\Documents\Underfill\docs\reference\smt-3d-sim"
$dest  = "C:\Users\user\Documents\Underfill\underfill-process-training"

Write-Output "=== Phase 2: index.html ==="
Copy-Item -Path "$srcA\index.html" -Destination "$dest\index.html" -Force
$content = Get-Content -Path "$dest\index.html" -Raw
if ($content -match "simulation\.html") {
    Write-Output "OK: simulation link present"
} else {
    Write-Output "PATCHING: adding simulation link"
    $patch = '<a href="simulation.html" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid #2563EB;border-radius:10px;background:#EFF6FF;color:#1D4ED8;font-size:14px;font-weight:600;text-decoration:none;margin:8px 8px 4px;">3D Simulator</a>'
    $content = $content -replace '(<nav id="nav"[^>]+>)', ('$1' + "`n      " + $patch)
    Set-Content -Path "$dest\index.html" -Value $content -Encoding UTF8
    Write-Output "PATCHED"
}
Write-Output "index.html: $((Get-Item "$dest\index.html").Length) bytes"

Write-Output ""
Write-Output "=== Phase 3: simulation.html ==="
$simContent = Get-Content -Path "$srcB\index.html" -Raw
$simContent = $simContent -replace 'href="training\.html"', 'href="index.html"'
$simContent = $simContent -replace "href='training\.html'", "href='index.html'"
$simContent = $simContent -replace 'smt-3d-sim/index\.html', 'simulation.html'
Set-Content -Path "$dest\simulation.html" -Value $simContent -Encoding UTF8

$verify = Get-Content -Path "$dest\simulation.html" -Raw
if ($verify -match 'href="index\.html"') {
    Write-Output "OK: Training button points to index.html"
} else {
    Write-Output "WARNING: check simulation.html links"
}
Write-Output "simulation.html: $((Get-Item "$dest\simulation.html").Length) bytes"

Write-Output ""
Write-Output "=== Phase 4a: build.ps1 ==="
# Write the build script (no Chinese characters to avoid encoding issues)
$b = "# scripts/build.ps1 - Unified build`r`n"
$b += '$srcDir  = Join-Path $PSScriptRoot "..\src"' + "`r`n"
$b += '$outDir  = Join-Path $PSScriptRoot "..\_site"' + "`r`n"
$b += '$null = New-Item -ItemType Directory -Path $outDir -Force' + "`r`n"
$b += '$outFile = Join-Path $outDir "index.html"' + "`r`n"
$b += "`r`n# Build teaching index.html`r`n"
$b += '$html = Get-Content -Raw (Join-Path $srcDir "index.html")' + "`r`n"
$b += '$css  = Get-Content -Raw (Join-Path $srcDir "css\style.css")' + "`r`n"
$b += '$js   = Get-Content -Raw (Join-Path $srcDir "js\app.js")' + "`r`n"
$b += '$css = $css -replace ' + "'/\*[\s\S]*?\*/', ''" + "`r`n"
$b += '$css = $css -replace ' + "'\s+', ' '" + "`r`n"
$b += '$css = $css -replace ' + "'\s*([{}:;,])\s*', " + "'" + '$1' + "'" + "`r`n"
$b += '$css = $css.Trim()' + "`r`n"
$b += '$js = $js -replace ' + "'//[^\n]*', ''" + "`r`n"
$b += '$js = $js -replace ' + "'/\*[\s\S]*?\*/', ''" + "`r`n"
$b += '$js = $js -replace ' + "'\s+', ' '" + "`r`n"
$b += '$js = $js.Trim()' + "`r`n"
$b += '$html = $html -replace ' + "'<link rel=" + '"stylesheet"' + " href=" + '"css/style\.css"' + " />', " + '"<style>$css</style>"' + "`r`n"
$b += '$html = $html -replace ' + "'<script src=" + '"js/app\.js"' + "></script>', " + '"<script>$js</script>"' + "`r`n"
$b += 'Set-Content -Path $outFile -Value $html -Encoding UTF8' + "`r`n"
$b += "Write-Output 'Built index.html'" + "`r`n"
$b += "`r`n# Copy simulation.html`r`n"
$b += 'Copy-Item -Path (Join-Path $PSScriptRoot "..\simulation.html") -Destination (Join-Path $outDir "simulation.html") -Force' + "`r`n"
$b += "Write-Output 'Copied simulation.html'" + "`r`n"
$b += "`r`n# Copy js/ (B project 9 modules)`r`n"
$b += 'Copy-Item -Path (Join-Path $PSScriptRoot "..\js") -Destination $outDir -Recurse -Force' + "`r`n"
$b += "Write-Output 'Copied js/'" + "`r`n"
$b += "`r`n# Copy css/ (B project dark theme)`r`n"
$b += 'Copy-Item -Path (Join-Path $PSScriptRoot "..\css") -Destination $outDir -Recurse -Force' + "`r`n"
$b += "Write-Output 'Copied css/'" + "`r`n"
$b += "`r`n# Copy A project simulation assets`r`n"
$b += '$simJsSrc  = Join-Path $srcDir "js\simulation"' + "`r`n"
$b += '$simJsDst  = Join-Path $outDir "src\js\simulation"' + "`r`n"
$b += '$simCssSrc = Join-Path $srcDir "css\simulation.css"' + "`r`n"
$b += '$simCssDst = Join-Path $outDir "src\css\simulation.css"' + "`r`n"
$b += '$null = New-Item -ItemType Directory -Path (Split-Path $simCssDst -Parent) -Force' + "`r`n"
$b += '$null = New-Item -ItemType Directory -Path $simJsDst -Force' + "`r`n"
$b += 'Copy-Item -Path $simCssSrc -Destination $simCssDst -Force' + "`r`n"
$b += 'Copy-Item -Path "$simJsSrc\*" -Destination $simJsDst -Recurse -Force' + "`r`n"
$b += "Write-Output 'Copied simulation assets'" + "`r`n"
$b += "Write-Output 'Build complete: _site/ ready'" + "`r`n"
$b += "exit 0" + "`r`n"

Set-Content -Path "$dest\scripts\build.ps1" -Value $b -Encoding UTF8
Write-Output "Updated: scripts/build.ps1"

Write-Output ""
Write-Output "=== Phase 4b: deploy.yml ==="
$d  = "name: Build & Deploy to GitHub Pages`n"
$d += "`non:`n  push:`n    branches: [main, master]`n`n"
$d += "permissions:`n  contents: read`n  pages: write`n  id-token: write`n`n"
$d += "concurrency:`n  group: pages`n  cancel-in-progress: true`n`n"
$d += "jobs:`n  build:`n    runs-on: windows-latest`n    steps:`n"
$d += "      - uses: actions/checkout@v4`n"
$d += "      - name: Build unified project`n        shell: pwsh`n        run: .\scripts\build.ps1`n"
$d += "      - name: Upload Pages artifact`n        uses: actions/upload-pages-artifact@v3`n        with:`n          path: _site`n"
$d += "  deploy:`n    needs: build`n    runs-on: ubuntu-latest`n    environment:`n"
$d += "      name: github-pages`n      url: `${{ steps.deployment.outputs.page_url }}`n"
$d += "    steps:`n      - name: Deploy to GitHub Pages`n        id: deployment`n        uses: actions/deploy-pages@v4`n"
Set-Content -Path "$dest\.github\workflows\deploy.yml" -Value $d -Encoding UTF8
Write-Output "Updated: deploy.yml"

Write-Output ""
Write-Output "=== Verification ==="
Write-Output "New project files:"
Get-ChildItem $dest | Format-Table Name -AutoSize
