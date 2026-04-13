$c = Get-Content 'C:\Users\Administrator\.pm2\dump.pm2' -Raw
if ($c.Length -lt 1000) {
    Write-Host "File too small: $($c.Length)"
    exit 1
}
Write-Host "File size: $($c.Length)"
if ($c -match 'OPENCLAW_DISABLE_BONJOUR') {
    Write-Host "BONJOUR found"
} else {
    Write-Host "BONJOUR not found"
}
if ($c -match 'OPENCLAW_FEISHU') {
    Write-Host "FEISHU found"
} else {
    Write-Host "FEISHU not found"
}
