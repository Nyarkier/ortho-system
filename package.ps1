# Build the React frontend and package the Python backend into a single executable.
# The result is placed in dist\package\OrthoSystem.exe.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host '1/3 Preparing frontend build...'
Push-Location "$root\ortho-app"
if (-Not (Test-Path .\node_modules)) {
    npm install
}
npm run build
Pop-Location

Write-Host '2/3 Packaging backend with PyInstaller...'
$pyInstallerExe = "$root\.venv\Scripts\pyinstaller.exe"
if (-Not (Test-Path $pyInstallerExe)) {
    Write-Host 'PyInstaller not found in virtualenv, installing...'
    & "$root\.venv\Scripts\python.exe" -m pip install pyinstaller
}
Set-Location "$root\backend"
Remove-Item -Recurse -Force .\build, .\dist, .\main.spec -ErrorAction SilentlyContinue

& $pyInstallerExe --onefile --add-data "$root\ortho-app\dist;dist" main.py
if ($LASTEXITCODE -ne 0) {
    throw 'PyInstaller build failed.'
}

Write-Host '3/3 Copying package output...'
$packageOutput = "$root\dist\package"
Remove-Item -Recurse -Force $packageOutput -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $packageOutput | Out-Null
Copy-Item -Path "$root\backend\dist\main.exe" -Destination "$packageOutput\OrthoSystem.exe"
Copy-Item -Path "$root\README.md" -Destination "$packageOutput\README.md"

Write-Host 'Package ready:'
Write-Host "  $packageOutput\OrthoSystem.exe"
Write-Host 'Copy this file to the isolated PC and run it.'
