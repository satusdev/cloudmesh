# Task: Show Servers Cost and Additional Dashboard Pages

**Status:** PASSED
**Created:** 2026-05-28 10:35

---

## 1. Context & Goal
The user wants to visualize all server costs in detail, with a dedicated page for cost breakdowns. We will retrieve dynamic pricing from Hetzner instead of using only hardcoded values, enrich server data (cores, memory, disk, datacenter, OS images, etc.), add multiple descriptive pages/tabs (Overview/Topology, Cost Analysis, Domains/WHOIS, Compute Resources, and Security/Port Audit), and implement domain sorting by expiration dates and DNS record counts.

---

## 2. Proposed Plan

### Step 1: Backend Pricing and Specification Retrieval
- Update `src/api/hetzner.py` to add dynamic retrieval of server and load balancer types with prices.
- Update `src/core/matcher.py` to retrieve dynamic pricing maps, extract server hardware specs (cores, memory, disk, location, image), LB specs, and Floating IP details (resolving server name). Calculate correct costs for each resource.
- Run `python script.py` to test parsing and generation of `data.json`.

### Step 2: Frontend UI Development
- Update interface definitions in `frontend/src/App.tsx`.
- Refactor dashboard navigation into a multi-page navbar/sidebar system.
- Build **Overview & Topology Tab** (incorporating search/filters, SVG graph, and tabular records).
- Build **Cost & Billing Tab** (summary cards, resource breakdown, project costs share bar, location breakdown, stale resources, and pricing recommendations).
- Build **Domains & WHOIS Tab** (domain status, expiration details, registrar, and chronological sorting).
- Build **Compute Resources Tab** (aggregates vCPUs/RAM/Storage, image breakdown, and full server spec table).
- Build **Security & Port Audit Tab** (active port status, exposure alerts, and security table).
- Add sorting options to sort domains by Name, Expiry Date (Asc/Desc), Records Count, or Cost.

### Step 3: Verification & Polish
- Run `pnpm lint` and `pnpm build` in the `frontend` directory to ensure type safety.
- Verify dashboard features in dark and light modes.

---

## 3. Risks & Mitigations
- **API Failures / Missing Tokens:** If Hetzner API keys lack permissions or request limits are hit, dynamic pricing will fail. We mitigate this by keeping a robust fallback to the `PRICING` dictionary.
- **Floating IP Resolution:** Floating IPs may be assigned or unassigned. We mitigate this by checking `fip['server']` and looking up the server ID in a pre-constructed server-to-name lookup dictionary.
- **Tailwind Version 4 Layouts:** The project uses Tailwind CSS v4. We will use standard utility classes (e.g. flex, grid, border, rounded, bg, text) to ensure compatibility.

---

## 4. Verification Steps
- Run `python script.py` and inspect `reports/data.json` to verify enriched specs are populated.
- Run `pnpm build` in the `frontend` folder to guarantee there are no TypeScript compilation or ESLint errors.
- Perform visual inspections on all 5 dashboard views to verify layout flow, sorting capability, and responsiveness.
