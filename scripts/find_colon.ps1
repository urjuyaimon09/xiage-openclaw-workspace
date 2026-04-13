$lines = [System.IO.File]::ReadAllLines('C:\Users\Administrator\.openclaw\workspace\scripts\gateway-diagnose.ps1')
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '\$gwProcId:') {
        Write-Host "Line $($i+1): $($lines[$i])"
    }
}
