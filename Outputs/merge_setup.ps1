# merge_setup.ps1 - Stage 1: Setup new project directory

$dest = "C:\Users\user\Documents\Underfill\underfill-process-training"
$srcA = "C:\Users\user\Documents\Underfill\docs\reference\underfill-process-training"
$srcB = "C:\Users\user\Documents\Underfill\docs\reference\smt-3d-sim"

Write-Output "=== Stage 1: Create new project structure ==="
Write-Output "dest: $dest"
Write-Output "srcA: $srcA"
Write-Output "srcB: $srcB"

# Create new project root
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Write-Output "Created: $dest"

# Copy A project support files
Copy-Item -Path (Join-Path $srcA ".gitignore") -Destination (Join-Path $dest ".gitignore") -Force
Copy-Item -Path (Join-Path $srcA "netlify.toml") -Destination (Join-Path $dest "netlify.toml") -Force
Copy-Item -Path (Join-Path $srcA "TERMINOLOGY.md") -Destination (Join-Path $dest "TERMINOLOGY.md") -Force
Write-Output "Copied: .gitignore, netlify.toml, TERMINOLOGY.md"

# Copy .github/workflows
New-Item -ItemType Directory -Path (Join-Path $dest ".github\workflows") -Force | Out-Null
Copy-Item -Path (Join-Path $srcA ".github\workflows\*") -Destination (Join-Path $dest ".github\workflows\") -Recurse -Force
Write-Output "Copied: .github/workflows/"

# Copy scripts/
New-Item -ItemType Directory -Path (Join-Path $dest "scripts") -Force | Out-Null
Copy-Item -Path (Join-Path $srcA "scripts\*") -Destination (Join-Path $dest "scripts\") -Recurse -Force
Write-Output "Copied: scripts/"

# Copy src/ directory (A project source files)
Copy-Item -Path (Join-Path $srcA "src") -Destination $dest -Recurse -Force
Write-Output "Copied: src/"

# Copy B project js/ directory (complete 3D engine - all 9 modules)
Copy-Item -Path (Join-Path $srcB "js") -Destination $dest -Recurse -Force
Write-Output "Copied: js/ (B project - 9 modules + physics engine)"

# Copy B project css/ directory (dark theme for simulation.html)
Copy-Item -Path (Join-Path $srcB "css") -Destination $dest -Recurse -Force
Write-Output "Copied: css/ (B project dark theme)"

Write-Output ""
Write-Output "=== Stage 1 Complete ==="
Write-Output ""
Write-Output "New directory contents:"
Get-ChildItem $dest | Format-Table Name, LastWriteTime -AutoSize
