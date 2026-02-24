@echo off
cd /d "%~dp0\.."
set PROJECT_REF=twsnzfzjtjdamwwembzp

echo [Deploy Helper] Deploying function 'embryo-analyze' to project %PROJECT_REF%...
echo.

call npx --yes supabase functions deploy embryo-analyze --project-ref %PROJECT_REF% --no-verify-jwt

if %errorlevel% equ 0 (
    echo.
    echo [Success] Function 'embryo-analyze' deployed successfully!
) else (
    echo.
    echo [Error] Deployment failed.
)
pause
