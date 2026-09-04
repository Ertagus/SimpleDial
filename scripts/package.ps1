# package.ps1 — build a clean ZIP of SimpleDial for the Chrome Web Store (Windows).
#
#   powershell -ExecutionPolicy Bypass -File scripts\package.ps1
#
# Output: dist\simpledial-v<version>.zip
# Uses an explicit allow-list (only files Chrome needs) and writes archive entry
# names with forward slashes, which the Chrome Web Store uploader expects.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$manifest = Get-Content manifest.json -Raw | ConvertFrom-Json
$version  = $manifest.version

# Explicit list of archive-path -> source-file pairs.
$files = @(
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'options.html',
  'options.js',
  'qr.html',
  'qr.js',
  'qrcode-generator.js',
  'icon16.png',
  'icon48.png',
  'icon128.png'
)
Get-ChildItem -Recurse _locales -Filter messages.json |
  ForEach-Object { $files += (Resolve-Path -Relative $_.FullName).TrimStart('.\') }

$missing = $files | Where-Object { -not (Test-Path $_) }
if ($missing) { throw "Missing files: $($missing -join ', ')" }

$outDir = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir "simpledial-v$version.zip"
if (Test-Path $out) { Remove-Item $out }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($out, 'Create')
try {
  foreach ($f in $files) {
    $entryName = ($f -replace '\\', '/')
    $full = (Resolve-Path $f).Path
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $full, $entryName, 'Optimal') | Out-Null
  }
} finally {
  $zip.Dispose()
}

Write-Host "Packaged: $out"
Write-Host ""
$zip = [System.IO.Compression.ZipFile]::OpenRead($out)
$zip.Entries | ForEach-Object { "{0,10}  {1}" -f $_.Length, $_.FullName }
$zip.Dispose()
