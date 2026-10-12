@echo off
setlocal

cd /d "%~dp0"
set "EDITOR_URL=http://127.0.0.1:3001"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js or add npm to PATH.
  pause
  exit /b 1
)

echo Starting CNT-FAI editor at %EDITOR_URL% ...
start "CNT-FAI Editor Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url=$env:EDITOR_URL; $deadline=(Get-Date).AddSeconds(20); while ((Get-Date) -lt $deadline) { try { $r=Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 1; if ($r.StatusCode -ge 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"

start "" "%EDITOR_URL%"
echo Editor opened in your browser.

endlocal
