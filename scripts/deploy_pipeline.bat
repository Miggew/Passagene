@echo off
echo Deploying embryoscore-pipeline to Cloud Run...

cd cloud-run\embryoscore-pipeline

gcloud run deploy embryoscore-pipeline ^
  --source . ^
  --platform managed ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --memory 4Gi ^
  --cpu 2 ^
  --timeout 600 ^
  --set-env-vars SUPABASE_URL="%SUPABASE_URL%",SUPABASE_SERVICE_ROLE_KEY="%SUPABASE_SERVICE_ROLE_KEY%"

echo Deployment complete.
pause
