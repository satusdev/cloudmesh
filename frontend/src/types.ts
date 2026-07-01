export interface MappingItem {
  subdomain: string;
  ip: string;
  project: string;
  server_name: string;
  status: string;
  created: string;
  server_type: string;
  price_monthly: number;
  traffic_mb: number;
  labels: string;
  dns_type: string;
  proxied: boolean;
  resource_type?: string;
  dns_latency?: number;
  http_latency?: number;

  // Hardware Specs & Metadata
  cores?: number;
  memory?: number;
  disk?: number;
  location?: string;
  datacenter?: string;
  image?: string;
  protection_delete?: boolean;
  locked?: boolean;
}

export interface DomainExpiration {
  expiry_date: string;
  days_left: number | null;
}

export interface ServerDetails {
  project: string;
  server_name: string;
  ip: string;
  status: string;
  created: string;
  server_type: string;
  labels: string;
  price_monthly: number;
  traffic_mb: number;
  resource_type?: string;

  // Hardware Specs & Metadata
  cores?: number;
  memory?: number;
  disk?: number;
  location?: string;
  datacenter?: string;
  image?: string;
  protection_delete?: boolean;
  locked?: boolean;

  // Load Balancer Details
  services_count?: number;
  targets_count?: number;
  algorithm?: string;

  // Floating IP Details
  fip_type?: string;
  assigned_server?: string | null;

  // Security checks fields
  firewalls?: any[];
  ssh_keys?: any[];
  backup_window?: string | null;
}

export interface TrendPoint {
  timestamp: string;
  total_spending: number;
  total_a_records: number;
  matched_servers: number;
  total_domains: number;
}

export interface DiffDetails {
  dns: {
    added: string[];
    removed: string[];
    modified: { subdomain: string; old_ip: string; new_ip: string }[];
  };
  servers: {
    added: string[];
    removed: string[];
    status_changed: { server_name: string; old_status: string; new_status: string }[];
  };
}

export interface Recommendation {
  type: string;
  severity: string;
  resource_name: string;
  resource_type: string;
  ip: string;
  project: string;
  cost_impact: number;
  description: string;
  suggestion: string;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resource_name: string;
  resource_type: 'server' | 'load_balancer' | 'dns_record';
  ip: string;
  project: string;
  description: string;
  suggestion: string;
}

export interface CleanupFlag {
  id: string;
  domain: string;
  subdomain: string;
  dns_type: string;
  ip: string;
  flag_type: 'dangling_dns' | 'dead_target' | 'private_ip' | 'resolution_error';
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  description: string;
  suggestion: string;
}

export interface SnapshotFile {
  filename: string;
  timestamp: string;
}

export interface AuditData {
  timestamp: string;
  total_domains: number;
  total_a_records: number;
  matched_servers: number;
  total_spending: number;
  mapping_by_domain: Record<string, MappingItem[]>;
  domain_expirations: Record<string, DomainExpiration>;
  servers: ServerDetails[];
  unmapped_servers: ServerDetails[];
  diff: DiffDetails;
  history_trends: TrendPoint[];
  recommendations?: Recommendation[];
  security_alerts?: SecurityAlert[];
  cleanup_flags?: CleanupFlag[];
  port_audit_results?: Record<string, Record<string, boolean>>;
  snapshots_list?: SnapshotFile[];
  passcode_hash?: string | null;
}
