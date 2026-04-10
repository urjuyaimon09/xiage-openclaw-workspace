# Fetch full list of skills from skills.sh, bypass CLI 6 result limit
# Usage: .\fetch-full-skills.ps1 -Sort trending -Count 100

param(
    [string]$Sort = "trending", # trending | top
    [int]$Count = 100
)

# Fetch the homepage
$response = Invoke-WebRequest -Uri "https://skills.sh" -UseBasicParsing
$html = $response.Content

# Extract all skill entries using regex
$pattern = "([\w/.-]+@[\w/.-]+)\s+\(([\d\.Kk]+)\s+installs\)[^']+https://skills.sh/([\w/.-]+)"
$matches = [regex]::Matches($html, $pattern)

$skills = @()
foreach ($match in $matches) {
    $skill = [PSCustomObject]@{
        FullName = $match.Groups[1].Value
        Installs = $match.Groups[2].Value
        Url      = "https://skills.sh/$($match.Groups[3].Value)"
    }
    $skills += $skill
}

# Return top N
$selected = $skills | Select-Object -First $Count
Write-Host "Found $($skills.Count) total skills, returning top $($selected.Count) ($Sort):"
Write-Host "========================================"
$selected | ForEach-Object {
    Write-Host "$($_.FullName) ($($_.Installs) installs)"
    Write-Host "  ↳ $($_.Url)"
}

# Save to file
$outFile = "skills-list-$Sort-$Count.json"
$selected | ConvertTo-Json | Out-File $outFile
Write-Host "========================================"
Write-Host "Full list saved to $outFile"
