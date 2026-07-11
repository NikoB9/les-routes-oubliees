param(
    [switch]$NoDocker,
    [switch]$SkipInstall,
    [switch]$SkipTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendDir = Join-Path $RepoRoot "backend"
$DistDir = Join-Path $RepoRoot "dist"
$StageDir = Join-Path $DistDir "release-staging"
$ArchivePath = Join-Path $DistDir "les-routes-oubliees-release.tar.gz"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-DockerRun {
    param(
        [Parameter(Mandatory = $true)][string]$Image,
        [Parameter(Mandatory = $true)][string]$MountPath,
        [Parameter(Mandatory = $true)][string[]]$Command,
        [string[]]$ExtraDockerArguments = @()
    )

    $arguments = @(
        "run",
        "--rm",
        "-v",
        "${MountPath}:/workspace",
        "-w",
        "/workspace"
    ) + $ExtraDockerArguments + @(
        $Image
    ) + $Command

    Invoke-Checked -FilePath "docker" -Arguments $arguments -WorkingDirectory $RepoRoot
}

function Resolve-Tar {
    $command = Get-Command "tar" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    $windowsTar = Join-Path $env:SystemRoot "System32\tar.exe"
    if (Test-Path $windowsTar) {
        return $windowsTar
    }

    throw "tar was not found. Install tar or ensure C:\Windows\System32\tar.exe is available."
}

if (Test-Path $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force
}
if (Test-Path $ArchivePath) {
    Remove-Item -LiteralPath $ArchivePath -Force
}

New-Item -ItemType Directory -Force -Path $StageDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $StageDir "backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $StageDir "frontend") | Out-Null

if ($NoDocker) {
    if (-not $SkipInstall) {
        Invoke-Checked -FilePath "npm" -Arguments @("ci") -WorkingDirectory $FrontendDir
    }
    Invoke-Checked -FilePath "npm" -Arguments @("run", "lint") -WorkingDirectory $FrontendDir
    if (-not $SkipTests) {
        Invoke-Checked -FilePath "npm" -Arguments @("test", "--", "--watch=false") -WorkingDirectory $FrontendDir
    }
    Invoke-Checked -FilePath "npm" -Arguments @("run", "build") -WorkingDirectory $FrontendDir

    $mavenArguments = @("-B", "package")
    if ($SkipTests) {
        $mavenArguments = @("-B", "-DskipTests", "package")
    }
    Invoke-Checked -FilePath (Join-Path $BackendDir "mvnw.cmd") -Arguments $mavenArguments -WorkingDirectory $BackendDir
}
else {
    $frontendCommands = @()
    if (-not $SkipInstall) {
        $frontendCommands += "npm ci"
    }
    $frontendCommands += "npm run lint"
    if (-not $SkipTests) {
        $frontendCommands += "npm test -- --watch=false"
    }
    $frontendCommands += "npm run build"
    Invoke-DockerRun `
        -Image "node:24.15.0-bookworm" `
        -MountPath $FrontendDir `
        -Command @("sh", "-lc", ($frontendCommands -join " && ")) `
        -ExtraDockerArguments @("-v", "/workspace/node_modules")

    $mavenCommand = "sh ./mvnw -B package"
    if ($SkipTests) {
        $mavenCommand = "sh ./mvnw -B -DskipTests package"
    }
    Invoke-DockerRun -Image "eclipse-temurin:25-jdk" -MountPath $BackendDir -Command @("sh", "-lc", $mavenCommand)
}

$IndexFiles = @(Get-ChildItem -LiteralPath (Join-Path $FrontendDir "dist") -Recurse -Filter "index.html")
if ($IndexFiles.Count -eq 0) {
    throw "No frontend index.html found under frontend/dist."
}

$FrontendIndex = $IndexFiles |
    Sort-Object @{ Expression = { if ($_.FullName -match "\\browser\\index\.html$") { 0 } else { 1 } } }, FullName |
    Select-Object -First 1
$FrontendBuildDir = Split-Path -Parent $FrontendIndex.FullName
Get-ChildItem -LiteralPath $FrontendBuildDir -Force |
    Copy-Item -Destination (Join-Path $StageDir "frontend") -Recurse -Force

$JarFiles = @(Get-ChildItem -LiteralPath (Join-Path $BackendDir "target") -Filter "*.jar" |
    Where-Object { $_.Name -notlike "original-*" } |
    Sort-Object LastWriteTime -Descending)
if ($JarFiles.Count -eq 0) {
    throw "No backend jar found under backend/target."
}

Copy-Item -LiteralPath $JarFiles[0].FullName -Destination (Join-Path $StageDir "backend\app.jar") -Force

$Commit = "unknown"
try {
    $Commit = (& git -C $RepoRoot rev-parse --short HEAD).Trim()
}
catch {
    $Commit = "unknown"
}

$CreatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
@(
    "commit=$Commit",
    "created_at_utc=$CreatedAt",
    "frontend_source=$($FrontendBuildDir.Replace($RepoRoot, '').TrimStart('\'))",
    "backend_source=$($JarFiles[0].Name)"
) | Set-Content -Path (Join-Path $StageDir "release-info.txt") -Encoding UTF8

$TarPath = Resolve-Tar
Invoke-Checked -FilePath $TarPath -Arguments @("-czf", $ArchivePath, "-C", $StageDir, "backend", "frontend", "release-info.txt") -WorkingDirectory $RepoRoot

$ArchiveEntries = @(& $TarPath -tzf $ArchivePath)
if ($ArchiveEntries -notcontains "backend/app.jar") {
    throw "Archive validation failed: backend/app.jar is missing."
}
if ($ArchiveEntries -notcontains "frontend/index.html") {
    throw "Archive validation failed: frontend/index.html is missing."
}

Write-Host "Release archive created: $ArchivePath"
