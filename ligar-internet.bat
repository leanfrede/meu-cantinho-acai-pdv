@echo off
title Ponte de Internet 4G - Cantinho Acai
:inicio
cls
echo ========================================================
echo   CONECTANDO A PONTE DA INTERNET (4G/CELULAR)...
echo ========================================================
echo.
echo Link fixo do sistema: https://cantinhoacai.loca.lt
echo.
echo [ATENCAO] Pode minimizar esta tela, mas NAO feche no X!
echo.
npx localtunnel --port 3000 --subdomain cantinhoacai

:: Se o comando acima cair ou a internet piscar, o codigo desce para ca:
echo.
echo [AVISO] A conexao com a internet oscilou ou caiu. 
echo Reconectando automaticamente em 5 segundos...
timeout /t 5 >nul
goto inicio