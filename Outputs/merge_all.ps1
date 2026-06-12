# merge_all.ps1 - Complete merge script (fixed heredoc)

$srcA = "C:\Users\user\Documents\Underfill\docs\reference\underfill-process-training"
$srcB = "C:\Users\user\Documents\Underfill\docs\reference\smt-3d-sim"
$dest  = "C:\Users\user\Documents\Underfill\underfill-process-training"

# =============================================================
Write-Output "=== Phase 2: Copy root index.html (A project, light theme) ==="
# =============================================================
Copy-Item -Path "$srcA\index.html" -Destination "$dest\index.html" -Force

$content = Get-Content -Path "$dest\index.html" -Raw
if ($content -match "simulation\.html") {
    Write-Output "OK: simulation.html link found in index.html"
} else {
    Write-Output "MISSING: simulation.html link not found - patching"
    $patch = '<a href="simulation.html" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid #2563EB;border-radius:10px;background:#EFF6FF;color:#1D4ED8;font-size:14px;font-weight:600;text-decoration:none;margin:8px 8px 4px;">&#x1F9EA; 3D &#x6a21;&#x64ec;&#x5ba4;</a>'
    $content = $content -replace '(<nav id="nav"[^>]+>)', "`$1`n      $patch"
    Set-Content -Path "$dest\index.html" -Value $content -Encoding UTF8
    Write-Output "PATCHED: simulation.html link added"
}
Write-Output "index.html: $((Get-Item "$dest\index.html").Length) bytes"

# =============================================================
Write-Output ""
Write-Output "=== Phase 3: Create simulation.html (B project 3D simulator) ==="
# =============================================================
$simContent = Get-Content -Path "$srcB\index.html" -Raw

# Fix: change training.html references to index.html
$simContent = $simContent -replace 'href="training\.html"', 'href="index.html"'
$simContent = $simContent -replace "href='training\.html'", "href='index.html'"

# Fix: clean up hardcoded local path hint
$simContent = $simContent -replace [regex]::Escape('python -m http.server 8000 -d "C:\\Users\\user\\Desktop\\未整理檔案"'), 'python -m http.server 8000'
$simContent = $simContent -replace 'smt-3d-sim/index\.html', 'simulation.html'

Set-Content -Path "$dest\simulation.html" -Value $simContent -Encoding UTF8

$verify = Get-Content -Path "$dest\simulation.html" -Raw
if ($verify -match 'href="index\.html"') {
    Write-Output "OK: Training button now points to index.html"
} else {
    Write-Output "WARNING: index.html link may not be set correctly"
}
Write-Output "simulation.html: $((Get-Item "$dest\simulation.html").Length) bytes"

