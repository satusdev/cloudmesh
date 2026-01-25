# CloudMesh Troubleshooting Guide

This guide covers common issues, debugging techniques, and solutions for CloudMesh problems.

## Quick Diagnosis

### Health Check Script
```bash
#!/bin/bash
# quick-diagnosis.sh
echo "=== CloudMesh Quick Diagnosis ==="

# Check Python installation
echo "Python version:"
python --version || echo "ERROR: Python not found"

# Check required packages
echo -e "\nRequired packages:"
python -c "import requests; print('requests: OK')" || echo "ERROR: requests missing"
python -c "import pdfkit; print('pdfkit: OK')" || echo "ERROR: pdfkit missing"
python -c "import prometheus_client; print('prometheus_client: OK')" || echo "ERROR: prometheus_client missing"

# Check wkhtmltopdf
echo -e "\nwkhtmltopdf:"
wkhtmltopdf --version || echo "ERROR: wkhtmltopdf not found"

# Check environment variables
echo -e "\nEnvironment variables:"
env | grep -E "(CLOUDFLARE|HETZNER|SLACK|PUSHGATEWAY)" | wc -l | xargs echo "Variables configured:"

# Test API connectivity
echo -e "\nAPI connectivity:"
if [ -n "$CLOUDFLARE_TOKEN" ]; then
    cf_status=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CLOUDFLARE_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify)
    echo "Cloudflare API: $cf_status"
else
    echo "Cloudflare API: No token configured"
fi

if [ -n "$HETZNER_TOKEN_1" ]; then
    hz_status=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $HETZNER_TOKEN_1" https://api.hetzner.cloud/v1/servers)
    echo "Hetzner API: $hz_status"
else
    echo "Hetzner API: No token configured"
fi

echo -e "\n=== Diagnosis Complete ==="
```

## Common Issues and Solutions

### 1. Cloudflare API Issues

#### 401 Unauthorized Error
```
Error: 401 Unauthorized
Cause: Invalid or expired API token
```

**Solutions:**
```bash
# 1. Verify token validity
curl -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
     https://api.cloudflare.com/client/v4/user/tokens/verify

# 2. Check token permissions
# Ensure token has Zone:Read and DNS:Read permissions

# 3. Verify token hasn't expired
# Check token creation date and TTL

# 4. Regenerate token if necessary
# Go to Cloudflare Dashboard → My Profile → API Tokens
```

#### 403 Forbidden Error
```
Error: 403 Forbidden
Cause: Insufficient permissions or token scope
```

**Solutions:**
```bash
# 1. Check token permissions
curl -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
     https://api.cloudflare.com/client/v4/user/tokens/verify

# 2. Verify zone access
curl -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
     https://api.cloudflare.com/client/v4/zones

# 3. Update token with correct permissions
# - Zone:Read
# - DNS:Read
# - Specific zone access if required
```

#### Rate Limiting
```
Error: 429 Too Many Requests
Cause: Exceeded API rate limits
```

**Solutions:**
```bash
# 1. Check rate limit status
curl -I -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
     https://api.cloudflare.com/client/v4/zones

# 2. Implement backoff in script
# CloudMesh has built-in retry logic, but you may need to:
# - Reduce frequency of runs
# - Optimize API calls
# - Use pagination efficiently

# 3. Monitor usage in Cloudflare dashboard
# Analytics → API Gateway Analytics
```

### 2. Hetzner API Issues

#### Invalid Authentication Token
```
Error: invalid authentication token
Cause: Invalid or expired Hetzner API token
```

**Solutions:**
```bash
# 1. Verify token validity
curl -H "Authorization: Bearer $HETZNER_TOKEN_1" \
     https://api.hetzner.cloud/v1/servers

# 2. Check token permissions
# Ensure token has server read permissions

# 3. Verify project access
curl -H "Authorization: Bearer $HETZNER_TOKEN_1" \
     https://api.hetzner.cloud/v1/projects

# 4. Regenerate token
# Go to Hetzner Cloud Console → Security → API Tokens
```

#### Project Not Found
```
Error: project not found
Cause: Token doesn't have access to specified project
```

**Solutions:**
```bash
# 1. List available projects
curl -H "Authorization: Bearer $HETZNER_TOKEN_1" \
     https://api.hetzner.cloud/v1/projects

# 2. Update project name in environment
export HETZNER_PROJECT_NAME_1="Correct Project Name"

# 3. Create project-specific token
# Generate new token with access to specific project
```

### 3. PDF Generation Issues

#### wkhtmltopdf Not Found
```
Error: wkhtmltopdf not found
Cause: wkhtmltopdf is not installed or not in PATH
```

