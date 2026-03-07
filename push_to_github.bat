@echo off
echo ========================================
echo   TU DONG DAY CODE LEN GITHUB - MINADS  
echo ========================================

set /p msg="Nhap noi dung thay doi (Enter de dung mac dinh): "
if "%msg%"=="" set msg="Update: %date% %time%"

echo.
echo 1. Dang them file (git add)...
git add .

echo 2. Dang luu thay doi (git commit)...
git commit -m "%msg%"

echo 3. Dang day code len GitHub (git push)...
git push origin main

echo.
echo ========================================
echo          HOAN TAT - MINADS SOFT         
echo ========================================
pause
