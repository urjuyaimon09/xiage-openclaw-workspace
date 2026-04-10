
# 读取API KEY
$apiKey = $env:VOLCANO_ENGINE_API_KEY
if (-not $apiKey) {
    $apiKey = $env:VOLCENGINE_API_KEY
}

if ($apiKey) {
    Write-Host "Found API KEY: $($apiKey.substring(0, 8))..."
    echo $apiKey > api_key.txt
    Write-Host "Saved to api_key.txt"
} else {
    Write-Host "No API KEY found in environment"
}
