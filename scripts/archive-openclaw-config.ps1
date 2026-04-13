# archive-openclaw-config.ps1
# 用途：修改 openclaw.json 之前自动存档
# 用法：.\archive-openclaw-config.ps1

$bakDir = 'C:\Users\Administrator\.openclaw'
$cfgFile = 'openclaw.json'
$ts = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$src = Join-Path $bakDir $cfgFile
$dst = Join-Path $bakDir "$cfgFile.bak.$ts"

if (!(Test-Path $src)) {
    Write-Host "[ERROR] $src not found"
    exit 1
}

Copy-Item $src $dst -Force
Write-Host "[OK] Archived: $dst"

# 保留最近10个
$backups = Get-ChildItem "$bakDir\$cfgFile.bak.*" | Sort-Object LastWriteTime -Descending
if ($backups.Count -gt 10) {
    $toRemove = $backups | Select-Object -Skip 10
    $toRemove | Remove-Item -Force
    Write-Host "[CLEAN] Removed $($toRemove.Count) old backups"
}
