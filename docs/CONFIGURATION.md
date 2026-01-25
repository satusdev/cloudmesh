# CloudMesh Configuration Guide

This guide covers all configuration options for CloudMesh, including environment variables, deployment modes, and advanced settings.

## Environment Variables Reference

CloudMesh supports comprehensive configuration through environment variables. All variables can be set in your shell, `.env` file, or CI/CD secrets.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CLOUDFLARE_TOKEN` | Cloudflare API token with `Zone:Read` and `DNS:Read` permissions | `x12345...abcde` |
| `PUSHGATEWAY_URL` | URL of Prometheus Pushgateway for metrics | `http://localhost:9091` |

### Hetzner Cloud Projects

| Variable | Description | Example |
|----------|-------------|---------|
| `HETZNER_TOKEN_1` | Hetzner API token for project 1 | `abc123...xyz` |
| `HETZNER_PROJECT_NAME_1` | Display name for project 1 | `Web Servers` |
| `HETZNER_TOKEN_2` | Hetzner API token for project 2 | `def456...uvw` |
| `HETZNER_PROJECT_NAME_2` | Display name for project 2 | `Database Servers` |
| `...` | Add more projects by incrementing the number | |

### Slack Integration (Optional)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SLACK_BOT_TOKEN` | Slack bot token starting with `xoxb-` | - | `xoxb-123...` |
| `SLACK_CHANNEL_ID` | Slack channel ID (right-click channel → Copy) | - | `C1234567890` |

### Feature Toggles

| Variable | Description | Default | Accepted Values |
|----------|-------------|---------|-----------------|
| `ENABLE_SLACK_NOTIFICATIONS` | Enable/disable Slack uploads | `true` | `true`, `false`, `1`, `0`, `yes`, `no` |
| `GENERATE_REPORTS` | Enable/disable HTML/PDF report generation | `true` | `true`, `false`, `1`, `0`, `yes`, `no` |

## Configuration Modes

### Development/Testing Mode
```bash
# Generate reports locally but don't send to Slack
GENERATE_REPORTS=true
ENABLE_SLACK_NOTIFICATIONS=false
```

### Monitoring Only Mode
```bash
# Only push metrics to Prometheus, no reports or Slack
GENERATE_REPORTS=false
ENABLE_SLACK_NOTIFICATIONS=false
```

### Production Mode
```bash
# Full functionality with reports and Slack notifications
GENERATE_REPORTS=true
ENABLE_SLACK_NOTIFICATIONS=true
```

### CI/CD Mode
```bash
# Reports for artifacts but no external notifications
GENERATE_REPORTS=true
ENABLE_SLACK_NOTIFICATIONS=false
```

## Example Configuration Files

### Basic .env file
```bash
# Required Configuration
CLOUDFLARE_TOKEN=your_cloudflare_token_here
HETZNER_TOKEN_1=your_hetzner_token_for_project1
HETZNER_PROJECT_NAME_1=Web Dev
PUSHGATEWAY_URL=http://localhost:9091

# Slack Integration (Optional)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=C1234567890

# Feature Toggles
ENABLE_SLACK_NOTIFICATIONS=true
GENERATE_REPORTS=true
```

### Multi-project .env file
```bash
# Required Configuration
CLOUDFLARE_TOKEN=your_cloudflare_token_here
PUSHGATEWAY_URL=http://pushgateway:9091

# Multiple Hetzner Projects
HETZNER_TOKEN_1=your_hetzner_token_for_project1
HETZNER_PROJECT_NAME_1=Web Servers
HETZNER_TOKEN_2=your_hetzner_token_for_project2
HETZNER_PROJECT_NAME_2=Database Servers
HETZNER_TOKEN_3=your_hetzner_token_for_project3
HETZNER_PROJECT_NAME_3=Development

# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=C1234567890

# Feature Toggles
ENABLE_SLACK_NOTIFICATIONS=true
GENERATE_REPORTS=true
```

### Production .env file
```bash
# Required Configuration
CLOUDFLARE_TOKEN=prod_cloudflare_token
PUSHGATEWAY_URL=https://pushgateway.example.com

# Production Hetzner Projects
HETZNER_TOKEN_1=prod_hetzner_token_main
HETZNER_PROJECT_NAME_1=Production Infrastructure
HETZNER_TOKEN_2=prod_hetzner_token_backup
HETZNER_PROJECT_NAME_2=Backup Infrastructure

# Production Slack Integration
SLACK_BOT_TOKEN=xoxb-prod-slack-bot-token
SLACK_CHANNEL_ID=C1234567890

# Production Settings
ENABLE_SLACK_NOTIFICATIONS=true
GENERATE_REPORTS=true
```

