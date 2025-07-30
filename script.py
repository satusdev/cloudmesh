import json
import requests
from datetime import datetime
import os
import pdfkit

# Load configuration
with open('config.json', 'r') as f:
    config = json.load(f)

CLOUDFLARE_TOKEN = config['cloudflare']['api_token']
HETZNER_PROJECTS = config['hetzner']

# Hetzner server type pricing (in EUR/month, as of 2025; update as needed)
PRICING = {
    "cx11": 3.29,
    "cx21": 5.99,
    "cx31": 11.99,
    "cx41": 21.99,
    "cx51": 39.99,
    "cpx11": 4.99,
    "cpx21": 8.99,
    "cpx31": 15.99,
    "cpx41": 29.99,
    "cpx51": 49.99,
    "ccx11": 19.99,
    "ccx21": 39.99,
    "ccx31": 79.99,
    "ccx41": 149.99,
    "ccx51": 299.99,
    # Add more server types as needed based on Hetzner offerings
}

# Fetch all results with pagination
def fetch_all(url, headers, params=None):
    results = []
    page = 1
    while True:
        if params is None:
            params = {}
        params['page'] = page
        params['per_page'] = 50
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        if 'result' in data:
            results.extend(data['result'])
            if page >= data['result_info']['total_pages']:
                break
        else:  # Hetzner uses 'servers' key
            results.extend(data['servers'])
            if 'meta' not in data or 'pagination' not in data['meta'] or page >= data['meta']['pagination']['last_page']:
                break
        page += 1
    return results

# Fetch Cloudflare zones
def fetch_cloudflare_zones(token):
    headers = {"Authorization": f"Bearer {token}"}
    return fetch_all("https://api.cloudflare.com/client/v4/zones", headers)

