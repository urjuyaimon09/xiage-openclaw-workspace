$c = Get-Content 'C:\Users\Administrator\.pm2\dump.pm2' -Raw
$pattern = '"OPENCLAW_FEISHU_HTTP_TIMEOUT_MS": "5000",'
$replacement = '"OPENCLAW_FEISHU_HTTP_TIMEOUT_MS": "5000",' + "`n      " + '"OPENCLAW_DISABLE_BONJOUR": "1",'
$c = $c -replace [regex]::Escape($pattern), $replacement
Set-Content -Path 'C:\Users\Administrator\.pm2\dump.pm2' -Value $c -NoNewline
Write-Host "Done"
