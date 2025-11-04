@echo off
echo Stopping frontend server on port 8080...

REM Find and kill process using port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /PID %%a /F >nul 2>&1
)

REM Wait a moment for port to be released
timeout /t 2 /nobreak >nul

echo Starting frontend server on http://localhost:8080...
cd /d %~dp0..
npx http-server -p 8080 -o

pause

