# Task: Enterprise-Grade Dashboard Upgrades and Engine Features

## Context
The user wants to transition CloudMesh from a basic execution-based script into a continuous monitoring tool. We will add scheduled monitoring mode, reverse mapping validation (finding unmapped servers), a historical snapshots and diff engine, and comprehensive dashboard upgrades (interactive topology graph, live metrics panel with sparklines/trends, dark/light themes, and advanced filters).

## Status: PASSED

## Plan

### 1. Engine & API Upgrades (Python Backend)
- **Record Enhancements**: Update Cloudflare API calls in `src/api/cloudflare.py` to capture `proxied` state and support both `A` and `AAAA` records.
- **Reverse Mapping**: Update matching logic in `src/core/matcher.py` to identify Hetzner virtual servers that do NOT have any Cloudflare DNS records pointing to their IPs (orphaned/unmapped servers).
- **Snapshot & Diff Engine**:
  - Load the previous run snapshot from `reports/snapshots/` to compare against the current run.
  - Compute a diff (added/modified/removed DNS records and servers).
  - Save historical snapshots to `reports/snapshots/snapshot_YYYYMMDD_HHMMSS.json`.
  - Maintain a maximum list of snapshots (prune old ones) and include a history summary in `data.json`.
- **Scheduled Daemon Mode**: Modify `src/main.py` to run continuously in a loop if `MONITORING_INTERVAL_SECS` environment variable is defined.

### 2. Frontend Dashboard Enhancements (React App)
- **Theme Manager**: Add a dark/light theme state ('dark' | 'light') with Tailwind CSS class transitions and `localStorage` persistence.
- **Advanced Filtering**: Add select dropdowns and toggles for:
  - Proxied vs DNS-only records.
  - DNS type (A vs AAAA).
  - Wildcard records (e.g. `*.example.com`).
  - Domain status (Expired / Impending Expiry / Healthy).
  - Cost brackets.
- **Uptime & Latency Sparklines**: Render a panel of sparkline trends over the last 24h using pure SVG charting based on the historical snapshots data in `data.json`.
- **Interactive Topology Graph**: Build a fully interactive SVG-based node topology graph visualization showing:
  - Domain -> DNS Record -> IP Address -> Hetzner Server -> Project.
  - Target/orphaned nodes colored in crimson red, and click behaviors to view server specs/labels.

### 3. Documentation Update
- Document the new scheduling variables (`MONITORING_INTERVAL_SECS`, `MAX_HISTORICAL_SNAPSHOTS`) and the reverse mapping / topology details in `README.md` and docs.

## Risks
- **SVG Graph Complexity**: A dense network with hundreds of nodes can become cluttered. We will implement tree groupings per domain and scale constraints to make the topology graph highly legible.
- **Daemon Memory Leaks**: Running in a loop inside a container requires clean socket management and cache pruning.

## Verification
- Run a daemon mode execution to confirm scheduling, snapshot generation, and diff tracking.
- Compile and build the React app to ensure there are no compilation errors.
