<#
.SYNOPSIS
  Create the local .env file and the JWT signing key the dev stack needs.

.DESCRIPTION
  Idempotent bootstrap for `npm run dev`:

  1. Copies `.env.example` to `.env` when `.env` does not exist yet.
  2. Generates `platform/identity/dev-key.pem` with openssl when it is missing.
  3. Pins `SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE` in `.env` to the ABSOLUTE
     key path. The Identity service resolves that setting relative to its own
     working directory (the module directory under bootRun), so a relative path
     silently points at the wrong place — this script exists to prevent that.

.EXAMPLE
  .\scripts\dev-secrets.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'
$examplePath = Join-Path $root '.env.example'
$keyPath = Join-Path (Join-Path (Join-Path $root 'platform') 'identity') 'dev-key.pem'
$envKeyName = 'SUPPORTFOLIO_IDENTITY_JWT_PRIVATE_KEY_FILE'

if (-not (Test-Path -LiteralPath $envPath)) {
  if (-not (Test-Path -LiteralPath $examplePath)) {
    throw "Cannot create .env: $examplePath is missing."
  }
  Copy-Item -LiteralPath $examplePath -Destination $envPath
  Write-Host 'created .env from .env.example'
}

if (-not (Test-Path -LiteralPath $keyPath)) {
  if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    throw 'openssl is required to generate platform/identity/dev-key.pem'
  }
  $keyDir = Split-Path -Parent $keyPath
  if (-not (Test-Path -LiteralPath $keyDir)) {
    New-Item -ItemType Directory -Path $keyDir -Force | Out-Null
  }
  & openssl genpkey -algorithm RSA -out $keyPath -pkeyopt rsa_keygen_bits:2048 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "openssl genpkey failed with exit code $LASTEXITCODE while creating platform/identity/dev-key.pem"
  }
  Write-Host 'generated platform/identity/dev-key.pem'
}

$lines = @(Get-Content -LiteralPath $envPath)
$updated = New-Object 'System.Collections.Generic.List[string]'
$found = $false
foreach ($line in $lines) {
  if ($line -match ('^\s*' + [regex]::Escape($envKeyName) + '\s*=')) {
    $updated.Add($envKeyName + '=' + $keyPath)
    $found = $true
  }
  else {
    $updated.Add($line)
  }
}
if (-not $found) {
  $updated.Add($envKeyName + '=' + $keyPath)
}

# Write without a BOM so the first line stays a plain comment for parseEnvFile.
[System.IO.File]::WriteAllLines($envPath, $updated, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "$envKeyName set"
