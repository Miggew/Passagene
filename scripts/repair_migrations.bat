@echo off
cd /d "%~dp0\.."
echo Repairing migration history...
call npx supabase migration repair --status applied 20260207
pause
