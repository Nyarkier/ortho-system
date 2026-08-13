@echo off
REM Build script for Ortho App EXE files

echo ========================================
echo Building Ortho App EXE Files
echo ========================================

cd /d D:\Ortho_App\ortho-system

echo.
echo Step 1: Installing PyInstaller...
pip install pyinstaller

echo.
echo Step 2: Building Appointment.exe...
pyinstaller Appointment.spec

echo.
echo Step 3: Building main.exe...
cd backend
pyinstaller main.spec
cd ..

echo.
echo ========================================
echo Build complete! EXE files are in dist/
echo ========================================
pause
