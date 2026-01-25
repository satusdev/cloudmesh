# CloudMesh Deployment Guide

This guide covers various deployment scenarios for CloudMesh, from local development to production environments.

## Prerequisites

### System Requirements
- **Python 3.6+** installed
- **wkhtmltopdf** for PDF generation
- **Docker** (optional, for containerized deployment)
- **git** for cloning the repository

### API Tokens Required
- Cloudflare API token with `Zone:Read` and `DNS:Read` permissions
- Hetzner Cloud API tokens for each project you want to monitor
- (Optional) Slack bot token for notifications

## Quick Start Deployment

### 1. Clone Repository
```bash
git clone https://github.com/satusdev/cloudmesh.git
cd cloudmesh
```

### 2. Install Dependencies
```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
# Or manually:
pip install requests pdfkit prometheus_client python-dotenv

# Install wkhtmltopdf
# Ubuntu/Debian:
sudo apt-get update && sudo apt-get install wkhtmltopdf
# macOS:
brew install wkhtmltopdf
# Windows: Download from https://wkhtmltopdf.org
```

### 3. Configure Environment
```bash
# Copy example configuration
cp .env.example .env

# Edit configuration with your API tokens
nano .env  # or use your preferred editor
```

### 4. Test Deployment
```bash
# Run with default settings
python script.py

# Check generated reports
ls -la reports/
```

## Deployment Scenarios

### Local Development

#### Basic Setup
```bash
# Development configuration
echo "GENERATE_REPORTS=true" >> .env
echo "ENABLE_SLACK_NOTIFICATIONS=false" >> .env

# Run the script
python script.py
```

#### Development with Monitoring
```bash
# Start monitoring stack
docker-compose up -d

# Run script with monitoring
PUSHGATEWAY_URL=http://localhost:9913 python script.py

# View metrics
open http://localhost:9912  # Prometheus
open http://localhost:9911  # Grafana
```

### Docker Deployment

#### Single Command Deployment
```bash
# Build and run with Docker
docker build -t cloudmesh .
docker run --env-file .env -v $(pwd)/reports:/app/reports cloudmesh
```

#### Docker Compose Deployment
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  cloudmesh:
    build: .
    env_file:
      - .env
    volumes:
      - ./reports:/app/reports
      - ./logs:/app/logs
    restart: unless-stopped
    depends_on:
      - prometheus
      - pushgateway
      - grafana

  prometheus:
    image: prom/prometheus
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9912:9090"
    restart: unless-stopped

  pushgateway:
    image: prom/pushgateway
    container_name: pushgateway
    ports:
      - "9913:9091"
    restart: unless-stopped

  grafana:
    image: grafana/grafana
    container_name: grafana
    ports:
      - "9911:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
    volumes:
      - grafana-storage:/var/lib/grafana
    restart: unless-stopped

volumes:
  grafana-storage:
```

```bash
# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Production Deployment

#### Systemd Service (Linux)
```ini
# /etc/systemd/system/cloudmesh.service
[Unit]
Description=CloudMesh Infrastructure Monitor
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/cloudmesh
ExecStart=/usr/bin/docker run --rm \
  --env-file /opt/cloudmesh/.env \
  -v /opt/cloudmesh/reports:/app/reports \
  cloudmesh:latest
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/cloudmesh.timer
[Unit]
Description=Run CloudMesh weekly
Requires=cloudmesh.service

[Timer]
OnCalendar=weekly
Persistent=true
RandomizedDelaySec=1800

[Install]
WantedBy=timers.target
```

```bash
# Install and enable
sudo cp cloudmesh.service /etc/systemd/system/
sudo cp cloudmesh.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cloudmesh.timer
sudo systemctl start cloudmesh.timer

# Check status
sudo systemctl status cloudmesh.timer
sudo systemctl list-timers cloudmesh
```

#### Kubernetes Deployment

**ConfigMap:**
```yaml
# k8s-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cloudmesh-config
data:
  PUSHGATEWAY_URL: "http://pushgateway:9091"
  ENABLE_SLACK_NOTIFICATIONS: "true"
  GENERATE_REPORTS: "true"
```

**Secret:**
```yaml
# k8s-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cloudmesh-secrets
type: Opaque
stringData:
  CLOUDFLARE_TOKEN: "your-cloudflare-token"
  HETZNER_TOKEN_1: "your-hetzner-token"
  HETZNER_PROJECT_NAME_1: "Production"
  SLACK_BOT_TOKEN: "xoxb-your-slack-token"
  SLACK_CHANNEL_ID: "C1234567890"
```

**Deployment:**
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudmesh
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cloudmesh
  template:
    metadata:
      labels:
        app: cloudmesh
    spec:
      containers:
      - name: cloudmesh
        image: cloudmesh:latest
        imagePullPolicy: Always
        envFrom:
        - configMapRef:
            name: cloudmesh-config
        - secretRef:
            name: cloudmesh-secrets
        volumeMounts:
        - name: reports
          mountPath: /app/reports
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: reports
        persistentVolumeClaim:
          claimName: cloudmesh-reports
      restartPolicy: Always
```

**CronJob:**
```yaml
# k8s-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cloudmesh-weekly
spec:
  schedule: "0 9 * * 1"  # Weekly on Monday at 9 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cloudmesh
            image: cloudmesh:latest
            envFrom:
            - configMapRef:
                name: cloudmesh-config
            - secretRef:
                name: cloudmesh-secrets
            volumeMounts:
            - name: reports
              mountPath: /app/reports
          volumes:
          - name: reports
            persistentVolumeClaim:
              claimName: cloudmesh-reports
          restartPolicy: OnFailure
