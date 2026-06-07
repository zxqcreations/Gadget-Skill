param(
    [string]$drive = "auto",
    [switch]$kill,
    [switch]$eject,
    [string]$gadget_params
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

if ($gadget_params -and (Test-Path $gadget_params)) {
    $jsonParams = Get-Content $gadget_params -Raw | ConvertFrom-Json
    if ($jsonParams.drive) { $drive = $jsonParams.drive }
    if ($jsonParams.kill -eq $true) { $kill = $true }
    if ($jsonParams.eject -eq $true) { $eject = $true }
}

Write-Host "============================================"
Write-Host "  USB Drive Occupation Detector"
Write-Host "============================================"
Write-Host "  Drive: $drive"
Write-Host "  Mode: $(if ($kill) { 'KILL' } else { 'DETECT ONLY' })"
Write-Host "============================================"
Write-Host ""

# ---- Find USB drives ----
function Get-USBDrives {
    $usbDrives = @()
    Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | ForEach-Object {
        $vol = Get-Volume -DriveLetter $_.DeviceID[0] -ErrorAction SilentlyContinue
        $usbDrives += [PSCustomObject]@{
            Letter = $_.DeviceID
            Label = if ($vol.FileSystemLabel) { $vol.FileSystemLabel } else { "USB Drive" }
            SizeGB = [math]::Round($_.Size / 1GB, 1)
            FreeGB = [math]::Round($_.FreeSpace / 1GB, 1)
            FileSystem = $_.FileSystem
        }
    }
    return $usbDrives
}

# ---- Find processes using a drive ----
function Find-DriveProcesses($driveLetter) {
    $drivePath = "$driveLetter\"
    $results = @()

    # Method 1: Check process working directories / command lines
    Get-Process | ForEach-Object {
        $proc = $_
        try {
            $procPath = $proc.Path
            $mainModule = $proc.MainModule.FileName

            if ($mainModule -like "$drivePath*" -or $procPath -like "$drivePath*") {
                $results += [PSCustomObject]@{
                    PID = $proc.Id
                    Name = $proc.ProcessName
                    Path = $procPath
                    Reason = "Running from USB"
                }
                return
            }

            # Check if process has files open on the drive
            try {
                $handles = $proc.Modules | Where-Object { $_.FileName -like "$drivePath*" }
                if ($handles) {
                    $results += [PSCustomObject]@{
                        PID = $proc.Id
                        Name = $proc.ProcessName
                        Path = $procPath
                        Reason = "DLL/Module loaded from USB"
                    }
                }
            } catch {}
        } catch {}
    }

    # Method 2: Use handle.exe for file handles
    $handleExe = Get-Command handle.exe -ErrorAction SilentlyContinue
    if (-not $handleExe) {
        $sysPath = "$env:ProgramFiles\SysinternalsSuite\handle.exe"
        if (Test-Path $sysPath) { $handleExe = $sysPath }
    }
    if ($handleExe) {
        try {
            $output = & $handleExe -nobanner -accepteula $drivePath 2>&1
            foreach ($line in $output) {
                if ($line -match '(\S+\.exe)\s+pid:\s+(\d+)\s+.*\s+(.+)') {
                    $results += [PSCustomObject]@{
                        PID = [int]$Matches[2]
                        Name = $Matches[1]
                        Path = ""
                        Reason = "File handle: $($Matches[3].Trim())"
                    }
                }
            }
        } catch {}
    }

    # Deduplicate by PID
    return $results | Sort-Object PID -Unique
}

# ---- Main ----
$targetDrives = @()
if ($drive -eq "auto") {
    $targetDrives = Get-USBDrives
    if ($targetDrives.Count -eq 0) {
        Write-Host "No USB drives detected."
        Write-Host ""
        Write-Host "All removable drives:"
        Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } |
            ForEach-Object { Write-Host "  $($_.DeviceID) - $([math]::Round($_.Size/1GB,1)) GB" }
        exit 0
    }
} else {
    # Verify the drive exists
    $disk = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DeviceID -eq $drive }
    if (-not $disk) {
        Write-Error "Drive $drive not found"
        exit 1
    }
    $targetDrives = @([PSCustomObject]@{Letter=$drive; Label=$disk.VolumeName; SizeGB=0; FreeGB=0; FileSystem=$disk.FileSystem})
}

