$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed.' }
    & npm.cmd run desktop:build
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
    & node scripts/notices.mjs
    if ($LASTEXITCODE -ne 0) { throw 'License collection failed.' }
    $version = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
    $releaseName = "StudioClock-$version-windows-x64"
    $outputDir = Join-Path $projectRoot "release/$releaseName"
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    Copy-Item -LiteralPath 'src-tauri/target/release/studio-clock.exe' -Destination "$outputDir/StudioClock.exe" -Force
    Copy-Item -LiteralPath 'docs/USER_GUIDE.md' -Destination "$outputDir/ReadMe.txt" -Force
    Copy-Item -LiteralPath 'docs/VALIDATION.md' -Destination "$outputDir/Validation.txt" -Force
    Copy-Item -LiteralPath 'LICENSE' -Destination "$outputDir/LICENSE.txt" -Force
    Copy-Item -LiteralPath 'THIRD_PARTY_NOTICES.txt' -Destination "$outputDir/THIRD_PARTY_NOTICES.txt" -Force
    $hash = (Get-FileHash -LiteralPath "$outputDir/StudioClock.exe" -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  StudioClock.exe" | Set-Content -LiteralPath "$outputDir/SHA256SUMS.txt" -Encoding ASCII
    Compress-Archive -LiteralPath $outputDir -DestinationPath "release/$releaseName.zip" -Force
    Get-Item -LiteralPath "$outputDir/StudioClock.exe", "release/$releaseName.zip" | Select-Object FullName, Length
} finally {
    Pop-Location
}