# Fetch DNS records for a zone
def fetch_dns_records(token, zone_id):
    headers = {"Authorization": f"Bearer {token}"}
    return fetch_all(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records", headers)

# Fetch Hetzner servers
def fetch_hetzner_servers(token):
    headers = {"Authorization": f"Bearer {token}"}
    return fetch_all("https://api.hetzner.cloud/v1/servers", headers)

# Main logic
def main():
    # Fetch Hetzner servers from all projects
    all_servers = []
    for project in HETZNER_PROJECTS:
        project_name = project['project_name']
        token = project['api_token']
        servers = fetch_hetzner_servers(token)
        for server in servers:
            all_servers.append({
                'project': project_name,
                'server_name': server['name'],
                'ip': server['public_net']['ipv4']['ip'],
                'status': server['status'],
                'created': server['created'],
                'server_type': server['server_type']['name'],
                'labels': ",".join([f"{k}={v}" for k, v in server.get("labels", {}).items()]),
                'price_monthly': PRICING.get(server['server_type']['name'], 0.0),
                'traffic_mb': 50  # Placeholder; replace with actual data if available
            })

    # Map IPs to server info
    ip_to_server = {server['ip']: server for server in all_servers}

    # Fetch Cloudflare zones and A records
    zones = fetch_cloudflare_zones(CLOUDFLARE_TOKEN)
    a_records = []
    for zone in zones:
        zone_id = zone['id']
        zone_name = zone['name']
        records = fetch_dns_records(CLOUDFLARE_TOKEN, zone_id)
        for record in records:
            if record['type'] == 'A':
                subdomain = record['name'].replace(f".{zone_name}", "") if record['name'] != zone_name else "@"
                a_records.append({
                    'domain': zone_name,
                    'subdomain': subdomain,
                    'ip': record['content']
                })

    # Map A records to servers and collect statistics
    mapping_by_domain = {}
    unique_domains = set()
    total_a_records = 0
    matched_server_ips = set()

    for record in a_records:
        domain = record['domain']
        ip = record['ip']
        unique_domains.add(domain)
        total_a_records += 1
        if domain not in mapping_by_domain:
            mapping_by_domain[domain] = []
        if ip in ip_to_server:
            server = ip_to_server[ip]
            matched_server_ips.add(ip)
            mapping_item = {
                'subdomain': record['subdomain'],
                'ip': ip,
                'project': server['project'],
                'server_name': server['server_name'],
                'status': server['status'],
                'created': server['created'],
                'server_type': server['server_type'],
                'price_monthly': server['price_monthly'],
                'traffic_mb': server['traffic_mb'],
                'labels': server['labels']
            }
        else:
            mapping_item = {
                'subdomain': record['subdomain'],
                'ip': ip,
                'project': 'N/A',
                'server_name': 'No match',
                'status': 'N/A',
                'created': 'N/A',
                'server_type': 'N/A',
                'price_monthly': 0.0,
                'traffic_mb': 0,
                'labels': 'N/A'
            }
        mapping_by_domain[domain].append(mapping_item)

    # Calculate totals
    total_servers = len(matched_server_ips)
    total_spending = sum(ip_to_server[ip]['price_monthly'] for ip in matched_server_ips)

    # Generate HTML report
    html = """
    <html>
    <head>
        <title>Domain to Server Mapping</title>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            h1, h2 {{ color: #333; }}
            table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
            th, td {{ border: 1px solid black; padding: 8px; text-align: left; }}
            th {{ background-color: #f2f2f2; }}
            .no-match {{ background-color: #ffcccc; }}
        </style>
    </head>
    <body>
    <h1>Domain to Server Mapping</h1>
    <h2>Summary</h2>
    <table>
        <tr><td>Total Domains</td><td>{}</td></tr>
        <tr><td>Total A Records</td><td>{}</td></tr>
        <tr><td>Total Matched Servers</td><td>{}</td></tr>
        <tr><td>Total Monthly Spending (€)</td><td>{:.2f}</td></tr>
    </table>
    <p>Note: 'No match' indicates that the IP address does not correspond to any server in the provided Hetzner projects.</p>
    """.format(len(unique_domains), total_a_records, total_servers, total_spending)

    for domain in sorted(mapping_by_domain.keys()):
        num_records = len(mapping_by_domain[domain])
        html += f"<h2>Domain: {domain} ({num_records} A records)</h2>"
        html += """
        <table>
        <tr>
            <th>Subdomain</th>
            <th>IP</th>
            <th>Project</th>
            <th>Server Name</th>
            <th>Status</th>
            <th>Created</th>
            <th>Server Type</th>
            <th>Price (€/month)</th>
            <th>Traffic (MB)</th>
            <th>Labels</th>
        </tr>
        """
        sorted_items = sorted(mapping_by_domain[domain], key=lambda x: x['subdomain'])
        for item in sorted_items:
            row_class = ' class="no-match"' if item['server_name'] == 'No match' else ''
            created_date = datetime.fromisoformat(item['created'].replace('Z', '+00:00')).strftime('%Y-%m-%d') if item['created'] != 'N/A' else 'N/A'
            price = item['price_monthly'] if item['server_name'] != 'No match' else 'N/A'
            traffic = item['traffic_mb'] if item['server_name'] != 'No match' else 'N/A'
            html += f"<tr{row_class}>"
            html += f"<td>{item['subdomain']}</td>"
            html += f"<td>{item['ip']}</td>"
            html += f"<td>{item['project']}</td>"
            html += f"<td>{item['server_name']}</td>"
            html += f"<td>{item['status']}</td>"
            html += f"<td>{created_date}</td>"
            html += f"<td>{item['server_type']}</td>"
            html += f"<td>{price}</td>"
            html += f"<td>{traffic}</td>"
            html += f"<td>{item['labels']}</td>"
            html += "</tr>"
        html += "</table>"

    html += """
    </body>
    </html>
    """

    # Create reports directory if it doesn’t exist
    os.makedirs('reports', exist_ok=True)

    # Write HTML to file
    html_file = 'reports/mapping.html'
    with open(html_file, 'w') as f:
        f.write(html)

    # Generate PDF from HTML with a timestamped filename
    pdf_file = f'reports/mapping_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
    try:
        pdfkit.from_file(html_file, pdf_file)
        print(f"PDF report generated: {pdf_file}")
    except Exception as e:
        print(f"Error generating PDF: {e}")
        print("HTML report still available at reports/mapping.html")

if __name__ == "__main__":
    main()