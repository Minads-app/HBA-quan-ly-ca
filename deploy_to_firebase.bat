@echo off
echo ========================================
echo   TU DONG TRIEN KHAI LEN FIREBASE - MINADS
echo ========================================

echo.
echo 1. Dang kiem tra dang nhap Firebase...
call npx firebase login

echo.
echo 2. Dang xay dung ban build (npm run build)...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Lỗi: Quá trình Build thất bại. Vui lòng kiểm tra lỗi code!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 3. Dang trien khai len Firebase Hosting...
call npx firebase deploy --only hosting,firestore:rules

echo.
echo ========================================
echo   TRIEN KHAI HOAN TAT - MINADS SOFT
echo ========================================
pause
