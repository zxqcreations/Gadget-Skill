<#
.SYNOPSIS
  GadgetServer wrapper for filter-maps.ps1
  Reads parameters from --gadget-params JSON file to avoid encoding issues.
#>

$ErrorActionPreference = "Stop"

# Force UTF-8 output encoding so Node.js can decode Chinese characters correctly
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# === Parse GadgetServer params JSON file ===
$params = @{}
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq '--gadget-params' -and ($i + 1) -lt $args.Count) {
        $paramsFile = $args[$i + 1]
        if (Test-Path -LiteralPath $paramsFile) {
            $json = Get-Content -LiteralPath $paramsFile -Raw -Encoding UTF8
            $params = $json | ConvertFrom-Json -AsHashtable
        }
        break
    }
}

# Path to the actual filter-maps.ps1
$FilterScript = "G:\BaiduNetdiskDownload\map4ra2\youliedefuchouditu_6000_anfensi.com\尤里超级地图包6000张\地图\MapProcessor\filter-maps.ps1"

if (-not (Test-Path -LiteralPath $FilterScript)) {
    Write-Error "filter-maps.ps1 not found at: $FilterScript"
    exit 1
}

# Build hashtable for splatting (named parameters)
$psArgs = @{}
if ($params['folder']) {
    $psArgs['Folder'] = $params['folder']
}
if ($params['whatif']) {
    $psArgs['WhatIf'] = $true
}

$display = ($psArgs.GetEnumerator() | ForEach-Object { "-$($_.Key) " + '"' + $_.Value + '"' }) -join ' '
Write-Host "Running: filter-maps.ps1 $display" -ForegroundColor Cyan
Write-Host ""

& $FilterScript @psArgs
exit $LASTEXITCODE
