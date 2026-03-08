@echo off
echo ========================================
echo   CAP NHAT CODE - MINADS SOFT
echo   (GitHub + Firebase Hosting)
echo ========================================

set /p msg="Nhap noi dung thay doi (Enter de dung mac dinh): "
if "%msg%"=="" set msg=Update: %date% %time%

echo.
echo [1/4] Dang them file vao Git...
git add .

echo [2/4] Dang luu thay doi (Git Commit)...
git commit -m "%msg%"

echo [3/4] Dang day code len GitHub...
git push origin main

echo [4/4] Dang build va deploy len Firebase Hosting...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo LOI: Build that bai! Vui long kiem tra loi code.
    pause
    exit /b %ERRORLEVEL%
)

call npx firebase deploy --only hosting,firestore:rules

echo.
echo ========================================
echo   HOAN TAT - DA CAP NHAT:
echo   - GitHub (luu tru code)
echo   - Firebase Hosting (web online)
echo ========================================
pause
