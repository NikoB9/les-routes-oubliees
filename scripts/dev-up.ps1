param(
    [switch] $App
)

$composeArgs = @("-f", "infra/compose.yml")

if ($App) {
    docker compose @composeArgs --profile app up --build
} else {
    docker compose @composeArgs up db
}
