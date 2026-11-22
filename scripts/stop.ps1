<#
.SYNOPSIS
  Stop the one-command dev stack: Gradle daemons, dev port listeners, dev containers.

.DESCRIPTION
  Tears down everything `npm run dev` may have started, and nothing else:

  - Stops the Gradle daemons via `.\gradlew.bat --stop`.
  - Frees the dev ports (4200, 4201, 8080, 8081, 8082, 9091, 9092, 9093) by
    killing whatever is listening on them.
  - Downs the `supportfolio-dev` compose project (the demo stack is untouched).
  - Downs the `supportfolio-prod` compose project when `npm run prod:shell` or
    `npm run prod:tinyurl` left containers behind (demo stack still untouched).

.PARAMETER Volumes
  Also remove the dev stack's container volumes (`docker compose down -v`).

.EXAMPLE
  .\scripts\stop.ps1

.EXAMPLE
  .\scripts\stop.ps1 -Volumes
#>
[CmdletBinding()]
param(
  [switch]$Volumes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$devPorts = @(4200, 4201, 8080, 8081, 8082, 9091, 9092, 9093)

$gradlew = Join-Path $root 'gradlew.bat'
if (Test-Path -LiteralPath $gradlew) {
  Push-Location $root
  try {
    & $gradlew --stop
  }
  finally {
    Pop-Location
  }
}
else {
  Write-Host 'gradlew.bat not found; skipping Gradle daemon stop'
}

if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
  foreach ($port in $devPorts) {
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    $owners = @($listeners | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)
    if ($owners.Count -eq 0) {
      Write-Host "$port -> free"
      continue
    }
    foreach ($ownerProcessId in $owners) {
      Stop-Process -Id $ownerProcessId -Force -ErrorAction SilentlyContinue
      Write-Host "$port -> killed PID $ownerProcessId"
    }
  }
}
else {
  Write-Host 'Get-NetTCPConnection unavailable; skipping port cleanup'
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  $composeArgs = @('compose', '-p', 'supportfolio-dev', 'down', '--remove-orphans')
  if ($Volumes) {
    $composeArgs += '-v'
  }
  Push-Location $root
  try {
    & docker @composeArgs

    # `npm run prod:*` runs its own compose project; down it too, or the standalone
    # / shell prod stack keeps serving on 18080/18082 after `npm run stop` said stopped.
    $prodFiles = @(
      'compose', '-p', 'supportfolio-prod', '-f', 'docker-compose.demo.yml',
      '--profile', 'observability'
    )
    $prodContainers = @(& docker @prodFiles ps -q)
    if ($prodContainers.Count -eq 0) {
      Write-Host 'prod stack -> nothing running'
    }
    else {
      $prodDown = $prodFiles + @('down', '--remove-orphans')
      if ($Volumes) {
        $prodDown += '-v'
      }
      & docker @prodDown
      Write-Host "prod stack -> removed $($prodContainers.Count) container(s)"
    }
  }
  finally {
    Pop-Location
  }
}
else {
  Write-Host 'docker not found; skipping dev container teardown'
}

Write-Host 'dev stack stopped'
