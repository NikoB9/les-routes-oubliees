<#
.SYNOPSIS
    Lance l'environnement local complet (PostgreSQL + backend + frontend) via Docker Compose.

.DESCRIPTION
    Enveloppe pratique autour de "docker compose -f infra/compose.yml".
    Construit et demarre les trois services (profil "app"), cree un .env de dev
    si absent, verifie que Docker repond, puis affiche les URLs d'acces.

    Tout passe par le conteneur frontend (http://localhost:4200) : le SPA est servi
    et les appels /api sont proxifies vers le backend. Inutile donc d'appeler le
    backend directement.

.PARAMETER DbOnly
    Ne demarre que PostgreSQL (utile si on lance backend/frontend nativement a cote).

.PARAMETER Rebuild
    Reconstruit les images sans cache avant de demarrer (apres changement de dependances).

.PARAMETER Foreground
    Attache la sortie des conteneurs au terminal (Ctrl+C pour arreter).
    Par defaut, la stack demarre en arriere-plan (detache).

.PARAMETER Logs
    Suit les logs des services deja demarres, puis quitte.

.PARAMETER Down
    Arrete et supprime les conteneurs (les donnees DB/medias sont conservees).

.PARAMETER Clean
    Comme -Down, mais supprime aussi les volumes (RAZ complete DB + medias).

.EXAMPLE
    .\scripts\runLocalEnv.ps1
    Demarre toute la stack en arriere-plan et affiche les URLs.

.EXAMPLE
    .\scripts\runLocalEnv.ps1 -Logs
    Suit les logs de la stack en cours.

.EXAMPLE
    .\scripts\runLocalEnv.ps1 -Down
    Arrete la stack (conserve les donnees).
#>
[CmdletBinding()]
param(
    [switch] $DbOnly,
    [switch] $Rebuild,
    [switch] $Foreground,
    [switch] $Logs,
    [switch] $Down,
    [switch] $Clean
)

$ErrorActionPreference = 'Stop'

# Racine du depot : ce script vit dans scripts/, on remonte d'un niveau.
$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot 'infra/compose.yml'
$envFile = Join-Path $repoRoot '.env'
$envExample = Join-Path $repoRoot '.env.example'

function Assert-Docker {
    try {
        docker version --format '{{.Server.Version}}' | Out-Null
    } catch {
        throw "Docker ne repond pas. Demarre Docker Desktop, attends qu'il soit pret, puis relance."
    }
}

function Get-EnvValue {
    param([string] $Name, [string] $Default)
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.+?)\s*$") {
                return $Matches[1]
            }
        }
    }
    return $Default
}

# Le profil "app" (top-level) doit precéder la sous-commande compose.
$baseArgs = @('-f', $composeFile)
if (-not $DbOnly) {
    $baseArgs += @('--profile', 'app')
}

Assert-Docker

# --- Arret / nettoyage ---
if ($Down -or $Clean) {
    if ($Clean) {
        Write-Host "Arret des services et suppression des volumes (DB + medias)..." -ForegroundColor Yellow
        docker compose @baseArgs down --volumes
    } else {
        Write-Host "Arret des services (donnees conservees)..." -ForegroundColor Yellow
        docker compose @baseArgs down
    }
    return
}

# --- Suivi des logs ---
if ($Logs) {
    docker compose @baseArgs logs -f --tail=100
    return
}

# --- .env de developpement cree si absent ---
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host ".env cree a partir de .env.example (valeurs de developpement)." -ForegroundColor Cyan
}

# --- Reconstruction complete optionnelle ---
if ($Rebuild -and -not $DbOnly) {
    Write-Host "Reconstruction des images sans cache..." -ForegroundColor Cyan
    docker compose @baseArgs build --no-cache
}

# --- Demarrage ---
$upArgs = $baseArgs + 'up'
if (-not $DbOnly) {
    $upArgs += '--build'      # prend en compte les changements de code
}
if (-not $Foreground) {
    $upArgs += '--detach'
}
if ($DbOnly) {
    $upArgs += 'db'
}

if ($DbOnly) {
    Write-Host "Demarrage de PostgreSQL uniquement..." -ForegroundColor Cyan
} else {
    Write-Host "Construction et demarrage de la stack complete (db + backend + frontend)..." -ForegroundColor Cyan
    Write-Host "Le premier build peut prendre plusieurs minutes." -ForegroundColor DarkGray
}

docker compose @upArgs

# En mode attache (Foreground), docker rend la main a l'arret : on s'arrete la.
if ($Foreground) {
    return
}

# --- Recapitulatif (mode detache) ---
$frontendPort = Get-EnvValue -Name 'FRONTEND_PORT' -Default '4200'
$backendPort  = Get-EnvValue -Name 'BACKEND_PORT'  -Default '8080'
$pgPort       = Get-EnvValue -Name 'POSTGRES_PORT' -Default '5432'

Write-Host ""
Write-Host "Environnement demarre." -ForegroundColor Green
if (-not $DbOnly) {
    Write-Host "  Application  : http://localhost:$frontendPort" -ForegroundColor Green
    Write-Host "  API backend  : http://localhost:$backendPort (proxifiee via l'application)"
}
Write-Host "  PostgreSQL   : localhost:$pgPort"
Write-Host ""
Write-Host "Suivre les logs : .\scripts\runLocalEnv.ps1 -Logs"
Write-Host "Arreter         : .\scripts\runLocalEnv.ps1 -Down"
Write-Host "RAZ complete    : .\scripts\runLocalEnv.ps1 -Clean"