# =============================================================
Write-Output ""
Write-Output "=== Phase 4a: Update scripts/build.ps1 ==="
# =============================================================
$buildLines = @(
    '# scripts/build.ps1 - Unified build: teaching + 3D simulator',
    '',
    '$srcDir  = Join-Path $PSScriptRoot "..\src"',
    '$outDir  = Join-Path $PSScriptRoot "..\_site"',
    '$null = New-Item -ItemType Directory -Path $outDir -Force',
    '$outFile = Join-Path $outDir "index.html"',
    '',
    '# === Build teaching index.html (light theme, inline CSS+JS) ===',
    '$html = Get-Content -Raw (Join-Path $srcDir "index.html")',
    '$css  = Get-Content -Raw (Join-Path $srcDir "css\style.css")',
    '$js   = Get-Content -Raw (Join-Path $srcDir "js\app.js")',
    '',
    '# Minify CSS',
    '$css = $css -replace ''/\*[\s\S]*?\*/'', ''''',
    '$css = $css -replace ''\s+'', '' ''',
    '$css = $css -replace ''\s*([{}:;,])\s*'', ''$1''',
    '$css = $css.Trim()',
    '',
    '# Minify JS',
    '$js = $js -replace ''//[^\n]*'', ''''',
    '$js = $js -replace ''/\*[\s\S]*?\*/'', ''''',
    '$js = $js -replace ''\s+'', '' ''',
    '$js = $js.Trim()',
    '',
    '# Inline into HTML',
    '$html = $html -replace ''<link rel="stylesheet" href="css/style\.css" />'', "<style>$css</style>"',
    '$html = $html -replace ''<script src="js/app\.js"></script>'', "<script>$js</script>"',
    'Set-Content -Path $outFile -Value $html -Encoding UTF8',
    'Write-Output "Built index.html: $([math]::Round((Get-Item $outFile).Length/1KB, 1)) KB"',
    '',
    '# === Copy simulation.html (no minification - ES modules) ===',
    '$simSrc = Join-Path $PSScriptRoot "..\simulation.html"',
    '$simDst = Join-Path $outDir "simulation.html"',
    'Copy-Item -Path $simSrc -Destination $simDst -Force',
    'Write-Output "Copied: simulation.html"',
    '',
    '# === Copy B project JS (3D engine, 9 modules + physics + training) ===',
    '$jsSrc = Join-Path $PSScriptRoot "..\js"',
    'Copy-Item -Path $jsSrc -Destination $outDir -Recurse -Force',
    'Write-Output "Copied: js/"',
    '',
    '# === Copy B project CSS (dark theme) ===',
    '$cssSrc = Join-Path $PSScriptRoot "..\css"',
    'Copy-Item -Path $cssSrc -Destination $outDir -Recurse -Force',
    'Write-Output "Copied: css/"',
    '',
    '# === Copy A project simulation assets ===',
    '$simJsSrc  = Join-Path $srcDir "js\simulation"',
    '$simJsDst  = Join-Path $outDir "src\js\simulation"',
    '$simCssSrc = Join-Path $srcDir "css\simulation.css"',
    '$simCssDst = Join-Path $outDir "src\css\simulation.css"',
    '$null = New-Item -ItemType Directory -Path (Split-Path $simCssDst -Parent) -Force',
    '$null = New-Item -ItemType Directory -Path $simJsDst -Force',
    'Copy-Item -Path $simCssSrc -Destination $simCssDst -Force',
    'Copy-Item -Path "$simJsSrc\*" -Destination $simJsDst -Recurse -Force',
    'Write-Output "Copied: src/js/simulation + src/css/simulation.css"',
    '',
    'Write-Output ""',
    'Write-Output "=== Build Complete: _site/ ready ==="',
    'exit 0'
)
Set-Content -Path "$dest\scripts\build.ps1" -Value ($buildLines -join "`r`n") -Encoding UTF8
Write-Output "Updated: scripts/build.ps1"

# =============================================================
Write-Output ""
Write-Output "=== Phase 4b: Update .github/workflows/deploy.yml ==="
# =============================================================
$deployLines = @(
    'name: Build & Deploy to GitHub Pages',
    '',
    'on:',
    '  push:',
    '    branches: [main, master]',
    '',
    'permissions:',
    '  contents: read',
    '  pages: write',
    '  id-token: write',
    '',
    'concurrency:',
    '  group: pages',
    '  cancel-in-progress: true',
    '',
    'jobs:',
    '  build:',
    '    runs-on: windows-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - name: Build unified project',
    '        shell: pwsh',
    '        run: .\scripts\build.ps1',
    '      - name: Upload Pages artifact',
    '        uses: actions/upload-pages-artifact@v3',
    '        with:',
    '          path: _site',
    '  deploy:',
    '    needs: build',
    '    runs-on: ubuntu-latest',
    '    environment:',
    '      name: github-pages',
    '      url: ${{ steps.deployment.outputs.page_url }}',
    '    steps:',
    '      - name: Deploy to GitHub Pages',
    '        id: deployment',
    '        uses: actions/deploy-pages@v4'
)
Set-Content -Path "$dest\.github\workflows\deploy.yml" -Value ($deployLines -join "`n") -Encoding UTF8
Write-Output "Updated: .github/workflows/deploy.yml"

