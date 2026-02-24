@echo off
cd /d "%~dp0"

echo === Deploying frame-extractor to Cloud Run ===
echo Region: us-central1
echo Memory: 1Gi (increased for stability)
echo.

call gcloud run deploy frame-extractor ^
  --source . ^
  --region us-central1 ^
  --memory 1024Mi ^
  --cpu 1 ^
  --max-instances 5 ^
  --min-instances 0 ^
  --timeout 300 ^
  --allow-unauthenticated

if %errorlevel% equ 0 (
    echo.
    echo [Success] frame-extractor deployed!
) else (
    echo.
    echo [Error] Deployment failed. Ensure 'gcloud' is installed and authenticated.
)
pause
