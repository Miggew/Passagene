@echo off
echo ===================================================
echo     CONFIGURANDO AMBIENTE DE ROTULAGEM (labelImg)
echo ===================================================

cd %~dp0\..\..

if not exist "datasets\Images" mkdir "datasets\Images"
if not exist "datasets\labels" mkdir "datasets\labels"
if not exist "datasets\classes.txt" (
    echo embriao > datasets\classes.txt
)

echo.
echo 1. Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Python nao encontrado. Por favor instale o Python 3.8+ e adicione ao PATH.
    pause
    exit /b
)

echo.
echo 2. Criando ambiente virtual em .venv-labeling...
if not exist ".venv-labeling" (
    python -m venv .venv-labeling
)

echo.
echo 3. Ativando ambiente e instalando labelImg...
call .venv-labeling\Scripts\activate
pip install setuptools
pip install Pillow

echo.
echo ===================================================
echo                 TUDO PRONTO!
echo ===================================================
echo.
echo INSTRUCOES:
echo 1. O rotulador "Passagene Simple Labeler" vai abrir.
echo 2. As imagens da pasta "datasets\Images" serao carregadas.
echo 3. ARRASTE o mouse para desenhar um retangulo ao redor de cada embriao.
echo 4. Use a SETA DIREITA para ir para a proxima imagem (salva automaticamente).
echo 5. Use DEL 'd' para apagar o ultimo retangulo se errar.
echo.
echo Pressione qualquer tecla para abrir o Rotulador Customizado agora...
pause

python scripts\labeling\simple_labeler.py

echo.
echo Quando terminar, feche o programa.
pause
