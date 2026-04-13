# Correct pairing: each ready is followed by its OWN subsequent ui_connected
$logPath = "C:\Users\Administrator\AppData\Local\Temp\openclaw\openclaw-2026-04-11.log"

$events = @()

$content = Get-Content $logPath -Encoding UTF8
foreach ($line in $content) {
    if ($line -match '"time":"([^"]+)"') {
        $ts = $matches[1]
        if ($line -match 'gateway.*ready') {
            $events += [PSCustomObject]@{ Time = $ts; Type = "ready" }
        }
        if ($line -match 'webchat connected' -and $line -match 'client=openclaw-control-ui') {
            $events += [PSCustomObject]@{ Time = $ts; Type = "ui" }
        }
    }
}

# Sort by time
$events = $events | Sort-Object { [DateTime]::Parse($_.Time) }

# Pair each ready with the NEXT ui event that comes after it
$startups = @()
$currentReady = $null

foreach ($ev in $events) {
    if ($ev.Type -eq "ready" -and ([DateTime]::Parse($ev.Time).Hour -lt 20)) {
        $currentReady = $ev.Time
    }
    if ($ev.Type -eq "ui" -and $currentReady -ne $null -and ([DateTime]::Parse($ev.Time).Hour -lt 20)) {
        $startups += [PSCustomObject]@{
            Ready = $currentReady
            UI = $ev.Time
        }
        $currentReady = $null  # only pair once per ready
    }
}

Write-Host "=== Gateway Startup History (2026-04-11, before 20:00) ===" -ForegroundColor Cyan
Write-Host ""

foreach ($s in $startups) {
    $readyTime = [DateTime]::Parse($s.Ready)
    $uiTime = [DateTime]::Parse($s.UI)
    $delay = $uiTime - $readyTime
    
    if ($delay.TotalSeconds -lt 0) { continue }  # skip invalid
    
    if ($delay.TotalSeconds -lt 10) { $type = "HOT " }
    elseif ($delay.TotalSeconds -lt 60) { $type = "MED " }
    else { $type = "COLD" }
    
    $delayStr = if ($delay.TotalSeconds -lt 60) { "$([Math]::Round($delay.TotalSeconds))s" } else { "$([Math]::Round($delay.TotalSeconds/60,1))m" }
    
    Write-Host "[$type] $($s.Ready.Substring(11,5)) -> $($s.UI.Substring(11,5))  delay=$delayStr"
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Yellow
if ($startups.Count -gt 0) {
    $allDelays = @()
    foreach ($s in $startups) {
        $delay = [DateTime]::Parse($s.UI) - [DateTime]::Parse($s.Ready)
        if ($delay.TotalSeconds -gt 0) { $allDelays += $delay.TotalSeconds }
    }
    
    $coldDelays = $allDelays | Where-Object { $_ -gt 60 }
    $medDelays = $allDelays | Where-Object { $_ -gt 10 -and $_ -le 60 }
    $hotDelays = $allDelays | Where-Object { $_ -le 10 }
    
    Write-Host "Total: $($startups.Count) startups"
    if ($coldDelays.Count -gt 0) { Write-Host "COLD (>60s): $($coldDelays.Count) events, avg=$([Math]::Round(($coldDelays | Measure-Object -Average).Average))s" }
    if ($medDelays.Count -gt 0) { Write-Host "MED  (10-60s): $($medDelays.Count) events, avg=$([Math]::Round(($medDelays | Measure-Object -Average).Average))s" }
    if ($hotDelays.Count -gt 0) { Write-Host "HOT  (<10s): $($hotDelays.Count) events, avg=$([Math]::Round(($hotDelays | Measure-Object -Average).Average))s" }
}
