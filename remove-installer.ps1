$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$targets = @(
  "install.html",
  "install.js",
  "remove-installer.js",
  "remove-installer.ps1"
)

foreach ($target in $targets) {
  $path = Join-Path $root $target
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

Write-Host "Installer files removed. Keep index.html, app.js, styles.css, config.js, assets, and Supabase files as needed."
