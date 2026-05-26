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

### Google Chat Integration (Optional)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `GOOGLE_CHAT_WEBHOOK_URL` | Google Chat incoming webhook URL | - | `https://chat.googleapis.com/v1/spaces/...` |

### Feature Toggles

| Variable | Description | Default | Accepted Values |
|----------|-------------|---------|-----------------|
| `ENABLE_SLACK_NOTIFICATIONS` | Enable/disable Slack uploads | `true` | `true`, `false`, `1`, `0`, `yes`, `no` |
| `ENABLE_GOOGLE_CHAT_NOTIFICATIONS` | Enable/disable Google Chat alerts | `true` | `true`, `false`, `1`, `0`, `yes`, `no` |
| `GENERATE_REPORTS` | Enable/disable HTML/PDF report generation | `true` | `true`, `false`, `1`, `0`, `yes`, `no` |

### Daemon & Scheduling (Optional)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MONITORING_INTERVAL_SECS` | Continuous scan sleep interval in seconds (0 = run once and exit) | `0` | `300` |
| `MAX_HISTORICAL_SNAPSHOTS` | Max historical snapshot JSON files to persist in `reports/snapshots/` | `10` | `15` |

## Configuration Modes

### Development/Testing Mode
```bash
# Generate reports locally but don't send to Slack or Google Chat
GENERATE_REPORTS=true
ENABLE_SLACK_NOTIFICATIONS=false
ENABLE_GOOGLE_CHAT_NOTIFICATIONS=false
```

### Monitoring Only Mode
```bash
# Only push metrics to Prometheus, no reports or notifications
GENERATE_REPORTS=false
ENABLE_SLACK_NOTIFICATIONS=false
ENABLE_GOOGLE_CHAT_NOTIFICATIONS=false
```

### Production Mode
```bash
# Full functionality with reports, Slack, and Google Chat notifications
GENERATE_REPORTS=true
ENABLE_SLACK_NOTIFICATIONS=true
ENABLE_GOOGLE_CHAT_NOTIFICATIONS=true
```

### CI/CD Mode
```bash
# Reports for artifacts but no external notifications
GENERATE_REPORTS=true
ENABLE_SLACK_NOTIFICATIONS=false
ENABLE_GOOGLE_CHAT_NOTIFICATIONS=false
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

# Google Chat Integration (Optional)
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/...

# Feature Toggles
ENABLE_SLACK_NOTIFICATIONS=true
ENABLE_GOOGLE_CHAT_NOTIFICATIONS=true
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

---

## Robustness & Security Features

### 1. Connection Retries & Backoff
All outgoing API calls to Cloudflare and Hetzner endpoints use a centralized retry session adapter.
- **Retry Count**: Max 5 attempts.
- **Exponential Backoff**: Backoff factor of 1.5 seconds between retries.
- **Status Codes Retried**: `429` (Rate-Limit), `500`, `502`, `503`, `504` (Server Errors).

### 2. Persistent Domain Expiry Caching
Domain expiration checks query regional WHOIS servers, which impose strict rate limits.
- **Cache Location**: `reports/whois_cache.json`.
- **Behavior**: Loaded on engine startup and updated incrementally. The updated cache is dumped back to disk at the end of the matching run.
- **Benefits**: Significantly speeds up recurring audit runs and reduces WHOIS rate blockages.

### 3. Automatic Label Masking (Data Sanitization)
To ensure internal infrastructure details or credentials are not exposed on dashboards or shared PDFs, Hetzner Cloud VM labels are sanitized:
- **Masked Keys**: Any label containing `key`, `token`, `secret`, `auth`, `password`, or `pass` (case-insensitive).
- **Masking Format**: Values are automatically replaced with `********`.
- **Target Outputs**: Sanitized in `data.json`, `reports/mapping.html`, and generated PDF summaries.

For more troubleshooting tips, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Advanced Engine Features

### 1. Extended Resource Mapping
CloudMesh supports matching A and AAAA DNS records to multiple resource types in Hetzner Cloud:
- **Virtual Servers**: Resolved by matching the VM's public IPv4 network addresses.
- **Load Balancers**: Matches against the Load Balancer's public IP.
- **Floating IPs**: Matches against assigned or unassigned Floating IP addresses.
The exported `data.json` includes the `resource_type` field with values of `server`, `load_balancer`, or `floating_ip`.

### 2. Network Security Port Audit
For every unique public IP address found in Cloudflare DNS or Hetzner resources, CloudMesh automatically performs an asynchronous security port check:
- **Checked Ports**: `22` (SSH), `80` (HTTP), `443` (HTTPS), and `3389` (RDP).
- **Concurrency**: Audits are performed concurrently using a multi-threaded connection worker pool to minimize overall runtime.
- **Result Details**: Results are stored in the `port_audit_results` object inside `data.json` and rendered as badge indicators in the React dashboard.

### 3. Stale VM & Cost Optimization Engine
The engine continuously evaluates matched and unmatched resources to construct optimization recommendations:
- **Stale Hetzner Resources**: Highlights Virtual Servers, Load Balancers, or Floating IPs that have no DNS records pointing to them. It reports their project names, monthly costs, and suggestions to decommission them to save expenses.
- **Dangling DNS Records**: Pinpoints Cloudflare subdomains or root domains pointing to IP addresses that do not correspond to any active Hetzner resources. It warns about potential subdomain hijacking risks (Subdomain Takeover) and suggests verifying or deleting the records.
- **Financial Cost Impact**: Aggregates potential monthly savings for all actionable items.

### 4. Interactive Snapshot Comparison
The React dashboard supports local historical comparison against archived snapshots:
- **Snapshot Archives**: Snapshots are saved to `reports/snapshots/snapshot_YYYYMMDD_HHMMSS.json` and mirrored in the frontend public path.
- **Delta Analysis**: Compares the current audit data to a selected historical snapshot directly in the browser. It computes changes in real-time, displaying:
  - Added / Removed / Modified DNS Records (including IP changes).
  - Added / Removed / Status-Changed virtual resources.

## Google Chat Webhook Integration Guide

CloudMesh can dispatch card-based alert summaries and domain expiration warnings directly to Google Chat spaces.

### Step 1: Create an Incoming Webhook in Google Chat
1. Open [Google Chat](https://chat.google.com) in your browser.
2. Go to the space where you want to receive alerts.
3. Click the space name dropdown at the top and select **Apps & integrations**.
4. Click **Manage webhooks** (or **Add Webhook** if you do not have any).
5. Enter a name for the webhook (e.g., `CloudMesh Auditor`).
6. (Optional) Provide an avatar URL (such as a server icon).
7. Click **Save**.
8. Copy the generated Webhook URL. It will look like:
   `https://chat.googleapis.com/v1/spaces/AAAAxxxxxx/webhooks/your-unique-webhook-token`

### Step 2: Configure Environment Variables
Set the following variables in your `.env` file:
```bash
# Enable Google Chat notifications
ENABLE_GOOGLE_CHAT_NOTIFICATIONS=true

# Paste the webhook URL copied in Step 1
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/AAAAxxxxxx/webhooks/your-unique-webhook-token
```

### Notification Format Details
When an audit run completes, CloudMesh posts a structured card containing:
- **Scan Summary**: Total audited domains, active A/AAAA records, and matched Hetzner resources.
- **Hetzner Projects Cost Summary**: Estimates of total monthly infrastructure expenditures.
- **Actionable Optimization Warnings**: Alerts for unmapped Hetzner resources or dangling DNS records.
- **Domain Expiry Cards**: Detailed list of domains expiring within the next 30 days.
