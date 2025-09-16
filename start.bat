@echo off
REM Minimal robust start.bat for Metasploit Recon UI
pushd %~dp0

echo Starting Metasploit Recon Interface...

REM -------------------------
REM 1) Check Python
REM -------------------------
python --version >nul 2>&1
if errorlevel 1 (
  echo Error: Python not found. Please install Python 3.11+.
  pause
  popd
  exit /b 1
)

REM -------------------------
REM 2) Check Metasploit (try PATH and MSF_PATH)
REM -------------------------
where msfconsole >nul 2>&1
if errorlevel 1 (
  if not "%MSF_PATH%"=="" (
    set "PATH=%MSF_PATH%;%PATH%"
    where msfconsole >nul 2>&1
  )
)

where msfconsole >nul 2>&1
if errorlevel 1 (
  echo Error: Metasploit Framework not found in PATH.
  echo If installed, set MSF_PATH to the Metasploit folder, then re-run this script.
  echo Example: setx MSF_PATH "C:\metasploit-framework"
  pause
  popd
  exit /b 1
)

REM -------------------------
REM 3) Ensure project venv exists at .venv
REM -------------------------
if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment at .venv...
  python -m venv .venv
  if errorlevel 1 (
    echo Failed to create venv
    pause
    popd
    exit /b 1
  )
)

REM build path to venv python using current directory (avoids parsing %~dp0 issues)
set "VENV_PY=%CD%\.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
  echo Error: venv Python not found at %VENV_PY%
  pause
  popd
  exit /b 1
)

REM -------------------------
REM 4) Upgrade pip & install requirements (idempotent)
REM -------------------------
echo Upgrading packaging tools...
"%VENV_PY%" -m pip install --upgrade pip setuptools wheel

if exist "backend\requirements.txt" (
  echo Installing backend requirements...
  "%VENV_PY%" -m pip install -r backend\requirements.txt
) else (
  echo Warning: backend\requirements.txt not found
)

REM -------------------------
REM 5) Ensure run_backend.py exists (create/overwrite)
REM -------------------------
echo Creating run_backend.py...
>run_backend.py echo from backend.app import MetasploitReconBackend
>>run_backend.py echo backend = MetasploitReconBackend()
>>run_backend.py echo app = backend.app

REM -------------------------
REM 6) Start backend in a new window (so this batch can continue)
REM -------------------------
echo Starting backend API (new window)...
start "Metasploit Backend" "%VENV_PY%" -m uvicorn run_backend:app --host 127.0.0.1 --port 8000 --reload

REM -------------------------
REM 7) Wait/poll for backend health
REM -------------------------
echo Waiting for backend to become available...
set /a tries=0
:poll
  timeout /t 1 /nobreak >nul
  curl -s http://127.0.0.1:8000/ >nul 2>&1
  if errorlevel 1 (
    set /a tries+=1
    if %tries% GEQ 20 (
      echo Error: backend did not start in time.
      pause
      popd
      exit /b 1
    )
    goto poll
  )
echo Backend is up.

REM -------------------------
REM 8) Start frontend if it exists
REM -------------------------
if exist "frontend" (
  echo Starting frontend simple server...
  pushd frontend
  start "Frontend Server" "%VENV_PY%" -m http.server 3000
  popd
  echo Frontend started at http://localhost:3000
) else (
  echo Frontend folder not found, skipping.
)

echo.
echo Backend: http://127.0.0.1:8000
echo API Docs: http://127.0.0.1:8000/docs
echo Press any key to stop services...
pause >nul

REM Attempt to close the windows we started (best-effort)
taskkill /f /fi "WINDOWTITLE eq Metasploit Backend" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Frontend Server" >nul 2>&1

popd
exit /b 0