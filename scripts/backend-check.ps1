param(
    [switch] $SkipTests
)

$goal = if ($SkipTests) { "-DskipTests package" } else { "verify" }

docker run --rm `
    -v "${PWD}\backend:/workspace" `
    -w /workspace `
    eclipse-temurin:25-jdk `
    sh -lc "sh ./mvnw -B $goal"
