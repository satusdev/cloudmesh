import json
import requests
from datetime import datetime
import os
import pdfkit
import time
import pathlib
import socket
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from prometheus_client import CollectorRegistry, Gauge, Counter, push_to_gateway
import cProfile
import pstats

# Load environment variables
load_dotenv()

# Configuration loading
def load_config_json():
    config_path = pathlib.Path('config.json')
    if config_path.exists():
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

# Initialize configuration
def get_cloudflare_token():
    token = os.environ.get('CLOUDFLARE_TOKEN')
    if not token:
        config = load_config_json()
        token = config.get('cloudflare', {}).get('api_token')
    if not token:
        raise RuntimeError("CLOUDFLARE_TOKEN not set in environment or config.json")
    return token

def get_hetzner_projects():
    projects = []
    i = 1
    while True:
        token = os.environ.get(f'HETZNER_TOKEN_{i}')
        name = os.environ.get(f'HETZNER_PROJECT_NAME_{i}')
        if token and name:
            projects.append({'project_name': name, 'api_token': token})
            i += 1
        else:
            break
    if not projects:
        config = load_config_json()
        projects = config.get('hetzner', [])
    if not projects:
        raise RuntimeError("No Hetzner projects found in environment or config.json")
    return projects

def get_pushgateway_url():
    url = os.environ.get('PUSHGATEWAY_URL')
    if not url:
        config = load_config_json()
        url = config.get('prometheus', {}).get('pushgateway_url')
    if not url:
        raise RuntimeError("PUSHGATEWAY_URL not set in environment or config.json")
    return url

# Hetzner server type pricing (in EUR/month, as of 2025)
PRICING = {
    "cx11": 3.29, "cx21": 5.99, "cx31": 11.99, "cx41": 21.99, "cx51": 39.99,
    "cpx11": 4.99, "cpx21": 8.99, "cpx31": 15.99, "cpx41": 29.99, "cpx51": 49.99,
    "ccx11": 19.99, "ccx21": 39.99, "ccx31": 79.99, "ccx41": 149.99, "ccx51": 299.99,
}

# API fetch functions
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
        else:
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

def fetch_hetzner_servers(token, project_name):
    headers = {"Authorization": f"Bearer {token}"}
    return fetch_all("https://api.hetzner.cloud/v1/servers", headers), project_name

def parallel_fetch_hetzner_servers(projects):
    results = []
    with ThreadPoolExecutor(max_workers=len(projects)) as executor:
        future_to_project = {executor.submit(fetch_hetzner_servers, project['api_token'], project['project_name']): project for project in projects}
        for future in future_to_project:
            servers, project_name = future.result()
            for server in servers:
                results.append(({'project_name': project_name}, server))
    return results

def tcp_health_check(ip, port=80, timeout=2):
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return 1  # Success
    except (socket.timeout, socket.error):
        return 0  # Failure

# Report generation
def generate_html_report(mapping_by_domain, unique_domains, total_a_records, matched_server_ips):
    total_servers = len(matched_server_ips)
    total_spending = sum(ip_to_server['price_monthly'] for ip, ip_to_server in mapping_by_domain.items() if ip in matched_server_ips)

    html = f"""
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
        <tr><td>Total Domains</td><td>{len(unique_domains)}</td></tr>
        <tr><td>Total A Records</td><td>{total_a_records}</td></tr>
        <tr><td>Total Matched Servers</td><td>{total_servers}</td></tr>
        <tr><td>Total Monthly Spending (€)</td><td>{total_spending:.2f}</td></tr>
    </table>
    <p>Note: 'No match' indicates that the IP address does not correspond to any server in the provided Hetzner projects.</p>
    """

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

    html += "</body></html>"
    return html

def save_report(html, timestamp):
    os.makedirs('reports', exist_ok=True)
    html_file = 'reports/mapping.html'
    pdf_file = f'reports/mapping_{timestamp}.pdf'

    with open(html_file, 'w') as f:
        f.write(html)

    try:
        pdfkit.from_file(html_file, pdf_file)
        print(f"PDF report generated: {pdf_file}")
    except Exception as e:
        print(f"Error generating PDF: {e}")
        print("HTML report still available at reports/mapping.html")

    return pdf_file

