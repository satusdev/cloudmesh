# Task: Improve API Robustness, WHOIS Cache Persistence, and Execution Sanitization

## Context
The project needs enhancement to improve API querying resilience, optimize WHOIS lookups via persistent storage, and secure the generated reports by sanitizing sensitive metadata. Additionally, we will update the project documentation (such as `README.md` and configuration docs) to reflect the new structure and capabilities.

## Status: PASSED

## Plan

### 1. Robust API Client Sessions
- Modify `src/api/cloudflare.py` to implement a centralized `requests.Session` with a `urllib3.util.Retry` adapter.
- Configure retries for transient status codes (429, 500, 502, 503, 504) with an exponential backoff factor to prevent rate-limit crashes.
- Update `fetch_all` to use the retry-enabled session.

### 2. Persistent WHOIS Cache
- Modify `src/core/matcher.py` to load cached WHOIS entries from `reports/whois_cache.json` if it exists.
- Implement helper functions `load_whois_cache()` and `save_whois_cache()`.
- Save the updated cache back to `reports/whois_cache.json` at the end of script execution.

### 3. Execution Data Sanitization
- Implement a helper to filter out sensitive fields (containing keywords like `token`, `secret`, `password`, `key`, `auth`) in Hetzner server labels before compiling them into mappings, HTML, and JSON reports.
- Ensure the sanitization happens in `process_servers_and_domains` during VM labels aggregation.

### 4. Documentation Overhaul
- Update `README.md` to detail:
  - New modular python project layout.
  - Setup and execution steps for the Vite/React dashboard.
  - Information on API retries, data safety/sanitization, and cache persistence.
- Update documentation files under `docs/` (e.g. `docs/CONFIGURATION.md` and `docs/ROADMAP.md`).

## Risks
- **WHOIS Cache Format Incompatibility**: Ensure parsing doesn't crash if the cache file gets corrupted. Use safe JSON loading with fallbacks.
- **Over-sanitization**: Make sure legitimate metadata labels are not unintentionally masked. Use selective key matching.

## Verification
- Run a dry-run execution of the script to verify WHOIS cache is created/read and data fields are sanitized.
- Build the frontend to verify there are no compilation errors.