Write-Host "USB Drives found:"
foreach ($d in $targetDrives) {
    $used = $d.SizeGB - $d.FreeGB
    Write-Host "  $($d.Letter) [$($d.Label)] — $($d.SizeGB) GB ($used GB used) [$($d.FileSystem)]"
}
Write-Host ""

$allProcesses = @()
$driveResults = @{}

foreach ($d in $targetDrives) {
    Write-Host "--- Checking $($d.Letter) [$($d.Label)] ---"
    $procs = Find-DriveProcesses $d.Letter
    $driveResults[$d.Letter] = $procs

    if ($procs.Count -eq 0) {
        Write-Host "  ✅ No processes found using this drive."
    } else {
        foreach ($p in $procs) {
            Write-Host "  ⚠ PID: $($p.PID) | $($p.Name)"
            Write-Host "       Reason: $($p.Reason)"
            if ($p.Path) { Write-Host "       Path: $($p.Path)" }
            $allProcesses += $p
        }
    }
    Write-Host ""
}

# ---- Summary ----
Write-Host "============================================"
Write-Host "  Summary"
Write-Host "============================================"
$total = ($driveResults.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
if ($total -eq 0) {
    Write-Host "  ✅ All USB drives are free to eject!"
} else {
    $uniquePids = ($driveResults.Values | ForEach-Object { $_ } | Sort-Object PID -Unique)
    Write-Host "  ⚠  $($uniquePids.Count) process(es) blocking USB ejection"
}
Write-Host "============================================"

# ---- Kill ----
if ($kill -and $allProcesses.Count -gt 0) {
    Write-Host ""
    Write-Host "Killing blocking processes..."
    $killedPids = @{}
    foreach ($p in ($allProcesses | Sort-Object PID -Unique)) {
        try {
            Stop-Process -Id $p.PID -Force -ErrorAction Stop
            Write-Host "  💀 KILLED: $($p.Name) (PID: $($p.PID))"
            $killedPids[$p.PID] = $true
        } catch {
            Write-Warning "  FAILED: $($p.Name) (PID: $($p.PID)): $_"
        }
    }
    Write-Host "  Killed $($killedPids.Count) / $($allProcesses.Count) process(es)"
}

# ---- Eject ----
if ($eject) {
    Write-Host ""
    foreach ($d in $targetDrives) {
        $driveLetter = $d.Letter[0]
        Write-Host "Attempting to eject $($d.Letter)..."
        try {
            $vol = Get-Volume -DriveLetter $driveLetter -ErrorAction Stop
            $vol | Dismount-Volume -ErrorAction Stop
            Write-Host "  ✅ $($d.Letter) dismounted successfully"
        } catch {
            # Try alternate method
            try {
                $ejectResult = (New-Object -ComObject Shell.Application).Namespace(17).ParseName($d.Letter)
                if ($ejectResult) {
                    $ejectResult.InvokeVerb("Eject")
                    Write-Host "  ✅ $($d.Letter) ejected via Shell"
                }
            } catch {
                Write-Warning "  ❌ Could not eject $($d.Letter): $_"
                Write-Host "     Try ejecting from File Explorer, or run as Administrator"
            }
        }
    }
}

if ((-not $kill) -and (-not $eject) -and $allProcesses.Count -gt 0) {
    Write-Host ""
    Write-Host "💡 Tip: Run again with 'Kill' enabled to terminate blocking processes."
    Write-Host "    Or with 'Eject' enabled to safely remove the USB drive."
}
