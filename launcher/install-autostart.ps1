$ErrorActionPreference = 'Stop'
$launcherScript = $MyInvocation.MyCommand.Path.Replace('install-autostart.ps1', 'start-gamenet.ps1')
$projectPath = Split-Path -Parent (Split-Path -Parent $launcherScript)
$startupFolder = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$shortcutPath = Join-Path $startupFolder 'GameNet Plus Manager.lnk'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path -LiteralPath $launcherScript)) {
  throw "Launcher not found: $launcherScript"
}

New-Item -ItemType Directory -Path $startupFolder -Force | Out-Null
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`" -Background"
$shortcut.WorkingDirectory = $projectPath
$shortcut.Description = 'Start GameNet Plus Manager after Windows logon'
$shortcut.IconLocation = Join-Path $env:SystemRoot 'System32\shell32.dll,220'
$shortcut.Save()

Write-Host "Autostart installed: $shortcutPath"
Write-Host 'Restart Windows or run start-wamp.cmd to test it.'
