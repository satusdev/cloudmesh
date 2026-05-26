import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

def get_robust_session():
    session = requests.Session()
    retries = Retry(
        total=5,
        backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504],
        raise_on_status=False
    )
    adapter = HTTPAdapter(max_retries=retries)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

# Shared retry-enabled session
api_session = get_robust_session()

def fetch_all(url, headers, params=None, key=None):
    results = []
    page = 1
    while True:
        if params is None:
            params = {}
        params['page'] = page
        params['per_page'] = 50
        response = api_session.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        if 'result' in data:
            results.extend(data['result'])
            if page >= data['result_info']['total_pages']:
                break
        else:
            res_key = key
            if not res_key:
                for k in ['servers', 'load_balancers', 'floating_ips']:
                    if k in data:
                        res_key = k
                        break
            if res_key and res_key in data:
                results.extend(data[res_key])
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