# =============================================================
Write-Output ""
Write-Output "=== Phase 4c: Update README.md ==="
# =============================================================
$readmeLines = @(
    '# Underfill 製程訓練 + SMT 3D 模擬器',
    '',
    '整合版本：Underfill 製程訓練教材（明亮主題）+ SMT 3D Process Simulator（含 9 個模組）。',
    '',
    '## 功能',
    '',
    '### 教學訓練 (index.html)',
    '互動式訓練教材，涵蓋材料規格 (UF3808)、製程流程、參數控制 (KPI)、點膠 Pattern 決策 (I/L/U)、檢驗標準 (Visual/X-Ray/CSAM) 與實戰案例。',
    '',
    '### 3D 模擬器 (simulation.html)',
    'SMT 製程 3D 模擬器，包含 9 個模組：',
    '- Underfill Dispensing',
    '- SPI - Solder Paste Inspection',
    '- FPC Assembly (FPCA)',
    '- Reflow Soldering',
    '- BGA Cross-Section',
    '- Capillary Flow Lab',
    '- Dispensing Pattern Lab',
    '- Void Simulation',
    '- Warpage Analysis',
    '',
    '## 使用方式',
    '',
    '### 教學訓練（可離線直接開啟）',
    '```',
    '直接用瀏覽器開啟 index.html',
    '```',
    '',
    '### 3D 模擬器（需 HTTP 伺服器）',
    '```bash',
    '# 在專案目錄執行',
    'python -m http.server 8000',
    '# 然後開啟 http://localhost:8000/simulation.html',
    '```',
    '',
    '### 建置生產版本',
    '```powershell',
    '.\scripts\build.ps1',
    '# 輸出至 _site/ 目錄',
    '```',
    '',
    '## 專案結構',
    '',
    '```',
    '├── index.html              # 教學訓練主頁（明亮主題，可離線）',
    '├── simulation.html         # SMT 3D 模擬器（深色主題，需伺服器）',
    '├── js/                     # 3D 模擬器 JS 引擎',
    '│   ├── app.js              # 主控制器',
    '│   ├── scene.js            # Three.js 場景',
    '│   ├── ui.js               # UI 控制面板',
    '│   ├── data/               # Analytics, Flow Controller',
    '│   ├── helpers/            # Animation, Geometry, Materials',
    '│   ├── modules/            # 9 個 3D 模擬模組',
    '│   ├── physics/            # SPH-2D, Heat-2D, FEA',
    '│   └── training/           # Defect Lab, Scenarios',
    '├── css/',
    '│   └── style.css           # 3D 模擬器深色主題',
    '├── src/                    # 教學訓練開發原始檔',
    '│   ├── index.html',
    '│   ├── css/style.css       # 教學頁明亮主題',
    '│   └── js/app.js           # 教學頁 JS 模組',
    '├── scripts/',
    '│   └── build.ps1           # 建置腳本',
    '├── .github/workflows/',
    '│   └── deploy.yml          # CI/CD → GitHub Pages',
    '└── TERMINOLOGY.md          # 術語中英對照表',
    '```',
    '',
    '## 技術規格',
    '',
    '- 教學頁：純 HTML/CSS/JS，零依賴，可離線',
    '- 3D 模擬器：Three.js v0.160（CDN），ES Modules',
    '- 明亮主題設計系統（教學頁）',
    '- 深色主題 3D 介面（模擬器）',
    '- localStorage 狀態持久化',
    '',
    '## 部署',
    '',
    '推送到 `main` 或 `master` 分支後自動建置並部署至 GitHub Pages。'
)
Set-Content -Path "$dest\README.md" -Value ($readmeLines -join "`n") -Encoding UTF8
Write-Output "Updated: README.md"

# =============================================================
Write-Output ""
Write-Output "=== All Phases Complete ==="
Write-Output ""
Write-Output "Final directory listing of new project:"
Get-ChildItem $dest | Format-Table Name, LastWriteTime -AutoSize
