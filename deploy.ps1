# ==============================================================================
# CloudMesh Production Deployment Script (PowerShell)
# ==============================================================================
# Strategy: tar bundle locally -> single scp upload -> extract and run on server
# This avoids rsync protocol issues and ensures consistent file delivery.
# ==============================================================================

$ErrorActionPreference = "Stop"

# Load environment variables from .env file if it exists
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $parts = $line.Split('=', 2)
            $key = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"').Trim("'")
            [System.Environment]::SetEnvironmentVariable($key, $value)
        }
    }
}

$TargetIP   = [System.Environment]::GetEnvironmentVariable("DEPLOY_TARGET_IP")
$TargetUser = [System.Environment]::GetEnvironmentVariable("DEPLOY_TARGET_USER")
$TargetDir  = [System.Environment]::GetEnvironmentVariable("DEPLOY_TARGET_DIR")

if ([string]::IsNullOrEmpty($TargetIP)) {
    Write-Error "Error: DEPLOY_TARGET_IP is not set in the environment or .env file. Please define DEPLOY_TARGET_IP in your local .env file."
    exit 1
}
if ([string]::IsNullOrEmpty($TargetUser)) { $TargetUser = "root" }
if ([string]::IsNullOrEmpty($TargetDir)) { $TargetDir = "/home/cloudmesh" }

$Remote     = "${TargetUser}@${TargetIP}"
$Archive    = "cloudmesh-deploy.tar.gz"


Write-Host "==================================================" -ForegroundColor Green
Write-Host "Deploying CloudMesh to ${TargetIP}" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Step 1: Build React Frontend Locally
Write-Host "[1/4] Building React frontend..." -ForegroundColor Cyan

if (-not (Test-Path frontend)) {
    Write-Error "Error: 'frontend' directory not found."
    exit 1
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Error "pnpm is not installed. Run: npm install -g pnpm"
    exit 1
}

Set-Location frontend
pnpm install
pnpm build
Set-Location ..

# Step 2: Bundle into a single tar archive
Write-Host "[2/4] Creating deployment archive ${Archive}..." -ForegroundColor Cyan

# Remove old archive if it exists
if (Test-Path $Archive) { Remove-Item $Archive }

# Windows 10+ ships with BSD tar. Archive only the required files and folders.
tar -czf $Archive `
    frontend/dist `
    src `
    docker-compose.yml `
    package.json `
    postgres-init.sql `
    prometheus.yml `
    script.py `
    requirements.txt `
    .env.example

# Step 3: Copy archive to remote server
Write-Host "[3/4] Uploading archive to server..." -ForegroundColor Cyan
scp $Archive "${Remote}:${TargetDir}/"

# Clean up local archive
Remove-Item $Archive

# Step 4: Run remote operations via SSH
Write-Host "[4/4] Executing remote environment updates..." -ForegroundColor Cyan

$RemoteCommands = @'
cd /home/cloudmesh

echo "🛑 Stopping old services..."
docker compose down --remove-orphans || true

echo "🧹 Deleting older files..."
rm -rf src frontend/dist docker-compose.yml package.json postgres-init.sql prometheus.yml script.py requirements.txt .env.example

echo "📦 Extracting new archive..."
tar -xzf cloudmesh-deploy.tar.gz
rm -f cloudmesh-deploy.tar.gz

echo "🐍 Preparing python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

echo "🔑 Configuring environment..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️ Created default .env file. Please configure the environment tokens."
fi

echo "📁 Creating output directories..."
mkdir -p reports/snapshots
mkdir -p frontend/dist/snapshots

echo "🚀 Starting Docker services..."
docker compose up -d

echo "🔍 Running audit script..."
./venv/bin/python script.py
'@

ssh $Remote $RemoteCommands

Write-Host "==================================================" -ForegroundColor Green
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green