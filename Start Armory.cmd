@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.13 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\vinext" (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open the local address shown below in your browser.
echo Keep this window open while using ARMORY.
call npm.cmd run dev
pause
