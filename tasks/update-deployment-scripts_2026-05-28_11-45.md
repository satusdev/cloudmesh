# Task: Update Deployment Scripts

**Status:** PASSED
**Created:** 2026-05-28 11:45

---

## 1. Context & Goal
The user wants to refactor the deployment scripts (`deploy.sh` and `deploy.ps1`) to bundle only the necessary files, upload them as a single archive, remove old files on the remote server (while preserving `.env`, `venv`, and `reports/`), extract the archive, and then run setup and audit commands on the target environment.

---

## 2. Proposed Plan

### Step 1: Propose & Align
- [x] Propose the implementation plan to the user and obtain approval.

### Step 2: Implement `deploy.sh`
- [x] Rewrite `deploy.sh` to compile frontend, compress only target production files (`frontend/dist`, `src`, `docker-compose.yml`, `package.json`, `postgres-init.sql`, `prometheus.yml`, `script.py`, `requirements.txt`, `.env.example`), upload via `scp`, clean up remote directory files, extract, and start services.

### Step 3: Implement `deploy.ps1`
- [x] Rewrite `deploy.ps1` to mirror the logic of `deploy.sh` in PowerShell syntax.

### Step 4: Verification
- [x] Verify the local React build steps.
- [x] Create and inspect the generated tar archive content to ensure no extra files are included.
- [x] Confirm syntax correctness for both Bash and PowerShell scripts.

---

## 3. Risks & Mitigations
- **Data Loss Risk:** Accidental removal of the remote `.env` or `reports/snapshots` directories.
  - *Mitigation:* Explicitly restrict `rm -rf` on the server to specific files and folders that we intend to replace (`src`, `frontend/dist`, config files). Avoid any recursive wildcard deletion.
- **Archive Size:** Including unnecessary files.
  - *Mitigation:* Explicitly pass only the specific files/folders list to `tar -czf`, ensuring no `node_modules`, `venv`, or `.git` directories are archived.

---

## 4. Verification Steps
- [x] Validate React frontend compilation: Run `pnpm build` in the `frontend` folder.
- [x] Inspect the archive structure: Run `tar -tf cloudmesh-deploy.tar.gz` and check files.
- [x] Perform Bash syntax check (`bash -n deploy.sh`).
