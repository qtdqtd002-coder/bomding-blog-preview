@echo off
chcp 65001 >nul
title 쓰담 · 글 관리 서버
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage-server.ps1" %*
pause
