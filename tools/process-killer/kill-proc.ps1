param(
    [string]$target,
    [string]$mode = "name",
    [switch]$kill,
    [switch]$force,
    [switch]$kill_tree,
    [string]$gadget_params
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

if ($gadget_params -and (Test-Path $gadget_params)) {
    $jsonParams = Get-Content $gadget_params -Raw | ConvertFrom-Json
    if ($jsonParams.target) { $target = $jsonParams.target }
    if ($jsonParams.mode) { $mode = $jsonParams.mode }
    if ($jsonParams.kill -eq $true) { $kill = $true }
    if ($jsonParams.force -eq $true) { $force = $true }
    if ($jsonParams.kill_tree -eq $true) { $kill_tree = $true }
}

Write-Host "============================================"
Write-Host "  Process Killer"
Write-Host "============================================"
Write-Host "  Target: $target"
Write-Host "  Mode:   $mode"
Write-Host "  Action: $(if ($kill) { 'KILL' } else { 'LIST ONLY' })"
if ($kill_tree) { Write-Host "  Scope:  Process Tree (including children)" }
if ($force) { Write-Host "  Confirm: SKIPPED (force mode)" }
Write-Host "============================================"
Write-Host ""

if (-not $target) {
    Write-Error "Target is required (process name or PID)"
    exit 1
}

# ---- Find processes ----
$found = @()

switch ($mode) {
    "pid" {
        try {
            $pidNum = [int]$target
            $proc = Get-Process -Id $pidNum -ErrorAction Stop
            $found = @($proc)
        } catch {
            Write-Error "No process found with PID: $target"
            exit 1
        }
    }
    "exact" {
        $found = @(Get-Process -Name $target -ErrorAction SilentlyContinue)
    }
    default {
        # "name" — partial match
        $found = @(Get-Process | Where-Object {
            $_.ProcessName -like "*$target*" -or
            $_.Name -like "*$target*" -or
            $_.Id -eq ($target -as [int])
        })
    }
}

if ($found.Count -eq 0) {
    Write-Host "No matching processes found."
    Write-Host ""
    Write-Host "💡 Tips:"
    Write-Host "  - Use 'By Name (partial match)' to search with partial names"
    Write-Host "  - Use 'By PID' for exact PID lookup"
    Write-Host "  - Try Get-Process in PowerShell for a full list"
    exit 0
}

# ---- Display ----
Write-Host "Found $($found.Count) process(es):"
Write-Host ""
Write-Host ("{0,-8} {1,-24} {2,10} {3,12} {4}" -f "PID", "NAME", "CPU(s)", "MEM(MB)", "PATH")
Write-Host ("{0,-8} {1,-24} {2,10} {3,12} {4}" -f "---", "----", "------", "-------", "----")

$totalMem = 0
$totalCpu = 0

foreach ($proc in $found) {
    try {
        $cpuSec = [math]::Round($proc.TotalProcessorTime.TotalSeconds, 1)
        $memMB = [math]::Round($proc.WorkingSet64 / 1MB, 1)
        $procPath = try { $proc.Path } catch { "" }
        if ($procPath.Length -gt 50) { $procPath = "..." + $procPath.Substring($procPath.Length - 47) }

        Write-Host ("{0,-8} {1,-24} {2,10} {3,12} {4}" -f $proc.Id, $proc.ProcessName, $cpuSec, $memMB, $procPath)
        $totalMem += $memMB
        $totalCpu += $cpuSec
    } catch {
        Write-Host ("{0,-8} {1,-24} {2,10} {3,12} {4}" -f $proc.Id, $proc.ProcessName, "-", "-", "[exited]")
    }
}

Write-Host ("{0,-8} {1,-24} {2,10} {3,12}" -f "", "TOTAL", $totalCpu, $totalMem)
Write-Host ""

# Find child processes if listing
if ($found.Count -gt 0) {
    $children = @()
    foreach ($proc in $found) {
        try {
            $childProcs = Get-CimInstance Win32_Process |
                Where-Object { $_.ParentProcessId -eq $proc.Id } |
                ForEach-Object {
                    try { Get-Process -Id $_.ProcessId -ErrorAction Stop } catch { $null }
                }
            $children += ($childProcs | Where-Object { $_ })
        } catch {}
    }
    if ($children.Count -gt 0) {
        Write-Host "Child processes (will also be killed if 'Kill Tree' is enabled):"
        foreach ($c in ($children | Sort-Object Id -Unique)) {
            Write-Host "  ├─ $($c.ProcessName) (PID: $($c.Id))"
        }
        Write-Host ""
    }
}

# ---- Kill ----
if (-not $kill) {
    Write-Host "============================================"
    Write-Host "  LIST MODE — no processes were killed"
    Write-Host "============================================"
    Write-Host "💡 Run again with 'Kill' enabled to terminate these processes."
    exit 0
}

# Kill logic
if (-not $force) {
    Write-Host "⚠️  About to kill $($found.Count) process(es)"
    if ($kill_tree) { Write-Host "⚠️  Process tree mode: children will also be killed" }
}

$killed = 0
$failed = 0

# If killing tree, kill children first
if ($kill_tree) {
    foreach ($proc in $found) {
        try {
            $childProcs = Get-CimInstance Win32_Process |
                Where-Object { $_.ParentProcessId -eq $proc.Id }
            foreach ($child in $childProcs) {
                try {
                    Stop-Process -Id $child.ProcessId -Force -ErrorAction Stop
                    Write-Host "  💀 CHILD: PID $($child.ProcessId)"
                    $killed++
                } catch {
                    Write-Warning "  ⚠ FAILED CHILD: PID $($child.ProcessId)"
                    $failed++
                }
            }
        } catch {}
    }
}

# Kill main processes
foreach ($proc in $found) {
    try {
        $procName = $proc.ProcessName
        $procId = $proc.Id
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "  💀 KILLED: $procName (PID: $procId)"
        $killed++
    } catch {
        Write-Warning "  ⚠ FAILED: $($proc.ProcessName) (PID: $($proc.Id)): $_"
        $failed++
    }
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Result: $killed killed, $failed failed"
Write-Host "============================================"

if ($failed -gt 0) {
    Write-Host "💡 Some processes could not be killed. Try running as Administrator."
}
