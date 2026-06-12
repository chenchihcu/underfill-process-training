# cleanup.ps1 - Delete old project folders
$smt3d = "C:\Users\user\Documents\Underfill\docs\reference\smt-3d-sim"
$training = "C:\Users\user\Documents\Underfill\docs\reference\underfill-process-training"

Write-Output "=== Deleting old project folders ==="

if (Test-Path $smt3d) {
    Remove-Item -Path $smt3d -Recurse -Force
    Write-Output "Deleted: $smt3d"
} else {
    Write-Output "Not found (already deleted?): $smt3d"
}

if (Test-Path $training) {
    Remove-Item -Path $training -Recurse -Force
    Write-Output "Deleted: $training"
} else {
    Write-Output "Not found (already deleted?): $training"
}

Write-Output ""
Write-Output "=== Remaining contents in docs/reference/ ==="
Get-ChildItem "C:\Users\user\Documents\Underfill\docs\reference" | Format-Table Name -AutoSize
