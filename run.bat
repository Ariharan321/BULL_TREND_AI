@echo off
title Stock Price Prediction Server
echo ==========================================================
echo   Stock Price Prediction & Alert local server is starting...
echo ==========================================================
echo.
echo   Please open http://localhost:8000 in your web browser.
echo.
echo   To stop the server, close this window or press Ctrl+C.
echo.
python "%~dp0server.py"
pause
