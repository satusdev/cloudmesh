# CloudMesh Security Guide

This guide covers security best practices for deploying and managing CloudMesh in production environments.

## API Token Management

### Principle of Least Privilege

#### Cloudflare API Tokens
- **Required Permissions:** `Zone:Read` and `DNS:Read` only
- **Zone Scope:** Limit to specific zones whenever possible
- **TTL:** Set appropriate expiration times (recommended: 90 days or less)

```bash
# Create Cloudflare token with minimal permissions
curl -X POST "https://api.cloudflare.com/client/v4/user/tokens" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "CloudMesh Monitoring",
    "policies": [
      {
        "effect": "allow",
        "permission_groups": [
          {"id": "0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a", "name": "Zone Settings"},
          {"id": "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b", "name": "Zone DNS Read"}
        ],
        "resources": {
          "com.cloudflare.api.account.zone": {
            "zone:id": [
              "specific-zone-id-1",
              "specific-zone-id-2"
            ]
          }
        }
      }
    ],
    "ttl": 7776000
  }'
```

#### Hetzner Cloud Tokens
- **Project Scope:** Create separate tokens for each project
- **Permissions:** Use read-only tokens when possible
- **IP Restrictions:** Restrict to specific IP addresses in production

```bash
# Create Hetzner project-specific token
curl -X POST "https://api.hetzner.cloud/v1/projects/{project_id}/api_tokens" \
  -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "CloudMesh-Monitoring",
    "permissions": [
      {
        "permission": "server",
        "action": "read"
      }
    ]
  }'
```

#### Slack Bot Tokens
- **Required Scopes:** `chat:write`, `files:write` only
- **Channel Restrictions:** Limit to specific channels
- **Bot Permissions:** Set as needed, avoid giving admin rights

### Token Storage Best Practices

#### Environment Variables (Recommended)
```bash
# Secure environment file setup
touch .env
chmod 600 .env
echo "CLOUDFLARE_TOKEN=your_token_here" >> .env
echo "HETZNER_TOKEN_1=your_token_here" >> .env
```

#### CI/CD Secret Management
```yaml
# GitHub Actions
name: CloudMesh Report
on:
  schedule:
    - cron: '0 9 * * 1'
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run CloudMesh
        env:
          CLOUDFLARE_TOKEN: ${{ secrets.CLOUDFLARE_TOKEN }}
          HETZNER_TOKEN_1: ${{ secrets.HETZNER_TOKEN }}
        run: python script.py
```

```yaml
# GitLab CI
variables:
  CLOUDFLARE_TOKEN: $CLOUDFLARE_TOKEN
  HETZNER_TOKEN_1: $HETZNER_TOKEN_1
```

#### Kubernetes Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cloudmesh-secrets
type: Opaque
stringData:
  CLOUDFLARE_TOKEN: "your-token"
  HETZNER_TOKEN_1: "your-token"
```

### Token Rotation Policy

#### Automated Rotation
```bash
#!/bin/bash
# rotate-tokens.sh
# Script to rotate API tokens automatically

