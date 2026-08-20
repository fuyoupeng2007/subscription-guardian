@echo off
chcp 65001 >nul
title Subscription Guardian
cd /d "%~dp0"

echo ============================================
echo       Subscription Guardian  -  Start
echo ============================================
echo.

set "HUB=http://127.0.0.1:11434"

rem ---- 1/4 find + start Ollama ----
echo [1/4] Checking model service (Ollama) ...
curl -s -m 2 %HUB%/api/version >nul 2>&1
if not errorlevel 1 goto ollama_ready

set "OLLAMA_EXE=%~dp0..\ollama\ollama.exe"
if not exist "%OLLAMA_EXE%" set "OLLAMA_EXE=%ProgramFiles%\ollama\ollama.exe"
if not exist "%OLLAMA_EXE%" set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\ollama\ollama.exe"
if not exist "%OLLAMA_EXE%" for /f "delims=" %%i in ('where ollama 2^>nul') do set "OLLAMA_EXE=%%i"

if not exist "%OLLAMA_EXE%" (
    echo.
    echo   [ERROR] Ollama not found.
    echo   I checked:  ..\ollama\ollama.exe ,  PATH ,  Program Files ,  LocalAppData.
    echo   Ollama is the local AI brain this project needs.
    echo   Fixes:
    echo     1) Open a terminal and run  ollama serve   (keep it open), then rerun this.
    echo     2) Or make sure Ollama exists at  D:\haeness\ollama\ollama.exe
    echo.
    pause
    exit /b 1
)

echo        Found Ollama: %OLLAMA_EXE%
echo        Starting Ollama server ...
start "Ollama Server" /min "%OLLAMA_EXE%" serve

:ollama_wait
timeout /t 2 /nobreak >nul
curl -s -m 2 %HUB%/api/version >nul 2>&1
if errorlevel 1 goto ollama_wait

:ollama_ready
echo         Ollama is ready.
echo.

rem -------- 2/4) dependencies --------
echo [2/4] Checking dependencies ...
if not exist "node_modules\@strands-agents\sdk" (
    echo         Installing Strands SDK ...
    call npm install @strands-agents/sdk openai
)
echo         Dependencies OK.
echo.

rem -------- 3/4) model (HTTP API, no exe path needed) --------
echo [3/4] Checking model qwen2.5:3b ...
curl -s -m 5 %HUB%/api/tags | findstr /c:"qwen2.5:3b" >nul 2>&1
if errorlevel 1 (
    echo         First run, pulling model, about 1.9 GB ...
    curl -s -m 600 -X POST %HUB%/api/pull -d "{\"name\":\"qwen2.5:3b\"}" >nul
    if errorlevel 1 (
        echo         [ERROR] Model download failed. Check network.
        pause
        exit /b 1
    )
)
echo         Model ready.
echo.

rem -------- 4/5) choose mode --------
echo Choose a mode:
echo   7 - Open Web UI  (pretty browser dashboard)  * recommended
echo   1 - Interactive chat  (terminal REPL)
echo   2 - Generate report  (files)
echo   3 - Multi-agent report  (analyst + reviewer)
echo   4 - Watch mode  (renewals in next 30 days)
echo   5 - Recommend which to open  (by hobbies + budget)
echo   6 - Real web research  (is a song/show on QQ/Wangyi/Bili?)
echo.
echo   * Just press Enter to open the Web UI.
set /p "MODE=Enter 7/1/2/3/4/5/6  (default 7): "
if "%MODE%"=="" set "MODE=7"

if "%MODE%"=="7" (
    node server.mjs
) else if "%MODE%"=="1" (
    node index.mjs
) else if "%MODE%"=="2" (
    node index.mjs --report
) else if "%MODE%"=="3" (
    node index.mjs --multi
) else if "%MODE%"=="4" (
    node index.mjs --watch 30
) else if "%MODE%"=="5" (
    node index.mjs --recommend
) else if "%MODE%"=="6" (
    set /p "QUERY=Song/show to look up (e.g. qingtian): "
    node index.mjs --research "%QUERY%"
) else (
    echo   [hint] Unknown input, opening Web UI.
    node server.mjs
)

echo.
pause