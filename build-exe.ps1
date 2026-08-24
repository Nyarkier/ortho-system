# Build script for Ortho App EXE files

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Ortho App EXE Files" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Set-Location $PSScriptRoot

Write-Host "`nStep 1: Installing PyInstaller..." -ForegroundColor Yellow
pip install pyinstaller

Write-Host "`nStep 2: Building Appointment.exe..." -ForegroundColor Yellow
pyinstaller Appointment.spec

Write-Host "`nStep 3: Building main.exe..." -ForegroundColor Yellow
Set-Location backend
pyinstaller main.spec
Set-Location ..

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Build complete! EXE files are in dist/" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
