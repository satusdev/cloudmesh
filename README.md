<div align="center">
  <h1>CloudMesh 🚀</h1>
  <p>A Python tool that maps Cloudflare domains and subdomains to Hetzner Cloud servers across multiple projects.</p>
  <img src="https://img.icons8.com/fluency/96/000000/server.png" alt="logo"/>
</div>

<div align="center">

[![Build Status](https://img.shields.io/github/actions/workflow/status/satusdev/cloudmesh/lint.yml?branch=main)](https://github.com/satusdev/cloudmesh/actions)
[![npm version](https://img.shields.io/npm/v/starter-template.svg)](https://www.npmjs.com/package/starter-template)
[![License](https://img.shields.io/npm/l/starter-template.svg)](https://opensource.org/licenses/MIT)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
[![Release Please](https://img.shields.io/badge/release-please-blue.svg)](https://github.com/googleapis/release-please)

</div>

## Overview ⏩️

CloudMesh is a Python tool that maps Cloudflare domains and subdomains to Hetzner Cloud servers across multiple projects. It fetches data from the Cloudflare and Hetzner APIs, matches domains to servers by IP addresses, and generates detailed HTML and PDF reports. This tool is ideal for infrastructure management, helping you track and clean up your cloud resources by providing a clear overview of your domain-to-server relationships.

## Table of Contents 📄

- [Overview ⏩️](#overview-️)
- [Core Features ✨](#core-features-)
- [Getting Started ☣️](#getting-started-️)
- [Contributing](#contributing)
- [Future Enhancements 🔮](#future-enhancements-)
- [Getting Help 🆘](#getting-help-)
- [License](#license)

## Core Features ✨

- **Comprehensive Mapping:** Links Cloudflare A records (domains and subdomains) to Hetzner servers, showing project, server name, IP, status, creation date, server type, monthly price, traffic usage, and labels.
- **Domain-Specific Tables:** Organizes data into separate tables for each domain, with subdomains sorted alphabetically.
- **Visual Clarity:** Highlights unmatched IPs (where no Hetzner server is found) in red for easy identification.
- **Summary Statistics:** Displays total domains, A records, matched servers, and total monthly spending (€) at the top of the report.
- **Dual Output Formats:** Generates both an HTML report (`reports/mapping.html`) for browser viewing and a timestamped PDF report (e.g., `reports/mapping_YYYYMMDD_HHMMSS.pdf`) for archiving or sharing.
- **Prometheus & Grafana Monitoring:** Pushes metrics to Prometheus Pushgateway for visualization in Grafana dashboards.
- **.env Support:** Loads configuration from a `.env` file automatically (using `python-dotenv`), with fallback to `config.json` if needed.
- **Slack Integration (New!):** Automatically uploads the PDF report to a Slack channel using the latest Slack external file upload API (see below).
- **Robust Error Handling:** Clear error messages for missing configuration, API issues, and Slack upload problems.
- **Extensible Design:** Built to support future enhancements like monitoring and automation.

### Prerequisites

- **Python 3.6+:** Ensure Python is installed (`python3 --version`).
- **Dependencies:**
  - Python packages: `requests`, `pdfkit`, `prometheus_client` (`pip install requests pdfkit prometheus_client`).
  - System tool: `wkhtmltopdf` for PDF generation.
    - Ubuntu/Debian: `sudo apt-get install wkhtmltopdf`
    - macOS: `brew install wkhtmltopdf`
    - Windows: Download from [wkhtmltopdf.org](https://wkhtmltopdf.org) and add to PATH.
- **API Tokens:**
  - Cloudflare: Create a token with `Zone:Read` and `DNS:Read` permissions for all zones (Cloudflare Dashboard).
  - Hetzner: Generate a Read & Write token for each project (Hetzner Cloud Console).

### Setup

#### 1. Install Python Dependencies

- Create and activate a virtual environment (recommended):
  ```bash
  python3 -m venv venv
  source venv/bin/activate  # On Windows: venv\Scripts\activate
  ```
- Install required Python packages:
  ```bash
  pip install requests pdfkit prometheus_client dotenv
  ```
- Install wkhtmltopdf:
  - Ubuntu/Debian: `sudo apt-get install wkhtmltopdf`
  - macOS: `brew install wkhtmltopdf`
  - Windows: Download from [wkhtmltopdf.org](https://wkhtmltopdf.org/downloads.html) and add to PATH

#### 2. Install and Run Prometheus, Pushgateway, and Grafana

**Option A: Docker (Recommended)**

> **Note:** When running Prometheus and Pushgateway in Docker, `localhost` does not work between containers. Use a user-defined Docker network and container names for connectivity.

```bash
# Create a Docker network for monitoring tools
docker network create monitoring

# Start Pushgateway on the network with a name
docker run -d --name pushgateway --network monitoring -p 9091:9091 prom/pushgateway

# Start Prometheus on the same network with a name and config volume
docker run -d --name prometheus --network monitoring -p 9090:9090 -v $PWD/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus

# Start Grafana on the same network with a name
docker run -d --name grafana --network monitoring -p 3000:3000 grafana/grafana
```

Update your `prometheus.yml` to use the Pushgateway container name:

```yaml
scrape_configs:
  - job_name: 'cloudmesh_pushgateway'
    static_configs:
      - targets: ['pushgateway:9091']
```

**Option B: Manual Installation**
- [Prometheus Download](https://prometheus.io/download/)
- [Pushgateway Download](https://prometheus.io/docs/prometheus/latest/getting_started/#pushgateway)
- [Grafana Download](https://grafana.com/grafana/download)

#### 3. Configure CloudMesh

- Set the following environment variables (in your shell, .env file, or CI/CD secrets):

  - `CLOUDFLARE_TOKEN`: Cloudflare API token with `Zone:Read` and `DNS:Read` permissions.
  - `HETZNER_TOKEN_1`, `HETZNER_PROJECT_NAME_1`: Hetzner API token and project name for each project (add more as needed: `HETZNER_TOKEN_2`, etc.).
  - `PUSHGATEWAY_URL`: URL of your Prometheus Pushgateway (e.g., `http://pushgateway:9091` or `http://localhost:9091`).

  Example `.env` file:
  ```
  CLOUDFLARE_TOKEN=your_cloudflare_token
  HETZNER_TOKEN_1=your_hetzner_token
  HETZNER_PROJECT_NAME_1=your_project_name
  PUSHGATEWAY_URL=http://pushgateway:9091
  ```

  If running in CI/CD, set these as repository secrets.

---

## Slack Integration 🚀

CloudMesh can automatically upload the generated PDF report to a Slack channel using the latest Slack external file upload API.

### Setup

1. **Create a Slack App** at https://api.slack.com/apps (choose "From scratch").
2. **Add Bot Token Scopes** in "OAuth & Permissions":
   - `chat:write` (Send messages as your bot)
   - `files:write` (Upload, edit, and delete files as your bot)
   - `incoming-webhook` (optional, for posting messages)
3. **Install the app to your workspace** and copy the **Bot User OAuth Token** (starts with `xoxb-...`).
4. **Invite the bot to your target channel** (including private channels) with `/invite @your-bot-name`.
5. **Add these to your `.env` file:**
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_CHANNEL_ID=your-channel-id
   ```
   - To get the channel ID: In Slack, right-click the channel and select "Copy Channel ID".

### How it Works

- The script uses Slack's `files.getUploadURLExternal` and `files.completeUploadExternal` APIs to upload the PDF.
- The file is uploaded and shared directly in the specified channel.
- If the bot is not a member of the channel, or if the channel ID is incorrect, the upload will silently fail or not appear.

### Troubleshooting

- **File not visible in channel:** Ensure the bot is invited to the channel and the channel ID is correct.
- **Permissions error:** Double-check that your bot has the required scopes.
- **API errors:** The script prints detailed error messages for Slack API failures.
- **Scopes required:**
  - `chat:write`
  - `files:write`
  - `incoming-webhook` (optional)

### Example `.env` for Slack

```
CLOUDFLARE_TOKEN=your_cloudflare_token
HETZNER_TOKEN_1=your_hetzner_token
HETZNER_PROJECT_NAME_1=your_project_name
PUSHGATEWAY_URL=http://pushgateway:9091
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=your-channel-id
```

---

### Docker Networking Troubleshooting

- If Prometheus cannot connect to Pushgateway, ensure both containers are on the same Docker network and use the container name (not `localhost`) in `prometheus.yml`.
- Restart Prometheus after any configuration changes.
- To check connectivity, you can run a shell in the Prometheus container and ping the Pushgateway:
  ```bash
  docker exec -it prometheus sh
  ping pushgateway
  ```
- If you run your script outside Docker, use `localhost:9091` for Pushgateway in `config.json`. If inside Docker, use `pushgateway:9091`.

### Monitoring and Dashboard Access

#### A. Accessing Prometheus

- Once Prometheus is running, open [http://localhost:9090](http://localhost:9090) in your browser.
- Use the "Status" → "Targets" menu to verify that the Pushgateway is listed and metrics are being scraped.
- You can query metrics directly from the Prometheus web UI.

#### B. Accessing Grafana

- Once Grafana is running, open [http://localhost:3000](http://localhost:3000) in your browser.
- **Default login:**  
  - Username: `admin`  
  - Password: `admin` (you will be prompted to change this on first login)
- After login:
  1. Go to "Configuration" → "Data Sources" → "Add data source".
  2. Select "Prometheus" and set the URL to `http://prometheus:9090`.
  3. Save & Test the data source.
  4. Go to "Dashboards" → "Import" and upload `grafana-dashboard.json` from the repo.
  5. Open the imported dashboard to view CloudMesh metrics.

- **Security Note:** Change the Grafana admin password after your first login.

#### C. Running the Script and Workflow

- Ensure the required environment variables are set as described above.
- Run the script:
  ```bash
  python script.py
  ```
- The script will:
  - Generate HTML and PDF reports in the `reports/` directory.
  - Push monitoring metrics (run count, duration, domains, records, errors, etc.) to the Prometheus Pushgateway.

#### D. How It All Works Together

1. `script.py` runs and pushes metrics to the Pushgateway.
2. Prometheus scrapes the Pushgateway and stores metrics.
3. Grafana visualizes these metrics using the provided dashboard.

#### E. Example Workflow

1. Start Prometheus, Pushgateway, and Grafana (see above).
2. Run `python script.py` to generate reports and metrics.
3. Open Prometheus ([http://localhost:9090](http://localhost:9090)) to verify metrics.
4. Open Grafana ([http://localhost:3000](http://localhost:3000)), add Prometheus as a data source, and import the dashboard.
5. View real-time metrics and visualizations in Grafana.


### Usage

- **Run the Script:**
  ```bash
  python script.py
  ```
  This generates:
  - `reports/mapping.html`: An HTML report viewable in any web browser.
  - `reports/mapping_YYYYMMDD_HHMMSS.pdf`: A timestamped PDF report for archiving or sharing.

- **View the Reports:**
  - **HTML:** Open `reports/mapping.html` in a browser (e.g., `open reports/mapping.html` on macOS, `xdg-open reports/mapping.html` on Linux, or `start reports/mapping.html` on Windows).
  - **PDF:** Open the latest PDF file in `reports/` using a PDF viewer.

- **Report Details:**
  - **Summary Table:** Shows total domains, A records, matched servers, and monthly spending.
  - **Domain Tables:** Each domain has its own table listing subdomains, IPs, projects, server names, status, creation dates, server types, prices, traffic, and labels.
  - **Unmatched IPs:** Highlighted in red for easy identification.

## Contributing

Contributions are welcome! If you have an improvement or a new feature, please follow these steps:

1.  **Fork the repository.**
2.  **Create a new branch** for your feature or fix.
3.  **Add your changes** and commit them with a conventional commit message.
4.  **Submit a pull request** with a clear description of your changes.

## ✨ Contributors

<a href="https://github.com/satusdev/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=satusdev/.github&repo=satusdev/cloudmesh" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

## Getting Help 🆘

If you encounter any issues or have questions, please [open an issue](https://github.com/satusdev/cloudmesh/issues) on the GitHub repository.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
