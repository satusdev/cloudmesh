import os
import requests
import boto3
from botocore.client import Config
from concurrent.futures import ThreadPoolExecutor
from src.api.cloudflare import fetch_all

# Hetzner resource type pricing (in EUR/month) - Static fallbacks
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
    
    try:
        volumes = fetch_all("https://api.hetzner.cloud/v1/volumes", headers, key="volumes")
    except Exception as e:
        print(f"Warning: Failed to fetch volumes for project {project_name}: {e}")
        volumes = []

    try:
        primary_ips = fetch_all("https://api.hetzner.cloud/v1/primary_ips", headers, key="primary_ips")
    except Exception as e:
        print(f"Warning: Failed to fetch primary IPs for project {project_name}: {e}")
        primary_ips = []

    return {
        "project_name": project_name,
        "servers": servers,
        "load_balancers": load_balancers,
        "floating_ips": floating_ips,
        "volumes": volumes,
        "primary_ips": primary_ips
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
        # GET /v1/pricing returns the unified catalog
        response = requests.get("https://api.hetzner.cloud/v1/pricing", headers=headers, timeout=15)
        if response.status_code != 200:
            raise Exception(f"API returned status {response.status_code}")
        pricing_data = response.json().get("pricing", {})
    except Exception as e:
        print(f"Warning: Failed to fetch unified pricing catalog: {e}")
        pricing_data = {}

    # Build server prices map
    server_prices = {}
    for st in pricing_data.get('server_types', []):
        name = st.get('name')
        prices = {}
        for p in st.get('prices', []):
            loc = p.get('location')
            try:
                prices[loc] = float(p.get('price_monthly', {}).get('net', 0.0))
            except (ValueError, TypeError, KeyError):
                pass
        server_prices[name] = prices

    # Build load balancer prices map
    lb_prices = {}
    for lbt in pricing_data.get('load_balancer_types', []):
        name = lbt.get('name')
        prices = {}
        for p in lbt.get('prices', []):
            loc = p.get('location')
            try:
                prices[loc] = float(p.get('price_monthly', {}).get('net', 0.0))
            except (ValueError, TypeError, KeyError):
                pass
        lb_prices[name] = prices

    # Build floating IP prices map
    fip_prices = {"ipv4": {}, "ipv6": {}}
    for fip_type_data in pricing_data.get('floating_ips', []):
        t = fip_type_data.get('type')
        if t in fip_prices:
            for p in fip_type_data.get('prices', []):
                loc = p.get('location')
                try:
                    fip_prices[t][loc] = float(p.get('price_monthly', {}).get('net', 3.00 if t == 'ipv4' else 1.00))
                except (ValueError, TypeError, KeyError):
                    pass

    # Build primary IP prices map
    pip_prices = {"ipv4": {}, "ipv6": {}}
    for pip_type_data in pricing_data.get('primary_ips', []):
        t = pip_type_data.get('type')
        if t in pip_prices:
            for p in pip_type_data.get('prices', []):
                loc = p.get('location')
                try:
                    pip_prices[t][loc] = float(p.get('price_monthly', {}).get('net', 0.50 if t == 'ipv4' else 0.0))
                except (ValueError, TypeError, KeyError):
                    pass

    # Extract volume price per GB month net
    volume_per_gb_net = 0.044  # Default fallback
    try:
        val = pricing_data.get('volume', {}).get('price_per_gb_month', {}).get('net')
        if val is not None:
            volume_per_gb_net = float(val)
    except (ValueError, TypeError):
        pass

    # Extract backup surcharge percentage
    backup_percentage = 20.0  # Default fallback
    try:
        val = pricing_data.get('server_backup', {}).get('percentage')
        if val is not None:
            backup_percentage = float(val)
    except (ValueError, TypeError):
        pass

    return {
        "server": server_prices,
        "load_balancer": lb_prices,
        "floating_ip": fip_prices,
        "primary_ip": pip_prices,
        "volume_per_gb": volume_per_gb_net,
        "backup_percentage": backup_percentage
    }

def fetch_hetzner_object_storage(access_key, secret_key):
    regions = ["fsn1", "nbg1", "hel1"]
    buckets = []
    
    for region in regions:
        endpoint_url = f"https://{region}.your-objectstorage.com"
        try:
            s3 = boto3.client(
                's3',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                endpoint_url=endpoint_url,
                config=Config(connect_timeout=4, read_timeout=5)
            )
            response = s3.list_buckets()
            for b in response.get('Buckets', []):
                buckets.append({
                    "name": b.get("Name"),
                    "created": b.get("CreationDate").isoformat() if b.get("CreationDate") else None,
                    "location": region,
                    "size_bytes": 0,
                    "object_count": 0
                })
        except Exception as e:
            # Credentials or endpoint failed
            print(f"Warning: Failed to fetch Object Storage buckets from {region}: {e}")
            
    # Estimate size for each bucket
    for bucket in buckets:
        region = bucket["location"]
        endpoint_url = f"https://{region}.your-objectstorage.com"
        try:
            s3 = boto3.client(
                's3',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                endpoint_url=endpoint_url,
                config=Config(connect_timeout=3, read_timeout=5)
            )
            paginator = s3.get_paginator('list_objects_v2')
            total_size = 0
            total_objects = 0
            for page in paginator.paginate(Bucket=bucket["name"], PaginationConfig={'MaxItems': 1000}):
                for obj in page.get('Contents', []):
                    total_size += obj.get('Size', 0)
                    total_objects += 1
            bucket["size_bytes"] = total_size
            bucket["object_count"] = total_objects
        except Exception as e:
            print(f"Warning: Failed to calculate size for bucket {bucket['name']}: {e}")
            
    return buckets
