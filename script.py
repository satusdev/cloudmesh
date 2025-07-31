import json
import requests
from datetime import datetime
import os
import pdfkit
import time

from prometheus_client import CollectorRegistry, Gauge, Counter, push_to_gateway

# Load configuration
with open('config.json', 'r') as f:
    config = json.load(f)

CLOUDFLARE_TOKEN = os.environ.get('CLOUDFLARE_TOKEN', config['cloudflare']['api_token'])

# Load Hetzner projects from environment variables if present, else from config.json
hetzner_projects_env = []
i = 1
while True:
    token = os.environ.get(f'HETZNER_TOKEN_{i}')
    name = os.environ.get(f'HETZNER_PROJECT_NAME_{i}')
    if token and name:
        hetzner_projects_env.append({'project_name': name, 'api_token': token})
        i += 1
    else:
        break
HETZNER_PROJECTS = hetzner_projects_env if hetzner_projects_env else config['hetzner']

PROMETHEUS_CONFIG = config.get('prometheus', {})
PUSHGATEWAY_URL = os.environ.get('PUSHGATEWAY_URL', PROMETHEUS_CONFIG.get('pushgateway_url'))

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

def fetch_cloudflare_zones(token):
    headers = {"Authorization": f"Bearer {token}"}
    return fetch_all("https://api.cloudflare.com/client/v4/zones", headers)

