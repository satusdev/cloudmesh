# CloudMesh Deployment Guide: Hetzner Server & Domain Integration

This guide explains how to deploy CloudMesh on a Hetzner Cloud server, link it with your domain (using Cloudflare), and follow best practices for a secure, reliable setup.

---

## 1. Provision a Hetzner Cloud Server

1. **Create a Hetzner Cloud Project** (if you don't have one).
2. **Create a new server:**
   - Go to the [Hetzner Cloud Console](https://console.hetzner.cloud/).
   - Click "Add Server".
   - Choose a location (e.g., Falkenstein, Nuremberg, Helsinki).
   - Select an image: **Ubuntu 22.04 LTS** (recommended).
   - Choose a server type (e.g., CX11 for testing, CPX21+ for production).
   - Add SSH keys for secure access.
   - Click "Create & Buy Now".

3. **Note the server's public IPv4 address** (shown in the console).

---

## 2. Initial Server Setup

SSH into your server:
```bash
ssh root@<your-server-ip>
```

Update and install dependencies:
```bash
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv git wkhtmltopdf
```

---

## 3. Clone CloudMesh and Set Up

```bash
git clone https://github.com/satusdev/cloudmesh.git
cd cloudmesh
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt || pip install requests pdfkit prometheus_client python-dotenv
```

---

## 4. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your secrets:
```bash
cp .env.example .env
nano .env
```
Set:
- `CLOUDFLARE_TOKEN` (Cloudflare API token)
- `HETZNER_TOKEN_1` and `HETZNER_PROJECT_NAME_1` (Hetzner API token/project)
- `PUSHGATEWAY_URL` (e.g., http://push.yourdomain.com or https://push.yourdomain.com)
- `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` (if using Slack integration)

---

## 5. Running CloudMesh

```bash
python script.py
```
- Reports are generated in `reports/`
- Metrics are pushed to Prometheus Pushgateway

**Optional:** Set up as a systemd service for auto-start (see below).

---

## 6. Link Your Domain (Cloudflare DNS)

1. **Add your domain to Cloudflare** if not already done.
2. **Create A records** in Cloudflare DNS:
   - `grafana.yourdomain.com` → your Hetzner server's public IP
   - `prometheus.yourdomain.com` → your Hetzner server's public IP
   - `push.yourdomain.com` → your Hetzner server's public IP
   - (and any app subdomains you need)
   - Proxy status: DNS only (or Proxied if you want Cloudflare protection)
3. **Wait for DNS propagation** (usually a few minutes).

---

## 7. (Alternative) Deploy Prometheus, Grafana, and Pushgateway with Docker

You can run all monitoring services in Docker containers for easier management and upgrades.

### 1. Install Docker and Docker Compose

```bash
apt update
apt install -y docker.io docker-compose
systemctl enable --now docker
```

### 2. Example `docker-compose.yml`

Create a `docker-compose.yml` in your project or `/opt/monitoring`:

```yaml
services:
  prometheus:
    image: prom/prometheus
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - monitoring

  pushgateway:
    image: prom/pushgateway
    container_name: pushgateway
    ports:
      - "9091:9091"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana
    container_name: grafana
    ports:
      - "3000:3000"
    networks:
      - monitoring
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

networks:
  monitoring:
    driver: bridge
```

- Place your `prometheus.yml` in the same directory.
- You can add volumes for Grafana dashboards if needed.

### 3. Start the Stack

```bash
docker-compose up -d
```

### 4. Nginx Reverse Proxy to Docker Containers

Use the same Nginx configs as above, since the containers expose their ports on localhost.  
If you want to use Docker networking, set `proxy_pass http://prometheus:9090;` etc., and run Nginx in Docker with `--network monitoring`.

### 5. Access Services

- Grafana: http://grafana.yourdomain.com
- Prometheus: http://prometheus.yourdomain.com
- Pushgateway: http://push.yourdomain.com

### 6. Notes

- For production, set strong Grafana admin passwords and use persistent volumes.
- You can use `docker-compose logs -f` to view logs.
- To update, run `docker-compose pull && docker-compose up -d`.

---

## 8. Serve Grafana, Prometheus, and Pushgateway with Nginx

To access your monitoring tools via your domain, use Nginx as a reverse proxy for each service.

### 1. Install Nginx

```bash
apt update
apt install -y nginx
```

### 2. Create Nginx Configs

Create a file for each service in `/etc/nginx/sites-available/`:

**/etc/nginx/sites-available/grafana**
```
server {
    listen 80;
    server_name grafana.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**/etc/nginx/sites-available/prometheus**
```
server {
    listen 80;
    server_name prometheus.yourdomain.com;

    location / {
        proxy_pass http://localhost:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**/etc/nginx/sites-available/pushgateway**
```
server {
    listen 80;
    server_name push.yourdomain.com;

    location / {
        proxy_pass http://localhost:9091;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Enable the Sites

```bash
ln -s /etc/nginx/sites-available/grafana /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/prometheus /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/pushgateway /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 4. (Optional) Add SSL with Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d grafana.yourdomain.com -d prometheus.yourdomain.com -d push.yourdomain.com
```
Follow prompts to secure each service with HTTPS.

---

### 5. Make Grafana Available to Prometheus and Pushgateway

- **Grafana Data Source:**  
  When adding Prometheus as a data source in Grafana, use the public URL:  
  `http://prometheus.yourdomain.com` (or `https://prometheus.yourdomain.com` if using SSL)
- **Prometheus Pushgateway Target:**  
  In your `prometheus.yml`, set the Pushgateway target to:  
  `push.yourdomain.com:9091` (or `push.yourdomain.com:80` if using Nginx proxy, or `https` for SSL)
- **Firewall/Nginx:**  
  Ensure your firewall and Nginx allow access between these services on the correct ports.

---

## 8. (Optional) Secure with HTTPS

If you want to serve web content (e.g., a dashboard or API), use Let's Encrypt:
```bash
apt install -y snapd
snap install core; snap refresh core
snap install --classic certbot
ln -s /snap/bin/certbot /usr/bin/certbot
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```
- Follow prompts to get SSL certificates.
- Configure your web server (nginx, apache, etc.) to use the certs.

---

## 9. (Optional) Run as a systemd Service

Create `/etc/systemd/system/cloudmesh.service`:
```
[Unit]
Description=CloudMesh Automation
After=network.target

[Service]
User=root
WorkingDirectory=/root/cloudmesh
Environment="PATH=/root/cloudmesh/venv/bin"
ExecStart=/root/cloudmesh/venv/bin/python /root/cloudmesh/script.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload
systemctl enable cloudmesh
systemctl start cloudmesh
systemctl status cloudmesh
```

---

## 10. Firewall & Security

- Use `ufw` or Hetzner's firewall to allow only necessary ports (e.g., 22 for SSH, 80/443 for web).
- Keep your server updated: `apt update && apt upgrade -y`
- Use SSH keys, disable password login if possible.

---

## 11. Monitoring & Troubleshooting

- Check logs: `journalctl -u cloudmesh -f`
- Reports: `ls reports/`
- Prometheus/Grafana:  
  - Grafana: https://grafana.yourdomain.com  
  - Prometheus: https://prometheus.yourdomain.com  
  - Pushgateway: https://push.yourdomain.com  
  - In Grafana, add Prometheus as a data source using the public URL.

---

## 12. Useful Links

- [Hetzner Cloud Console](https://console.hetzner.cloud/)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Prometheus](https://prometheus.io/)
- [Grafana](https://grafana.com/)

---

## 13. FAQ

- **Q: My domain doesn't resolve?**
  - Check Cloudflare DNS, wait for propagation, verify server is running.
- **Q: Slack upload not visible?**
  - Ensure bot is in the channel, see README Slack section.
- **Q: How do I update CloudMesh?**
  - `git pull` in the repo, then restart the service.

---

For more, see the main [README.md](../README.md).
