#!/bin/bash

# 部署配置变量
SERVICE_NAME="feishu-clash-demo"
PROJECT_ID="eyeweb-wb-20251211"
REGION="asia-southeast1"
SERVICE_ACCOUNT="tryon-live-gemini@eyeweb-wb-20251211.iam.gserviceaccount.com"
MEMORY="2Gi"
CPU="1"
PORT="8080"

cmd="gcloud run deploy $SERVICE_NAME \
  --source . --allow-unauthenticated\
  --project $PROJECT_ID \
  --region $REGION \
  --service-account $SERVICE_ACCOUNT \
  --memory $MEMORY \
  --cpu $CPU \
  --port $PORT"

echo "Command to run:"
echo $cmd

$cmd