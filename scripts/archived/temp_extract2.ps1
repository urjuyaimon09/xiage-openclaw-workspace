$lines = Get-Content 'C:\Users\Administrator\.openclaw\agents\main\sessions\747c06c4-73bf-4676-b9d1-a28bfd666b90.jsonl' -Encoding UTF8
$sb = [System.Text.StringBuilder]::new()
$count = 0
foreach ($line in $lines) {
    if ($line -match '"role":"user"') {
        try {
            $j = $line | ConvertFrom-Json
            # Navigate to message.content[0].text
            $text = $j.message.content[0].text
            if ($text -and $text.Length -gt 20) {
                [void]$sb.AppendLine("=== MSG $count ===")
                [void]$sb.AppendLine($text.Substring(0, [Math]::Min(800, $text.Length)))
                [void]$sb.AppendLine()
                $count++
                if ($count -ge 30) { break }
            }
        } catch {}
    }
}
$sb.ToString()
