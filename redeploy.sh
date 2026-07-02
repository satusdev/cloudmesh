#!/usr/bin/env bash
# =============================================================================
# CloudMesh Remote Pull-Based Deployment Script
# =============================================================================
# Run this script directly on the remote server to pull updates and rebuild.
# =============================================================================

set -euo pipefail

TARGET_DIR="/home/cloudmesh"

echo "=================================================="
echo "🔄 Redeploying CloudMesh on Remote Host..."
echo "=================================================="

cd "${TARGET_DIR}"

# Step 1: Pull latest changes if it is a git repository
if [ -d .git ]; then
    echo "📥 Pulling latest changes from git..."
    git pull origin main || {
        echo "⚠️ Git pull failed. This might be due to SSH authentication constraints."
        echo "If this is a private repository, ensure your SSH agent is forwarded."
    }
else
    echo "ℹ️ Note: Not a git repository. Skipping git pull."
    echo "To track updates, initialize git: git init && git remote add origin git@github.com:satusdev/cloudmesh.git"
fi

# Step 2: Build React frontend using Node Docker image
# This container mounts the frontend folder and outputs build assets to frontend/dist.
echo "📦 Building React frontend dashboard using node:20-alpine..."
if [ -d "frontend" ]; then
    docker run --rm \
        -v "$(pwd)/frontend:/app" \
        -w /app \
        node:20-alpine \
        sh -c "corepack enable && pnpm install && pnpm build"
else
    echo "❌ Error: 'frontend' directory not found."
    exit 1
fi

# Step 3: Update Python virtual environment
echo "🐍 Preparing python virtual environment..."
if [ ! -d 'venv' ]; then
    python3 -m venv venv
fi

./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Step 4: Restart Docker containers
echo "🚀 Restarting Docker containers..."
docker compose down --remove-orphans || true
docker compose up -d

echo "🧹 Pruning unused Docker images and orphaned resources..."
docker system prune -af || true

# Step 5: Run initial audit script
echo "🔍 Running initial audit..."
./venv/bin/python script.py

echo "=================================================="
echo "✅ Redeployment completed successfully!"
echo "=================================================="