# Generate new Cloudflare token
NEW_CF_TOKEN=$(curl -X POST "https://api.cloudflare.com/client/v4/user/tokens" \
  -H "Authorization: Bearer $MASTER_CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"name": "CloudMesh Rotated Token", "policies": [...]}')

# Update environment
sed -i "s/CLOUDFLARE_TOKEN=.*/CLOUDFLARE_TOKEN=$NEW_CF_TOKEN/" .env

# Restart services
systemctl restart cloudmesh
```

#### Rotation Schedule
- **Cloudflare Tokens:** Every 90 days
- **Hetzner Tokens:** Every 180 days
- **Slack Tokens:** Annually or when compromised
- **Emergency Rotation:** Immediately upon suspected compromise

## Network Security

### Firewall Configuration

#### Required Outbound Connections
```bash
# UFW (Ubuntu) firewall rules
sudo ufw allow out 443/tcp comment "HTTPS to Cloudflare"
sudo ufw allow out 443/tcp comment "HTTPS to Hetzner"
sudo ufw allow out 443/tcp comment "HTTPS to Slack"

# Specific IP restrictions (if possible)
sudo ufw allow out to 104.16.0.0/12 port 443 comment "Cloudflare"
sudo ufw allow out to 213.133.98.0/24 port 443 comment "Hetzner"
```

#### Docker Network Isolation
```yaml
# docker-compose.security.yml
version: '3.8'
services:
  cloudmesh:
    build: .
    networks:
      - cloudmesh-internal
    dns:
      - 8.8.8.8
      - 1.1.1.1
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    user: "1000:1000"

networks:
  cloudmesh-internal:
    driver: bridge
    internal: false
```

### SSL/TLS Configuration

#### Certificate Verification
```python
# In script.py - ensure SSL verification is always enabled
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def secure_session():
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    # Always verify SSL certificates
    session.verify = True
    return session
```

#### Custom CA Certificates
```bash
# For corporate environments with custom CAs
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
```

## Data Protection

### Data Classification

#### Public Information
- Domain names and subdomains
- IP addresses
- Server types and pricing
- Status information

#### Sensitive Information
- API tokens and secrets
- Server labels and internal naming
- Project names and identifiers
- Historical performance data

### Data Handling

#### Encryption at Rest
```bash
# Encrypt report directory
sudo cryptsetup luksFormat /dev/sdb1
sudo cryptsetup open /dev/sdb1 encrypted_reports
sudo mkfs.ext4 /dev/mapper/encrypted_reports
sudo mount /dev/mapper/encrypted_reports /opt/cloudmesh/reports
```

#### Secure File Permissions
```bash
# Set appropriate permissions
chmod 750 /opt/cloudmesh
chmod 750 /opt/cloudmesh/reports
chmod 640 /opt/cloudmesh/reports/*
chmod 600 /opt/cloudmesh/.env
chown -R cloudmesh:cloudmesh /opt/cloudmesh
```

#### Data Retention
```bash
# Automated cleanup script
#!/bin/bash
# cleanup-reports.sh
find /opt/cloudmesh/reports -name "*.pdf" -mtime +30 -delete
find /opt/cloudmesh/reports -name "*.html" -mtime +7 -delete
```

### Privacy Compliance

#### GDPR Considerations
- Domain names and IP addresses are generally considered public information
- Server labels might contain personal information - audit and anonymize if needed
- Implement data subject access request (DSAR) procedures

#### Data Processing Records
```yaml
# data-processing-register.yml
data_processor: CloudMesh
purpose: Infrastructure monitoring and reporting
legal_basis: Legitimate interest
data_categories:
  - domain_names: public
  - ip_addresses: public
  - server_labels: internal
  - api_tokens: secret
retention_period: 30 days for reports, indefinite for configuration
security_measures:
  - encryption_in_transit: TLS 1.3
  - encryption_at_rest: LUKS encryption
  - access_control: RBAC
  - audit_logging: enabled
```

## Access Control

### System Access

#### User Management
```bash
# Create dedicated service user
sudo useradd -r -s /bin/false -d /opt/cloudmesh cloudmesh
sudo usermod -L cloudmesh  # Lock password login

# Grant necessary permissions
sudo chown -R cloudmesh:cloudmesh /opt/cloudmesh
sudo chmod 750 /opt/cloudmesh
```

#### sudo Configuration
```bash
# /etc/sudoers.d/cloudmesh
cloudmesh ALL=(root) NOPASSWD: /usr/bin/systemctl restart cloudmesh
cloudmesh ALL=(root) NOPASSWD: /usr/bin/docker run --rm cloudmesh:latest
```

### Container Security

#### Docker Hardening
```dockerfile
# Dockerfile.security
FROM python:3.9-slim

# Create non-root user
RUN groupadd -r cloudmesh && useradd -r -g cloudmesh cloudmesh

# Install dependencies securely
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    wkhtmltopdf \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy files as non-root user
COPY --chown=cloudmesh:cloudmesh . .

# Switch to non-root user
USER cloudmesh

# Set secure permissions
RUN chmod +x script.py

# Run as non-root
CMD ["python", "script.py"]
```

#### Pod Security Policies (Kubernetes)
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: cloudmesh-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## Auditing and Monitoring

### Audit Logging

#### Application Logging
```python
# Enhanced logging configuration
import logging
import json
from datetime import datetime

class SecureFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'process_id': os.getpid()
        }
        return json.dumps(log_entry)

# Configure secure logging
logging.basicConfig(
    level=logging.INFO,
    handlers=[
        logging.FileHandler('/var/log/cloudmesh/audit.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
logger.handlers[0].setFormatter(SecureFormatter())
```

#### System Monitoring
```bash
# Monitor CloudMesh processes
auditctl -w /opt/cloudmesh/script.py -p x -k cloudmesh_execution
auditctl -w /opt/cloudmesh/.env -p rwa -k cloudmesh_config

# Log monitoring with auditd
ausearch -k cloudmesh_execution -i
ausearch -k cloudmesh_config -i
```

### Security Monitoring

#### Intrusion Detection
```bash
# Monitor for suspicious activity
#!/bin/bash
# security-monitor.sh

# Check for unauthorized access attempts
grep "Failed password" /var/log/auth.log | grep cloudmesh

# Monitor for unusual API usage
tail -f /var/log/cloudmesh/audit.log | jq 'select(.level == "ERROR")'

# Check file integrity
find /opt/cloudmesh -type f -exec sha256sum {} \; > /tmp/cloudmesh-hash.txt
```

#### Alert Configuration
```yaml
# Prometheus alerts for security
groups:
- name: cloudmesh_security
  rules:
  - alert: CloudMeshHighErrorRate
    expr: rate(cloudmesh_script_errors_total[5m]) > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High error rate in CloudMesh"
      description: "CloudMesh error rate is {{ $value }} errors/second"

  - alert: CloudMeshUnauthorizedAccess
    expr: cloudmesh_unauthorized_access_total > 0
    for: 0m
    labels:
      severity: critical
    annotations:
      summary: "Unauthorized access detected"
      description: "Unauthorized access attempts detected in CloudMesh"
```

## Incident Response

### Security Incident Procedures

#### Immediate Response
1. **Isolate:** Stop affected services
2. **Assess:** Determine scope of compromise
3. **Rotate:** Change all exposed credentials
4. **Document:** Record timeline and actions taken

#### Recovery Steps
```bash
#!/bin/bash
# incident-response.sh

echo "=== CloudMesh Incident Response ==="

# 1. Stop services
systemctl stop cloudmesh
docker stop cloudmesh

# 2. Backup current state
cp /opt/cloudmesh/.env /opt/cloudmesh/.env.backup.$(date +%Y%m%d%H%M%S)

# 3. Rotate credentials
echo "Rotating Cloudflare token..."
# Token rotation script here

echo "Rotating Hetzner tokens..."
# Token rotation script here

echo "Rotating Slack token..."
# Token rotation script here

# 4. Verify configuration
echo "Verifying new configuration..."
python script.py --dry-run

# 5. Restart services
systemctl start cloudmesh

echo "Incident response complete"
```

### Forensics and Investigation

#### Log Collection
```bash
# Collect forensic evidence
mkdir -p /tmp/cloudmesh-forensics
cp /var/log/cloudmesh/*.log /tmp/cloudmesh-forensics/
cp /opt/cloudmesh/.env /tmp/cloudmesh-forensics/env.backup
docker logs cloudmesh > /tmp/cloudmesh-forensics/docker.log

# Create audit trail
tar -czf cloudmesh-forensics-$(date +%Y%m%d%H%M%S).tar.gz /tmp/cloudmesh-forensics/
```

## Compliance Frameworks

### ISO 27001 Controls

#### A.9 Access Control
- Control 9.1: Business requirements for access control
- Control 9.2: User access management
- Control 9.3: User responsibilities
- Control 9.4: System and application access control

#### A.12 Operations Security
- Control 12.1: Operational procedures and responsibilities
- Control 12.2: Protection from malware
- Control 12.3: Backup management
- Control 12.4: Logging and monitoring
- Control 12.5: Control of operational software

#### A.14 Communications Security
- Control 14.1: Network security controls
- Control 14.2: Network segregation
- Control 14.3: Information transfer policies and procedures

### SOC 2 Considerations

#### Security Principle
- **Common Criteria 6.1:** Logical and physical access controls
- **Common Criteria 6.2:** Logical access security software
- **Common Criteria 6.3:** Identification, authentication, and authorization
- **Common Criteria 6.7:** Data destruction and media disposal

#### Availability Principle
- **Common Criteria 7.1:** Availability controls
- **Common Criteria 7.2:** Environmental protections

## Security Testing

### Vulnerability Scanning
```bash
# Container vulnerability scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image cloudmesh:latest

# Dependency scanning
pip install safety
safety check -r requirements.txt

# Static code analysis
pip install bandit
bandit -r script.py
```

### Penetration Testing
```bash
# Test API token exposure
curl -H "Authorization: Bearer INVALID_TOKEN" \
  https://api.cloudflare.com/client/v4/zones

# Test rate limiting
for i in {1..100}; do
  curl -s "https://api.cloudflare.com/client/v4/zones" > /dev/null
done

# Test input validation
python script.py "$(echo 'malicious_input')"
```

## Best Practices Checklist

### Daily/Weekly
- [ ] Review error logs for anomalies
- [ ] Verify API token usage patterns
- [ ] Check for unauthorized access attempts
- [ ] Monitor system resource usage

### Monthly
- [ ] Rotate API tokens if approaching expiration
- [ ] Review user access permissions
- [ ] Update dependencies and scan for vulnerabilities
- [ ] Audit configuration files

### Quarterly
- [ ] Conduct security assessment
- [ ] Review and update security policies
- [ ] Perform incident response drill
- [ ] Update documentation

### Annually
- [ ] Complete compliance audit
- [ ] Review and update threat model
- [ ] Conduct penetration testing
- [ ] Review disaster recovery procedures

For troubleshooting security issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
For deployment security guidance, see [DEPLOYMENT.md](DEPLOYMENT.md).