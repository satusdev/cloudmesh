<div align="center">
  <h1>CloudMesh 🚀</h1>
  <p>Production-grade infrastructure auditor linking Cloudflare DNS records to Hetzner Cloud virtual servers.</p>
  <img src="https://img.icons8.com/fluency/96/000000/server.png" alt="logo"/>
</div>

<div align="center">

[![Build Status](https://img.shields.io/github/actions/workflow/status/satusdev/cloudmesh/lint.yml?branch=main)](https://github.com/satusdev/cloudmesh/actions)
[![License](https://img.shields.io/npm/l/starter-template.svg)](https://opensource.org/licenses/MIT)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
[![Release Please](https://img.shields.io/badge/release-please-blue.svg)](https://github.com/googleapis/release-please)

</div>

---

## 1. System Overview

CloudMesh is a production-grade infrastructure auditing tool that matches active Cloudflare DNS A records to Hetzner Cloud virtual servers by resolving and matching public IP addresses. It identifies orphaned DNS records (subdomains pointing to missing servers), aggregates monthly cloud costs per project, checks domain expiration dates, pushes telemetry to a Prometheus/Pushgateway stack, and provides a modern, interactive React/Vite dashboard.

---

## 2. Core Features

- **Extended Resource Mapping**: Integrates and maps Cloudflare DNS zones (supporting both `A` and `AAAA` records) to multiple Hetzner Cloud resource types, including Virtual Servers, Load Balancers, and Floating IPs.
- **Network Security Port Audit**: Concurrently scans ports `22` (SSH), `80` (HTTP), `443` (HTTPS), and `3389` (RDP) on all resolved IPs using a high-performance multi-threaded socket verification pool.
- **Stale VM & Cost Optimization Engine**: Detects financial waste and potential subdomain takeovers by recommending removal of dangling DNS entries and idle/unmapped Hetzner resources.
- **Interactive SVG Topology Graph**: Renders a dynamic node connection map (Domain -> Cloudflare Record -> Public IP -> Hetzner Resource -> Project) showing orphaned nodes in crimson, clickable resource nodes, and cost-weighted projects.
- **Drift & Historical Diff Engine**: Computes modifications (added, removed, or changed records/resources) compared to prior audit runs, with a client-side selector for arbitrary historical snapshot comparison.
- **DNS & HTTP Latency Telemetry**: Measures DNS resolution speed and TCP connection latency asynchronously for all subdomains.
- **Scheduled Monitor (Daemon Mode)**: Runs continuously inside containers or servers at a configurable interval (`MONITORING_INTERVAL_SECS`) to automate ongoing scans.
- **Advanced Filtering**: Filters records on the fly by Cloudflare proxy states, DNS type (A/AAAA), wildcard formats, cost ranges, projects, and domain expiration health.
- **Disk-Persistent WHOIS Cache**: Automatically caches domain registration lookups in `reports/whois_cache.json` to prevent rate-limit blocks and speed up execution.
- **API Robustness & Retries**: Utilizes a customized connection pool configured with a 5-retry policy and exponential backoff to handle transient errors (`429`, `500`, `502`, `503`, `504`).
- **Label Sanitization (Data Safety)**: Masks sensitive metadata keys (e.g., `key`, `token`, `secret`, `auth`, `password`) in VM labels as `********` before exporting reports.
- **Multi-Channel Alerting**: Dispatches summary metrics and domain expiration warnings to Slack channels (supporting PDF uploads) and Google Chat webhook cards.
- **Prometheus Telemetry**: Pushes metrics (running counts, processing durations, domain mappings, server uptimes) to Prometheus Pushgateway.

---

## 3. Directory Structure

```
├── docs/                     # Detailed guides (Deployment, Configuration, Troubleshooting)
├── frontend/                 # React / Vite TypeScript dashboard application
│   ├── src/                  # React dashboard component codebase
│   └── public/               # Static assets & generated data.json source
├── reports/                  # Generated HTML, PDF, and JSON audit artifacts (gitignored)
├── src/                      # Modular Python package engine
│   ├── api/                  # Cloudflare and Hetzner API client components
│   ├── core/                 # Matcher calculations and persistent cache adapters
│   ├── notifications/        # Slack and Google Chat webhook integrations
│   ├── reports/              # Print HTML and JSON file writers
│   ├── config.py             # Configuration validation and environment loader
│   ├── metrics.py            # Prometheus metric registry declarations
│   └── main.py               # Orchestrator flow
├── docker-compose.yml        # Telemetry containers (Prometheus & Pushgateway)
├── prometheus.yml            # Prometheus scrape targets configuration
├── script.py                 # Thin backward-compatible script wrapper
└── PROJECT.md                # System specification and architecture design doc
```

---

## 4. Getting Started

### Prerequisites
- **Python 3.8+**
- **NodeJS 18+ & pnpm**
- **wkhtmltopdf** (optional, required to export PDF reports)
  - Ubuntu/Debian: `sudo apt-get update && sudo apt-get install wkhtmltopdf`
  - macOS: `brew install wkhtmltopdf`
  - Windows: Download from [wkhtmltopdf.org](https://wkhtmltopdf.org) and add to system PATH.

### 1. Setup Python Environment
Create a virtual environment and install engine dependencies:
```bash
# Create and activate environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
# Or manually:
pip install requests pdfkit prometheus_client python-dotenv python-whois
```

### 2. Configure Credentials
Copy `.env.example` to `.env` and fill in API credentials and daemon configurations:
```bash
CLOUDFLARE_TOKEN=your_cloudflare_api_token
HETZNER_TOKEN_1=your_hetzner_project_api_token
HETZNER_PROJECT_NAME_1=Hetzner_Project_Name_1
PUSHGATEWAY_URL=http://localhost:9913

# (Optional) Scheduled Daemon Mode Configuration
MONITORING_INTERVAL_SECS=300       # Run audits every 5 minutes (set to 0 or omit to run once)
MAX_HISTORICAL_SNAPSHOTS=10        # Maximum history snapshots to persist for diffs and sparklines
```

---

## 5. Execution & Usage

### Step 1: Run the Audit Engine
Execute the Python script to fetch, map, and export the infrastructure mapping reports:
```bash
python script.py
```
This script validates credentials, computes mappings, and outputs:
- `reports/mapping.html`: Static printable report.
- `reports/data.json` & `frontend/public/data.json`: Raw structured audit data.
- `reports/whois_cache.json`: Persistent WHOIS queries.
- `reports/mapping_YYYYMMDD_HHMMSS.pdf`: Archived PDF report.

### Step 2: Launch the React Dashboard
Run the frontend dev server to visualize findings interactively:
```bash
# Navigate to frontend and install dependencies
cd frontend
pnpm install

# Start local server
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The dashboard automatically syncs with `frontend/public/data.json` on page refresh or load.

---

## 6. Telemetry Stack (Prometheus)

To collect execution metrics, spin up the telemetry containers:
```bash
# Start Prometheus and Pushgateway
docker compose up -d

# Verify services
# Prometheus target page: http://localhost:9912
# Pushgateway metrics: http://localhost:9913
```

---

## 7. Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/name`).
3. Commit changes using standard Conventional Commit guidelines.
4. Submit a Pull Request.

---

## 8. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
