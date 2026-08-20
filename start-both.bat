@echo off
title Subscription Guarding - ZH + EN
echo ============================================================
echo    Start TWO independent versions at once
echo    ZH (Chinese)  -> http://localhost:3000
echo    EN (English)  -> http://localhost:3100
echo ============================================================
echo.
start "Guardian-ZH-3000" cmd /k "cd /d %~dp0 && node server.mjs"
start "Guardian-EN-3100" cmd /k "cd /d %~dp0en && node server.mjs"
echo Two windows are opening. Watch for the URLs in each.
echo If a browser does not open, open the URLs above yourself.
pause