**Solutions:**
```bash
# Ubuntu/Debian:
sudo apt-get update
sudo apt-get install wkhtmltopdf

# CentOS/RHEL:
sudo yum install wkhtmltopdf

# macOS:
brew install wkhtmltopdf

# Windows:
# Download from https://wkhtmltopdf.org/downloads.html
# Add to PATH

# Verify installation:
wkhtmltopdf --version
```

#### PDF Generation Timeout
```
Error: wkhtmltopdf timeout
Cause: Large report taking too long to generate
```

**Solutions:**
```bash
# 1. Increase timeout in script
# Modify pdfkit options:
options = {
    'quiet': '',
    'encoding': 'UTF-8',
    'javascript-delay': 5000,  # Increase JavaScript delay
    'load-error-handling': 'ignore',
    'load-media-error-handling': 'ignore'
}

# 2. Optimize HTML content
# - Reduce table size
# - Split large reports
# - Remove unnecessary CSS/JS

# 3. Generate HTML only
export GENERATE_REPORTS=true
# Then manually convert:
wkhtmltopdf --page-size A4 reports/mapping.html reports/mapping.pdf
```

#### Permission Denied Writing PDF
```
Error: Permission denied
Cause: Cannot write to reports directory
```

**Solutions:**
```bash
# 1. Check directory permissions
ls -la reports/

# 2. Fix permissions
chmod 755 reports/
chmod 644 reports/*

# 3. Check ownership
sudo chown -R $USER:$USER reports/

# 4. Create directory if missing
mkdir -p reports
```

### 4. Slack Integration Issues

#### Bot Not in Channel
```
Error: not_in_channel
Cause: Slack bot hasn't been invited to the target channel
```

**Solutions:**
```bash
# 1. Invite bot to channel
# In Slack: /invite @your-bot-name

# 2. Verify channel ID format
# Should be: C1234567890 (not #channel-name)

# 3. Check bot permissions
# Ensure bot has:
# - chat:write
# - files:write
```

#### Missing Scopes
```
Error: missing_scope
Cause: Bot token doesn't have required permissions
```

**Solutions:**
```bash
# 1. Check bot scopes
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     https://slack.com/api/auth.test

# 2. Update bot permissions
# Go to https://api.slack.com/apps
# Select your app → OAuth & Permissions
# Add scopes:
# - chat:write
# - files:write
# - incoming-webhook (optional)

# 3. Reinstall bot to workspace
# After updating scopes, reinstall the app
```

#### File Upload Failed
```
Error: file_upload_failed
Cause: Issues uploading PDF to Slack
```

**Solutions:**
```bash
# 1. Check file size limits
# Slack file limit: 1GB for paid workspaces

# 2. Verify file exists
ls -la reports/mapping_*.pdf

# 3. Test file upload manually
curl -F "file=@/path/to/report.pdf" \
     -F "channels=C1234567890" \
     -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     https://slack.com/api/files.upload

# 4. Check bot is in channel
# Ensure bot is member of target channel
```

### 5. Prometheus Integration Issues

#### Connection Refused
```
Error: Connection refused
Cause: Pushgateway is not running or not accessible
```

**Solutions:**
```bash
# 1. Check if Pushgateway is running
docker ps | grep pushgateway

# 2. Verify URL configuration
echo $PUSHGATEWAY_URL

# 3. Test connectivity
curl $PUSHGATEWAY_URL/metrics

# 4. Check network connectivity
telnet $PUSHGATEWAY_URL 9091

# 5. Start Pushgateway if not running
docker run -d -p 9091:9091 prom/pushgateway
```

#### DNS Resolution Issues
```
Error: Name resolution failed
Cause: Cannot resolve Pushgateway hostname
```

**Solutions:**
```bash
# 1. Check DNS resolution
nslookup pushgateway  # or your hostname

# 2. Use IP address instead
export PUSHGATEWAY_URL=http://192.168.1.100:9091

# 3. Check /etc/hosts
echo "192.168.1.100 pushgateway" >> /etc/hosts

# 4. Check Docker networking
# Ensure containers are on same network
docker network ls
docker network inspect cloudmesh_monitoring
```

### 6. Performance Issues

#### Slow Execution
```
Problem: Script takes too long to complete
```

**Solutions:**
```bash
# 1. Profile script execution
python -m cProfile -o profile.stats script.py
python -m pstats profile.stats

# 2. Check system resources
top -p $(pgrep -f script.py)
iotop -p $(pgrep -f script.py)

# 3. Monitor API calls
# Check rate limiting
# Optimize pagination
# Reduce unnecessary requests

# 4. Use parallel processing
# CloudMesh already uses threading for Hetzner APIs
# Monitor thread utilization
```

