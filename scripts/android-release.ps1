param(
    [string]$SdkPath = $env:ANDROID_HOME,
    [string]$JavaPath = $env:JAVA_HOME,
    [string]$GradlePath = '',
    [string]$BuildToolsVersion = '',
    [string]$Proxy = '',
    [switch]$UseMirror,
    [switch]$Offline
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $SdkPath) {
    $sdkCandidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Android/android-sdk'),
        (Join-Path $env:LOCALAPPDATA 'Android/Sdk'),
        (Join-Path $projectRoot '.runtime/android-sdk')
    )
    $SdkPath = $sdkCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'platforms/android-36/android.jar') } | Select-Object -First 1
    if (-not $SdkPath) { throw 'Set ANDROID_HOME or pass -SdkPath with Android SDK Platform 36 installed.' }
}
if (-not $JavaPath) {
    $jdkRoots = @((Join-Path $env:ProgramFiles 'Android/openjdk'), (Join-Path $projectRoot '.runtime/android-tools/jdk21'))
    foreach ($jdkRoot in $jdkRoots) {
        if (Test-Path -LiteralPath $jdkRoot) {
            $jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin/jlink.exe') } | Sort-Object Name -Descending | Select-Object -First 1
            if ($jdk) { $JavaPath = $jdk.FullName; break }
        }
    }
    if (-not $JavaPath) { throw 'Set JAVA_HOME to a full JDK 17 or 21 directory, or pass -JavaPath.' }
}
if (-not $GradlePath) { $GradlePath = Join-Path $projectRoot '.runtime/android-tools/gradle-8.13/bin/gradle.bat' }
if (-not $BuildToolsVersion) {
    $buildTools = Get-ChildItem -LiteralPath (Join-Path $SdkPath 'build-tools') -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'apksigner.bat')) } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if (-not $buildTools) { throw 'No installed stable Android Build Tools found. Pass -BuildToolsVersion if using a preview.' }
    $BuildToolsVersion = $buildTools.Name
}
$apksigner = Join-Path $SdkPath "build-tools/$BuildToolsVersion/apksigner.bat"
foreach ($required in @("$JavaPath/bin/java.exe", "$JavaPath/bin/javac.exe", "$JavaPath/bin/jlink.exe", "$JavaPath/bin/keytool.exe", "$SdkPath/platforms/android-36/android.jar", $apksigner, $GradlePath)) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Missing build dependency: $required" }
}
$previousJava = $env:JAVA_HOME
$previousSdk = $env:ANDROID_HOME
$previousGradle = $env:GRADLE_USER_HOME
$previousMirror = $env:STUDIO_CLOCK_MAVEN_MIRROR
Push-Location $projectRoot
try {
    $env:JAVA_HOME = $JavaPath
    $env:ANDROID_HOME = $SdkPath
    $env:GRADLE_USER_HOME = Join-Path $projectRoot '.runtime/gradle-cache'
    if ($UseMirror) { $env:STUDIO_CLOCK_MAVEN_MIRROR = '1' }
    Write-Output "Android SDK: $SdkPath"
    Write-Output "Java JDK: $JavaPath"
    Write-Output "Android Build Tools: $BuildToolsVersion"
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Timer tests failed.' }
    & npm.cmd run android:web
    if ($LASTEXITCODE -ne 0) { throw 'Vue build failed.' }
    & node scripts/notices.mjs --android
    if ($LASTEXITCODE -ne 0) { throw 'Android license collection failed.' }
    $signingDir = Join-Path $projectRoot 'android/signing'
    $keyFile = Join-Path $signingDir 'studio-clock-release.jks'
    $keyProperties = Join-Path $projectRoot 'android/keystore.properties'
    if (-not (Test-Path -LiteralPath $keyFile)) {
        if (Test-Path -LiteralPath $keyProperties) { throw 'Signing configuration exists but its key is missing. Restore the original signing key.' }
        New-Item -ItemType Directory -Path $signingDir -Force | Out-Null
        $secretBytes = New-Object byte[] 32
        $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $random.GetBytes($secretBytes)
        $random.Dispose()
        $env:STUDIO_CLOCK_KEY_PASSWORD = [Convert]::ToBase64String($secretBytes)
        try {
            & "$JavaPath/bin/keytool.exe" -genkeypair -keystore $keyFile -storetype PKCS12 -alias studio-clock -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Studio Clock, O=Studio Clock' -storepass:env STUDIO_CLOCK_KEY_PASSWORD -keypass:env STUDIO_CLOCK_KEY_PASSWORD -noprompt
            if ($LASTEXITCODE -ne 0) { throw 'Signing key generation failed.' }
            $lines = @('storeFile=signing/studio-clock-release.jks', 'keyAlias=studio-clock', "storePassword=$env:STUDIO_CLOCK_KEY_PASSWORD", "keyPassword=$env:STUDIO_CLOCK_KEY_PASSWORD")
            $lines | Set-Content -LiteralPath $keyProperties -Encoding ASCII
        } finally { $env:STUDIO_CLOCK_KEY_PASSWORD = $null }
    }
    if (-not (Test-Path -LiteralPath $keyProperties)) { throw 'Restore android/keystore.properties for the existing signing key.' }
    $sdkProperty = $SdkPath.Replace('\', '/').Replace(':', '\:')
    "sdk.dir=$sdkProperty" | Set-Content -LiteralPath 'android/local.properties' -Encoding ASCII
    $gradleArgs = @('-p', 'android', '--no-daemon', '--console=plain', "-PstudioClockBuildToolsVersion=$BuildToolsVersion", ':app:assembleRelease', ':app:lintRelease')
    if ($Offline) { $gradleArgs += '--offline' }
    if ($Proxy) {
        $proxyUri = [Uri]$Proxy
        $gradleArgs += @("-Dhttp.proxyHost=$($proxyUri.Host)", "-Dhttp.proxyPort=$($proxyUri.Port)", "-Dhttps.proxyHost=$($proxyUri.Host)", "-Dhttps.proxyPort=$($proxyUri.Port)", '-Dhttp.nonProxyHosts=localhost|127.*')
    }
    & $GradlePath @gradleArgs
    if ($LASTEXITCODE -ne 0) { throw 'Android build or lint failed.' }
    $builtApk = 'android/app/build/outputs/apk/release/app-release.apk'
    & $apksigner verify --verbose $builtApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    $version = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
    $outputDir = Join-Path $projectRoot "release/StudioClock-$version-android"
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    $apkName = "StudioClock-$version-android.apk"
    Copy-Item -LiteralPath $builtApk -Destination "$outputDir/$apkName" -Force
    Copy-Item -LiteralPath 'docs/ANDROID.md' -Destination "$outputDir/ReadMe.txt" -Force
    Copy-Item -LiteralPath 'docs/ANDROID_VALIDATION.md' -Destination "$outputDir/Validation.txt" -Force
    Copy-Item -LiteralPath 'LICENSE' -Destination "$outputDir/LICENSE.txt" -Force
    Copy-Item -LiteralPath 'ANDROID_THIRD_PARTY_NOTICES.txt' -Destination "$outputDir/THIRD_PARTY_NOTICES.txt" -Force
    $hash = (Get-FileHash -LiteralPath "$outputDir/$apkName" -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $apkName" | Set-Content -LiteralPath "$outputDir/SHA256SUMS.txt" -Encoding ASCII
    Get-Item -LiteralPath "$outputDir/$apkName" | Select-Object FullName, Length | Format-List
} finally {
    Pop-Location
    $env:JAVA_HOME = $previousJava
    $env:ANDROID_HOME = $previousSdk
    $env:GRADLE_USER_HOME = $previousGradle
    $env:STUDIO_CLOCK_MAVEN_MIRROR = $previousMirror
}
