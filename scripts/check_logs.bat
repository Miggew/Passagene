@echo off
cd /d "%~dp0\.."
echo Fetching logs for embryo-analyze...
call npx --yes supabase functions logs --project-ref twsnzfzjtjdamwwembzp --no-verify-jwt
pause
