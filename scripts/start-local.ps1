#requires -Version 5.1
[CmdletBinding()]
param([switch]$Recreate, [switch]$Check, [string]$DockerExecutable = '')

$ErrorActionPreference = 'Stop'
$liveRoot = Split-Path -Parent $PSScriptRoot
Push-Location $liveRoot
try {
    if ($DockerExecutable -eq '') {
        $dockerCommand = Get-Command docker.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($dockerCommand) { $DockerExecutable = $dockerCommand.Source }
    }
    if ($DockerExecutable -eq '') {
        $dockerCandidates = @(
            "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
            "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe",
            "$env:LOCALAPPDATA\Docker\Docker\resources\bin\docker.exe"
        )
        foreach ($candidate in $dockerCandidates) {
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $DockerExecutable = $candidate
                break
            }
        }
    }
    if ($DockerExecutable -eq '' -or -not (Test-Path -LiteralPath $DockerExecutable -PathType Leaf)) {
        throw 'Docker CLI was not found on PATH or in the usual Docker Desktop locations. Repair/install Docker Desktop, open a new terminal and retry. For a custom installation, pass -DockerExecutable "C:\path\to\docker.exe".'
    }
    $DockerExecutable = (Resolve-Path -LiteralPath $DockerExecutable).Path
    Get-Command node -ErrorAction Stop | Out-Null
    if ($Check) {
        Write-Host 'Docker executable and Node paths resolved. Docker engine and Compose availability were not checked.'
        Write-Host 'No containers, credentials, environment files or databases were changed.'
        return
    }
    & $DockerExecutable info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0) { throw 'Docker is not accessible from this terminal. Existing services were not changed.' }
    & node scripts/init-local-secrets.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Local credential initialization failed.' }
    $composeArguments = @('compose', '-f', 'compose.local.yaml', 'up', '-d', '--build')
    if ($Recreate) { $composeArguments += '--force-recreate' }
    & $DockerExecutable @composeArguments
    if ($LASTEXITCODE -ne 0) { throw 'Local container startup failed. No volumes were removed.' }
    & $DockerExecutable compose -f compose.local.yaml ps
    if ($LASTEXITCODE -ne 0) { throw 'Could not verify local container state.' }
    Write-Host 'Nashvel Live: http://localhost:3000'
    Write-Host 'LiveKit signaling: ws://127.0.0.1:7880'
    Write-Host 'Start Chats API in a second terminal: .\scripts\start-chats-api.ps1'
    Write-Host 'Start Chats Web with pnpm dev from its app directory.'
} finally {
    Pop-Location
}
