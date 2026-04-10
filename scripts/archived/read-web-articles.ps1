$files = [System.IO.Directory]::GetFiles("C:\Users\Administrator\.openclaw\workspace\web-articles")
Write-Host "Found $($files.Count) files"
foreach ($f in $files) {
    Write-Host "--- File ---"
    Write-Host $f
    try {
        $content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
        Write-Host $content.Substring(0, [Math]::Min(3000, $content.Length))
    } catch {
        Write-Host "Error: $_"
    }
    Write-Host ""
}
