$files = Get-ChildItem 'C:\Users\Administrator\.openclaw\agents\main\sessions\' -File | Where-Object { $_.Extension -eq '.jsonl' -and $_.Name -ne 'sessions.json' }
$results = @()
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -and $content.Contains('ou_d5069f1816462333bb56ed22d3c74db5') -and $content.Contains('马斯洛')) {
        $results += [PSCustomObject]@{
            Name = $f.Name
            SizeKB = [math]::Round($f.Length/1KB)
            LastWrite = $f.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
        }
    }
}
$results | Format-Table -AutoSize
