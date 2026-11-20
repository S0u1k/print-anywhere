@echo off
setlocal

title PocketPrint Bridge - Shutdown
color 0C

echo ===============================================================================
echo                      POCKETPRINT BRIDGE - SYSTEM SHUTDOWN
echo ===============================================================================
echo.
echo [*] Shutting down PocketPrint Bridge services...
echo.

:: 1. Terminate Windows by title
taskkill /F /FI "WINDOWTITLE eq PocketPrint Cloud Relay*" >nul 2>nul
taskkill /F /FI "WINDOWTITLE eq PocketPrint Web Dashboard*" >nul 2>nul
taskkill /F /FI "WINDOWTITLE eq PocketPrint Windows Agent*" >nul 2>nul

:: 2. Terminate port 5000 (Cloud Relay) and port 5173 (Web Dashboard) via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ports = @(5000, 5173); " ^
    "foreach ($port in $ports) { " ^
    "    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; " ^
    "    foreach ($conn in $conns) { " ^
    "        $pId = $conn.OwningProcess; " ^
    "        if ($pId -and $pId -gt 0) { " ^
    "            Write-Host ('[*] Stopping process on port ' + $port + ' (PID: ' + $pId + ')...'); " ^
    "            Stop-Process -Id $pId -Force -ErrorAction SilentlyContinue; " ^
    "        } " ^
    "    } " ^
    "}; " ^
    "$agentProcs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*laptopAgent.ts*' }; " ^
    "foreach ($p in $agentProcs) { " ^
    "    Write-Host ('[*] Stopping Laptop Agent (PID: ' + $p.ProcessId + ')...'); " ^
    "    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; " ^
    "}"

echo.
ping 127.0.0.1 -n 3 >nul

:: 3. Port Verification
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$p5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue; " ^
    "$p5173 = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; " ^
    "if (-not $p5000 -and -not $p5173) { " ^
    "    Write-Host '===============================================================================' -ForegroundColor Green; " ^
    "    Write-Host '                     ALL SERVICES STOPPED SUCCESSFULLY!' -ForegroundColor Green; " ^
    "    Write-Host '===============================================================================' -ForegroundColor Green; " ^
    "    Write-Host ' [OK] Cloud Relay Server        (Port 5000) : STOPPED' -ForegroundColor Green; " ^
    "    Write-Host ' [OK] Web Frontend Dashboard    (Port 5173) : STOPPED' -ForegroundColor Green; " ^
    "    Write-Host ' [OK] Windows Laptop Print Agent            : STOPPED' -ForegroundColor Green; " ^
    "    Write-Host ''; " ^
    "    Write-Host ' All project ports and processes are now cleanly released.' -ForegroundColor Green; " ^
    "} else { " ^
    "    Write-Host '===============================================================================' -ForegroundColor Yellow; " ^
    "    Write-Host '                       SHUTDOWN COMPLETED WITH WARNINGS' -ForegroundColor Yellow; " ^
    "    Write-Host '===============================================================================' -ForegroundColor Yellow; " ^
    "    if ($p5000) { Write-Host ' [WARN] Port 5000 is still occupied by PID ' $p5000.OwningProcess -ForegroundColor Yellow; } " ^
    "    if ($p5173) { Write-Host ' [WARN] Port 5173 is still occupied by PID ' $p5173.OwningProcess -ForegroundColor Yellow; } " ^
    "}"

echo ===============================================================================
echo.
ping 127.0.0.1 -n 2 >nul
exit /b 0
