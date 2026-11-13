@echo off
rem Star Lattice: starts its local server and opens it in your browser.
rem Close this window to stop it. (Made in stage 1; "Make desktop shortcut.vbs" puts a shortcut to it on the desktop.)
title Star Lattice
cd /d "%~dp0"

set "PY="
for %%P in (python py) do if not defined PY (
  %%P -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul && set "PY=%%P"
)
for %%P in ("%USERPROFILE%\miniconda3\python.exe" "%USERPROFILE%\anaconda3\python.exe" "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe") do if not defined PY (
  if exist %%P set "PY=%%~P"
)
if not defined PY (
  echo.
  echo   Star Lattice needs Python 3, which wasn't found on this computer.
  echo   Install it from https://www.python.org/downloads/  -- on the installer's
  echo   first screen, tick "Add python.exe to PATH". Then start Star Lattice again.
  echo.
  start "" "https://www.python.org/downloads/"
  pause
  exit /b 1
)

echo Starting Star Lattice with %PY% ...
"%PY%" serve.py %* --open
if errorlevel 1 (
  echo.
  echo   Star Lattice stopped with an error ^(see above^).
  pause
)