```

## Automated Scheduling

### Cron Jobs

#### Weekly Reports (Linux/macOS)
```bash
# Edit crontab
crontab -e

# Add weekly job (every Sunday at 9 AM)
0 9 * * 0 cd /opt/cloudmesh && /usr/bin/python3 script.py

# Daily monitoring only (every 6 hours)
0 */6 * * * cd /opt/cloudmesh && GENERATE_REPORTS=false /usr/bin/python3 script.py

# Weekly with logging
0 9 * * 0 cd /opt/cloudmesh && /usr/bin/python3 script.py >> /var/log/cloudmesh.log 2>&1
```

#### Cron Job Examples
```bash
# Development: Every hour with Slack disabled
0 * * * * cd ~/cloudmesh && ENABLE_SLACK_NOTIFICATIONS=false python script.py

# Production: Daily at 8 AM with full functionality
0 8 * * * cd /opt/cloudmesh && python script.py

# Testing: Every 5 minutes, monitoring only
*/5 * * * * cd /opt/cloudmesh && GENERATE_REPORTS=false python script.py
```

### Windows Task Scheduler

#### PowerShell Script
```powershell
# cloudmesh-task.ps1
$env:GENERATE_REPORTS = "true"
$env:ENABLE_SLACK_NOTIFICATIONS = "true"
Set-Location "C:\cloudmesh"
python script.py
```

#### Task Setup
```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\cloudmesh\cloudmesh-task.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 9am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun
Register-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -TaskName "CloudMesh Daily" -Description "Run CloudMesh infrastructure monitoring"
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/cloudmesh.yml
name: CloudMesh Infrastructure Report

on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Monday at 9 AM
  workflow_dispatch:

jobs:
  cloudmesh:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'

    - name: Install dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y wkhtmltopdf
        pip install -r requirements.txt

    - name: Run CloudMesh
      env:
        CLOUDFLARE_TOKEN: ${{ secrets.CLOUDFLARE_TOKEN }}
        HETZNER_TOKEN_1: ${{ secrets.HETZNER_TOKEN_1 }}
        HETZNER_PROJECT_NAME_1: ${{ secrets.HETZNER_PROJECT_NAME_1 }}
        SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
        SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
        GENERATE_REPORTS: true
        ENABLE_SLACK_NOTIFICATIONS: true
      run: python script.py

    - name: Upload reports
      uses: actions/upload-artifact@v3
      with:
        name: cloudmesh-reports
        path: reports/
```

### GitLab CI
```yaml
# .gitlab-ci.yml
stages:
  - report

cloudmesh_report:
  stage: report
  image: python:3.9
  only:
    - schedules
  before_script:
    - apt-get update && apt-get install -y wkhtmltopdf
    - pip install -r requirements.txt
  script:
    - python script.py
  artifacts:
    paths:
      - reports/
    expire_in: 1 week
  variables:
    GENERATE_REPORTS: "true"
    ENABLE_SLACK_NOTIFICATIONS: "true"
```

## Performance Optimization

### Large-Scale Deployments

#### Memory Optimization
```bash
# Use memory-efficient Python settings
PYTHONMALLOC=malloc python script.py

# Limit memory usage
ulimit -v 1048576  # 1GB limit
python script.py
```

#### Parallel Processing Configuration
```python
# In script.py, optimize for your infrastructure size
MAX_WORKERS = min(32, (os.cpu_count() or 1) + 4)  # Adjust based on your needs
```

#### Database Caching (Future Enhancement)
For very large deployments, consider implementing:
- SQLite local caching
- PostgreSQL for distributed deployments
- Redis for temporary caching

### Resource Planning

| Infrastructure Size | CPU | Memory | Storage | Network |
|---------------------|-----|---------|---------|---------|
| Small (< 50 domains) | 1 core | 512MB | 1GB | Basic |
| Medium (50-200 domains) | 2 cores | 1GB | 5GB | Standard |
| Large (200-1000 domains) | 4 cores | 2GB | 20GB | Enhanced |
| Enterprise (1000+ domains) | 8+ cores | 4GB+ | 100GB+ | Premium |

## Monitoring and Logging

### Log Management
```bash
# Configure logging for production
mkdir -p /var/log/cloudmesh

# Log rotation configuration
cat > /etc/logrotate.d/cloudmesh << EOF
/var/log/cloudmesh/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 cloudmesh cloudmesh
}
EOF
```

### Health Checks
```bash
# Simple health check script
#!/bin/bash
# health-check.sh
cd /opt/cloudmesh
timeout 300 python script.py > /dev/null 2>&1
exit_code=$?
if [ $exit_code -eq 0 ]; then
    echo "CloudMesh: OK"
    exit 0
else
    echo "CloudMesh: FAILED"
    exit 1
fi
```

### Monitoring Integration
```bash
# Prometheus health check
curl -f http://localhost:9912/-/healthy || exit 1

# Grafana health check
curl -f http://localhost:9911/api/health || exit 1

# Pushgateway health check
curl -f http://localhost:9913/-/healthy || exit 1
```

## Backup and Recovery

### Report Backup
```bash
# Backup reports to cloud storage
#!/bin/bash
# backup-reports.sh
aws s3 sync /opt/cloudmesh/reports/ s3://your-bucket/cloudmesh-reports/ --delete
```

### Configuration Backup
```bash
# Backup configuration
#!/bin/bash
# backup-config.sh
tar -czf cloudmesh-config-$(date +%Y%m%d).tar.gz .env script.py requirements.txt
aws s3 cp cloudmesh-config-$(date +%Y%m%d).tar.gz s3://your-bucket/cloudmesh-backups/
```

For security best practices, see [SECURITY.md](SECURITY.md).
For troubleshooting guidance, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).