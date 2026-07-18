@echo off
title Servidor Ngrok Profissional - Cantinho Acai
cls
echo ========================================================
echo   CONECTANDO A PONTE BLINDADA NGROK (4G/CELULAR)...
echo ========================================================
echo.

:: O 127.0.0.1:3000 corrige o bug do IPv6 (Erro 8012)
call npx ngrok http --domain=dislocate-doorway-coach.ngrok-free.dev http://127.0.0.1:3000

echo.
echo ========================================================
echo SE A TELA CHEGOU AQUI, A INTERNET CAIU OU DEU ERRO!
echo ========================================================
pause