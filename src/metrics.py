from prometheus_client import CollectorRegistry, Gauge, Counter

def setup_prometheus_metrics():
    registry = CollectorRegistry()
    metrics = {
        'run_counter': Counter('cloudmesh_script_runs_total', 'Total script runs', registry=registry),
        'run_duration': Gauge('cloudmesh_script_run_duration_seconds', 'Script run duration (seconds)', registry=registry),
        'error_counter': Counter('cloudmesh_script_errors_total', 'Total script errors', registry=registry),
        'domains': Gauge('cloudmesh_domains_total', 'Total domains processed', registry=registry),
        'a_records': Gauge('cloudmesh_a_records_total', 'Total A records processed', registry=registry),
        'matched_servers': Gauge('cloudmesh_matched_servers_total', 'Total matched servers', registry=registry),
        'unmatched_ips': Gauge('cloudmesh_unmatched_ips_total', 'Total unmatched IPs', registry=registry),
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