#### High Memory Usage
```
Problem: Script uses too much memory
```

**Solutions:**
```bash
# 1. Monitor memory usage
python -m memory_profiler script.py

# 2. Optimize data structures
# Process data in chunks
# Clear unused variables

# 3. Limit concurrent requests
# Adjust ThreadPoolExecutor size
MAX_WORKERS = min(10, (os.cpu_count() or 1))

# 4. Use streaming for large responses
# Process API responses incrementally
```

## Debug Mode

### Verbose Logging
```bash
# Enable Python verbose mode
python -v script.py 2>&1 | tee debug.log

# Enable detailed logging
python -c "
import logging
logging.basicConfig(level=logging.DEBUG)
exec(open('script.py').read())
"
```

### Environment Check
```bash
#!/bin/bash
# debug-environment.sh
echo "=== Environment Debug ==="
echo "Date: $(date)"
echo "User: $(whoami)"
echo "Directory: $(pwd)"
echo "Python: $(python --version)"
echo ""

echo "=== Environment Variables ==="
env | grep -E "(CLOUDFLARE|HETZNER|SLACK|PUSHGATEWAY|GENERATE|ENABLE)" | sort

echo ""
echo "=== Network Connectivity ==="
echo "Cloudflare API:"
curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" \
     -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
     https://api.cloudflare.com/client/v4/user/tokens/verify

echo "Hetzner API:"
curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" \
     -H "Authorization: Bearer $HETZNER_TOKEN_1" \
     https://api.hetzner.cloud/v1/servers

echo "Pushgateway:"
curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" \
     $PUSHGATEWAY_URL/metrics
```

### API Testing
```bash
#!/bin/bash
# test-apis.sh
echo "=== Cloudflare API Test ==="
cf_response=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
                  https://api.cloudflare.com/client/v4/zones?per_page=1)
echo $cf_response | jq '.success, .result_info.total_pages'

echo -e "\n=== Hetzner API Test ==="
hz_response=$(curl -s -H "Authorization: Bearer $HETZNER_TOKEN_1" \
                  https://api.hetzner.cloud/v1/servers?per_page=1)
echo $hz_response | jq '.servers | length'

echo -e "\n=== Slack API Test ==="
if [ -n "$SLACK_BOT_TOKEN" ]; then
    slack_response=$(curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
                         https://slack.com/api/auth.test)
    echo $slack_response | jq '.ok, .user, .team'
else
    echo "Slack token not configured"
fi
```

### Dry Run Mode
```python
# Add to script.py for testing
def dry_run_mode():
    """Test configuration without generating reports or sending notifications."""
    print("=== CloudMesh Dry Run Mode ===")

    # Test API connectivity
    print("Testing Cloudflare API...")
    cf_response = requests.get("https://api.cloudflare.com/client/v4/user/tokens/verify",
                              headers={"Authorization": f"Bearer {get_cloudflare_token()}"})
    print(f"Cloudflare API: {cf_response.status_code}")

    print("Testing Hetzner APIs...")
    for project in get_hetzner_projects():
        hz_response = requests.get("https://api.hetzner.cloud/v1/servers",
                                   headers={"Authorization": f"Bearer {project['api_token']}"})
        print(f"Hetzner API ({project['project_name']}): {hz_response.status_code}")

    print("Testing Slack integration...")
    if should_send_slack_notifications():
        slack_response = requests.post("https://slack.com/api/auth.test",
                                       headers={"Authorization": f"Bearer {os.environ.get('SLACK_BOT_TOKEN')}"})
        print(f"Slack API: {slack_response.status_code}")
    else:
        print("Slack notifications disabled")

    print("Testing Pushgateway...")
    pushgateway_response = requests.get(f"{get_pushgateway_url()}/metrics")
    print(f"Pushgateway: {pushgateway_response.status_code}")

    print("=== Dry Run Complete ===")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--dry-run":
        dry_run_mode()
    else:
        main()
```

## Log Analysis

### Extracting Errors
```bash
# Find all error messages
grep -i "error\|exception\|failed" script.log

# Find API errors specifically
grep -i "401\|403\|404\|429\|500" script.log

# Find timeout errors
grep -i "timeout\|connection\|refused" script.log
```

### Performance Analysis
```bash
# Extract timing information
grep "duration\|time\|seconds" script.log

# Analyze API call patterns
grep -E "(cloudflare|hetzner|slack)" script.log | cut -d' ' -f1-5

# Memory usage tracking
grep "memory\|mb\|gb" script.log
```

