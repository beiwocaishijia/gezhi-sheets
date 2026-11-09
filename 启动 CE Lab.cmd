@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo CE Lab 本地工作台：http://127.0.0.1:8001
echo 首次使用请先在本目录运行 npm ci。
call npm.cmd run dev
pause
