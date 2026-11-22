<#
.SYNOPSIS
  Build and run a production-style Supportfolio stack for one app.

.DESCRIPTION
  shell   builds the composed platform (shell gateway plus both micro-frontends)
          and starts it together with the observability profile on
          http://localhost:18080.
  tinyurl builds the standalone TinyURL slice without the shell, using
          docker-compose.standalone.yml, and starts it on http://localhost:18082.

  This runner never opens a tunnel and never resets the stack; the reset command
  is printed when the stack is up. Demo login and demo seeding are owned by
  scripts/demo.ps1; the production images bake the demo flags off.

.PARAMETER App
  Which stack to build and start: shell or tinyurl.

.EXAMPLE
  .\scripts\prod.ps1 -App shell

.EXAMPLE
  .\scripts\prod.ps1 -App tinyurl
#>
[CmdletBinding()]
param(
  [ValidateSet('shell', 'tinyurl')]
  [string]$App
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $App) {
  Write-Host 'usage: scripts/prod.ps1 -App shell|tinyurl'
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$standaloneDist = 'dist/projects/tinyurl/microfrontend-standalone'

# Native commands do not honour $ErrorActionPreference, so check their exit
# codes explicitly; a failed build must never fall through to a docker build.
function Invoke-Native {
  param(
    [Parameter(Mandatory)]
    [string]$Command,
    [string[]]$Arguments = @()
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "'$Command $($Arguments -join ' ')' failed with exit code $LASTEXITCODE."
  }
}

Push-Location $repoRoot

try {
  if ($App -eq 'shell') {
    # ---------------------------------------------------------------- shell stack
    Write-Host 'Building Identity service jar...' -ForegroundColor Cyan
    Invoke-Native '.\gradlew.bat' @(':platform:identity:bootJar', '--quiet')

    Write-Host 'Building Shell gateway jar...' -ForegroundColor Cyan
    Invoke-Native '.\gradlew.bat' @(':platform:shell:bootJar', '--quiet')

    Write-Host 'Building TinyURL service jar...' -ForegroundColor Cyan
    Invoke-Native '.\gradlew.bat' @(':projects:tinyurl:service:bootJar', '--quiet')

    Write-Host 'Building shell host...' -ForegroundColor Cyan
    Invoke-Native 'npx' @('nx', 'build', 'shell-host')

    Write-Host 'Building TinyURL microfrontend...' -ForegroundColor Cyan
    Invoke-Native 'npx' @('nx', 'build', 'tinyurl-microfrontend')

    # Image names and tags mirror scripts/demo.ps1 verbatim.
    Write-Host 'Building Identity image...' -ForegroundColor Cyan
    Invoke-Native 'docker' @('build', '-f', 'platform/identity/Dockerfile', '-t', 'supportfolio/identity:demo', '.')

    Write-Host 'Building Shell image...' -ForegroundColor Cyan
    Invoke-Native 'docker' @('build', '-f', 'platform/shell/Dockerfile', '-t', 'supportfolio/shell:demo', '.')

    Write-Host 'Building TinyURL image...' -ForegroundColor Cyan
    Invoke-Native 'docker' @('build', '-f', 'projects/tinyurl/Dockerfile', '-t', 'supportfolio/tinyurl:demo', '.')

    Write-Host 'Starting shell stack with observability...' -ForegroundColor Cyan
    Invoke-Native 'docker' @(
      'compose', '-f', 'docker-compose.demo.yml', '--profile', 'observability',
      'up', '-d', '--wait', 'shell', 'prometheus', 'grafana'
    )

    Write-Host ''
    Write-Host 'shell      http://localhost:18080' -ForegroundColor Green
    Write-Host 'grafana    http://localhost:13000 (anonymous viewer)' -ForegroundColor Green
    Write-Host 'prometheus http://localhost:19090' -ForegroundColor Green

    $note = @"

Keep this laptop awake while the stack is in use.

Reset command (destroys the database volume):
  docker compose -f docker-compose.demo.yml --profile observability down -v
"@
    Write-Host $note -ForegroundColor Yellow
  }
  else {
    # -------------------------------------------------------------- tinyurl stack
    Write-Host 'Building Identity service jar...' -ForegroundColor Cyan
    Invoke-Native '.\gradlew.bat' @(':platform:identity:bootJar', '--quiet')

    Write-Host 'Building TinyURL service jar...' -ForegroundColor Cyan
    Invoke-Native '.\gradlew.bat' @(':projects:tinyurl:service:bootJar', '--quiet')

    Write-Host 'Building standalone TinyURL microfrontend...' -ForegroundColor Cyan
    Invoke-Native 'npx' @('nx', 'build', 'tinyurl-microfrontend', '--configuration=standalone')

    # docker-compose.standalone.yml mounts this directory over the bundle baked
    # into the image. Compose creates a missing host path silently (create_host_path),
    # so an empty directory would shadow the baked bundle with nothing and serve
    # 404s without any error. Refuse to start instead.
    $builtFile = Get-ChildItem -Path $standaloneDist -File -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if (-not $builtFile) {
      throw "standalone bundle is empty ($standaloneDist) - run 'npx nx build tinyurl-microfrontend --configuration=standalone' first."
    }

    # Image names and tags mirror scripts/demo.ps1 verbatim; no shell image here.
    Write-Host 'Building Identity image...' -ForegroundColor Cyan
    Invoke-Native 'docker' @('build', '-f', 'platform/identity/Dockerfile', '-t', 'supportfolio/identity:demo', '.')

    Write-Host 'Building TinyURL image...' -ForegroundColor Cyan
    Invoke-Native 'docker' @('build', '-f', 'projects/tinyurl/Dockerfile', '-t', 'supportfolio/tinyurl:demo', '.')

    # The explicit target list is what keeps the shell out of standalone mode:
    # up with only tinyurl-service starts postgres and identity as its
    # dependencies and never starts the shell container.
    Write-Host 'Starting standalone TinyURL stack...' -ForegroundColor Cyan
    Invoke-Native 'docker' @(
      'compose', '-f', 'docker-compose.demo.yml', '-f', 'docker-compose.standalone.yml',
      'up', '-d', '--wait', 'tinyurl-service'
    )

    Write-Host ''
    Write-Host 'tinyurl http://localhost:18082' -ForegroundColor Green

    $note = @"

Keep this laptop awake while the stack is in use.

Reset command (destroys the database volume):
  docker compose -f docker-compose.demo.yml -f docker-compose.standalone.yml down -v
"@
    Write-Host $note -ForegroundColor Yellow
  }
}
finally {
  Pop-Location
}