### Creating Debug Reports
```bash
#!/bin/bash
# generate-debug-report.sh
REPORT_FILE="cloudmesh-debug-$(date +%Y%m%d%H%M%S).txt"

{
    echo "=== CloudMesh Debug Report ==="
    echo "Generated: $(date)"
    echo "Hostname: $(hostname)"
    echo "User: $(whoami)"
    echo "Directory: $(pwd)"
    echo ""

    echo "=== System Information ==="
    uname -a
    python --version
    echo ""

    echo "=== Environment Variables ==="
    env | grep -E "(CLOUDFLARE|HETZNER|SLACK|PUSHGATEWAY|GENERATE|ENABLE)" | \
      sed 's/=.*/=***/'
    echo ""

    echo "=== Dependencies ==="
    pip list | grep -E "(requests|pdfkit|prometheus|dotenv)"
    echo ""

    echo "=== Network Tests ==="
    echo "Cloudflare API:"
    curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" \
         -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
         https://api.cloudflare.com/client/v4/user/tokens/verify 2>/dev/null

    echo "Hetzner API:"
    curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" \
         -H "Authorization: Bearer $HETZNER_TOKEN_1" \
         https://api.hetzner.cloud/v1/servers 2>/dev/null

    echo "Pushgateway:"
    curl -s -o /dev/null -w "Status: %{http_code}, Time: %{time_total}s\n" \
         $PUSHGATEWAY_URL/metrics 2>/dev/null
    echo ""

    echo "=== Recent Logs ==="
    if [ -f "script.log" ]; then
        tail -50 script.log
    else
        echo "No log file found"
    fi
    echo ""

    echo "=== Disk Usage ==="
    df -h
    echo ""

    echo "=== Memory Usage ==="
    free -h
    echo ""

    echo "=== Process Status ==="
    ps aux | grep -E "(python|cloudmesh)" | head -10

} > "$REPORT_FILE"

echo "Debug report generated: $REPORT_FILE"
```

## Getting Help

### Community Resources
- **GitHub Issues:** [Report bugs and request features](https://github.com/satusdev/cloudmesh/issues)
- **GitHub Discussions:** [Community support and questions](https://github.com/satusdev/cloudmesh/discussions)
- **Wiki:** [Additional documentation and examples](https://github.com/satusdev/cloudmesh/wiki)

### Creating Effective Bug Reports
When reporting issues, include:

1. **Environment Information**
   ```bash
   # Run this and include output
   python --version
   uname -a
   pip list | grep -E "(requests|pdfkit|prometheus)"
   ```

2. **Configuration (sanitized)**
   ```bash
   # Include without sensitive data
   env | grep -E "(CLOUDFLARE|HETZNER|SLACK|PUSHGATEWAY)" | sed 's/=.*/=***/'
   ```

3. **Error Messages**
   ```bash
   # Include full error output
   python script.py 2>&1 | tee error.log
   ```

4. **Expected vs Actual Behavior**
   - What you expected to happen
   - What actually happened
   - Steps to reproduce

5. **Debug Report**
   ```bash
   # Generate and attach debug report
   ./generate-debug-report.sh
   ```

### Contact Information
- **Maintainer:** [GitHub Repository Maintainers](https://github.com/satusdev/cloudmesh)
- **Support:** Use GitHub Issues for all support requests
- **Security Issues:** Report security vulnerabilities privately

## FAQ

### General Questions

**Q: How often should I run CloudMesh?**
A: It depends on your needs:
- Weekly for regular reports (default recommendation)
- Daily for active monitoring
- Hourly for critical infrastructure (monitoring mode only)

**Q: Can CloudMesh handle multiple Cloudflare accounts?**
A: Currently, CloudMesh supports one Cloudflare account per run. You can run multiple instances with different tokens if needed.

**Q: What happens if an API is down?**
A: CloudMesh has built-in retry logic and will continue with available data. Failed API calls are logged but don't stop the entire process.

### Technical Questions

**Q: Why are my domains showing as "No match"?**
A: This means the IP address in your DNS record doesn't match any Hetzner server in your configured projects. Check:
- IP addresses in your DNS records
- Server IPs in your Hetzner projects
- Project configurations

**Q: How can I reduce memory usage?**
A: For large deployments:
- Use monitoring-only mode (`GENERATE_REPORTS=false`)
- Process data in smaller batches
- Increase system memory or use cloud instances with more RAM

**Q: Can I export data to other formats?**
A: Currently CloudMesh supports HTML and PDF. The data structure is accessible in the script if you need custom exports.

For configuration help, see [CONFIGURATION.md](CONFIGURATION.md).
For deployment issues, see [DEPLOYMENT.md](DEPLOYMENT.md).
For security concerns, see [SECURITY.md](SECURITY.md).