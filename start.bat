@echo off
setlocal

title PocketPrint Bridge - Launcher
color 0B

echo ===============================================================================
echo                      POCKETPRINT BRIDGE - SYSTEM STARTUP
echo ===============================================================================
echo.

set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "WEB_DIR=%PROJECT_ROOT%\web"

:: Centralized Cache & Tool Paths (D:\My Created Projects\Cache)
set "CACHE_ROOT=D:\My Created Projects\Cache"
set "npm_config_cache=%CACHE_ROOT%\npm"
set "PIP_CACHE_DIR=%CACHE_ROOT%\pip"
set "PNPM_HOME=%CACHE_ROOT%\pnpm"
set "PNPM_CACHE_DIR=%CACHE_ROOT%\pnpm"
set "YARN_CACHE_FOLDER=%CACHE_ROOT%\yarn"
set "GRADLE_USER_HOME=%CACHE_ROOT%\gradle"
set "EXPO_CACHE_DIR=%CACHE_ROOT%\expo"
set "METRO_CACHE_DIR=%CACHE_ROOT%\metro"

:: Prepend tools from Cache directory
set "PATH=%CACHE_ROOT%\tools\git\cmd;%CACHE_ROOT%\tools\gh;C:\Program Files\nodejs;%PATH%"

echo [*] Project Root:     %PROJECT_ROOT%
echo [*] Backend Folder:   %BACKEND_DIR%
echo [*] Web Folder:       %WEB_DIR%
echo [*] Shared Cache:     %CACHE_ROOT%
echo [*] NPM Cache:        %npm_config_cache%
echo.

:: 1. Verify Node.js & NPM
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js or verify C:\Program Files\nodejs.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in PATH!
    pause
    exit /b 1
)

echo [OK] Node.js, npm, and toolchain detected.
echo.

:: 2. Pre-check ports (5000 and 5173)
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [WARN] Port 5000 is already in use.
    echo If a previous Relay instance is running, run stop.bat first.
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [WARN] Port 5173 is already in use.
    echo If a previous Web Frontend is running, run stop.bat first.
)

echo.
echo ===============================================================================
echo Starting Services:
echo   1. Cloud Relay Server         (Port 5000)
echo   2. Web Frontend Dashboard     (Port 5173)
echo   3. Windows Laptop Print Agent (Canon USB Spooler)
echo ===============================================================================
echo.

:: 3. Launch Backend Cloud Relay Server
echo [1/3] Launching Cloud Relay Server (Port 5000)...
start "PocketPrint Cloud Relay" /D "%BACKEND_DIR%" cmd /k "call npm run dev"

:: Delay for backend to initialize
ping 127.0.0.1 -n 4 >nul

:: 4. Launch Web Frontend (Vite)
echo [2/3] Launching Web Frontend Dashboard (Port 5173)...
start "PocketPrint Web Dashboard" /D "%WEB_DIR%" cmd /k "call npm run dev -- --host"

:: Delay for frontend bundler
ping 127.0.0.1 -n 4 >nul

:: 5. Launch Windows Laptop Print Agent
echo [3/3] Launching Windows Laptop Print Agent (Mode A)...
start "PocketPrint Windows Agent" /D "%BACKEND_DIR%" cmd /k "call npm run agent"

echo.
echo ===============================================================================
echo                         ALL SERVICES STARTED!
echo ===============================================================================
echo.
echo  * Web Dashboard:          http://localhost:5173
echo  * Cloud Relay API:        http://localhost:5000
echo  * Windows Agent Gateway:  Active (Connected to Canon MG2500 Driver)
echo.
echo  Tip: Double-click stop.bat at any time to shut down all services.
echo ===============================================================================
echo.

:: Open default browser to the web dashboard
start http://localhost:5173

ping 127.0.0.1 -n 3 >nul
exit /b 0
