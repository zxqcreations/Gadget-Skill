param(
    [string]$path,
    [switch]$recursive,
    [switch]$kill,
    [string]$gadget_params
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

if ($gadget_params -and (Test-Path $gadget_params)) {
    $jsonParams = Get-Content $gadget_params -Raw | ConvertFrom-Json
    if ($jsonParams.path) { $path = $jsonParams.path }
    if ($jsonParams.recursive -eq $true) { $recursive = $true }
    if ($jsonParams.kill -eq $true) { $kill = $true }
}

Write-Host "============================================"
Write-Host "  File Lock Detector"
Write-Host "============================================"
Write-Host "  Path: $path"
Write-Host "  Mode: $(if ($kill) { 'KILL' } else { 'DETECT ONLY' })"
Write-Host "============================================"
Write-Host ""

if (-not $path) {
    Write-Error "Path is required"
    exit 1
}

# Resolve to absolute path
try {
    $resolved = Resolve-Path $path -ErrorAction Stop
    $path = $resolved.Path
} catch {
    Write-Error "Path not found: $path"
    exit 1
}

Write-Host "[Info] Resolved path: $path"
Write-Host ""

# ---- Method 1: Test lock by attempting exclusive open ----
function Test-FileLocked($filePath) {
    if (Test-Path $filePath -PathType Container) { return $false }
    try {
        $fs = [System.IO.File]::Open($filePath, [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        $fs.Close()
        $fs.Dispose()
        return $false
    } catch [System.IO.IOException] {
        return $true  # File is locked
    } catch {
        return $false
    }
}

# ---- Method 2: Check process modules (works for exe/dll) ----
function Find-ProcessByModule($filePath) {
    $fileName = Split-Path $filePath -Leaf
    $results = @()
    Get-Process | ForEach-Object {
        $proc = $_
        try {
            $modules = $proc.Modules | Where-Object { $_.FileName -eq $filePath }
            if ($modules) {
                $results += [PSCustomObject]@{
                    PID = $proc.Id
                    Name = $proc.ProcessName
                    Path = $proc.Path
                    Module = $filePath
                    Method = "Module"
                }
            }
        } catch {}
    }
    return $results
}

# ---- Method 3: Use handle.exe if available ----
function Find-ByHandleExe($targetPath) {
    $handleExe = Get-Command handle.exe -ErrorAction SilentlyContinue
    if (-not $handleExe) { $handleExe = Get-Command handle64.exe -ErrorAction SilentlyContinue }
    if (-not $handleExe) {
        $sysPath = "$env:ProgramFiles\SysinternalsSuite\handle.exe"
        if (Test-Path $sysPath) { $handleExe = $sysPath }
    }
    if (-not $handleExe) { return @() }

    $results = @()
    try {
        $output = & $handleExe -nobanner -accepteula $targetPath 2>&1
        foreach ($line in $output) {
            if ($line -match '(\w+\.exe)\s+pid:\s+(\d+)\s+.*\s+(.+)') {
                $results += [PSCustomObject]@{
                    PID = [int]$Matches[2]
                    Name = $Matches[1]
                    Path = ""
                    Handle = $Matches[3].Trim()
                    Method = "handle.exe"
                }
            }
        }
    } catch {}
    return $results
}

# ---- Method 4: Use openfiles (requires admin + enabled) ----
function Find-ByOpenFiles($targetPath) {
    try {
        $output = openfiles /query /fo csv /v 2>&1
        if ($LASTEXITCODE -ne 0) { return @() }
        $csv = $output | ConvertFrom-Csv
        $results = @()
        foreach ($row in $csv) {
            if ($row.'Open File (Path\executable)' -like "*$targetPath*") {
                $results += [PSCustomObject]@{
                    PID = [int]$row.'Process ID'
                    Name = $row.'Application Name'
                    Path = $row.'Open File (Path\executable)'
                    Method = "openfiles"
                }
            }
        }
        return $results
    } catch { return @() }
}

# ---- Execute detection ----
$allLocks = @()
$lockedFiles = @()

if (Test-Path $path -PathType Container) {
    # It's a directory
    Write-Host "[Scan] Checking folder: $path"
    $filesToCheck = if ($recursive) {
        Get-ChildItem $path -File -Recurse -ErrorAction SilentlyContinue
    } else {
        Get-ChildItem $path -File -ErrorAction SilentlyContinue
    }

    foreach ($file in $filesToCheck) {
        if (Test-FileLocked $file.FullName) {
            $lockedFiles += $file.FullName
        }
    }
    Write-Host "[Scan] Checked $($filesToCheck.Count) files, $($lockedFiles.Count) locked"
} else {
    # It's a file
    if (Test-FileLocked $path) {
        $lockedFiles += $path
        Write-Host "[Scan] File is LOCKED: $path"
    } else {
        Write-Host "[Scan] File is NOT locked (can be opened for exclusive write)"
    }
}

# For each locked file, find the responsible process
foreach ($file in $lockedFiles) {
    Write-Host ""
    Write-Host "--- Locked: $file ---"

    # Try handle.exe first (most reliable)
    $handles = Find-ByHandleExe $file
    if ($handles.Count -gt 0) {
        foreach ($h in $handles) {
            Write-Host "  PID: $($h.PID) | $($h.Name) | Handle: $($h.Handle)"
            $allLocks += [PSCustomObject]@{File=$file; PID=$h.PID; Name=$h.Name; Method=$h.Method}
        }
        continue
    }

    # Try modules
    $modules = Find-ProcessByModule $file
    if ($modules.Count -gt 0) {
        foreach ($m in $modules) {
            Write-Host "  PID: $($m.PID) | $($m.Name) (loaded as module)"
            $allLocks += [PSCustomObject]@{File=$file; PID=$m.PID; Name=$m.Name; Method=$m.Method}
        }
        continue
    }

    # Try openfiles
    $openf = Find-ByOpenFiles $file
    if ($openf.Count -gt 0) {
        foreach ($o in $openf) {
            Write-Host "  PID: $($o.PID) | $($o.Name)"
            $allLocks += [PSCustomObject]@{File=$file; PID=$o.PID; Name=$o.Name; Method=$o.Method}
        }
        continue
    }

    Write-Host "  [Could not identify locking process]"
    Write-Host "  Tips:"
    Write-Host "    1. Run as Administrator for better detection"
    Write-Host "    2. Install Sysinternals handle.exe for precise results"
    Write-Host "       winget install Microsoft.Sysinternals.Handle"
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Summary"
Write-Host "============================================"
Write-Host "  Files scanned: $(if (Test-Path $path -PathType Container) { $filesToCheck.Count } else { 1 })"
Write-Host "  Files locked:  $($lockedFiles.Count)"
Write-Host "  Locks found:   $($allLocks.Count)"
Write-Host "============================================"

# ---- Kill locking processes ----
if ($kill -and $allLocks.Count -gt 0) {
    Write-Host ""
    Write-Host "Killing locking processes..."
    $killed = @{}
    foreach ($lock in $allLocks) {
        if ($killed.ContainsKey($lock.PID)) { continue }
        try {
            Stop-Process -Id $lock.PID -Force -ErrorAction Stop
            Write-Host "  💀 KILLED: $($lock.Name) (PID: $($lock.PID))"
            $killed[$lock.PID] = $true
        } catch {
            Write-Warning "  FAILED: $($lock.Name) (PID: $($lock.PID)): $_"
        }
    }
    Write-Host "  Killed $($killed.Count) process(es)"
}
