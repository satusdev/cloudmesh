import json
import os
import pathlib
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def load_config_json():
    config_path = pathlib.Path('config.json')
    if config_path.exists():
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

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

def get_bool_env(name, default=True):
    val = os.environ.get(name)
    if val is None:
        return default
    return str(val).lower() in ('true', '1', 'yes', 'on', 'y')

def get_monitoring_interval():
    val = os.environ.get('MONITORING_INTERVAL_SECS')
    if val is not None:
        try:
            return int(val)
        except ValueError:
            pass
    config = load_config_json()
    return int(config.get('monitoring', {}).get('interval_secs', 0))

def get_max_snapshots():
    val = os.environ.get('MAX_HISTORICAL_SNAPSHOTS')
    if val is not None:
        try:
            return int(val)
        except ValueError:
            pass
    config = load_config_json()
    return int(config.get('monitoring', {}).get('max_snapshots', 10))

def get_dashboard_password_hash():
    import hashlib
    password = os.environ.get('DASHBOARD_PASSWORD')
    if not password:
        config = load_config_json()
        password = config.get('dashboard', {}).get('password')
    if password:
        return hashlib.sha256(password.encode('utf-8')).hexdigest()
    return None

