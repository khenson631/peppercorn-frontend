@echo off
echo Starting frontend server on http://localhost:8080...
cd ..\..
cd frontend
npx http-server -p 8080 -o
pause