## Advanced Configuration

### Boolean Value Handling
CloudMesh accepts multiple boolean formats:
- `true`, `1`, `yes`, `on` → Enabled
- `false`, `0`, `no`, `off` → Disabled

### Configuration Precedence
1. Environment variables (highest priority)
2. `.env` file values
3. `config.json` file (legacy support)
4. Default values

### Environment Variable Validation
CloudMesh validates required variables on startup:
```bash
# Missing required variables will show clear error messages:
# "CLOUDFLARE_TOKEN not set in environment or config.json"
# "No Hetzner projects found in environment or config.json"
# "PUSHGATEWAY_URL not set in environment or config.json"
```

## Platform-Specific Configuration

### Docker Environment
```yaml
# docker-compose.yml
version: '3.8'
services:
  cloudmesh:
    build: .
    env_file:
      - .env
    volumes:
      - ./reports:/app/reports
    environment:
      - GENERATE_REPORTS=true
      - ENABLE_SLACK_NOTIFICATIONS=false
```

### Kubernetes Environment
```yaml
# kubernetes-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cloudmesh-secrets
type: Opaque
stringData:
  CLOUDFLARE_TOKEN: "your-token"
  HETZNER_TOKEN_1: "your-token"
  SLACK_BOT_TOKEN: "xoxb-your-token"
---
# kubernetes-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudmesh
spec:
  template:
    spec:
      containers:
      - name: cloudmesh
        image: cloudmesh:latest
        envFrom:
        - secretRef:
            name: cloudmesh-secrets
        env:
        - name: GENERATE_REPORTS
          value: "true"
        - name: ENABLE_SLACK_NOTIFICATIONS
          value: "true"
```

### Systemd Service Environment
```ini
# /etc/systemd/system/cloudmesh.service
[Unit]
Description=CloudMesh Infrastructure Monitor
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/opt/cloudmesh
ExecStart=/usr/bin/python3 script.py
Environment=GENERATE_REPORTS=true
Environment=ENABLE_SLACK_NOTIFICATIONS=true
EnvironmentFile=/opt/cloudmesh/.env

[Install]
WantedBy=multi-user.target
```

## Configuration Testing

### Validate Environment Variables
```bash
# Check if all required variables are set
env | grep -E "(CLOUDFLARE|HETZNER|PUSHGATEWAY)" | wc -l

# Test API connectivity
curl -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
     https://api.cloudflare.com/client/v4/user/tokens/verify

curl -H "Authorization: Bearer $HETZNER_TOKEN_1" \
     https://api.hetzner.cloud/v1/servers
```

### Dry Run Configuration
```bash
# Test configuration without generating reports
GENERATE_REPORTS=false ENABLE_SLACK_NOTIFICATIONS=false python script.py

# Test Slack configuration only
GENERATE_REPORTS=false python script.py
# Check logs for Slack configuration messages
```

## Configuration Troubleshooting

### Common Configuration Issues

1. **Missing Required Variables**
   ```bash
   # Error: "CLOUDFLARE_TOKEN not set"
   export CLOUDFLARE_TOKEN=your_token
   ```

2. **Incorrect Boolean Values**
   ```bash
   # These all work:
   ENABLE_SLACK_NOTIFICATIONS=true
   ENABLE_SLACK_NOTIFICATIONS=1
   ENABLE_SLACK_NOTIFICATIONS=yes
   ```

3. **Hetzner Project Configuration**
   ```bash
   # Make sure token and name pairs match:
   HETZNER_TOKEN_1=token1
   HETZNER_PROJECT_NAME_1=Project1
   HETZNER_TOKEN_2=token2
   HETZNER_PROJECT_NAME_2=Project2
   ```

### Debug Configuration
```bash
# Show current configuration (without sensitive data)
env | grep -E "(CLOUDFLARE|HETZNER|SLACK|PUSHGATEWAY|GENERATE|ENABLE)" | \
  sed 's/=.*/=***/'

# Test with specific configuration
GENERATE_REPORTS=false python script.py 2>&1 | grep -i error
```

For more troubleshooting tips, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).