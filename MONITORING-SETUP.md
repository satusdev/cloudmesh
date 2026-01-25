# CloudMesh Monitoring Setup

> **Note:** This document has been integrated into our comprehensive documentation structure. For the most up-to-date monitoring setup information, please see:
> - [Deployment Guide - Monitoring Section](docs/DEPLOYMENT.md#monitoring-and-dashboard)
> - [Configuration Guide - Prometheus Integration](docs/CONFIGURATION.md#monitoring-integration)
> - [Troubleshooting Guide - Prometheus Issues](docs/TROUBLESHOOTING.md#5-prometheus-integration-issues)

## Quick Reference

### Port Mappings
- **Grafana**: http://localhost:9911 (admin/admin)
- **Prometheus**: http://localhost:9912
- **Pushgateway**: http://localhost:9913

### Services Status Check
```bash
docker ps
# Should show:
# prometheus:9912:9090
# pushgateway:9913:9091
# grafana:9911:3000
```

### Script Execution
```bash
# With current monitoring setup
PUSHGATEWAY_URL=http://localhost:9913 python script.py

# Or use docker-compose
docker-compose up
```

### Data Flow
✅ **Script** → **Pushgateway** (port 9913) → **Prometheus** (internal) → **Grafana** (port 9911)

### Key Configuration Files
- `docker-compose.yml` - Container definitions and networking
- `prometheus.yml` - Prometheus scraping configuration
- `script.py` - Main CloudMesh script with Prometheus integration
- `grafana-dashboard.json` - Grafana dashboard configuration

### Common Commands

**Start all services:**
```bash
docker-compose up -d
```

**Check service health:**
```bash
curl http://localhost:9912/targets  # Prometheus targets
curl http://localhost:9913/metrics   # Pushgateway metrics
```

**Stop all services:**
```bash
docker-compose down
```

**View logs:**
```bash
docker-compose logs -f prometheus
docker-compose logs -f grafana
docker-compose logs -f pushgateway
```

---

**For detailed setup instructions, configuration options, and troubleshooting, please refer to the documentation in the `docs/` directory.**

### Verification Commands
```bash
# Test all services
curl -I http://localhost:9911  # Grafana (should redirect to login)
curl -I http://localhost:9912  # Prometheus
curl -I http://localhost:9913  # Pushgateway

# Check metrics in Pushgateway
curl -s http://localhost:9913/metrics | grep cloudmesh

# Check metrics in Prometheus
curl -s "http://localhost:9912/api/v1/query?query=cloudmesh_domains_total"
```

### Management
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f prometheus
docker compose logs -f pushgateway
docker compose logs -f grafana
```

## Issues Fixed
1. ✅ **Container connectivity** - Fixed internal Docker networking
2. ✅ **Port conflicts** - Changed to 991x port range
3. ✅ **Prometheus scraping** - Corrected internal targets
4. ✅ **Script metrics** - Updated Pushgateway URL
5. ✅ **Configuration cleanup** - Removed duplicate config files

## Next Steps
1. Access Grafana: http://localhost:9911 (admin/admin)
2. Import dashboard from `grafana-dashboard-enhanced.json`
3. Set up data source pointing to http://prometheus:9090
4. Run script regularly to update metrics