def fetch_dns_records(token, zone_id):
    headers = {"Authorization": f"Bearer {token}"}
    return fetch_all(f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records", headers)

def fetch_hetzner_servers(token):
    headers = {"Authorization": f"Bearer {token}"}
    return fetch_all("https://api.hetzner.cloud/v1/servers", headers)

def parallel_fetch_hetzner_servers(projects):
    from concurrent.futures import ThreadPoolExecutor
    results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_project = {
            executor.submit(fetch_hetzner_servers, project['api_token']): project
            for project in projects
        }
        for future in future_to_project:
            project = future_to_project[future]
            try:
                servers = future.result()
                for server in servers:
                    results.append((project, server))
            except Exception:
                continue
    return results

def tcp_health_check(ip, port=80, timeout=2):
    import socket
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return 1
    except Exception:
        return 0

def main():
    import cProfile
    import pstats
    profiler = cProfile.Profile()
    profiler.enable()

    registry = CollectorRegistry()
    run_counter = Counter('cloudmesh_script_runs_total', 'Total script runs', registry=registry)
    run_duration = Gauge('cloudmesh_script_run_duration_seconds', 'Script run duration (seconds)', registry=registry)
    domains_gauge = Gauge('cloudmesh_domains_total', 'Total domains processed', registry=registry)
    a_records_gauge = Gauge('cloudmesh_a_records_total', 'Total A records processed', registry=registry)
    matched_servers_gauge = Gauge('cloudmesh_matched_servers_total', 'Total matched servers', registry=registry)
    unmatched_ips_gauge = Gauge('cloudmesh_unmatched_ips_total', 'Total unmatched IPs', registry=registry)
    error_counter = Counter('cloudmesh_script_errors_total', 'Total script errors', registry=registry)

    # New metrics
    server_uptime_gauge = Gauge(
        'cloudmesh_server_uptime_seconds',
        'Server uptime in seconds',
        ['server_name', 'project', 'ip'],
        registry=registry
    )
    dns_ttl_gauge = Gauge(
        'cloudmesh_dns_ttl_seconds',
        'DNS TTL in seconds',
        ['domain', 'subdomain', 'ip'],
        registry=registry
    )
    server_health_gauge = Gauge(
        'cloudmesh_server_health_status',
        'Server health status (1=healthy, 0=unreachable)',
        ['server_name', 'ip'],
        registry=registry
    )

    start_time = time.time()
    error_occurred = False

    try:
        # Gauge for detailed mapping info (for Grafana tables)
        mapping_info_gauge = Gauge(
            'cloudmesh_domain_mapping_info',
            'Domain to server mapping info',
            [
                'domain', 'subdomain', 'ip', 'project', 'server_name', 'status',
                'created', 'server_type', 'price_monthly', 'traffic_mb', 'labels'
            ],
            registry=registry
        )

        # Fetch Hetzner servers from all projects (parallelized)
        all_servers = []
        now = datetime.utcnow()
        hetzner_results = parallel_fetch_hetzner_servers(HETZNER_PROJECTS)
        for project, server in hetzner_results:
            project_name = project['project_name']
            ip = server['public_net']['ipv4']['ip']
            created = server['created']
            # Calculate uptime in seconds if running
            uptime_seconds = 0
            if server['status'] == 'running' and created:
                try:
                    created_dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    uptime_seconds = (now - created_dt).total_seconds()
                except Exception:
                    uptime_seconds = 0
            # Push server uptime metric
            server_uptime_gauge.labels(
                server_name=server['name'],
                project=project_name,
                ip=ip
            ).set(uptime_seconds)
            # Push health check metric (TCP port 80)
            health = tcp_health_check(ip, port=80)
            server_health_gauge.labels(
                server_name=server['name'],
                ip=ip
            ).set(health)
            all_servers.append({
                'project': project_name,
                'server_name': server['name'],
                'ip': ip,
                'status': server['status'],
                'created': created,
                'server_type': server['server_type']['name'],
                'labels': ",".join([f"{k}={v}" for k, v in server.get("labels", {}).items()]),
                'price_monthly': PRICING.get(server['server_type']['name'], 0.0),
                'traffic_mb': 50  # Placeholder; replace with actual data if available
            })

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
                    # Push DNS TTL metric
                    dns_ttl_gauge.labels(
                        domain=zone_name,
                        subdomain=subdomain,
                        ip=record['content']
                    ).set(record.get('ttl', 0))

        mapping_by_domain = {}
        unique_domains = set()
        total_a_records = 0
        matched_server_ips = set()
        unmatched_ips = set()

        # Deduplicate mappings by all label fields
        seen_label_sets = set()
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
                unmatched_ips.add(ip)
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

            # Create a tuple of all label values to deduplicate
            label_tuple = (
                domain,
                mapping_item['subdomain'],
                mapping_item['ip'],
                mapping_item['project'],
                mapping_item['server_name'],
                mapping_item['status'],
                mapping_item['created'],
                mapping_item['server_type'],
                str(mapping_item['price_monthly']),
                str(mapping_item['traffic_mb']),
                mapping_item['labels']
            )
            if label_tuple in seen_label_sets:
                continue
            seen_label_sets.add(label_tuple)

            # Push detailed mapping info as a Prometheus metric for Grafana tables
            mapping_info_gauge.labels(
                domain=domain,
                subdomain=mapping_item['subdomain'],
                ip=mapping_item['ip'],
                project=mapping_item['project'],
                server_name=mapping_item['server_name'],
                status=mapping_item['status'],
                created=mapping_item['created'],
                server_type=mapping_item['server_type'],
                price_monthly=str(mapping_item['price_monthly']),
                traffic_mb=str(mapping_item['traffic_mb']),
                labels=mapping_item['labels']
            ).set(1)

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

        os.makedirs('reports', exist_ok=True)
        html_file = 'reports/mapping.html'
        with open(html_file, 'w') as f:
            f.write(html)

        pdf_file = f'reports/mapping_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        try:
            pdfkit.from_file(html_file, pdf_file)
            print(f"PDF report generated: {pdf_file}")
        except Exception as e:
            print(f"Error generating PDF: {e}")
            print("HTML report still available at reports/mapping.html")

        # Send PDF report to Slack if webhook is set
        slack_webhook = os.environ.get("SLACK_WEBHOOK_URL")
        if slack_webhook:
            try:
                import requests
                with open(pdf_file, "rb") as f:
                    pdf_bytes = f.read()
                response = requests.post(
                    slack_webhook,
                    files={"file": ("mapping.pdf", pdf_bytes, "application/pdf")},
                    data={"initial_comment": "CloudMesh Weekly Report (PDF)", "channels": "#general"}
                )
                print("PDF report sent to Slack, status:", response.status_code)
            except Exception as e:
                print("Failed to send PDF report to Slack:", e)

        # Set Prometheus metrics
        run_counter.inc()
        run_duration.set(time.time() - start_time)
        domains_gauge.set(len(unique_domains))
        a_records_gauge.set(total_a_records)
        matched_servers_gauge.set(total_servers)
        unmatched_ips_gauge.set(len(unmatched_ips))

    except Exception as e:
        error_occurred = True
        error_counter.inc()
        print(f"Script error: {e}")
        raise
    finally:
        # Push metrics to Pushgateway
        try:
            push_to_gateway(PUSHGATEWAY_URL, job='cloudmesh_script', registry=registry)
            print(f"Prometheus metrics pushed to {PUSHGATEWAY_URL}")
        except Exception as e:
            print(f"Error pushing metrics to Pushgateway: {e}")
        profiler.disable()
        with open("reports/profile.txt", "w") as f:
            ps = pstats.Stats(profiler, stream=f)
            ps.sort_stats("cumulative")
            ps.print_stats()

if __name__ == "__main__":
    main()
