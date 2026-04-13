# archive-pm2-dump.ps1
# 用途：修改 dump.pm2 之前存档
# 用法：.\archive-pm2-dump.ps1

$bakDir = 'C:\Users\Administrator\.pm2'
$cfgFile = 'dump.pm2'
$src = Join-Path $bakDir $cfgFile
$ts = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$dst = Join-Path $bakDir "$cfgFile.bak.$ts"

if (!(Test-Path $src)) {
    Write-Host "[ERROR] $src not found"
    exit 1
}

Copy-Item $src $dst -Force
Write-Host "[OK] Archived: $dst"

$backups = Get-ChildItem "$bakDir\$cfgFile.bak.*" | Sort-Object LastWriteTime -Descending
if ($backups.Count -gt 10) {
    $toRemove = $backups | Select-Object -Skip 10
    $toRemove | Remove-Item -Force
    Write-Host "[CLEAN] Removed $($toRemove.Count) old backups"
}
