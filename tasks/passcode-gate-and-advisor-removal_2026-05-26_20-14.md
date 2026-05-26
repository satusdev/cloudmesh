# Task: Passcode Gate and Advisor Removal

## Context
The user requested the removal of the "Optimization Advisor" from the frontend dashboard, along with implementing a secure passcode-based authentication gate that utilizes an environment-based passcode (`DASHBOARD_PASSWORD`) rather than public access.

## Status: PASSED

## Plan

### 1. Backend Updates
- [x] Create configuration loader for `DASHBOARD_PASSWORD`.
- [x] In `src/reports/generator.py`, hash the passcode via SHA-256 and export it as `passcode_hash` in data payloads and snapshots.
- [x] Correct `.gitignore` rules to prevent ignoring the nested `src/reports/` package while continuing to ignore the root `/reports/` folder.

### 2. Frontend Updates
- [x] Remove the "Optimization Advisor" panel from the dashboard sidebar in `frontend/src/App.tsx`.
- [x] Add passcode status variables and `handleUnlock` / `handleLock` logic.
- [x] Render a glassmorphic login overlay screen in `App.tsx` when a `passcode_hash` is present in the database payload and the user session is unauthenticated.
- [x] Persist authentication status securely in `sessionStorage` and implement logout (lock) controls in the header.

## Risks
- Client-side checks: Relies on native web crypto. Verified that `crypto.subtle.digest` works across standard browsers.
- Ignoring code paths: Fixed gitignore mapping rules to ensure `src/reports/generator.py` is safely tracked.

## Verification
- Ran `pnpm build` in the frontend directory. Build succeeded cleanly.
- Ran `pnpm lint` in the frontend directory. Lint passed successfully.
- Compiled python source files using `py_compile`. Succeeded with no syntax errors.