# Enhanced Prometheus metrics setup
def setup_prometheus_metrics():
    registry = CollectorRegistry()
    metrics = {
        'run_counter': Counter('cloudmesh_script_runs_total', 'Total script runs', registry=registry),
        'run_duration': Gauge('cloudmesh_script_run_duration_seconds', 'Script run duration (seconds)', registry=registry),
        'domains': Gauge('cloudmesh_domains_total', 'Total domains processed', registry=registry),
        'a_records': Gauge('cloudmesh_a_records_total', 'Total A records processed', registry=registry),
        'matched_servers': Gauge('cloudmesh_matched_servers_total', 'Total matched servers', registry=registry),
        'unmatched_ips': Gauge('cloudmesh_unmatched_ips_total', 'Total unmatched IPs', registry=registry),
        'error_counter': Counter('cloudmesh_script_errors_total', 'Total script errors', registry=registry),
        'server_uptime': Gauge(
            'cloudmesh_server_uptime_seconds',
            'Server uptime in seconds',
            ['server_name', 'project', 'ip'],
            registry=registry
        ),
        'dns_ttl': Gauge(
            'cloudmesh_dns_ttl_seconds',
            'DNS TTL in seconds',
            ['domain', 'subdomain', 'ip'],
            registry=registry
        ),
        'server_health': Gauge(
            'cloudmesh_server_health_status',
            'Server health status (1=healthy, 0=unreachable)',
            ['server_name', 'ip'],
            registry=registry
        ),
        # Enhanced metrics for better dashboard
        'domain_summary': Gauge(
            'cloudmesh_domain_summary',
            'Domain summary with server counts and costs',
            ['domain', 'matched_servers', 'total_records', 'total_cost'],
            registry=registry
        ),
        'mapping_info_clean': Gauge(
            'cloudmesh_domain_mapping_info_clean',
            'Clean domain to server mapping info (deduplicated)',
            [
                'domain', 'subdomain', 'ip', 'project', 'server_name', 'status',
                'created', 'server_type', 'price_monthly', 'traffic_mb', 'labels'
            ],
            registry=registry
        )
    }
    return registry, metrics

# Enhanced processing logic with better deduplication
def process_servers_and_domains(cloudflare_token, hetzner_projects, metrics):
    now = datetime.utcnow()
    all_servers = []
    hetzner_results = parallel_fetch_hetzner_servers(hetzner_projects)

    for project, server in hetzner_results:
        project_name = project['project_name']
        ip = server['public_net']['ipv4']['ip']
        created = server['created']
        uptime_seconds = 0
        if server['status'] == 'running' and created:
            try:
                created_dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                uptime_seconds = (now - created_dt).total_seconds()
            except Exception:
                uptime_seconds = 0
        metrics['server_uptime'].labels(
            server_name=server['name'],
            project=project_name,
            ip=ip
        ).set(uptime_seconds)
        health = tcp_health_check(ip, port=80)
        metrics['server_health'].labels(
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
            'traffic_mb': 50
        })

    ip_to_server = {server['ip']: server for server in all_servers}
    zones = fetch_cloudflare_zones(cloudflare_token)
    a_records = []
    for zone in zones:
        zone_id = zone['id']
        zone_name = zone['name']
        records = fetch_dns_records(cloudflare_token, zone_id)
        for record in records:
            if record['type'] == 'A':
                subdomain = record['name'].replace(f".{zone_name}", "") if record['name'] != zone_name else "@"
                a_records.append({
                    'domain': zone_name,
                    'subdomain': subdomain,
                    'ip': record['content']
                })
                metrics['dns_ttl'].labels(
                    domain=zone_name,
                    subdomain=subdomain,
                    ip=record['content']
                ).set(record.get('ttl', 0))

    mapping_by_domain = {}
    unique_domains = set()
    total_a_records = 0
    matched_server_ips = set()
    unmatched_ips = set()

    # Enhanced deduplication using dictionary
    unique_mappings = {}
    domain_stats = {}

    for record in a_records:
        domain = record['domain']
        ip = record['ip']
        unique_domains.add(domain)
        total_a_records += 1
        if domain not in mapping_by_domain:
            mapping_by_domain[domain] = []
            domain_stats[domain] = {'matched': 0, 'total': 0, 'cost': 0}

        # Create unique key for deduplication
        unique_key = f"{domain}:{record['subdomain']}:{ip}"
        domain_stats[domain]['total'] += 1

        if ip in ip_to_server:
            server = ip_to_server[ip]
            matched_server_ips.add(ip)
            domain_stats[domain]['matched'] += 1
            domain_stats[domain]['cost'] += server['price_monthly']

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

        # Only add if we haven't seen this exact mapping before
        if unique_key not in unique_mappings:
            unique_mappings[unique_key] = mapping_item
            mapping_by_domain[domain].append(mapping_item)

    # Push domain summary metrics
    for domain, stats in domain_stats.items():
        metrics['domain_summary'].labels(
            domain=domain,
            matched_servers=str(stats['matched']),
            total_records=str(stats['total']),
            total_cost=str(round(stats['cost'], 2))
        ).set(1)

    # Push deduplicated mapping metrics
    for unique_key, mapping_item in unique_mappings.items():
        domain = unique_key.split(':')[0]

        # Only push for valid entries to reduce noise
        metrics['mapping_info_clean'].labels(
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

    return mapping_by_domain, unique_domains, total_a_records, matched_server_ips, unmatched_ips

# Slack integration functions
def send_message_to_slack(token, channel_id, text):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    data = {
        "channel": channel_id,
        "text": text
    }
    response = requests.post('https://slack.com/api/chat.postMessage', headers=headers, json=data)
    response_json = response.json()

    if not response_json['ok']:
        print(f"Error in chat.postMessage: {response_json['error']}")
        return response_json

    return response_json

def upload_to_slack(file_path, token, channel_id, initial_comment):
    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)

    headers = {
        'Authorization': f'Bearer {token}',
    }
    data = {
        "filename": filename,
        "length": file_size
    }
    response = requests.post('https://slack.com/api/files.getUploadURLExternal', headers=headers, data=data)
    response_json = response.json()

    if not response_json['ok']:
        print(f"Error in getUploadURLExternal: {response_json['error']}")
        return response_json

    upload_url = response_json['upload_url']
    file_id = response_json['file_id']

    with open(file_path, 'rb') as file_content:
        files = {'file': (filename, file_content, 'application/pdf')}
        upload_response = requests.post(upload_url, files=files)
        if upload_response.status_code != 200:
            print(f"Error uploading file: {upload_response.status_code}")
            print(upload_response.text)
            return {"ok": False, "error": "upload_failed"}

    headers['Content-Type'] = 'application/json'
    data = {
        "files": [{"id": file_id, "title": filename}],
        "channel_id": channel_id,
        "initial_comment": initial_comment
    }
    complete_response = requests.post(
        'https://slack.com/api/files.completeUploadExternal',
        headers=headers,
        json=data
    )

    try:
        complete_response_json = complete_response.json()
    except ValueError:
        print(f"Error in completeUploadExternal: Unable to decode JSON response")
        print(complete_response.text)
        return {"ok": False, "error": "json_decode_failed"}

    if not complete_response_json['ok']:
        print(f"Error in completeUploadExternal: {complete_response_json['error']}")

    return complete_response_json

