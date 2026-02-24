@echo off
cd /d "%~dp0\.."
echo Applying migrations...
npx supabase db push --include-all
pause
