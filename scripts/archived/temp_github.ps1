[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{'Accept' = 'application/vnd.github.v3+json'}
try {
    $r = Invoke-RestMethod 'https://api.github.com/repos/openclaw/skills/contents/skills/ralph-loop' -TimeoutSec 15 -Headers $headers
    $r | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
