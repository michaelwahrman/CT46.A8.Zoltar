@echo off
rem CT46.A8.Zoltar - launch Zoltar so the music plays from the very first moment.
rem Chrome / Edge normally hold sound until the visitor clicks; this starts a separate browser window
rem with autoplay allowed (its own profile folder, so the flag works even if your browser is already open).
rem Add  --kiosk  after --app=... below for a full-screen coin-op cabinet (exit with Alt+F4).
setlocal
set "PAGE=%~dp0index.html"
set "PROFILE=%LOCALAPPDATA%\ZoltarKiosk"
set "FLAGS=--autoplay-policy=no-user-gesture-required --user-data-dir="%PROFILE%" --no-first-run"

set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER (
  echo Could not find Chrome or Edge. Open index.html in your browser and click once to start the music.
  pause
  exit /b 1
)
start "" "%BROWSER%" %FLAGS% --app="file:///%PAGE:\=/%"
endlocal
