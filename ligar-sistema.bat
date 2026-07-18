@echo off
title Servidor do Caixa - Meu Cantinho Acai
cls
echo ========================================================
echo   LIGANDO O SERVIDOR DO SISTEMA...
echo ========================================================
echo.

:: O comando pushd resolve o erro do "caminho UNC" e entra na pasta a forca!
pushd "%~dp0"

:: Liga o servidor
node server.js

echo.
echo ========================================================
echo [ERRO] O SERVIDOR CAIU OU NAO LIGOU! LEIA AVISO ACIMA.
echo ========================================================
pause