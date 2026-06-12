# verify.ps1
$dest = "C:\Users\user\Documents\Underfill\underfill-process-training"

Write-Output "=== index.html link check ==="
$idx = Get-Content -Path (Join-Path $dest "index.html") -Raw
$simMatch = [regex]::Match($idx, 'href=[\"'']simulation\.html[\"'']')
if ($simMatch.Success) {
    Write-Output "OK: simulation.html link found"
} else {
    Write-Output "FAIL: simulation.html link missing"
}

Write-Output ""
Write-Output "=== simulation.html link check ==="
$sim = Get-Content -Path (Join-Path $dest "simulation.html") -Raw
$idxMatch = [regex]::Match($sim, 'href="index\.html"')
if ($idxMatch.Success) {
    Write-Output "OK: index.html link found in Training button"
} else {
    Write-Output "FAIL: index.html link missing in simulation.html"
}

Write-Output ""
Write-Output "=== Root files ==="
Get-ChildItem $dest -File | Select-Object Name, Length | Format-Table -AutoSize

Write-Output "=== JS modules (9 expected) ==="
Get-ChildItem (Join-Path $dest "js\modules") | Select-Object Name | Format-Table -AutoSize

Write-Output "=== Physics modules ==="
Get-ChildItem (Join-Path $dest "js\physics") | Select-Object Name | Format-Table -AutoSize

Write-Output "=== Build output _site root ==="
Get-ChildItem (Join-Path $dest "_site") -File | Select-Object Name, Length | Format-Table -AutoSize
