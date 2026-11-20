<#
.SYNOPSIS
  Build and run the Supportfolio demo stack with an optional Cloudflare quick tunnel.

.PARAMETER NoTunnel
  Skip the tunnel profile. Use this for CI/local core-stack validation.

.PARAMETER NoDemo
  Start the stack with demo login and demo seeding disabled (DEMO_ENABLED=false).
  Use this to reproduce the inert-flag check on demand.

.PARAMETER Observability
  Also start the observability profile (Prometheus + Grafana). Metrics ports are never
  published publicly; Grafana is on http://localhost:13000.

.EXAMPLE
  .\scripts\demo.ps1

.EXAMPLE
  .\scripts\demo.ps1 -NoTunnel

.EXAMPLE
  .\scripts\demo.ps1 -NoTunnel -NoDemo
#>
[CmdletBinding()]
param(
  [switch]$NoTunnel,
  [switch]$NoDemo,
  [switch]$Observability
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$previousDemoEnabled = $env:DEMO_ENABLED
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

  # Build all backend artifacts.
  Write-Host 'Building Identity service jar...' -ForegroundColor Cyan
  .\gradlew.bat :platform:identity:bootJar --quiet

  Write-Host 'Building Shell gateway jar...' -ForegroundColor Cyan
  .\gradlew.bat :platform:shell:bootJar --quiet

  Write-Host 'Building TinyURL service jar...' -ForegroundColor Cyan
  .\gradlew.bat :projects:tinyurl:service:bootJar --quiet

  # Build all frontend artifacts.
  Write-Host 'Building TinyURL microfrontend...' -ForegroundColor Cyan
  npx nx build tinyurl-microfrontend

  Write-Host 'Building shell host...' -ForegroundColor Cyan
  npx nx build shell-host

  # Build all three demo images from the repo root so the script is self-sufficient.
  Write-Host 'Building Identity demo image...' -ForegroundColor Cyan
  docker build -f platform/identity/Dockerfile -t supportfolio/identity:demo .

  Write-Host 'Building Shell demo image...' -ForegroundColor Cyan
  docker build -f platform/shell/Dockerfile -t supportfolio/shell:demo .

  Write-Host 'Building TinyURL demo image...' -ForegroundColor Cyan
  docker build -f projects/tinyurl/Dockerfile -t supportfolio/tinyurl:demo .

  # Demo login and demo seeding are opt-in in docker-compose.demo.yml (DEMO_ENABLED,
  # default false). The runner turns them on so a fresh demo is immediately usable;
  # -NoDemo keeps the flags off to reproduce the inert-flag check.
  if ($NoDemo) {
    $env:DEMO_ENABLED = 'false'
    Write-Host 'Demo login and demo data are disabled (-NoDemo).' -ForegroundColor Yellow
  }
  else {
    $env:DEMO_ENABLED = 'true'
  }

  # Bring up the core stack and wait for health.
  Write-Host 'Starting core demo stack...' -ForegroundColor Cyan
  docker compose -f docker-compose.demo.yml up -d --wait

  if ($Observability) {
    Write-Host 'Starting observability profile (Prometheus + Grafana)...' -ForegroundColor Cyan
    docker compose -f docker-compose.demo.yml --profile observability up -d --wait
    Write-Host 'Prometheus: http://localhost:19090' -ForegroundColor Green
    Write-Host 'Grafana:    http://localhost:13000 (anonymous viewer)' -ForegroundColor Green
  }

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
      throw "Could not find a trycloudflare.com URL in the tunnel logs within 60 seconds. Run 'docker compose -f docker-compose.demo.yml logs tunnel' to inspect."
    }
  }

  # The reset note must list every profile that may be running: the observability
  # profile is only mentioned when the runner actually started it, so the default
  # output stays identical to the pre-switch script.
  $resetProfiles = '--profile tunnel'
  if ($Observability) {
    $resetProfiles = '--profile observability --profile tunnel'
  }

  $note = @"

Keep this laptop awake while the demo is in use.

Reset command (destroys the database volume):
  docker compose -f docker-compose.demo.yml $resetProfiles down -v
"@
  Write-Host $note -ForegroundColor Yellow
}
finally {
  $env:DEMO_ENABLED = $previousDemoEnabled
  Pop-Location
}
