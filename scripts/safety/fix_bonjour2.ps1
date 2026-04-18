$c = Get-Content 'C:\Users\Administrator\.pm2\dump.pm2' -Raw
$pattern = '"OPENCLAW_FEISHU_HTTP_TIMEOUT_MS": "5000",'
$replacement = '"OPENCLAW_FEISHU_HTTP_TIMEOUT_MS": "5000",
      "OPENCLAW_DISABLE_BONJOUR": "1",'
$newC = $c -replace [regex]::Escape($pattern), $replacement
if ($newC -eq $c) {
    Write-Host "Pattern not found, nothing replaced"
    exit 1
}
Set-Content -Path 'C:\Users\Administrator\.pm2\dump.pm2' -Value $newC
Write-Host "Done. BONJOUR added."
