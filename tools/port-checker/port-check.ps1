param(
    [int]$port = 3000,
    [switch]$kill,
    [switch]$force,
    [string]$gadget_params
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

# If invoked via GadgetServer, read params from JSON file
if ($gadget_params -and (Test-Path $gadget_params)) {
    $jsonParams = Get-Content $gadget_params -Raw | ConvertFrom-Json
    if ($jsonParams.port) { $port = [int]$jsonParams.port }
    if ($jsonParams.kill -eq $true) { $kill = $true }
    if ($jsonParams.force -eq $true) { $force = $true }
}

Write-Host "============================================"
Write-Host "  Port Occupation Checker"
Write-Host "============================================"
Write-Host "  Port: $port"
Write-Host "  Mode: $(if ($kill) { 'KILL' } else { 'DETECT ONLY' })"
Write-Host "============================================"
Write-Host ""

# Find processes using the port
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' -or $_.State -eq 'Established' }

if (-not $connections) {
    Write-Host "✅ Port $port is FREE — no process is listening on this port."
    exit 0
}

$seenPids = @{}
foreach ($conn in $connections) {
    $pid2 = $conn.OwningProcess
    if ($seenPids.ContainsKey($pid2)) { continue }
    $seenPids[$pid2] = $true

    try {
        $proc = Get-Process -Id $pid2 -ErrorAction Stop
        $procPath = $proc.Path
        $procName = $proc.ProcessName
        $startTime = $proc.StartTime
        $cpuTime = $proc.TotalProcessorTime
        $memBytes = $proc.WorkingSet64
        $memMB = [math]::Round($memBytes / 1MB, 1)

        Write-Host "┌─────────────────────────────────────────────"
        Write-Host "│ Process: $procName"
        Write-Host "│ PID:     $pid2"
        Write-Host "│ Path:    $procPath"
        Write-Host "│ State:   $($conn.State) | $($conn.LocalAddress):$($conn.LocalPort)"
        if ($conn.RemoteAddress) {
            Write-Host "│ Remote:  $($conn.RemoteAddress):$($conn.RemotePort)"
        }
        Write-Host "│ Started: $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))"
        Write-Host "│ CPU:     $($cpuTime.ToString())"
        Write-Host "│ Memory:  $memMB MB"
        Write-Host "└─────────────────────────────────────────────"
        Write-Host ""
    } catch {
        Write-Host "┌─────────────────────────────────────────────"
        Write-Host "│ Process: [Unknown]"
        Write-Host "│ PID:     $pid2 (process may have exited)"
        Write-Host "│ State:   $($conn.State)"
        Write-Host "└─────────────────────────────────────────────"
        Write-Host ""
    }
}

$count = $seenPids.Count
Write-Host "============================================"
Write-Host "  Found $count process(es) on port $port"
Write-Host "============================================"

if ($kill) {
    if (-not $force) {
        Write-Host ""
        Write-Warning "About to KILL $count process(es). This may cause data loss!"
        Write-Host "Proceeding with forceful termination..."
    }

    $killed = 0
    foreach ($pid2 in $seenPids.Keys) {
        try {
            $proc = Get-Process -Id $pid2 -ErrorAction Stop
            $procName = $proc.ProcessName
            Stop-Process -Id $pid2 -Force -ErrorAction Stop
            Write-Host "💀 KILLED: $procName (PID: $pid2)"
            $killed++
        } catch {
            Write-Warning "FAILED to kill PID $pid2 : $_"
        }
    }
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Killed: $killed / $count process(es)"
    Write-Host "============================================"

    # Verify port is now free
    Start-Sleep -Milliseconds 500
    $still = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' }
    if (-not $still) {
        Write-Host "✅ Port $port is now FREE"
    } else {
        Write-Host "⚠️  Port $port is still occupied by $($still.Count) process(es)"
    }
}
