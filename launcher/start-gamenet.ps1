[CmdletBinding()]
param(
  [switch]$Background
)

$ErrorActionPreference = 'Stop'
$launcherPath = $MyInvocation.MyCommand.Path
$projectPath = Split-Path -Parent (Split-Path -Parent $launcherPath)
$logDirectory = Join-Path $projectPath 'logs'
$launcherLog = Join-Path $logDirectory 'launcher.log'
$serverLog = Join-Path $logDirectory 'server.log'
$serverErrorLog = Join-Path $logDirectory 'server-error.log'

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-LauncherLog {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message"
  Add-Content -LiteralPath $launcherLog -Value $line -Encoding UTF8
  if (-not $Background) { Write-Host $line }
}

function Find-Executable {
  param(
    [string]$Name,
    [string[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  try {
    $command = Get-Command $Name -ErrorAction Stop
    return $command.Source
  } catch {
    return $null
  }
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port
  )

  try {
    return [bool](Test-NetConnection -ComputerName $HostName -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue)
  } catch {
    return $false
  }
}

try {
  Write-LauncherLog "Starting GameNet Plus Manager from $projectPath"

  $nodePath = Find-Executable -Name 'node.exe' -Candidates @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
  )
  if (-not $nodePath) {
    throw 'Node.js 20 or newer was not found. Install Node.js and run the launcher again.'
  }

  $nodeDirectory = Split-Path -Parent $nodePath
  $env:Path = "$nodeDirectory;$env:Path"
  $npmPath = Find-Executable -Name 'npm.cmd' -Candidates @(
    (Join-Path $nodeDirectory 'npm.cmd')
  )
  if (-not $npmPath) { throw 'npm.cmd was not found beside Node.js.' }
  Write-LauncherLog "Node found at $nodePath"

  $envFile = Join-Path $projectPath '.env'
  if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath (Join-Path $projectPath '.env.example') -Destination $envFile
    Write-LauncherLog 'Created .env from .env.example'
  }

  $appPort = 3000
  $appPortLine = Get-Content -LiteralPath $envFile -ErrorAction SilentlyContinue |
    Where-Object { $_ -match '^\s*PORT\s*=' } |
    Select-Object -First 1
  if ($appPortLine -and $appPortLine -match '^\s*PORT\s*=\s*(\d+)') {
    $appPort = [int]$Matches[1]
  }

  $wampPath = Find-Executable -Name 'wampmanager.exe' -Candidates @(
    'C:\wamp64\wampmanager.exe',
    'C:\wamp\wampmanager.exe',
    (Join-Path $env:ProgramFiles 'wamp64\wampmanager.exe'),
    (Join-Path $env:ProgramFiles 'wamp\wampmanager.exe')
  )
  $wampProcess = Get-Process -Name 'wampmanager' -ErrorAction SilentlyContinue
  if (-not $wampProcess -and $wampPath) {
    try {
      # WAMP manager is optional: its GUI can fail to start because of UAC or
      # an already-running instance, while the Windows database service is
      # still perfectly usable. Never let that optional GUI stop the app.
      Start-Process -FilePath $wampPath -WorkingDirectory (Split-Path -Parent $wampPath) -WindowStyle Hidden | Out-Null
      Write-LauncherLog "Started WAMP manager at $wampPath"
    } catch {
      Write-LauncherLog "Could not start WAMP manager: $($_.Exception.Message); continuing with services"
    }
  } elseif ($wampProcess) {
    Write-LauncherLog 'WAMP manager is already running'
  } else {
    Write-LauncherLog 'WAMP manager was not found in the common paths; continuing with Node'
  }

  # If WAMP registered MySQL/MariaDB as a Windows service, start it when
  # possible. Service names differ between WAMP versions.
  foreach ($serviceName in @('wampmariadb64', 'wampmariadb', 'wampmysqld64', 'wampmysqld')) {
    $mysqlService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($mysqlService -and $mysqlService.Status -ne 'Running') {
      try {
        Start-Service -Name $serviceName -ErrorAction Stop
        Write-LauncherLog "Started MySQL service $serviceName"
      } catch {
        Write-LauncherLog "Could not start $serviceName automatically: $($_.Exception.Message)"
      }
    }
  }

  $mysqlPort = 3306
  $portLine = Get-Content -LiteralPath $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*MYSQL_PORT\s*=' } | Select-Object -First 1
  if ($portLine -and $portLine -match '^\s*MYSQL_PORT\s*=\s*(\d+)') {
    $mysqlPort = [int]$Matches[1]
  }

  $mysqlReady = $false
  for ($attempt = 1; $attempt -le 20; $attempt++) {
    if (Test-TcpPort -HostName '127.0.0.1' -Port $mysqlPort) {
      $mysqlReady = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if ($mysqlReady) {
    Write-LauncherLog "MySQL is listening on port $mysqlPort"
  } else {
    Write-LauncherLog "MySQL was not detected on port $mysqlPort; Node will still start in local/fallback mode"
  }

  if (-not (Test-Path -LiteralPath (Join-Path $projectPath 'node_modules\.bin\tsx.cmd'))) {
    Write-LauncherLog 'Dependencies are missing; running npm install'
    & $npmPath install --include=dev --no-audit --no-fund 2>&1 | Tee-Object -FilePath $launcherLog -Append
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
  }

  $existingApp = Get-NetTCPConnection -LocalPort $appPort -State Listen -ErrorAction SilentlyContinue
  if ($existingApp) {
    Write-LauncherLog "GameNet Plus Manager is already listening on port $appPort"
    exit 0
  }

  $serverProcess = Start-Process -FilePath $npmPath -ArgumentList @('run', 'dev') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrorLog -PassThru
  Write-LauncherLog "Started Node server with process id $($serverProcess.Id)"

  for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$appPort/api/health" -TimeoutSec 2
      if ($health.ok -eq $true) {
        Write-LauncherLog "GameNet Plus Manager is ready at http://localhost:$appPort"
        exit 0
      }
    } catch {
      # The server can need a few seconds while Vite initializes.
    }
    Start-Sleep -Seconds 1
  }

  throw "Node started but the health endpoint did not respond within 30 seconds on port $appPort. Check logs/server-error.log."
} catch {
  Write-LauncherLog "START FAILED: $($_.Exception.Message)"
  exit 1
}
