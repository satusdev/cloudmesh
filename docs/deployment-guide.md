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
- `PUSHGATEWAY_URL` (e.g., http://localhost:9091 or your monitoring server)
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
2. **Create an A record** in Cloudflare DNS:
   - Name: `@` (for root) or `app` (for app.yourdomain.com)
   - IPv4 address: your Hetzner server's public IP
   - Proxy status: DNS only (or Proxied if you want Cloudflare protection)
3. **Wait for DNS propagation** (usually a few minutes).

---

## 7. (Optional) Secure with HTTPS

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

## 8. (Optional) Run as a systemd Service

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

## 9. Firewall & Security

- Use `ufw` or Hetzner's firewall to allow only necessary ports (e.g., 22 for SSH, 80/443 for web).
- Keep your server updated: `apt update && apt upgrade -y`
- Use SSH keys, disable password login if possible.

---

## 10. Monitoring & Troubleshooting

- Check logs: `journalctl -u cloudmesh -f`
- Reports: `ls reports/`
- Prometheus/Grafana: see metrics and dashboards as per main README.

---

## 11. Useful Links

- [Hetzner Cloud Console](https://console.hetzner.cloud/)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Prometheus](https://prometheus.io/)
- [Grafana](https://grafana.com/)

---

## 12. FAQ

- **Q: My domain doesn't resolve?**
  - Check Cloudflare DNS, wait for propagation, verify server is running.
- **Q: Slack upload not visible?**
  - Ensure bot is in the channel, see README Slack section.
- **Q: How do I update CloudMesh?**
  - `git pull` in the repo, then restart the service.

---

For more, see the main [README.md](../README.md).
