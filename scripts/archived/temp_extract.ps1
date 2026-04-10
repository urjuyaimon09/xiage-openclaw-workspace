$content = Get-Content 'C:\Users\Administrator\.openclaw\agents\main\sessions\747c06c4-73bf-4676-b9d1-a28bfd666b90.jsonl' -Raw -Encoding UTF8
# Extract all user messages
$lines = $content -split "`n"
$userMsgs = @()
foreach ($line in $lines) {
    if ($line -match '"role":"user"') {
        # Extract the text content from user messages
        if ($line -match '"text":"([^"]{10,})"') {
            $userMsgs += $Matches[1]
        }
    }
}
$userMsgs | ForEach-Object { Write-Host "---"; Write-Host $_ }
