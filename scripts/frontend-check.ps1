param(
    [ValidateSet("lint", "test", "build", "all")]
    [string] $Task = "all"
)

$workdir = "/workspace"
$volume = "${PWD}\frontend:$workdir"
$image = "node:24.15.0-bookworm"

# Sans ce controle, `all` enchaine les trois taches quoi qu'il arrive et rend le code de sortie
# de la derniere : une suite de tests morte — Vitest sait perdre un worker sans rien echouer —
# passait inapercue derriere un build reussi, et le lot partait pour verifie.
function Invoke-FrontendTask {
    param([string] $Command)

    docker run --rm -v $volume -w $workdir $image sh -lc $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Echec de la tache frontend : $Command (code $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
}

switch ($Task) {
    "lint" { Invoke-FrontendTask "npm run lint" }
    "test" { Invoke-FrontendTask "npm test -- --watch=false" }
    "build" { Invoke-FrontendTask "npm run build" }
    "all" {
        Invoke-FrontendTask "npm run lint"
        Invoke-FrontendTask "npm test -- --watch=false"
        Invoke-FrontendTask "npm run build"
    }
}
