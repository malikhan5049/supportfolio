<#
.SYNOPSIS
  Build and run the Supportfolio demo stack with an optional Cloudflare quick tunnel.

.PARAMETER NoTunnel
  Skip the tunnel profile. Use this for CI/local core-stack validation.

.EXAMPLE
  .\scripts\demo.ps1

.EXAMPLE
  .\scripts\demo.ps1 -NoTunnel
#>
[CmdletBinding()]
param(
  [switch]$NoTunnel
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  # Ensure a JWT signing key exists.
  $keyPath = Join-Path (Join-Path (Join-Path $repoRoot 'platform') 'identity') 'dev-key.pem'
  if (-not (Test-Path $keyPath)) {
    if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
      throw "openssl is required to generate $keyPath but was not found on PATH."
    }
    openssl genpkey -algorithm RSA -out $keyPath -pkeyopt rsa_keygen_bits:2048
    Write-Host "Generated $keyPath" -ForegroundColor Green
  }

  # Build TinyURL service + microfrontend artifacts consumed by its Dockerfile.
  Write-Host 'Building TinyURL service jar...' -ForegroundColor Cyan
  .\gradlew.bat :projects:tinyurl:service:bootJar --quiet

  Write-Host 'Building TinyURL microfrontend...' -ForegroundColor Cyan
  npx nx build tinyurl-microfrontend

  # Bring up the core stack and wait for health.
  Write-Host 'Starting core demo stack...' -ForegroundColor Cyan
  docker compose -f docker-compose.demo.yml up -d --build --wait

  if ($NoTunnel) {
    Write-Host 'Core stack is healthy (tunnel skipped).' -ForegroundColor Green
    Write-Host "Shell is available at http://localhost:18080"
  }
  else {
    # Bring up the quick tunnel.
    Write-Host 'Starting Cloudflare quick tunnel...' -ForegroundColor Cyan
    docker compose -f docker-compose.demo.yml --profile tunnel up -d tunnel

    # Poll for the public URL.
    $deadline = (Get-Date).AddSeconds(60)
    $publicUrl = $null
    while ((Get-Date) -lt $deadline) {
      $logs = docker compose -f docker-compose.demo.yml logs tunnel --no-log-prefix --tail 50 2>&1 | Out-String
      $match = [regex]::Match($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
      if ($match.Success) {
        $publicUrl = $match.Value
        break
      }
      Start-Sleep -Seconds 2
    }

    if ($publicUrl) {
      Write-Host "Demo public URL: $publicUrl" -ForegroundColor Green
      Write-Host "Registry: $publicUrl/api/remote-registry"
      Write-Host "TinyURL app: $publicUrl/apps/tinyurl/"
    }
    else {
      Write-Warning "Could not find a trycloudflare.com URL in the tunnel logs within 60 seconds."
      Write-Host "Run 'docker compose -f docker-compose.demo.yml logs tunnel' to inspect."
    }
  }

  $note = @"

Keep this laptop awake while the demo is in use.

Reset command (destroys the database volume):
  docker compose -f docker-compose.demo.yml --profile tunnel down -v
"@
  Write-Host $note -ForegroundColor Yellow
}
finally {
  Pop-Location
}
