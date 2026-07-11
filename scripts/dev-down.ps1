param(
    [switch] $Volumes
)

$composeArgs = @("-f", "infra/compose.yml", "down")

if ($Volumes) {
    docker compose @composeArgs --volumes
} else {
    docker compose @composeArgs
}
