<div align="center">
  <h1>CloudMesh 🚀</h1>
  <p>A Python tool that maps Cloudflare domains and subdomains to Hetzner Cloud servers across multiple projects.</p>
  <img src="https://img.icons8.com/fluency/96/000000/server.png" alt="logo"/>
</div>

<div align="center">

[![Build Status](https://img.shields.io/github/actions/workflow/status/satusdev/scaffold/lint.yml?branch=main)](https://github.com/satusdev/scaffold/actions)
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
- **Extensible Design:** Built to support future enhancements like monitoring and automation.

### Prerequisites

- **Python 3.6+:** Ensure Python is installed (`python3 --version`).
- **Dependencies:**
  - Python packages: `requests`, `pdfkit` (`pip install requests pdfkit`).
  - System tool: `wkhtmltopdf` for PDF generation.
    - Ubuntu/Debian: `sudo apt-get install wkhtmltopdf`
    - macOS: `brew install wkhtmltopdf`
    - Windows: Download from [wkhtmltopdf.org](https://wkhtmltopdf.org) and add to PATH.
- **API Tokens:**
  - Cloudflare: Create a token with `Zone:Read` and `DNS:Read` permissions for all zones (Cloudflare Dashboard).
  - Hetzner: Generate a Read & Write token for each project (Hetzner Cloud Console).

### Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/yourusername/CloudHetznerSync.git
   cd CloudHetznerSync
   ```
2. **Set Up a Virtual Environment (recommended):**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. **Install Python Dependencies:**
   ```bash
   pip install requests pdfkit
   ```
4. **Install wkhtmltopdf:**  
   Follow the instructions above for your operating system.
5. **Configure API Tokens:**  
   Create a `config.json` file in the project root with your API tokens:
   ```json
   {
     "cloudflare": {
       "api_token": "your_cloudflare_api_token"
     },
     "hetzner": [
       {"project_name": "Project1", "api_token": "hetzner_token_for_project1"},
       {"project_name": "Project2", "api_token": "hetzner_token_for_project2"}
     ]
   }
   ```
   **Important:** Do not commit `config.json` to version control. It’s already excluded in `.gitignore`.

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


## Getting Started ☣️

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/satusdev/cloudmesh.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd cloudmesh
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Start coding!** 🎉

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

## Future Enhancements 🔮

We have a few ideas for future enhancements. Feel free to contribute or suggest new ones!

- **Prometheus and Grafana Integration:** Add real-time monitoring with Prometheus to collect server metrics (e.g., CPU, memory, actual traffic) and visualize them in Grafana dashboards for a dynamic, at-a-glance view.
- **Accurate Traffic Data:** Integrate Hetzner’s Robot Webservice or server logs to fetch real-time network traffic, replacing the current placeholder.
- **Automated Cleanup:** Add functionality to power off or delete unused servers directly via the Hetzner API, based on criteria like low traffic or age.
- **Interactive Reports:** Enhance the HTML report with sorting, filtering, and search capabilities using JavaScript.
- **Extended DNS Support:** Include other DNS record types (e.g., CNAME, MX) to provide a complete DNS-to-server mapping.
- **Notifications:** Send alerts (via email or Slack) for unmatched IPs or servers needing attention (e.g., high cost, low usage).
- **Multi-Provider Support:** Expand to map domains to servers from other providers (e.g., AWS, DigitalOcean).

These enhancements can be prioritized based on your needs, making CloudHetznerSync a robust tool for infrastructure management.

## Getting Help 🆘

If you encounter any issues or have questions, please [open an issue](https://github.com/satusdev/scaffold/issues) on the GitHub repository.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
