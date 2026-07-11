param(
    [ValidateSet("lint", "test", "build", "all")]
    [string] $Task = "all"
)

$workdir = "/workspace"
$volume = "${PWD}\frontend:$workdir"
$image = "node:24.15.0-bookworm"

function Invoke-FrontendTask {
    param([string] $Command)

    docker run --rm -v $volume -w $workdir $image sh -lc $Command
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
