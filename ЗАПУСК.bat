@echo off
title Demo Bot
color 0A
echo.
echo  ==============================
echo   ЗАПУСК DEMO BOT
echo  ==============================
echo.

cd /d "%~dp0"

echo  [1/2] Запуск бота...
start "Telegram Bot" cmd /k "node src/bot.js"

timeout /t 2 /nobreak >nul

echo  [2/2] Готово!
echo.
echo  Бот запущен в отдельном окне.
echo  Закройте это окно.
echo.
pause
