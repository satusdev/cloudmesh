from concurrent.futures import ThreadPoolExecutor
from src.api.cloudflare import fetch_all

# Hetzner resource type pricing (in EUR/month)
PRICING = {
    # Virtual Servers (Intel/AMD Shared/Dedicated)
    "cx11": 3.29, "cx21": 5.99, "cx31": 11.99, "cx41": 21.99, "cx51": 39.99,
    "cx22": 5.30, "cx32": 10.90, "cx42": 20.90, "cx52": 37.90,
    "cpx11": 4.99, "cpx21": 8.99, "cpx31": 15.99, "cpx41": 29.99, "cpx51": 49.99,
    "ccx11": 19.99, "ccx21": 39.99, "ccx31": 79.99, "ccx41": 149.99, "ccx51": 299.99,
    
    # Load Balancers
    "lb11": 5.90, "lb21": 11.90, "lb31": 29.90,
    
    # Floating IPs (Flat cost per address)
    "floating_ip": 1.00
}

def fetch_hetzner_project_resources(token, project_name):
    headers = {"Authorization": f"Bearer {token}"}
    servers = fetch_all("https://api.hetzner.cloud/v1/servers", headers, key="servers")
    load_balancers = fetch_all("https://api.hetzner.cloud/v1/load_balancers", headers, key="load_balancers")
    floating_ips = fetch_all("https://api.hetzner.cloud/v1/floating_ips", headers, key="floating_ips")
    return {
        "project_name": project_name,
        "servers": servers,
        "load_balancers": load_balancers,
        "floating_ips": floating_ips
    }

def parallel_fetch_hetzner_resources(projects):
    results = []
    if not projects:
        return results
    with ThreadPoolExecutor(max_workers=len(projects)) as executor:
        future_to_project = {
            executor.submit(fetch_hetzner_project_resources, project['api_token'], project['project_name']): project 
            for project in projects
        }
        for future in future_to_project:
            res = future.result()
            results.append(res)
    return results

def fetch_dynamic_pricing(token):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        server_types = fetch_all("https://api.hetzner.cloud/v1/server_types", headers, key="server_types")
    except Exception as e:
        print(f"Warning: Failed to fetch server types pricing: {e}")
        server_types = []

    try:
        lb_types = fetch_all("https://api.hetzner.cloud/v1/load_balancer_types", headers, key="load_balancer_types")
    except Exception as e:
        print(f"Warning: Failed to fetch load balancer types pricing: {e}")
        lb_types = []

    # Build maps
    server_prices = {}
    for st in server_types:
        name = st.get('name')
        prices = {}
        for p in st.get('prices', []):
            loc = p.get('location')
            try:
                prices[loc] = float(p.get('price_monthly', {}).get('net', 0.0))
            except (ValueError, TypeError, KeyError):
                pass
        server_prices[name] = prices

    lb_prices = {}
    for lbt in lb_types:
        name = lbt.get('name')
        prices = {}
        for p in lbt.get('prices', []):
            loc = p.get('location')
            try:
                prices[loc] = float(p.get('price_monthly', {}).get('net', 0.0))
            except (ValueError, TypeError, KeyError):
                pass
        lb_prices[name] = prices

    return {
        "server": server_prices,
        "load_balancer": lb_prices
    }

