import json
import os
import socket
import time
import glob
import whois
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from src.api.cloudflare import fetch_cloudflare_zones, fetch_dns_records
from src.api.hetzner import parallel_fetch_hetzner_resources, PRICING, fetch_dynamic_pricing

# WHOIS cache persistent path
CACHE_PATH = os.path.join('reports', 'whois_cache.json')

def load_whois_cache():
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load WHOIS cache from {CACHE_PATH}: {e}")
    return {}

def save_whois_cache(cache):
    os.makedirs('reports', exist_ok=True)
    try:
        with open(CACHE_PATH, 'w', encoding='utf-8') as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
        print(f"WHOIS cache persisted to: {CACHE_PATH}")
    except Exception as e:
        print(f"Warning: Failed to save WHOIS cache to {CACHE_PATH}: {e}")

# Load the cache on initialization
whois_cache = load_whois_cache()

def tcp_health_check(ip, port=80, timeout=2):
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return 1  # Success
    except (socket.timeout, socket.error):
        return 0  # Failure

def get_domain_expiry(domain):
    if domain in whois_cache:
        val = whois_cache[domain]
        if isinstance(val, dict) and val.get("status") == "error":
            ts = val.get("timestamp", 0)
            if time.time() - ts < 86400:
                return "Error / N/A"
            # Expired error entry, delete to allow retry
            del whois_cache[domain]
        else:
            return val

    try:
        w = whois.whois(domain)
        expiry = w.expiration_date

        # Handle different formats (datetime, list, string)
        if isinstance(expiry, list):
            expiry = expiry[0] if expiry else None
        if isinstance(expiry, str):
            try:
                expiry = datetime.strptime(expiry, "%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                try:
                    expiry = datetime.strptime(expiry.split()[0], "%Y-%m-%d")
                except ValueError:
                    expiry = None

        if isinstance(expiry, datetime):
            expiry_str = expiry.strftime("%Y-%m-%d")
        else:
            expiry_str = "N/A"

        whois_cache[domain] = expiry_str
        time.sleep(1.2)  # Rate limiting to avoid WHOIS bans
        return expiry_str

    except Exception as e:
        print(f"WHOIS error for {domain}: {e}")
        whois_cache[domain] = {
            "status": "error",
            "timestamp": time.time(),
            "reason": str(e)
        }
        return "Error / N/A"

def get_days_to_expiry(expiry_str):
    if expiry_str in ("N/A", "Error / N/A"):
        return None
    try:
        expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d")
        today = datetime.now().date()
        delta = expiry_date.date() - today
        return delta.days
    except Exception:
        return None

def get_latest_snapshot():
    snapshot_files = glob.glob(os.path.join('reports', 'snapshots', 'snapshot_*.json'))
    if not snapshot_files:
        return None
    snapshot_files.sort()
    latest_file = snapshot_files[-1]
    try:
        with open(latest_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Failed to load latest snapshot from {latest_file}: {e}")
        return None

# Helper functions for Latency checking
def check_dns_latency(hostname):
    start = time.time()
    try:
        socket.gethostbyname(hostname)
        return round((time.time() - start) * 1000, 2)
    except Exception:
        return -1.0

def check_connection_latency(ip, port=80, timeout=1.0):
    start = time.time()
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return round((time.time() - start) * 1000, 2)
    except Exception:
        if port == 80:
            start2 = time.time()
            try:
                with socket.create_connection((ip, 443), timeout=timeout):
                    return round((time.time() - start2) * 1000, 2)
            except Exception:
                pass
        return -1.0

# Helper functions for Port Auditing
def check_single_port(ip, port, timeout=1.0):
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return port, True
    except Exception:
        return port, False

def scan_ip_ports(ip, timeout=1.0):
    ports = [22, 80, 443, 3389]
    status = {}
    with ThreadPoolExecutor(max_workers=len(ports)) as executor:
        futures = {executor.submit(check_single_port, ip, port, timeout): port for port in ports}
        for future in futures:
            port, open_state = future.result()
            status[str(port)] = open_state
    return status

def run_port_audit(ips, timeout=1.0):
    ip_port_status = {}
    if not ips:
        return ip_port_status
    with ThreadPoolExecutor(max_workers=min(20, len(ips))) as executor:
        future_to_ip = {executor.submit(scan_ip_ports, ip, timeout): ip for ip in ips}
        for future in future_to_ip:
            ip = future_to_ip[future]
            try:
                ip_port_status[ip] = future.result()
            except Exception:
                ip_port_status[ip] = {"22": False, "80": False, "443": False, "3389": False}
    return ip_port_status

# Helper functions for Recommendations
def generate_recommendations(all_resources, matched_ips, mapping_by_domain):
    recommendations = []
    total_potential_savings = 0.0
    
    # 1. Unmapped Resources (Stale VMs, LBs, FIPs)
    for res in all_resources:
        if res['ip'] not in matched_ips:
            res_type = res['resource_type']
            name = res['server_name']
            cost = res['price_monthly']
            
            if res_type == 'server':
                description = f"Virtual Server '{name}' has no active Cloudflare DNS records pointing to its IP ({res['ip']})."
                suggestion = "Consider shutting down or decommissioning this server to save costs."
                severity = "high"
            elif res_type == 'load_balancer':
                description = f"Load Balancer '{name}' has no active Cloudflare DNS records pointing to its IP ({res['ip']})."
                suggestion = "Consider deleting this load balancer if it is no longer routing traffic."
                severity = "medium"
            else: # floating_ip
                description = f"Floating IP '{name}' is not targeted by any active Cloudflare DNS records."
                suggestion = "Consider releasing this Floating IP if it is unused."
                severity = "low"
                
            recommendations.append({
                "type": "stale_resource",
                "severity": severity,
                "resource_name": name,
                "resource_type": res_type,
                "ip": res['ip'],
                "project": res['project'],
                "cost_impact": cost,
                "description": description,
                "suggestion": suggestion
            })
            total_potential_savings += cost
            
    # 2. Dangling DNS Records
    for domain, mappings in mapping_by_domain.items():
        for item in mappings:
            if item['server_name'] == 'No match':
                sub = item['subdomain']
                hostname = domain if sub == '@' else f"{sub}.{domain}"
                recommendations.append({
                    "type": "dangling_dns",
                    "severity": "medium",
                    "resource_name": hostname,
                    "resource_type": "dns_record",
                    "ip": item['ip'],
                    "project": "N/A",
                    "cost_impact": 0.0,
                    "description": f"DNS record '{hostname}' points to IP {item['ip']}, which does not match any active Hetzner resource.",
                    "suggestion": "Verify if the target IP is correct, or delete the DNS record to prevent subdomain takeover hijacking."
                })
                
    return recommendations, round(total_potential_savings, 2)

def fetch_records_for_zone(token, zone_id, zone_name):
    try:
        return zone_name, fetch_dns_records(token, zone_id)
    except Exception as e:
        print(f"Error fetching DNS records for zone {zone_name}: {e}")
        return zone_name, []

def process_servers_and_domains(cloudflare_token, hetzner_projects, metrics):
    now = datetime.utcnow()
    all_resources = []
    
    # 1. Fetch dynamic pricing maps using first project's token
    pricing_maps = None
    if hetzner_projects:
        try:
            first_token = hetzner_projects[0]['api_token']
            pricing_maps = fetch_dynamic_pricing(first_token)
            print("Successfully loaded dynamic Hetzner pricing.")
        except Exception as e:
            print(f"Warning: Failed to fetch dynamic Hetzner pricing maps: {e}")
            pricing_maps = None

    hetzner_results = parallel_fetch_hetzner_resources(hetzner_projects)
    
    for project_res in hetzner_results:
        project_name = project_res['project_name']
        
        # Build server ID to name map for Floating IP lookup
        server_id_to_name = {s['id']: s['name'] for s in project_res.get('servers', [])}
        
        # 1. Process Virtual Servers
        for server in project_res.get('servers', []):
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
            
            # Label sanitization
            sanitized_labels_dict = {}
            for k, v in server.get("labels", {}).items():
                k_lower = k.lower()
                if any(sec in k_lower for sec in ['secret', 'token', 'password', 'key', 'auth', 'pass']):
                    v = '********'
                sanitized_labels_dict[k] = v
            labels_str = ",".join([f"{k}={v}" for k, v in sanitized_labels_dict.items()])
            
            # Dynamic pricing lookup
            st_name = server['server_type']['name']
            loc_name = server.get('datacenter', {}).get('location', {}).get('name', 'N/A')
            dc_name = server.get('datacenter', {}).get('name', 'N/A')
            
            price = 0.0
            if pricing_maps and st_name in pricing_maps.get('server', {}):
                prices_by_loc = pricing_maps['server'][st_name]
                if loc_name in prices_by_loc:
                    price = prices_by_loc[loc_name]
                elif prices_by_loc:
                    price = next(iter(prices_by_loc.values()))
            
            if price == 0.0:
                price = PRICING.get(st_name, 0.0)

            cores = server.get('server_type', {}).get('cores', 0)
            memory = server.get('server_type', {}).get('memory', 0.0)
            disk = server.get('server_type', {}).get('disk', 0)
            image_desc = server.get('image', {}).get('description', 'N/A') if server.get('image') else 'N/A'
            protection_delete = server.get('protection', {}).get('delete', False)
            locked = server.get('locked', False)

            all_resources.append({
                'resource_type': 'server',
                'project': project_name,
                'server_name': server['name'],
                'ip': ip,
                'status': server['status'],
                'created': created,
                'server_type': st_name,
                'labels': labels_str,
                'price_monthly': price,
                'traffic_mb': 50,
                # Enriched fields
                'cores': cores,
                'memory': memory,
                'disk': disk,
                'location': loc_name,
                'datacenter': dc_name,
                'image': image_desc,
                'protection_delete': protection_delete,
                'locked': locked
            })
            
        # 2. Process Load Balancers
        for lb in project_res.get('load_balancers', []):
            ip = lb.get('public_net', {}).get('ipv4', {}).get('ip')
            if not ip:
                continue
            created = lb['created']
            
            sanitized_labels_dict = {}
            for k, v in lb.get("labels", {}).items():
                k_lower = k.lower()
                if any(sec in k_lower for sec in ['secret', 'token', 'password', 'key', 'auth', 'pass']):
                    v = '********'
                sanitized_labels_dict[k] = v
            labels_str = ",".join([f"{k}={v}" for k, v in sanitized_labels_dict.items()])
            
            lb_type = lb['load_balancer_type']['name']
            loc_name = lb.get('location', {}).get('name', 'N/A')
            
            price = 0.0
            if pricing_maps and lb_type in pricing_maps.get('load_balancer', {}):
                prices_by_loc = pricing_maps['load_balancer'][lb_type]
                if loc_name in prices_by_loc:
                    price = prices_by_loc[loc_name]
                elif prices_by_loc:
                    price = next(iter(prices_by_loc.values()))
                    
            if price == 0.0:
                price = PRICING.get(lb_type, 0.0)

            services_count = len(lb.get('services', []))
            targets_count = len(lb.get('targets', []))
            algorithm = lb.get('algorithm', {}).get('type', 'round_robin')

            all_resources.append({
                'resource_type': 'load_balancer',
                'project': project_name,
                'server_name': lb['name'],
                'ip': ip,
                'status': algorithm,
                'created': created,
                'server_type': lb_type,
                'labels': labels_str,
                'price_monthly': price,
                'traffic_mb': 0,
                # Enriched fields
                'location': loc_name,
                'services_count': services_count,
                'targets_count': targets_count,
                'algorithm': algorithm
            })
            
        # 3. Process Floating IPs
        for fip in project_res.get('floating_ips', []):
            ip = fip['ip']
            created = fip['created']
            
            sanitized_labels_dict = {}
            for k, v in fip.get("labels", {}).items():
                k_lower = k.lower()
                if any(sec in k_lower for sec in ['secret', 'token', 'password', 'key', 'auth', 'pass']):
                    v = '********'
                sanitized_labels_dict[k] = v
            labels_str = ",".join([f"{k}={v}" for k, v in sanitized_labels_dict.items()])
            
            fip_type = fip.get('type', 'ipv4')
            loc_name = fip.get('home_location', {}).get('name', 'N/A')
            
            # Resolve assigned server name
            assigned_server_id = fip.get('server')
            assigned_server_name = server_id_to_name.get(assigned_server_id) if assigned_server_id else None

            # Dynamic price
            if fip_type == 'ipv4':
                price = PRICING.get('floating_ip_ipv4', 3.00)
            else:
                price = PRICING.get('floating_ip_ipv6', 1.00)

            all_resources.append({
                'resource_type': 'floating_ip',
                'project': project_name,
                'server_name': fip.get('description') or f"Floating IP {ip}",
                'ip': ip,
                'status': 'assigned' if assigned_server_id else 'unassigned',
                'created': created,
                'server_type': fip_type,
                'labels': labels_str,
                'price_monthly': price,
                'traffic_mb': 0,
                # Enriched fields
                'location': loc_name,
                'fip_type': fip_type,
                'assigned_server': assigned_server_name
            })

    ip_to_server = {res['ip']: res for res in all_resources}
    
    zones = fetch_cloudflare_zones(cloudflare_token)
    zone_results = []
    if zones:
        with ThreadPoolExecutor(max_workers=min(10, len(zones))) as executor:
            futures = {
                executor.submit(fetch_records_for_zone, cloudflare_token, zone['id'], zone['name']): zone
                for zone in zones
            }
            for future in futures:
                zone_name, records = future.result()
                zone_results.append((zone_name, records))

    a_records = []
    for zone_name, records in zone_results:
        for record in records:
            if record['type'] in ('A', 'AAAA'):
                subdomain = record['name'].replace(f".{zone_name}", "") if record['name'] != zone_name else "@"
                a_records.append({
                    'domain': zone_name,
                    'subdomain': subdomain,
                    'ip': record['content'],
                    'dns_type': record['type'],
                    'proxied': record.get('proxied', False)
                })
                metrics['dns_ttl'].labels(
                    domain=zone_name,
                    subdomain=subdomain,
                    ip=record['content']
                ).set(record.get('ttl', 0))

    # Parallel resolve record latencies to avoid blocking
    def enrich_record_telemetry(record_item):
        domain = record_item['domain']
        ip = record_item['ip']
        subdomain = record_item['subdomain']
        hostname = domain if subdomain == '@' else f"{subdomain}.{domain}"
        
        dns_latency = check_dns_latency(hostname)
        http_latency = check_connection_latency(ip)
        return {
            **record_item,
            "dns_latency": dns_latency,
            "http_latency": http_latency
        }
        
    enriched_records = []
    if a_records:
        with ThreadPoolExecutor(max_workers=min(25, len(a_records))) as executor:
            enriched_records = list(executor.map(enrich_record_telemetry, a_records))

    # Pre-warm WHOIS cache in parallel
    unique_domains = {record['domain'] for record in enriched_records}
    if unique_domains:
        print(f"Pre-warming WHOIS cache for {len(unique_domains)} domains in parallel...")
        with ThreadPoolExecutor(max_workers=min(5, len(unique_domains))) as executor:
            list(executor.map(get_domain_expiry, unique_domains))

    mapping_by_domain = {}
    total_a_records = 0
    matched_server_ips = set()
    unmatched_ips = set()

    unique_mappings = {}
    domain_stats = {}

    for record in enriched_records:
        domain = record['domain']
        ip = record['ip']
        unique_domains.add(domain)
        total_a_records += 1
        if domain not in mapping_by_domain:
            mapping_by_domain[domain] = []
            domain_stats[domain] = {'matched': 0, 'total': 0, 'cost': 0}

        unique_key = f"{domain}:{record['subdomain']}:{ip}"
        domain_stats[domain]['total'] += 1

        if ip in ip_to_server:
            resource = ip_to_server[ip]
            matched_server_ips.add(ip)
            domain_stats[domain]['matched'] += 1
            domain_stats[domain]['cost'] += resource['price_monthly']

            mapping_item = {
                'subdomain': record['subdomain'],
                'ip': ip,
                'project': resource['project'],
                'server_name': resource['server_name'],
                'status': resource['status'],
                'created': resource['created'],
                'server_type': resource['server_type'],
                'price_monthly': resource['price_monthly'],
                'traffic_mb': resource['traffic_mb'],
                'labels': resource['labels'],
                'dns_type': record['dns_type'],
                'proxied': record['proxied'],
                'resource_type': resource['resource_type'],
                'dns_latency': record['dns_latency'],
                'http_latency': record['http_latency']
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
                'labels': 'N/A',
                'dns_type': record['dns_type'],
                'proxied': record['proxied'],
                'resource_type': 'unknown',
                'dns_latency': record['dns_latency'],
                'http_latency': record['http_latency']
            }

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

    # 1. Reverse mapping validation (detect Hetzner resources with no Cloudflare records)
    unmapped_servers = []
    for ip, resource in ip_to_server.items():
        if ip not in matched_server_ips:
            unmapped_servers.append(resource)

    # 2. Historical comparison diff engine
    latest_snapshot = get_latest_snapshot()
    diff = {
        "dns": {"added": [], "removed": [], "modified": []},
        "servers": {"added": [], "removed": [], "status_changed": []}
    }

    if latest_snapshot:
        prev_dns = {}
        for domain, items in latest_snapshot.get("mapping_by_domain", {}).items():
            for item in items:
                key = f"{item['subdomain']}.{domain}" if item['subdomain'] != '@' else domain
                prev_dns[key] = item

        curr_dns = {}
        for domain, items in mapping_by_domain.items():
            for item in items:
                key = f"{item['subdomain']}.{domain}" if item['subdomain'] != '@' else domain
                curr_dns[key] = item

        # Added / modified DNS
        for key, curr_item in curr_dns.items():
            if key not in prev_dns:
                diff["dns"]["added"].append(key)
            else:
                prev_item = prev_dns[key]
                if curr_item["ip"] != prev_item["ip"]:
                    diff["dns"]["modified"].append({
                        "subdomain": key,
                        "old_ip": prev_item["ip"],
                        "new_ip": curr_item["ip"]
                    })

        # Removed DNS
        for key in prev_dns:
            if key not in curr_dns:
                diff["dns"]["removed"].append(key)

        # Compare Hetzner resources
        prev_servers = {s["server_name"]: s for s in latest_snapshot.get("servers", [])}
        curr_servers = {s["server_name"]: s for s in all_resources}

        # Added / status changed
        for name, curr_s in curr_servers.items():
            if name not in prev_servers:
                diff["servers"]["added"].append(name)
            else:
                prev_s = prev_servers[name]
                if curr_s["status"] != prev_s["status"]:
                    diff["servers"]["status_changed"].append({
                        "server_name": name,
                        "old_status": prev_s["status"],
                        "new_status": curr_s["status"]
                    })

        # Removed
        for name in prev_servers:
            if name not in curr_servers:
                diff["servers"]["removed"].append(name)

    # 3. Port Audit Execution
    unique_resolved_ips = list(unmatched_ips.union(matched_server_ips))
    port_audit_results = run_port_audit(unique_resolved_ips)

    # 4. Generate Optimization Recommendations
    recommendations, total_potential_savings = generate_recommendations(all_resources, matched_server_ips, mapping_by_domain)

    # Persist the updated WHOIS cache
    save_whois_cache(whois_cache)

    return mapping_by_domain, unique_domains, total_a_records, matched_server_ips, unmatched_ips, ip_to_server, unmapped_servers, diff, recommendations, port_audit_results
