# CloudMesh Monitoring Setup

## Final Configuration (Simplified & Working)

### Port Mappings
- **Grafana**: http://localhost:9911 (admin/admin)
- **Prometheus**: http://localhost:9912
- **Pushgateway**: http://localhost:9913

### Services Running
```bash
docker ps
# prometheus:9912:9090
# pushgateway:9913:9091
# grafana:9911:3000
```

### Script Execution
```bash
PUSHGATEWAY_URL=http://localhost:9913 python3 script_enhanced.py
```

### Data Flow
✅ **Script** → **Pushgateway** (port 9913) → **Prometheus** (internal) → **Grafana** (port 9911)

### Key Files
- `docker-compose.yml` - Container definitions
- `prometheus.yml` - Prometheus scraping config
- `script_enhanced.py` - Main monitoring script
- `grafana-dashboard-enhanced.json` - Grafana dashboard

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