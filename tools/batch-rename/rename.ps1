param(
    [string]$folder,
    [string]$pattern,
    [string]$replacement,
    [switch]$recursive,
    [switch]$dry_run,
    [string]$gadget_params
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

# If invoked via GadgetServer, read params from JSON file
if ($gadget_params -and (Test-Path $gadget_params)) {
    $jsonParams = Get-Content $gadget_params -Raw | ConvertFrom-Json
    $folder = if ($jsonParams.folder) { $jsonParams.folder } else { $folder }
    $pattern = if ($jsonParams.pattern) { $jsonParams.pattern } else { $pattern }
    $replacement = if ($jsonParams.replacement) { $jsonParams.replacement } else { $replacement }
    $recursive = if ($jsonParams.recursive -eq $true) { $true } else { $recursive }
    $dry_run = if ($jsonParams.dry_run -eq $true) { $true } else { $dry_run }
}

if (-not $folder) { Write-Error "folder is required"; exit 1 }
if (-not $pattern) { Write-Error "pattern is required"; exit 1 }
if (-not $replacement) { Write-Error "replacement is required"; exit 1 }

if (-not (Test-Path $folder)) {
    Write-Error "Folder not found: $folder"
    exit 1
}

$files = if ($recursive) {
    Get-ChildItem -Path $folder -File -Recurse
} else {
    Get-ChildItem -Path $folder -File
}

$renamed = 0
$skipped = 0
$errors = 0

foreach ($file in $files) {
    try {
        $oldName = $file.Name
        $newName = $oldName -replace $pattern, $replacement

        if ($oldName -eq $newName) {
            $skipped++
            continue
        }

        $newPath = Join-Path $file.DirectoryName $newName

        if (Test-Path $newPath) {
            Write-Warning "SKIP (target exists): $oldName -> $newName"
            $errors++
            continue
        }

        if ($dry_run) {
            Write-Host "[DRY RUN] $oldName -> $newName"
        } else {
            Rename-Item -Path $file.FullName -NewName $newName
            Write-Host "RENAMED: $oldName -> $newName"
        }
        $renamed++
    } catch {
        Write-Error "Error renaming '$($file.Name)': $_"
        $errors++
    }
}

Write-Host ""
Write-Host "========== Summary =========="
Write-Host "  Total files scanned: $($files.Count)"
Write-Host "  Would rename / Renamed: $renamed"
Write-Host "  Skipped (no match): $skipped"
Write-Host "  Errors: $errors"
if ($dry_run) {
    Write-Host "  Mode: DRY RUN (no files were changed)"
}
