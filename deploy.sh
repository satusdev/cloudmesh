#!/usr/bin/env bash
# =============================================================================
# CloudMesh Production Deployment Script
# =============================================================================
# Strategy: tar bundle locally -> single scp upload -> extract and run on server
# This avoids rsync protocol issues and ensures consistent file delivery.
# =============================================================================

set -euo pipefail

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
            key=$(echo "$line" | cut -d'=' -f1 | xargs)
            value=$(echo "$line" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            export "$key=$value"
        fi
    done < .env
fi

# Target Server Configuration
TARGET_IP="${DEPLOY_TARGET_IP:-}"
TARGET_USER="${DEPLOY_TARGET_USER:-root}"
TARGET_DIR="${DEPLOY_TARGET_DIR:-/home/cloudmesh}"
ARCHIVE="cloudmesh-deploy.tar.gz"

if [ -z "$TARGET_IP" ]; then
    echo "❌ Error: DEPLOY_TARGET_IP is not set in the environment or .env file."
    echo "Please define DEPLOY_TARGET_IP in your local .env file."
    exit 1
fi


echo "=================================================="
echo "🚀 Deploying CloudMesh to ${TARGET_IP}..."
echo "=================================================="

# Step 1: Build React Frontend Locally
echo "📦 Building React frontend dashboard locally..."
if [ ! -d "frontend" ]; then
    echo "❌ Error: 'frontend' directory not found."
    exit 1
fi

cd frontend
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is required to build the frontend. Install it via 'npm install -g pnpm'."
    exit 1
fi

pnpm install
pnpm build
cd ..

# Step 2: Bundle into a single tar archive
echo "📦 Creating deployment archive ${ARCHIVE}..."
rm -f "${ARCHIVE}"

# Archive only the required files and folders
tar -czf "${ARCHIVE}" \
    frontend/dist \
    src \
    docker-compose.yml \
    package.json \
    postgres-init.sql \
    prometheus.yml \
    script.py \
    requirements.txt \
    redeploy.sh \
    .env.example

# Step 3: Copy archive to remote server
echo "📤 Uploading deployment archive..."
scp "${ARCHIVE}" "${TARGET_USER}@${TARGET_IP}:${TARGET_DIR}/"

# Clean up local archive
rm -f "${ARCHIVE}"

# Step 4: Run remote operations
echo "⚙️ Running remote environment updates..."
ssh "${TARGET_USER}@${TARGET_IP}" bash -c "
  mkdir -p ${TARGET_DIR}
  cd ${TARGET_DIR}
  
  echo '🛑 Stopping old services...'
  docker compose down --remove-orphans || true
  
  echo '🧹 Deleting older files...'
  rm -rf src frontend/dist docker-compose.yml package.json postgres-init.sql prometheus.yml script.py requirements.txt redeploy.sh .env.example
  
  echo '📦 Extracting new archive...'
  tar -xzf ${ARCHIVE}
  rm -f ${ARCHIVE}
  
  echo '🐍 Preparing python virtual environment...'
  if [ ! -d 'venv' ]; then
      python3 -m venv venv
  fi
  
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install -r requirements.txt
  
  echo '🔑 Configuring environment...'
  if [ ! -f '.env' ]; then
      cp .env.example .env
      echo '⚠️ Created default .env file. Please configure the environment tokens.'
  else
      echo '🛡️ Existing .env file found. Retaining server configuration.'
  fi
  
  echo '📁 Creating output directories...'
  mkdir -p reports/snapshots
  mkdir -p frontend/dist/snapshots
  
  echo '🚀 Starting Docker services...'
  docker compose up -d
  
  echo '🧹 Pruning old images and orphaned resources to clean up space...'
  docker system prune -af || true
  
  echo '🔍 Running audit script...'
  ./venv/bin/python script.py
"

echo "=================================================="
echo "✅ Deployment completed successfully!"
echo "=================================================="