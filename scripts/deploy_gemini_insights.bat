@echo off
cd ..
set PROJECT_REF=twsnzfzjtjdamwwembzp

echo [Deploy Helper] Deploying function 'fetch-gemini-insights' to project %PROJECT_REF%...
call npx --yes supabase functions deploy fetch-gemini-insights --project-ref %PROJECT_REF% --no-verify-jwt

if %errorlevel% equ 0 (
    echo.
    echo [Success] Function deployed successfully!
) else (
    echo.
    echo [Error] Deployment failed.
)
pause
