#!/bin/bash

# 部署配置变量
SERVICE_NAME="feishu-clash"
# PROJECT_ID="eyeweb-wb-fanso"
# SERVICE_ACCOUNT="fanso-feishu-clash@eyeweb-wb-fanso.iam.gserviceaccount.com"
PROJECT_ID="project-m-claude"
SERVICE_ACCOUNT="feishu-clash@project-m-claude.iam.gserviceaccount.com"
REGION="asia-southeast1"
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