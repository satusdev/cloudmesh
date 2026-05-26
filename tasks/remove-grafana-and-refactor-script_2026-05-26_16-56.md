# Task: Remove Grafana, Refactor Script, and Create React Dashboard

## Context
The user wants to remove Grafana from the docker-compose setup, refactor the monolithic 1.4k line `script.py` into a clean modular Python structure for easier maintenance, add `__pycache__` to `.gitignore`, and replace the static HTML dashboard with a premium React/Vite dashboard that displays up-to-date Cloudflare and Hetzner infrastructure stats and audit data.

## Status: PASSED

## Plan

### 1. Git Ignore Cleanup
- Update `.gitignore` to ignore python cache files: `__pycache__/`, `*.pyc`, `*.pyo`, and `*.pyd`.
- Remove any existing tracked `__pycache__` directories from Git.

### 2. Docker Compose Cleanup
- Remove the `grafana` service from `docker-compose.yml`.
- Delete the Grafana configuration files: `grafana-dashboard.json` and the `grafana-provisioning/` directory.
- Retain `prometheus` and `pushgateway` in `docker-compose.yml` to preserve Prometheus metrics collection functionality, but simplify port bindings and setup.

### 3. Modular Python Refactoring
Break down the monolithic `script.py` into a clean structure under `src/` to improve maintainability and follow the Single Responsibility Principle:
- `src/__init__.py`
- `src/config.py`: Configuration loading, validation, and credentials.
- `src/api/cloudflare.py`: Cloudflare fetching and processing logic.
- `src/api/hetzner.py`: Hetzner fetching, pricing mapping, and parallel server retrieval.
- `src/core/matcher.py`: Matching A records to Hetzner IPs, computing statistics, WHOIS cache, and expiry checks.
- `src/notifications/slack.py`: Slack webhook, channel message sending, and file uploads.
- `src/notifications/gchat.py`: Google Chat webhook formatting and sending.
- `src/reports/generator.py`: PDF generation via `pdfkit` and JSON output generation.
- `src/metrics.py`: Prometheus metrics initialization and Pushgateway integration.
- `src/main.py`: Main execution runner with profiler integration.
- `script.py`: Retain as a thin execution wrapper pointing to `src.main.main` to preserve backwards compatibility.

### 4. Create React Dashboard
Create a modern, feature-rich React frontend in a `frontend/` directory:
- Initialize a React + Vite + TypeScript application in `frontend/`.
- Set up TailwindCSS for premium styling (dark mode by default, glassmorphic UI, responsive layouts, smooth micro-animations).
- Build the UI dashboard featuring:
  - **Overview Statistics:** Total domains, A records, matched servers, estimated monthly spend.
  - **Expiry Tracker:** Clean alerts for domains expiring in <= 30 days or already expired.
  - **Interactive Domain Mapping Cards:** Expandable cards grouped by domain name containing tables of subdomain mappings (with status badges, cost per server, traffic, labels, and match/no-match states).
  - **Filters and Search:** Real-time search by domain, IP, or server name, and tabs for "All", "Matched Only", and "Orphaned/Unmatched" DNS records.
  - **Visualizations:** Simple graphs or styling representations of monthly spend per project and server health.
  - **Last Synced Banner:** Displays the time of the last script run and data refresh.
- Integrate the React app with the Python engine by having the Python script output a structured `data.json` file into the frontend's static directory (e.g., `frontend/public/data.json`), enabling the frontend to be "always connected" to the latest run data.

### 5. Documentation Update
- Update `PROJECT.md` to document the new modular Python engine structure and the React dashboard frontend.
- Update `docs/DEPLOYMENT.md` and `docs/CONFIGURATION.md` to reflect the removal of Grafana and addition of the React dashboard.

## Risks
- **Dependency Issues:** Ensure the React frontend packages install correctly and build without type errors.
- **Data Integration:** Ensure the schema of `data.json` produced by Python aligns perfectly with the TypeScript interfaces in React.
- **Port Conflicts:** Ensure the Vite dev server runs on a stable port.

## Verification
- Run modular python tests or test execution to verify JSON output and metrics push.
- Build the React frontend using `pnpm build` to verify there are no compilation or type errors.
- Run lint and formatting checks on both Python and React code.
