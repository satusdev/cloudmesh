# Task: Integrate Google Chat and Premium HTML Dashboard

## Context
The project needs integration with Google Chat notifications alongside Slack to ease the migration phase. Additionally, the Grafana/Prometheus dependency is heavyweight for a simple reporting script. We will replace/complement it with a highly premium, modern, and interactive standalone HTML dashboard (`reports/mapping.html`) with search, filters, cost graphs, and status toggles.

## Status: PASSED

## Plan
1. **Google Chat Integration:**
   - Add environment variable config options: `ENABLE_GOOGLE_CHAT_NOTIFICATIONS` and `GOOGLE_CHAT_WEBHOOK_URL`.
   - Update configuration parsing to support Google Chat.
   - Refactor notification systems in `script.py` to use modular functions: `send_slack_notifications` and `send_google_chat_notifications`.
   - Build a well-formatted Card/Message payload for Google Chat webhooks containing summary statistics and domain warnings (expiring domains).

2. **Premium Dashboard Redesign:**
   - Overhaul `generate_html_report` in `script.py` to output a state-of-the-art interactive single-page dashboard.
   - Incorporate a modern color palette (dark mode by default, utilizing slate, indigo, and emerald colors).
   - Add a client-side search input, filtering toggles (All, Matched, Unmatched), and collapsible sections for each domain.
   - Include modern typography (Inter font from Google Fonts).
   - Display dynamic summary charts (such as project cost distribution) rendered purely via modern CSS/JS.
   - Add subtle micro-animations (transitions, hover states, scale changes).

3. **Documentation:**
   - Update `docs/CONFIGURATION.md` to document the new Google Chat configuration variables.
   - Update `PROJECT.md` to reflect the updated architecture.

## Risks
- **Google Chat Payload Size Limits:** Keep the card message payload concise. Only list expiring domains and summary metrics in the webhook payload, while point to the local HTML/PDF reports for full details.
- **Python-to-HTML Injection:** Ensure proper escaping when generating HTML strings from DNS/Hetzner outputs.

## Verification
- Run a dry-run execution of the script to generate the HTML report.
- Verify the generated HTML dashboard features (filtering, sorting, searching, layout) in the browser.
- Perform linting check on `script.py` and run code formatting.