# Main function
def main():
    profiler = cProfile.Profile()
    profiler.enable()

    registry, metrics = setup_prometheus_metrics()
    start_time = time.time()
    error_occurred = False

    try:
        cloudflare_token = get_cloudflare_token()
        hetzner_projects = get_hetzner_projects()
        pushgateway_url = get_pushgateway_url()

        mapping_by_domain, unique_domains, total_a_records, matched_server_ips, unmatched_ips = process_servers_and_domains(
            cloudflare_token, hetzner_projects, metrics
        )

        html = generate_html_report(mapping_by_domain, unique_domains, total_a_records, matched_server_ips)
        pdf_file = save_report(html, datetime.now().strftime("%Y%m%d_%H%M%S"))

        # slack_bot_token = os.environ.get("SLACK_BOT_TOKEN")
        # slack_channel_id = os.environ.get("SLACK_CHANNEL_ID")
        # if slack_bot_token and slack_channel_id:
        #     try:
        #         initial_comment = "CloudMesh Weekly Report - Server and Cloudflare monitoring (PDF)"
        #         upload_result = upload_to_slack(pdf_file, slack_bot_token, slack_channel_id, initial_comment)
        #         if upload_result.get("ok"):
        #             print("PDF report uploaded to Slack successfully.")
        #             file_name = os.path.basename(pdf_file)
        #             send_message_to_slack(
        #                 slack_bot_token,
        #                 slack_channel_id,
        #                 f"CloudMesh Weekly Report (PDF) uploaded: {file_name}"
        #             )
        #         else:
        #             print(f"Slack upload returned an error: {upload_result.get('error')}")
        #     except Exception as e:
        #         print(f"Error uploading to Slack: {e}")

        metrics['domains'].set(len(unique_domains))
        metrics['a_records'].set(total_a_records)
        metrics['matched_servers'].set(len(matched_server_ips))
        metrics['unmatched_ips'].set(len(unmatched_ips))
        print(f"Processing complete. {len(unique_domains)} domains, {total_a_records} A records, {len(matched_server_ips)} matched servers.")

    except Exception as e:
        error_occurred = True
        print(f"Error during processing: {e}")
        metrics['error_counter'].inc()
        raise

    finally:
        duration = time.time() - start_time
        metrics['run_duration'].set(duration)
        metrics['run_counter'].inc()

        try:
            push_to_gateway(pushgateway_url, job='cloudmesh', registry=registry)
            print("Metrics pushed to Prometheus successfully.")
        except Exception as e:
            print(f"Error pushing metrics to Prometheus: {e}")

    profiler.disable()
    profiler_stats = pstats.Stats(profiler)
    profiler_stats.sort_stats('cumulative')
    print("\n--- Performance Profile ---")
    profiler_stats.print_stats(10)

if __name__ == "__main__":
    main()
