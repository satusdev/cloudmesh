# Task: Secure Deployment Variables

**Status:** PASSED
**Created:** 2026-05-28 11:50

---

## 1. Context & Goal
To prevent sensitive IP addresses, usernames, and directories from being committed to the public Git repository, we will refactor both deployment scripts (`deploy.sh` and `deploy.ps1`) to load these values dynamically from the environment (e.g. from the `.env` file). We will also update `.env.example` to provide templates for these variables.

---

## 2. Proposed Plan

### Step 1: Propose & Align
- [x] Propose the implementation plan to the user and obtain approval.

### Step 2: Update `.env.example`
- [x] Add template variables `DEPLOY_TARGET_IP`, `DEPLOY_TARGET_USER`, and `DEPLOY_TARGET_DIR` under a new section.

### Step 3: Implement Environment Loading in `deploy.sh`
- [x] Add code to read `.env` at runtime and extract deployment targets.
- [x] Replace hardcoded configuration with dynamic variables loaded from the environment.

### Step 4: Implement Environment Loading in `deploy.ps1`
- [x] Add code to read `.env` in PowerShell and load variables to the environment.
- [x] Replace hardcoded configuration with dynamic variables.

### Step 5: Verification
- [x] Verify that running the scripts without the environment variables correctly errors out with clear instructions.
- [x] Verify that setting the environment variables allows the scripts to execute the build and package actions successfully.

---

## 3. Risks & Mitigations
- **User Disruption:** Developers might forget to add these new variables to their local `.env` files.
  - *Mitigation:* The scripts will perform explicit validation on `DEPLOY_TARGET_IP` and fail fast with clear instructions on how to configure `.env`.

---

## 4. Verification Steps
- [x] Run `deploy.ps1` without the environment variable to verify error checking.
- [x] Validate syntax parser check for both scripts.
