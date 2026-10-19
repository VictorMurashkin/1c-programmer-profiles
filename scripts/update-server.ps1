# Stop ProfilesNext, snapshot the database, pull main, check the migration, rebuild, start the service.
# IIS keeps proxying; this script updates the Node app folder, not the IIS site folder.
# The live database is modified only with -SyncCatalog: competencies and profiles are rewritten from seed/data.json.
# Employees, IDPs and assignments stay. Restoring a snapshot is a manual step, see docs/update-server.md.
#Requires -RunAsAdministrator

param(
  [string]$AppDir = "",
  [string]$ServiceName = "ProfilesNext",
  [string]$BackupDir = "C:\apps\programming-profiles-backups",
  [switch]$SyncCatalog
)

$ErrorActionPreference = "Stop"

if (-not $AppDir) {
  $AppDir = Split-Path -Parent $PSScriptRoot
}

$script:ServiceStopped = $false

function Wait-AppStatus([string]$Status) {
  try {
    (Get-Service -Name $ServiceName).WaitForStatus($Status, (New-TimeSpan -Seconds 40))
    return $true
  } catch {
    return $false
  }
}

function Start-AppService {
  if (-not $script:ServiceStopped) {
    return $true
  }
  Write-Host "Starting $ServiceName"
  try {
    Start-Service -Name $ServiceName
  } catch {
    Write-Host "Could not start $ServiceName. Start it manually: Start-Service $ServiceName"
    return $false
  }
  if (-not (Wait-AppStatus "Running")) {
    Write-Host "Start of $ServiceName timed out after 40 seconds. Check Get-Service $ServiceName and logs\node-err.log."
    return $false
  }
  $script:ServiceStopped = $false
  Write-Host "Service $ServiceName is running."
  return $true
}

function Fail([string]$Message) {
  Write-Host $Message
  if (-not (Start-AppService)) {
    exit 1
  }
  exit 1
}

Set-Location $AppDir

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail "git is not installed. Install Git for Windows, then run this script again."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Fail "npm.cmd is not on PATH. Install Node.js 24 and open a new PowerShell window."
}
if (-not (Test-Path (Join-Path $AppDir ".git"))) {
  Fail "No git checkout in $AppDir. Clone the repository first."
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
  Fail "Service $ServiceName is not installed. Create it once, see docs/deploy-iis.md."
}

$envFile = Join-Path $AppDir ".env.local"
if (-not (Test-Path $envFile)) {
  Fail "Missing $envFile. The update does not create server passwords."
}

$dirty = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) {
  Fail "git status failed."
}
if ($dirty.Count -gt 0) {
  Fail "Local edits in $AppDir. On the server the code must match GitHub. Do not continue."
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
  Fail "git rev-parse failed."
}
if ($branch -ne "main") {
  Fail "Checkout is '$branch', not main. git pull was not run. Service was not stopped."
}

Write-Host "Stopping $ServiceName"
Stop-Service -Name $ServiceName -Force
$script:ServiceStopped = $true
if (-not (Wait-AppStatus "Stopped")) {
  Fail "Stop of $ServiceName timed out after 40 seconds. Update was not started."
}

$before = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or -not $before) {
  Fail "git rev-parse failed."
}

$db = Join-Path $AppDir "data\profiles.sqlite"
if (-not (Test-Path $db)) {
  Fail "Missing $db. Update was not started."
}
try {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $probe = Join-Path $BackupDir ".write-probe"
  Set-Content -Path $probe -Value "ok" -Encoding Ascii
  Remove-Item $probe -Force
} catch {
  Fail "Backup folder is not writable: $BackupDir. git pull was not run."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $BackupDir ("profiles-{0}-{1}.sqlite" -f $stamp, $before.Substring(0, [Math]::Min(12, $before.Length)))
Write-Host "Snapshot $backup"
& npm.cmd run db:snapshot -- $db $backup
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backup)) {
  Fail "Database snapshot failed. git pull was not run. Backup: $backup"
}

$packagesChanged = $false
$buildStarted = $false

function Restore-Previous([string]$Step) {
  Write-Host "Step '$Step' failed. Restoring $before."
  Write-Host "Backup: $backup"
  $ok = $true
  git reset --hard $before
  if ($LASTEXITCODE -ne 0) {
    $ok = $false
  }
  if ($ok -and $packagesChanged) {
    Write-Host "npm ci (previous version)"
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) {
      $ok = $false
    }
  }
  if ($ok -and ($packagesChanged -or $buildStarted)) {
    Write-Host "npm run build (previous version)"
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
      $ok = $false
    }
  }
  if (-not $ok) {
    Write-Host "Rollback failed. Service $ServiceName stays stopped."
    Write-Host "Manual: cd $AppDir"
    Write-Host "  git reset --hard $before"
    Write-Host "  npm ci"
    Write-Host "  npm run build"
    Write-Host "  Start-Service $ServiceName"
    Write-Host "Backup: $backup"
    exit 1
  }
  if (-not (Start-AppService)) {
    Write-Host "Code is at $before, but the service is not running. Backup: $backup"
    exit 1
  }
  Write-Host "Still on the previous version $before. Backup: $backup"
  exit 1
}

Write-Host "Pulling origin/main"
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) {
  Restore-Previous "git pull"
}

$after = (git rev-parse HEAD).Trim()
$changed = @()
if ($before -ne $after) {
  $changed = @(git diff --name-only $before $after)
  if ($LASTEXITCODE -ne 0) {
    Restore-Previous "git diff"
  }
}

$needCi = -not (Test-Path (Join-Path $AppDir "node_modules"))
foreach ($name in $changed) {
  if ($name -eq "package.json" -or $name -eq "package-lock.json") {
    $needCi = $true
    $packagesChanged = $true
  }
}

if ($needCi) {
  $packagesChanged = $true
  Write-Host "npm ci"
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) {
    Restore-Previous "npm ci"
  }
}

Write-Host "npm run check:upgrade"
& npm.cmd run check:upgrade -- $backup
if ($LASTEXITCODE -ne 0) {
  Restore-Previous "check:upgrade"
}

Write-Host "npm run build"
$buildStarted = $true
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  Restore-Previous "build"
}

if (-not (Test-Path $envFile)) {
  Restore-Previous ".env.local"
}

if ($SyncCatalog) {
  Write-Host "Sync catalog from seed/data.json"
  & npm.cmd run db:sync-catalog -- $db
  if ($LASTEXITCODE -ne 0) {
    Restore-Previous "sync-catalog"
  }
}

if (-not (Start-AppService)) {
  Write-Host "Build succeeded, but $ServiceName did not start. Code is at $after. Backup: $backup"
  exit 1
}
Write-Host "Update finished. Backup: $backup"
Write-Host "Open the site and refresh with Ctrl+F5."
