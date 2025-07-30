# CloudMesh Deployment & Usage Guide

## 1. Prerequisites

- **Python 3.6+**
- **Docker** (recommended for Prometheus, Pushgateway, Grafana)
- **wkhtmltopdf** (for PDF report generation)
- **Git**

## 2. Server Preparation

Install required tools:

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip wkhtmltopdf git
# Install Docker if not present
curl -fsSL https://get.docker.com | sh
```

## 3. Clone the Repository

```bash
git clone https://github.com/satusdev/cloudmesh.git
cd cloudmesh
```

## 4. Install Python Dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install requests pdfkit prometheus_client
```

## 5. Set Environment Variables

Create a `.env` file or export variables in your shell:

```
CLOUDFLARE_TOKEN=your_cloudflare_token
HETZNER_TOKEN_1=your_hetzner_token
HETZNER_PROJECT_NAME_1=your_project_name
PUSHGATEWAY_URL=http://pushgateway:9091
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
```

- `SLACK_WEBHOOK_URL` is optional but required to send the weekly report to a Slack channel.
- Add more Hetzner projects as needed (`HETZNER_TOKEN_2`, etc.).

## 6. Start Monitoring Stack (Docker)

```bash
docker network create monitoring

docker run -d --name pushgateway --network monitoring -p 9091:9091 prom/pushgateway
docker run -d --name prometheus --network monitoring -p 9090:9090 -v $PWD/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
docker run -d --name grafana --network monitoring -p 3000:3000 grafana/grafana
```

## 7. Run the Script

```bash
source venv/bin/activate
python script.py
```

- Generates HTML and PDF reports in `reports/`
- Pushes metrics to Pushgateway

## 8. Schedule Script (Optional)

### Using cron

```bash
crontab -e
# Add (runs every Sunday at 2:00 AM):
0 2 * * 0 cd /path/to/cloudmesh && /bin/bash -c 'source venv/bin/activate && python script.py'
```

### Using systemd

Create `/etc/systemd/system/cloudmesh.service`:

```
[Unit]
Description=CloudMesh Monitor

[Service]
WorkingDirectory=/path/to/cloudmesh
EnvironmentFile=/path/to/cloudmesh/.env
ExecStart=/path/to/cloudmesh/venv/bin/python script.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudmesh
sudo systemctl start cloudmesh
```

## 9. Set Up Grafana Dashboard

- Open Grafana at [http://localhost:3000](http://localhost:3000)
- Add Prometheus as a data source (`http://prometheus:9090`)
- Import `grafana-dashboard.json` from the repo

## 10. Verify & Troubleshoot

- Check Prometheus at [http://localhost:9090](http://localhost:9090) for metrics
- Check Grafana dashboard for live data
- Review logs and `reports/profile.txt` for performance info

## 11. Slack Integration

- To send the weekly HTML report to a Slack channel, create an [Incoming Webhook](https://api.slack.com/messaging/webhooks) in your Slack workspace and set the `SLACK_WEBHOOK_URL` environment variable.
- The script will automatically post the report after each run if this variable is set.

## 12. CI/CD Automation (Optional)

- Use `.github/workflows/monitor.yml` for scheduled runs and artifact uploads

---

**For more details, see the main README.md.**
