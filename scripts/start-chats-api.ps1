#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ApiDirectory = '',
    [ValidateRange(1024,65535)][int]$Port = 8001,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
if ($ApiDirectory -eq '') { $ApiDirectory = Join-Path $PSScriptRoot '..\..\hillbcs-digital-platform\apps\chats-api' }
$apiRoot = (Resolve-Path -LiteralPath $ApiDirectory).Path
$credentialFile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\secrets\local-keys.yaml'))
if (-not (Test-Path -LiteralPath (Join-Path $apiRoot 'artisan'))) { throw 'Chats API was not found at the selected path.' }
if (-not (Test-Path -LiteralPath (Join-Path $apiRoot 'vendor\autoload.php'))) { throw 'Install the Chats API dependencies first.' }
if (Test-Path -LiteralPath (Join-Path $apiRoot 'bootstrap\cache\config.php')) {
    throw 'Chats API has cached configuration. Resolve that deliberately before using process-local LiveKit overrides; this script will not clear it.'
}
Get-Command php -ErrorAction Stop | Out-Null
if ($Check) {
    Write-Host 'Chats API launcher checks passed. No credential contents, environment files or database contents were read.'
    return
}
if (-not (Test-Path -LiteralPath $credentialFile -PathType Leaf)) { throw 'Run scripts/start-local.ps1 first to initialize the local stack.' }

Write-Host "Chats API: http://127.0.0.1:$Port (foreground; Ctrl+C to stop)."
Write-Host 'Using the local LiveKit credential file. Existing database settings are unchanged; no migrations will run.'

$oldLivekitUrl = $env:LIVEKIT_URL
$oldLivekitHttpUrl = $env:LIVEKIT_HTTP_URL
$oldLivekitKeyFile = $env:LIVEKIT_KEY_FILE
$oldMeetLivekit = $env:MEET_PROVIDER_LIVEKIT_ENABLED
$oldWorkers = $env:PHP_CLI_SERVER_WORKERS

try {
    $env:LIVEKIT_URL = 'ws://127.0.0.1:7880'
    $env:LIVEKIT_HTTP_URL = 'http://127.0.0.1:7880'
    $env:LIVEKIT_KEY_FILE = $credentialFile
    $env:MEET_PROVIDER_LIVEKIT_ENABLED = 'true'
    $env:PHP_CLI_SERVER_WORKERS = '1'

    Push-Location $apiRoot
    & php artisan serve --no-reload --host=127.0.0.1 --port=$Port --tries=1
} finally {
    Pop-Location
    $env:LIVEKIT_URL = $oldLivekitUrl
    $env:LIVEKIT_HTTP_URL = $oldLivekitHttpUrl
    $env:LIVEKIT_KEY_FILE = $oldLivekitKeyFile
    $env:MEET_PROVIDER_LIVEKIT_ENABLED = $oldMeetLivekit
    $env:PHP_CLI_SERVER_WORKERS = $oldWorkers
}
