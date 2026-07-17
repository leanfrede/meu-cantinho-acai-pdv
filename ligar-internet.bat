@echo off
title Servidor Ngrok Profissional - Cantinho Acai
cls
echo ========================================================
echo   CONECTANDO A PONTE BLINDADA NGROK (4G/CELULAR)...
echo ========================================================
echo.

:: O comando call impede o Windows de fechar a janela!
call npx ngrok http --domain=dislocate-doorway-coach.ngrok-free.dev 3000

echo.
echo ========================================================
echo SE A TELA CHEGOU AQUI, O SERVIDOR PAROU OU DEU ERRO!
echo ========================================================
pause