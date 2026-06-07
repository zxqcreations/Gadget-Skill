<#
.SYNOPSIS
  GadgetServer wrapper for MapValidator --fix (line-based auto-repair)
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

# Path to the MapValidator project
$ProjPath = "G:\BaiduNetdiskDownload\map4ra2\youliedefuchouditu_6000_anfensi.com\尤里超级地图包6000张\地图\MapProcessor\MapValidator\MapValidator.csproj"

if (-not (Test-Path -LiteralPath $ProjPath)) {
    Write-Error "MapValidator.csproj not found at: $ProjPath"
    exit 1
}

$MapPath = $params['path']
if (-not $MapPath) {
    Write-Error "Required parameter 'path' is missing. Please specify a map file or folder."
    exit 1
}

if (-not (Test-Path -LiteralPath $MapPath)) {
    Write-Error "Path does not exist: $MapPath"
    exit 1
}

# Build dotnet run arguments (array splatting into dotnet is fine - dotnet is not a PS script)
$dotnetArgs = @("run", "--project", $ProjPath, "--", $MapPath, "--fix")
if ($params['recursive']) { $dotnetArgs += "--recursive" }
if ($params['quiet']) { $dotnetArgs += "--quiet" }

Write-Host "Running: dotnet $($dotnetArgs -join ' ')" -ForegroundColor Cyan
Write-Host ""

& dotnet $dotnetArgs
exit $LASTEXITCODE
