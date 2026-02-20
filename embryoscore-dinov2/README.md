# EmbryoScore DINOv2 Service

Cloud Run service for embryo analysis using DINOv2 embeddings + MLP classifier.

## Deploy

```bash
# Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT/embryoscore-dinov2

# Deploy with GPU
gcloud run deploy embryoscore-dinov2 \
  --image gcr.io/YOUR_PROJECT/embryoscore-dinov2 \
  --gpu 1 --gpu-type nvidia-l4 \
  --cpu 4 --memory 16Gi \
  --max-instances 3 --min-instances 0 \
  --region us-central1 \
  --timeout 60
```

## Endpoints

- `POST /analyze-embryo` — Process embryo crops → embedding + classification
- `GET /health` — Health check
