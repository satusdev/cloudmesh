import { useEffect, useState, useMemo } from 'react';
import { 
  Server, 
  Search, 
  DollarSign, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  ShieldCheck, 
  Layers, 
  Sparkles, 
  Sun, 
  Moon, 
  Database, 
  ArrowRight, 
  TrendingUp, 
  SlidersHorizontal, 
  CloudLightning,
  Lock,
  Unlock
} from 'lucide-react';


interface MappingItem {
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

interface DomainExpiration {
  expiry_date: string;
  days_left: number | null;
}

interface ServerDetails {
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
}


interface TrendPoint {
  timestamp: string;
  total_spending: number;
  total_a_records: number;
  matched_servers: number;
  total_domains: number;
}

interface DiffDetails {
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

interface Recommendation {
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

interface SnapshotFile {
  filename: string;
  timestamp: string;
}

interface AuditData {
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
  port_audit_results?: Record<string, Record<string, boolean>>;
  snapshots_list?: SnapshotFile[];
  passcode_hash?: string | null;
}


export default function App() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      return savedTheme;
    }
    // Default is dark mode
    document.documentElement.classList.add('dark');
    return 'dark';
  });

  const [refreshing, setRefreshing] = useState(false);

  // Authentication State
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('cloudmesh_authenticated') === 'true';
  });
  const [passcodeError, setPasscodeError] = useState('');

  const hashPasscode = async (str: string) => {
    const utf8 = new Uint8Array(Array.from(str).map(c => c.charCodeAt(0)));
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    if (!data || !data.passcode_hash) return;
    
    const hash = await hashPasscode(passcode);
    if (hash === data.passcode_hash) {
      setIsAuthenticated(true);
      sessionStorage.setItem('cloudmesh_authenticated', 'true');
    } else {
      setPasscodeError('Incorrect passcode. Access denied.');
    }
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('cloudmesh_authenticated');
    setPasscode('');
  };


  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [proxyFilter, setProxyFilter] = useState<'all' | 'proxied' | 'dns-only'>('all');
  const [dnsTypeFilter, setDnsTypeFilter] = useState<'all' | 'A' | 'AAAA'>('all');
  const [wildcardFilter, setWildcardFilter] = useState<'all' | 'wildcard' | 'standard'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'expiring-soon' | 'healthy'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [costRange, setCostRange] = useState<number>(100); // Max €100 cost filter

  const [activePage, setActivePage] = useState<'overview' | 'cost' | 'domains' | 'compute' | 'security'>('overview');
  const [domainSortKey, setDomainSortKey] = useState<'name' | 'expiry' | 'cost' | 'records'>('name');
  const [domainSortOrder, setDomainSortOrder] = useState<'asc' | 'desc'>('asc');
  const [dnsSortKey, setDnsSortKey] = useState<'subdomain' | 'latency' | 'price'>('subdomain');
  const [dnsSortOrder, setDnsSortOrder] = useState<'asc' | 'desc'>('asc');

  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  
  interface SelectedNode {
    type: string;
    id: string;
    label?: string;
    ip?: string;
  }
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<SelectedNode | null>(null);
  const [showTopology, setShowTopology] = useState(false);

  // Custom Comparison Snapshot State
  const [selectedSnapshotFile, setSelectedSnapshotFile] = useState<string>('none');
  const [comparisonDiff, setComparisonDiff] = useState<DiffDetails | null>(null);
  const [comparingError, setComparingError] = useState<string | null>(null);

  // Load custom comparison on dropdown selection
  useEffect(() => {
    if (selectedSnapshotFile === 'none' || !data) {
      const timer = setTimeout(() => {
        setComparisonDiff(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    
    const loadSnapshotAndCompare = async () => {
      try {
        setComparingError(null);
        const response = await fetch(`/snapshots/${selectedSnapshotFile}`);
        if (!response.ok) {
          throw new Error('Failed to load snapshot file.');
        }
        const snapshotData: AuditData = await response.json();
        
        const diff: DiffDetails = {
          dns: { added: [], removed: [], modified: [] },
          servers: { added: [], removed: [], status_changed: [] }
        };
        
        const prevDns: Record<string, MappingItem> = {};
        Object.entries(snapshotData.mapping_by_domain).forEach(([domain, items]) => {
          items.forEach(item => {
            const key = item.subdomain !== '@' ? `${item.subdomain}.${domain}` : domain;
            prevDns[key] = item;
          });
        });
        
        const currDns: Record<string, MappingItem> = {};
        Object.entries(data.mapping_by_domain).forEach(([domain, items]) => {
          items.forEach(item => {
            const key = item.subdomain !== '@' ? `${item.subdomain}.${domain}` : domain;
            currDns[key] = item;
          });
        });
        
        Object.entries(currDns).forEach(([key, currItem]) => {
          if (!prevDns[key]) {
            diff.dns.added.push(key);
          } else {
            const prevItem = prevDns[key];
            if (currItem.ip !== prevItem.ip) {
              diff.dns.modified.push({
                subdomain: key,
                old_ip: prevItem.ip,
                new_ip: currItem.ip
              });
            }
          }
        });
        
        Object.keys(prevDns).forEach(key => {
          if (!currDns[key]) {
            diff.dns.removed.push(key);
          }
        });
        
        const prevServers = new Map(snapshotData.servers.map(s => [s.server_name, s]));
        const currServers = new Map(data.servers.map(s => [s.server_name, s]));
        
        currServers.forEach((currS, name) => {
          if (!prevServers.has(name)) {
            diff.servers.added.push(name);
          } else {
            const prevS = prevServers.get(name)!;
            if (currS.status !== prevS.status) {
              diff.servers.status_changed.push({
                server_name: name,
                old_status: prevS.status,
                new_status: currS.status
              });
            }
          }
        });
        
        prevServers.forEach((_, name) => {
          if (!currServers.has(name)) {
            diff.servers.removed.push(name);
          }
        });
        
        setComparisonDiff(diff);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to compare snapshots.';
        setComparingError(errMsg);
      }
    };
    
    loadSnapshotAndCompare();
  }, [selectedSnapshotFile, data]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };


  const fetchData = async () => {
    try {
      const response = await fetch('/data.json');
      if (!response.ok) {
        throw new Error('Please run the python script first to generate the initial audit report (data.json).');
      }
      const jsonData: AuditData = await response.json();
      setData(jsonData);
      
      const domains = Object.keys(jsonData.mapping_by_domain).sort();
      const initialCollapsed: Record<string, boolean> = {};
      domains.forEach((domain, idx) => {
        initialCollapsed[domain] = idx >= 3;
      });
      setCollapsedDomains(initialCollapsed);
      setError(null);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load audit data.';
      setError(errMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Extract unique projects for filters
  const projectList = useMemo(() => {
    if (!data) return [];
    const projects = new Set<string>();
    data.servers.forEach(s => projects.add(s.project));
    Object.values(data.mapping_by_domain).flat().forEach(m => {
      if (m.project && m.project !== 'N/A') projects.add(m.project);
    });
    return Array.from(projects).sort();
  }, [data]);

  // Filters calculation
  const filteredMapping = useMemo(() => {
    if (!data) return {};
    const result: Record<string, MappingItem[]> = {};

    Object.entries(data.mapping_by_domain).forEach(([domain, records]) => {
      const expiration = data.domain_expirations[domain];
      const daysLeft = expiration?.days_left;

      // Expiry filter check
      let matchesExpiry = true;
      if (expiryFilter === 'expired') {
        matchesExpiry = daysLeft !== null && daysLeft < 0;
      } else if (expiryFilter === 'expiring-soon') {
        matchesExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
      } else if (expiryFilter === 'healthy') {
        matchesExpiry = daysLeft === null || daysLeft > 30;
      }

      const matchedRecords = records.filter(record => {
        const matchesSearch = 
          domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
          record.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
          record.ip.includes(searchQuery) ||
          record.server_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          record.project.toLowerCase().includes(searchQuery.toLowerCase());

        const isMatched = record.server_name !== 'No match';
        const matchesTab = 
          activeTab === 'all' ||
          (activeTab === 'matched' && isMatched) ||
          (activeTab === 'unmatched' && !isMatched);

        const matchesProxy = 
          proxyFilter === 'all' ||
          (proxyFilter === 'proxied' && record.proxied) ||
          (proxyFilter === 'dns-only' && !record.proxied);

        const matchesDnsType = 
          dnsTypeFilter === 'all' ||
          record.dns_type === dnsTypeFilter;

        const isWildcard = record.subdomain.startsWith('*');
        const matchesWildcard = 
          wildcardFilter === 'all' ||
          (wildcardFilter === 'wildcard' && isWildcard) ||
          (wildcardFilter === 'standard' && !isWildcard);

        const matchesProject = 
          selectedProject === 'all' || 
          record.project === selectedProject;

        const matchesCost = 
          record.price_monthly <= costRange;

        return matchesSearch && matchesTab && matchesProxy && matchesDnsType && matchesWildcard && matchesProject && matchesCost;
      });

      if (matchedRecords.length > 0 && matchesExpiry) {
        result[domain] = matchedRecords;
      }
    });

    return result;
  }, [data, searchQuery, activeTab, proxyFilter, dnsTypeFilter, wildcardFilter, expiryFilter, selectedProject, costRange]);

  // Compute live filtered stats
  const filteredStats = useMemo(() => {
    const flatRecords = Object.values(filteredMapping).flat();
    const matchedCount = flatRecords.filter(r => r.server_name !== 'No match').length;
    const totalSpend = flatRecords
      .filter(r => r.server_name !== 'No match')
      .reduce((sum, r) => sum + r.price_monthly, 0);

    return {
      recordsCount: flatRecords.length,
      matchedCount,
      unmatchedCount: flatRecords.length - matchedCount,
      totalSpend
    };
  }, [filteredMapping]);

  // Calculate project cost distribution
  const projectCosts = useMemo(() => {
    if (!data) return [];
    const costs: Record<string, { total: number; count: number }> = {};
    data.servers.forEach(server => {
      if (!costs[server.project]) {
        costs[server.project] = { total: 0, count: 0 };
      }
      costs[server.project].total += server.price_monthly;
      costs[server.project].count += 1;
    });
    return Object.entries(costs).sort((a, b) => b[1].total - a[1].total);
  }, [data]);

  // Expiring domains <= 30 days
  const expiringDomains = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.domain_expirations)
      .filter(([, info]) => info.days_left !== null && info.days_left <= 30)
      .sort((a, b) => (a[1].days_left ?? 999) - (b[1].days_left ?? 999));
  }, [data]);

  // Sparkline Chart SVG Path Generator
  const generateSparkline = (points: number[]) => {
    if (points.length < 2) return '';
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;
    const width = 120;
    const height = 30;

    return points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  // Node Topology calculation
  const topologyData = useMemo(() => {
    if (!data) return null;
    const flatRecords = Object.entries(filteredMapping).flatMap(([domain, items]) => 
      items.map(item => ({ ...item, domain }))
    );

    // Group items into columns
    const domains = Array.from(new Set(flatRecords.map(r => r.domain))).sort().slice(0, 8); // limit for visual sanity
    const records = flatRecords.filter(r => domains.includes(r.domain)).slice(0, 15);
    const ips = Array.from(new Set(records.map(r => r.ip))).sort();
    const servers = Array.from(new Set(records.map(r => r.server_name))).sort();
    const projects = Array.from(new Set(records.filter(r => r.project !== 'N/A').map(r => r.project))).sort();

    // Map keys to layout coordinates
    const width = 780;
    const height = 400;

    const getX = (col: number) => 40 + col * (width - 80) / 4;

    const layoutColumn = (items: string[], colIdx: number) => {
      const x = getX(colIdx);
      const count = items.length;
      return items.map((id, idx) => {
        const y = count > 1 
          ? 30 + idx * (height - 60) / (count - 1)
          : height / 2;
        return { id, x, y };
      });
    };

    const domainNodes = layoutColumn(domains, 0);
    const recordNodes = records.map((r, idx) => {
      const x = getX(1);
      const y = records.length > 1 
        ? 30 + idx * (height - 60) / (records.length - 1)
        : height / 2;
      return { id: `${r.subdomain}.${r.domain}`, label: r.subdomain, x, y, parentDomain: r.domain, ip: r.ip };
    });
    const ipNodes = layoutColumn(ips, 2);
    const serverNodes = layoutColumn(servers, 3).map(node => {
      const originalResource = data.servers.find(s => s.server_name === node.id);
      return {
        ...node,
        resourceType: originalResource?.resource_type || 'server'
      };
    });
    const projectNodes = layoutColumn(projects, 4);

    // Build connections/edges
    const edges: { x1: number; y1: number; x2: number; y2: number; isOrphan: boolean }[] = [];

    recordNodes.forEach(rn => {
      // Connect Domain -> Record
      const dNode = domainNodes.find(dn => dn.id === rn.parentDomain);
      if (dNode) {
        edges.push({ x1: dNode.x, y1: dNode.y, x2: rn.x, y2: rn.y, isOrphan: rn.label === 'No match' });
      }
      // Connect Record -> IP
      const ipNode = ipNodes.find(ipn => ipn.id === rn.ip);
      if (ipNode) {
        edges.push({ x1: rn.x, y1: rn.y, x2: ipNode.x, y2: ipNode.y, isOrphan: rn.label === 'No match' });
      }
    });

    records.forEach(r => {
      // Connect IP -> Server
      const ipNode = ipNodes.find(ipn => ipn.id === r.ip);
      const sNode = serverNodes.find(sn => sn.id === r.server_name);
      if (ipNode && sNode) {
        edges.push({ x1: ipNode.x, y1: ipNode.y, x2: sNode.x, y2: sNode.y, isOrphan: r.server_name === 'No match' });
      }
      // Connect Server -> Project
      const projNode = projectNodes.find(pn => pn.id === r.project);
      if (sNode && projNode && r.project !== 'N/A') {
        edges.push({ x1: sNode.x, y1: sNode.y, x2: projNode.x, y2: projNode.y, isOrphan: false });
      }
    });

    return {
      nodes: {
        domains: domainNodes,
        records: recordNodes,
        ips: ipNodes,
        servers: serverNodes,
        projects: projectNodes
      },
      edges
    };
  }, [filteredMapping, data]);

  const locationCosts = useMemo(() => {
    if (!data) return [];
    const costs: Record<string, { total: number; count: number }> = {};
    data.servers.forEach(s => {
      const loc = s.location || 'Unknown';
      if (!costs[loc]) costs[loc] = { total: 0, count: 0 };
      costs[loc].total += s.price_monthly;
      costs[loc].count += 1;
    });
    return Object.entries(costs).sort((a, b) => b[1].total - a[1].total);
  }, [data]);

  const typeCosts = useMemo(() => {
    if (!data) return [];
    const costs: Record<string, { total: number; count: number }> = {};
    data.servers.forEach(s => {
      const type = s.resource_type || 'server';
      if (!costs[type]) costs[type] = { total: 0, count: 0 };
      costs[type].total += s.price_monthly;
      costs[type].count += 1;
    });
    return Object.entries(costs).sort((a, b) => b[1].total - a[1].total);
  }, [data]);

  const computeStats = useMemo(() => {
    if (!data) return { cores: 0, memory: 0, disk: 0, serversCount: 0 };
    let cores = 0;
    let memory = 0;
    let disk = 0;
    let serversCount = 0;
    
    data.servers.forEach(s => {
      if (s.resource_type === 'server' || !s.resource_type) {
        cores += s.cores || 0;
        memory += s.memory || 0;
        disk += s.disk || 0;
        serversCount += 1;
      }
    });
    
    return { cores, memory, disk, serversCount };
  }, [data]);

  const osBreakdown = useMemo(() => {
    if (!data) return [];
    const osCounts: Record<string, number> = {};
    data.servers.forEach(s => {
      if (s.resource_type === 'server' || !s.resource_type) {
        let os = 'N/A';
        const img = (s.image || '').toLowerCase();
        if (img.includes('ubuntu')) os = 'Ubuntu';
        else if (img.includes('debian')) os = 'Debian';
        else if (img.includes('centos')) os = 'CentOS';
        else if (img.includes('rocky')) os = 'Rocky Linux';
        else if (img.includes('alma')) os = 'AlmaLinux';
        else if (img.includes('fedora')) os = 'Fedora';
        else if (img.includes('windows')) os = 'Windows Server';
        else if (img !== 'n/a' && s.image) os = s.image;
        
        osCounts[os] = (osCounts[os] || 0) + 1;
      }
    });
    return Object.entries(osCounts).sort((a, b) => b[1] - a[1]);
  }, [data]);

  // Sort domains dynamically
  const sortedDomains = useMemo(() => {
    const entries = Object.entries(filteredMapping);
    entries.sort(([domainA, recordsA], [domainB, recordsB]) => {
      let val = 0;
      if (domainSortKey === 'name') {
        val = domainA.localeCompare(domainB);
      } else if (domainSortKey === 'expiry') {
        const daysA = data?.domain_expirations[domainA]?.days_left ?? 999999;
        const daysB = data?.domain_expirations[domainB]?.days_left ?? 999999;
        val = daysA - daysB;
      } else if (domainSortKey === 'cost') {
        const costA = recordsA.reduce((sum, r) => sum + r.price_monthly, 0);
        const costB = recordsB.reduce((sum, r) => sum + r.price_monthly, 0);
        val = costB - costA; // Highest cost first
      } else if (domainSortKey === 'records') {
        val = recordsB.length - recordsA.length; // Most records first
      }
      return domainSortOrder === 'asc' ? val : -val;
    });
    return entries;
  }, [filteredMapping, domainSortKey, domainSortOrder, data]);

  const getSortedRecords = (records: MappingItem[]) => {
    return records.slice().sort((a, b) => {
      let comparison = 0;
      if (dnsSortKey === 'subdomain') {
        comparison = a.subdomain.localeCompare(b.subdomain);
      } else if (dnsSortKey === 'latency') {
        const latA = a.dns_latency ?? 999999;
        const latB = b.dns_latency ?? 999999;
        comparison = latA - latB;
      } else if (dnsSortKey === 'price') {
        comparison = a.price_monthly - b.price_monthly;
      }
      return dnsSortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const toggleDomain = (domain: string) => {
    setCollapsedDomains(prev => ({
      ...prev,
      [domain]: !prev[domain]
    }));
  };

  const setAllCollapse = (collapsed: boolean) => {
    if (!data) return;
    const updated: Record<string, boolean> = {};
    Object.keys(data.mapping_by_domain).forEach(domain => {
      updated[domain] = collapsed;
    });
    setCollapsedDomains(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
          <Server className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 h-6 w-6" />
        </div>
        <p className="mt-4 text-slate-400 font-medium animate-pulse">Running CloudMesh Auditor Engine...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-955 flex flex-col items-center justify-center text-slate-100 p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-2xl p-6 text-center shadow-xl">
          <AlertTriangle className="mx-auto text-red-500 h-12 w-12 mb-4" />
          <h2 className="text-xl font-bold text-slate-100 mb-2">Audit Session Inactive</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            {error || 'No audit records were parsed from cache or cloud credentials.'}
          </p>
          <div className="bg-slate-950 rounded-lg p-3 text-left font-mono text-xs text-indigo-400 mb-6 border border-slate-800">
            <span className="text-slate-500">$</span> python script.py
          </div>
          <button 
            onClick={handleRefresh}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 px-4 font-semibold text-sm transition duration-200 flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Credentials
          </button>
        </div>
      </div>
    );
  }

  if (data.passcode_hash && !isAuthenticated) {
    return (
      <div className={`min-h-screen transition-colors duration-250 flex flex-col items-center justify-center p-4 ${theme === 'dark' ? 'bg-[#030712] text-slate-100' : 'bg-[#f8fafc] text-slate-950'}`}>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-605 dark:text-slate-305 p-2 rounded-xl transition duration-200 cursor-pointer"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-808" />}
          </button>
        </div>
        
        <div className="max-w-md w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-850 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
          <div className="bg-indigo-600/10 p-4 rounded-full border border-indigo-500/20 text-indigo-500">
            <Lock className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">CloudMesh Auditor</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold uppercase tracking-wider text-rose-500 tracking-widest font-mono">Restricted Access</p>
          </div>
          <form onSubmit={handleUnlock} className="w-full space-y-4">
            <div className="relative">
              <input
                type="password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setPasscodeError('');
                }}
                placeholder="Enter dashboard passcode..."
                className="w-full bg-slate-100/50 dark:bg-slate-950/50 border border-slate-250 dark:border-slate-800/80 rounded-xl py-3.5 px-4 text-center text-sm font-semibold tracking-wide placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition duration-200"
              />
            </div>
            {passcodeError && (
              <p className="text-xs font-semibold text-rose-500 animate-pulse">{passcodeError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3.5 font-bold text-sm transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              <Unlock className="h-4 w-4" />
              Unlock Dashboard
            </button>
          </form>
          <p className="text-[10px] text-slate-400 dark:text-slate-505">
            Protected by CloudMesh environment configuration passcode.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-250 ${theme === 'dark' ? 'bg-[#030712] text-slate-100' : 'bg-[#f8fafc] text-slate-950'}`}>
      
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 mb-6 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/10 p-2.5 rounded-2xl border border-indigo-500/20 text-indigo-500">
              <Layers className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-600 bg-clip-text text-transparent">
                CloudMesh Auditor
              </h1>
              <p className="text-xs md:text-sm mt-0.5 font-medium flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                Infrastructure Audit & Topology Maps
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-slate-500 font-bold ml-1">Active</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 self-end md:self-center">
            <div className="text-right">
              <span className="text-[10px] tracking-wider font-semibold text-slate-500 block">SCAN TIMESTAMP</span>
              <span className="text-sm font-mono font-bold text-slate-655 dark:text-slate-300">{data.timestamp}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {data.passcode_hash && (
                <button 
                  onClick={handleLock}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-rose-500 p-2 rounded-xl transition duration-200 cursor-pointer"
                  title="Lock Dashboard"
                >
                  <Lock className="h-5 w-5" />
                </button>
              )}
              <button 
                onClick={toggleTheme}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-605 dark:text-slate-305 p-2 rounded-xl transition duration-200 cursor-pointer"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-805" />}
              </button>
              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-605 dark:text-slate-305 p-2 rounded-xl transition duration-200 disabled:opacity-50 cursor-pointer"
                title="Refresh mapping data"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        {/* Navigation Tabs Navbar */}
        <nav className="flex flex-wrap items-center gap-2 border-b border-slate-205 dark:border-slate-805 pb-4 mb-6">
          <button
            onClick={() => setActivePage('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition duration-150 border cursor-pointer ${
              activePage === 'overview'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15'
                : 'bg-slate-105 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400'
            }`}
          >
            <Layers className="h-4 w-4" />
            Overview & Map
          </button>
          <button
            onClick={() => setActivePage('cost')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition duration-150 border cursor-pointer ${
              activePage === 'cost'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15'
                : 'bg-slate-105 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Cost & Billing
          </button>
          <button
            onClick={() => setActivePage('domains')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition duration-150 border cursor-pointer ${
              activePage === 'domains'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15'
                : 'bg-slate-105 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400'
            }`}
          >
            <Search className="h-4 w-4" />
            Domains & WHOIS
          </button>
          <button
            onClick={() => setActivePage('compute')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition duration-150 border cursor-pointer ${
              activePage === 'compute'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15'
                : 'bg-slate-105 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400'
            }`}
          >
            <Server className="h-4 w-4" />
            Compute Resources
          </button>
          <button
            onClick={() => setActivePage('security')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition duration-150 border cursor-pointer ${
              activePage === 'security'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15'
                : 'bg-slate-105 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Security & Ports
          </button>
        </nav>

        {/* Overview & Topology View */}
        {activePage === 'overview' && (
          <div className="space-y-6">
            
            {/* Live Metrics Panel & Sparklines */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Domains Stat */}
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-202 dark:border-slate-802">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Audited Domains</span>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-3xl font-black">{data.total_domains}</span>
                  {data.history_trends && data.history_trends.length > 1 && (
                    <div className="opacity-80">
                      <svg width="120" height="30" className="overflow-visible">
                        <path
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          d={generateSparkline(data.history_trends.map(t => t.total_domains))}
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* DNS Records Stat */}
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-202 dark:border-slate-802">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">DNS A / AAAA Records</span>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-3xl font-black">{data.total_a_records}</span>
                  {data.history_trends && data.history_trends.length > 1 && (
                    <div className="opacity-80">
                      <svg width="120" height="30" className="overflow-visible">
                        <path
                          fill="none"
                          stroke="#8b5cf6"
                          strokeWidth="2.5"
                          d={generateSparkline(data.history_trends.map(t => t.total_a_records))}
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Matched Servers Stat */}
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-202 dark:border-slate-802">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Mapped Servers</span>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-3xl font-black text-emerald-500">{data.matched_servers}</span>
                    <span className="text-xs text-slate-500 font-semibold ml-1">/{data.total_a_records}</span>
                  </div>
                  {data.history_trends && data.history_trends.length > 1 && (
                    <div className="opacity-80">
                      <svg width="120" height="30" className="overflow-visible">
                        <path
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          d={generateSparkline(data.history_trends.map(t => t.matched_servers))}
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Spend Stat */}
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-202 dark:border-slate-802">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hetzner Monthly Spend</span>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-3xl font-black text-indigo-500">€{data.total_spending.toFixed(2)}</span>
                  {data.history_trends && data.history_trends.length > 1 && (
                    <div className="opacity-80">
                      <svg width="120" height="30" className="overflow-visible">
                        <path
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          d={generateSparkline(data.history_trends.map(t => t.total_spending))}
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* View Mode Toggle: Grid or Topology */}
            <section className="flex gap-2">
              <button 
                onClick={() => setShowTopology(false)}
                className={`text-xs font-bold px-4 py-2.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer ${
                  !showTopology 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15' 
                    : 'bg-slate-105 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400'
                }`}
              >
                <Database className="h-4 w-4" />
                Tabular Auditing View
              </button>
              <button 
                onClick={() => setShowTopology(true)}
                className={`text-xs font-bold px-4 py-2.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer ${
                  showTopology 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15' 
                    : 'bg-slate-105 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400'
                }`}
              >
                <CloudLightning className="h-4 w-4" />
                Infrastructure Topology Graph
              </button>
            </section>

            {showTopology && topologyData ? (
              /* SECTION: Interactive Topology Graph */
              <section className="glass-panel p-6 rounded-2xl border-slate-200 dark:border-slate-800 relative">
                <h2 className="text-sm font-bold text-slate-400 mb-6 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  Dynamic Infrastructure Topology Map
                </h2>

                <div className="overflow-x-auto">
                  <svg width="780" height="400" className="mx-auto block overflow-visible">
                    {/* Column Headers */}
                    <text x="40" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Domain</text>
                    <text x="210" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Cloudflare Record</text>
                    <text x="390" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Resolved IP</text>
                    <text x="570" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Hetzner Server</text>
                    <text x="740" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Project</text>

                    {/* Edges / Paths */}
                    {topologyData.edges.map((edge, idx) => {
                      const dx = edge.x2 - edge.x1;
                      const path = `M ${edge.x1} ${edge.y1} C ${edge.x1 + dx/2} ${edge.y1}, ${edge.x1 + dx/2} ${edge.y2}, ${edge.x2} ${edge.y2}`;
                      return (
                        <path
                          key={idx}
                          d={path}
                          fill="none"
                          stroke={edge.isOrphan ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.15)'}
                          strokeWidth={edge.isOrphan ? 2 : 1.5}
                          strokeDasharray={edge.isOrphan ? "4,4" : undefined}
                        />
                      );
                    })}

                    {/* Domain Nodes */}
                    {topologyData.nodes.domains.map(node => (
                      <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNodeDetails({ type: 'domain', id: node.id })}>
                        <circle cx={node.x} cy={node.y} r="8" fill="#4f46e5" />
                        <text x={node.x - 12} y={node.y + 4} fill={theme === 'dark' ? '#cbd5e1' : '#1e293b'} fontSize="9" fontWeight="bold" textAnchor="end">{node.id}</text>
                      </g>
                    ))}

                    {/* Cloudflare Record Nodes */}
                    {topologyData.nodes.records.map(node => (
                      <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNodeDetails({ type: 'record', id: node.id, label: node.label, ip: node.ip })}>
                        <circle cx={node.x} cy={node.y} r="5" fill={node.label === 'No match' ? '#ef4444' : '#818cf8'} />
                        <text x={node.x + 8} y={node.y - 4} fill="#64748b" fontSize="8" fontWeight="medium">{node.label}</text>
                      </g>
                    ))}

                    {/* IP Nodes */}
                    {topologyData.nodes.ips.map(node => (
                      <g key={node.id}>
                        <circle cx={node.x} cy={node.y} r="4" fill="#a7f3d0" />
                        <text x={node.x + 8} y={node.y + 3} fill="#10b981" fontSize="8" fontFamily="monospace">{node.id}</text>
                      </g>
                    ))}

                    {/* Server / LB / Floating IP Nodes */}
                    {topologyData.nodes.servers.map(node => {
                      let fill = '#10b981';
                      if (node.id === 'No match') {
                        fill = '#ef4444';
                      } else if (node.resourceType === 'load_balancer') {
                        fill = '#6366f1';
                      } else if (node.resourceType === 'floating_ip') {
                        fill = '#f59e0b';
                      }
                      
                      return (
                        <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNodeDetails({ type: node.resourceType || 'server', id: node.id })}>
                          <circle cx={node.x} cy={node.y} r="7" fill={fill} />
                          <text x={node.x + 10} y={node.y + 3} fill={fill} fontSize="8" fontWeight="bold">{node.id}</text>
                        </g>
                      );
                    })}

                    {/* Project Nodes */}
                    {topologyData.nodes.projects.map(node => {
                      const pCost = projectCosts.find(pc => pc[0] === node.id)?.[1]?.total || 0;
                      const radius = Math.max(5, Math.min(15, 5 + pCost / 5)); // Weight project node by cost
                      return (
                        <g key={node.id}>
                          <circle cx={node.x} cy={node.y} r={radius} fill="#f59e0b" />
                          <text x={node.x + radius + 4} y={node.y + 3} fill="#b45309" fontSize="8" fontWeight="bold">{node.id}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Topology Node Click Overlay */}
                {selectedNodeDetails && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-bold text-indigo-400 capitalize mb-1">{selectedNodeDetails.type} Node Details</h4>
                      <p className="text-slate-300 font-medium">Identifier: <span className="font-mono text-slate-100">{selectedNodeDetails.id}</span></p>
                      {selectedNodeDetails.ip && <p className="text-slate-400 mt-0.5">Points to IP: <span className="font-mono text-slate-300">{selectedNodeDetails.ip}</span></p>}
                    </div>
                    <button 
                      onClick={() => setSelectedNodeDetails(null)}
                      className="text-slate-505 hover:text-slate-305 font-bold px-2 py-0.5 rounded border border-slate-800 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                )}
              </section>
            ) : (
              /* SECTION: Tabular Auditing Grid */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: DNS Cards & Controls */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Controls and Advanced Filters Panel */}
                  <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800 space-y-4">
                    
                    {/* Search and Tabs */}
                    <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-550 h-4.5 w-4.5" />
                        <input 
                          type="text" 
                          placeholder="Search subdomain, IP, server, labels..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-slate-950/80 border border-slate-205 dark:border-slate-805 hover:border-slate-305 dark:hover:border-slate-705 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-500 transition outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        <button 
                          onClick={() => setActiveTab('all')}
                          className={`text-[11px] font-bold px-3.5 py-2.5 rounded-lg border cursor-pointer transition ${
                            activeTab === 'all' 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                              : 'bg-slate-105 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          All ({filteredStats.recordsCount})
                        </button>
                        <button 
                          onClick={() => setActiveTab('matched')}
                          className={`text-[11px] font-bold px-3.5 py-2.5 rounded-lg border cursor-pointer transition ${
                            activeTab === 'matched' 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                              : 'bg-slate-105 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          Matched ({filteredStats.matchedCount})
                        </button>
                        <button 
                          onClick={() => setActiveTab('unmatched')}
                          className={`text-[11px] font-bold px-3.5 py-2.5 rounded-lg border cursor-pointer transition ${
                            activeTab === 'unmatched' 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                              : 'bg-slate-105 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          Orphaned ({filteredStats.unmatchedCount})
                        </button>
                      </div>
                    </div>

                    {/* Advanced Filter Collapse Header */}
                    <div className="border-t border-slate-200 dark:border-slate-800/60 pt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1"><SlidersHorizontal className="h-4 w-4 text-indigo-400" /> Advanced Filter Tools</span>
                      <div className="flex gap-2">
                        <button onClick={() => setAllCollapse(false)} className="hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">Expand All</button>
                        <span>|</span>
                        <button onClick={() => setAllCollapse(true)} className="hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">Collapse All</button>
                      </div>
                    </div>

                    {/* Advanced Filter Dropdowns Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      
                      {/* Cloudflare Proxy Filter */}
                      <div className="flex flex-col gap-1">
                        <label className="font-semibold text-slate-400">Cloudflare Proxy Mode</label>
                        <select 
                          value={proxyFilter}
                          onChange={(e) => setProxyFilter(e.target.value as 'all' | 'proxied' | 'dns-only')}
                          className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
                        >
                          <option value="all">All Records</option>
                          <option value="proxied">Proxied Only</option>
                          <option value="dns-only">DNS Only (Bypassed)</option>
                        </select>
                      </div>

                      {/* DNS Record Type Filter */}
                      <div className="flex flex-col gap-1">
                        <label className="font-semibold text-slate-400">DNS record Type</label>
                        <select 
                          value={dnsTypeFilter}
                          onChange={(e) => setDnsTypeFilter(e.target.value as 'all' | 'A' | 'AAAA')}
                          className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
                        >
                          <option value="all">All (A & AAAA)</option>
                          <option value="A">A Records (IPv4)</option>
                          <option value="AAAA">AAAA Records (IPv6)</option>
                        </select>
                      </div>

                      {/* Wildcard Filter */}
                      <div className="flex flex-col gap-1">
                        <label className="font-semibold text-slate-400">Subdomain Format</label>
                        <select 
                          value={wildcardFilter}
                          onChange={(e) => setWildcardFilter(e.target.value as 'all' | 'wildcard' | 'standard')}
                          className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
                        >
                          <option value="all">All Formats</option>
                          <option value="wildcard">Wildcard DNS (*)</option>
                          <option value="standard">Standard Subdomain</option>
                        </select>
                      </div>

                      {/* Expiration Filter */}
                      <div className="flex flex-col gap-1">
                        <label className="font-semibold text-slate-400">Domain Expiration</label>
                        <select 
                          value={expiryFilter}
                          onChange={(e) => setExpiryFilter(e.target.value as 'all' | 'expired' | 'expiring-soon' | 'healthy')}
                          className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
                        >
                          <option value="all">All Expirations</option>
                          <option value="expired">Expired Only</option>
                          <option value="expiring-soon">Expiring (≤ 30 days)</option>
                          <option value="healthy">Healthy (&gt; 30 days)</option>
                        </select>
                      </div>

                      {/* Project Filter */}
                      <div className="flex flex-col gap-1">
                        <label className="font-semibold text-slate-400">Hetzner Project</label>
                        <select 
                          value={selectedProject}
                          onChange={(e) => setSelectedProject(e.target.value)}
                          className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
                        >
                          <option value="all">All Projects</option>
                          {projectList.map(proj => (
                            <option key={proj} value={proj}>{proj}</option>
                          ))}
                        </select>
                      </div>

                      {/* Price/Cost Filter */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between font-semibold text-slate-400">
                          <span>Max Cost Bracket</span>
                          <span className="text-indigo-400 font-bold">≤ €{costRange}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={costRange} 
                          onChange={(e) => setCostRange(Number(e.target.value))}
                          className="mt-2.5 h-1.5 bg-slate-200 dark:bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>

                    {/* Sorting Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800/60 pt-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-500">Sort Domains By:</span>
                        <select
                          value={domainSortKey}
                          onChange={(e) => setDomainSortKey(e.target.value as 'name' | 'expiry' | 'cost' | 'records')}
                          className="bg-slate-100 dark:bg-slate-955 border border-slate-202 dark:border-slate-852 p-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-semibold outline-none"
                        >
                          <option value="name">Domain Name</option>
                          <option value="expiry">Expiration Date</option>
                          <option value="cost">Monthly Spend</option>
                          <option value="records">Records Count</option>
                        </select>
                        <button
                          onClick={() => setDomainSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-955 dark:hover:bg-slate-900 border border-slate-202 dark:border-slate-852 p-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition"
                        >
                          {domainSortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-500">Sort Records By:</span>
                        <select
                          value={dnsSortKey}
                          onChange={(e) => setDnsSortKey(e.target.value as 'subdomain' | 'latency' | 'price')}
                          className="bg-slate-100 dark:bg-slate-955 border border-slate-202 dark:border-slate-852 p-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-semibold outline-none"
                        >
                          <option value="subdomain">Subdomain name</option>
                          <option value="latency">DNS Resolution latency</option>
                          <option value="price">Monthly cost</option>
                        </select>
                        <button
                          onClick={() => setDnsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-955 dark:hover:bg-slate-900 border border-slate-202 dark:border-slate-852 p-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition"
                        >
                          {dnsSortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cards layout */}
                  <div className="space-y-4 text-xs">
                    {sortedDomains.length === 0 ? (
                      <div className="glass-panel p-12 rounded-2xl text-center border-slate-200 dark:border-slate-800">
                        <Search className="mx-auto text-slate-500 h-10 w-10 mb-3" />
                        <h3 className="text-base font-bold">No mapping records matched</h3>
                        <p className="text-slate-500 text-xs mt-1">Please try modifying your search query or filters.</p>
                      </div>
                    ) : (
                      sortedDomains.map(([domain, records]) => {
                        const isCollapsed = collapsedDomains[domain] ?? false;
                        const expiration = data.domain_expirations[domain];
                        const daysLeft = expiration?.days_left;
                        
                        let expiryColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                        let expiryLabel = `Expires: ${expiration?.expiry_date}`;
                        
                        if (daysLeft !== null && daysLeft !== undefined) {
                          if (daysLeft < 0) {
                            expiryColor = "text-rose-500 bg-rose-500/10 border-rose-500/20 animate-pulse";
                            expiryLabel = `EXPIRED (${Math.abs(daysLeft)} days ago)`;
                          } else if (daysLeft <= 30) {
                            expiryColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
                            expiryLabel = `Expires in ${daysLeft} days`;
                          }
                        }

                        const sortedRecs = getSortedRecords(records);

                        return (
                          <div key={domain} className="glass-panel rounded-2xl overflow-hidden border-slate-200 dark:border-slate-800 transition duration-150">
                            
                            {/* Domain Card Header */}
                            <div 
                              onClick={() => toggleDomain(domain)}
                              className="bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/80 px-5 py-4 flex items-center justify-between cursor-pointer transition duration-150 border-b border-slate-200 dark:border-slate-800/40"
                            >
                              <div className="flex items-center gap-3">
                                <button className="text-slate-400">
                                  {isCollapsed ? <ChevronUp className="-rotate-90 transition duration-200 h-4 w-4" /> : <ChevronDown className="transition duration-200 h-4 w-4" />}
                                </button>
                                <span className="font-bold tracking-tight text-sm">{domain}</span>
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                                  {records.length} records
                                </span>
                              </div>

                              {expiration && (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${expiryColor}`}>
                                  {expiryLabel}
                                </span>
                              )}
                            </div>

                            {/* Table Content */}
                            {!isCollapsed && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-105/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/50">
                                      <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Subdomain</th>
                                      <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">IP Address</th>
                                      <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Record Type</th>
                                      <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Hetzner Server</th>
                                      <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Status</th>
                                      <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5 text-right">Price</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                                    {sortedRecs.map((record, rIdx) => {
                                      const isMatched = record.server_name !== 'No match';
                                      
                                      return (
                                        <tr 
                                          key={rIdx} 
                                          className={`transition hover:bg-slate-50 dark:hover:bg-slate-900/30 ${
                                            isMatched ? '' : 'bg-rose-500/5 dark:bg-rose-950/5'
                                          }`}
                                        >
                                          {/* Subdomain */}
                                          <td className="py-3.5 px-5 font-bold text-slate-700 dark:text-slate-300">
                                            {record.subdomain === '@' ? (
                                              <span className="text-slate-400 dark:text-slate-500 font-semibold">@ (root)</span>
                                            ) : (
                                              record.subdomain
                                            )}
                                          </td>
                                          
                                          {/* IP & Proxy Status */}
                                          <td className="py-3.5 px-5 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                                            <div className="flex flex-col gap-0.5">
                                              <div className="flex items-center gap-1.5">
                                                <span>{record.ip}</span>
                                                {record.proxied && (
                                                  <span className="text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.2 rounded" title="Cloudflare Proxied">
                                                    CF Proxy
                                                  </span>
                                                )}
                                              </div>
                                              {record.dns_latency !== undefined && record.dns_latency > 0 && (
                                                <span className="text-[10px] font-normal text-slate-500">
                                                  dns: {record.dns_latency}ms | http: {record.http_latency && record.http_latency > 0 ? `${record.http_latency}ms` : 'timeout'}
                                                </span>
                                              )}
                                            </div>
                                          </td>

                                          {/* Record Type */}
                                          <td className="py-3.5 px-5 font-bold text-slate-455">
                                            {record.dns_type || 'A'}
                                          </td>

                                          {/* Server Name */}
                                          <td className="py-3.5 px-5 text-slate-700 dark:text-slate-300 font-semibold">
                                            {isMatched ? (
                                              <div>
                                                <div className="flex items-center gap-1.5">
                                                  <span>{record.server_name}</span>
                                                  {record.resource_type && record.resource_type !== 'server' && (
                                                    <span className={`text-[9px] font-bold px-1.5 rounded uppercase ${
                                                      record.resource_type === 'load_balancer' 
                                                        ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' 
                                                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                                    }`}>
                                                      {record.resource_type === 'load_balancer' ? 'LB' : 'FIP'}
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="text-[10px] text-slate-500 block font-normal">{record.project}</span>
                                              </div>
                                            ) : (
                                              <span className="text-slate-400 dark:text-slate-600">—</span>
                                            )}
                                          </td>

                                          {/* Status */}
                                          <td className="py-3.5 px-5">
                                            <div className="flex flex-col gap-1.5">
                                              <div>
                                                {!isMatched ? (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                                    No Match
                                                  </span>
                                                ) : record.status === 'running' || record.status === 'assigned' ? (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                                    Running
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-205 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-350 dark:border-slate-700">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                                                    {record.status.toUpperCase()}
                                                  </span>
                                                )}
                                              </div>
                                              
                                              {data.port_audit_results?.[record.ip] && (
                                                <div className="flex flex-wrap gap-1">
                                                  {Object.entries(data.port_audit_results[record.ip]).map(([port, open]) => {
                                                    let color = "bg-slate-200/50 dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-400";
                                                    if (open) {
                                                      if (port === '22') color = "bg-amber-500/15 border-amber-500/25 text-amber-500 font-bold";
                                                      else if (port === '3389') color = "bg-rose-500/15 border-rose-500/25 text-rose-500 font-bold animate-pulse";
                                                      else if (port === '443') color = "bg-emerald-500/15 border-emerald-500/25 text-emerald-500 font-bold";
                                                      else color = "bg-sky-500/15 border-sky-500/25 text-sky-550 font-bold";
                                                    }
                                                    return (
                                                      <span key={port} className={`text-[8px] px-1 rounded border ${color}`} title={`${port} ${open ? 'Open' : 'Closed'}`}>
                                                        {port}
                                                      </span>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          </td>

                                          {/* Price */}
                                          <td className="py-3.5 px-5 text-right font-mono text-indigo-650 dark:text-indigo-305 font-bold">
                                            {isMatched ? `€${record.price_monthly.toFixed(2)}` : <span className="text-slate-400 dark:text-slate-600">—</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Sidebar Panels */}
                <div className="space-y-6 text-xs">
                  
                  {/* Snapshot Comparer panel */}
                  {data.snapshots_list && data.snapshots_list.length > 0 && (
                    <div className="glass-panel rounded-2xl p-5 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                      <h2 className="text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-indigo-500" />
                        Snapshot Drift Comparer
                      </h2>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-semibold text-slate-550 dark:text-slate-400">Compare Current Against:</label>
                        <select
                          value={selectedSnapshotFile}
                          onChange={(e) => setSelectedSnapshotFile(e.target.value)}
                          className="bg-slate-105 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-705 dark:text-slate-305 outline-none w-full font-semibold"
                        >
                          <option value="none">None (Showing default diff)</option>
                          {data.snapshots_list.map((snap) => (
                            <option key={snap.filename} value={snap.filename}>
                              {snap.timestamp} ({snap.filename})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {comparingError && (
                        <div className="text-xs text-rose-500 font-semibold">{comparingError}</div>
                      )}
                      
                      {selectedSnapshotFile !== 'none' && comparisonDiff && (
                        <div className="space-y-3 leading-relaxed border-t border-slate-200 dark:border-slate-800/60 pt-3">
                          <div className="font-bold text-[10px] uppercase text-slate-500 tracking-wider mb-2">
                            Drift comparison logs:
                          </div>
                          
                          {comparisonDiff.dns.added.length === 0 &&
                           comparisonDiff.dns.removed.length === 0 &&
                           comparisonDiff.dns.modified.length === 0 &&
                           comparisonDiff.servers.added.length === 0 &&
                           comparisonDiff.servers.removed.length === 0 &&
                           comparisonDiff.servers.status_changed.length === 0 && (
                            <div className="text-slate-500 text-center py-2">
                              No infrastructure drift detected.
                            </div>
                          )}
                          
                          {/* Added DNS */}
                          {comparisonDiff.dns.added.map(item => (
                            <div key={item} className="flex items-center gap-1.5 text-emerald-500">
                              <span className="font-bold bg-emerald-500/10 px-1 rounded">+ DNS</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{item}</span>
                            </div>
                          ))}
                          {/* Removed DNS */}
                          {comparisonDiff.dns.removed.map(item => (
                            <div key={item} className="flex items-center gap-1.5 text-rose-500">
                              <span className="font-bold bg-rose-500/10 px-1 rounded">- DNS</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{item}</span>
                            </div>
                          ))}
                          {/* Modified DNS */}
                          {comparisonDiff.dns.modified.map(item => (
                            <div key={item.subdomain} className="flex flex-col text-indigo-500 border-l-2 border-indigo-500/30 pl-2">
                              <span className="font-bold text-[10px] tracking-wide bg-indigo-500/10 px-1 rounded self-start">Δ IP Change</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono mt-0.5">{item.subdomain}</span>
                              <span className="text-[10px] text-slate-400 mt-0.5 font-mono">{item.old_ip} <ArrowRight className="inline h-3 w-3 mx-0.5" /> {item.new_ip}</span>
                            </div>
                          ))}
                          {/* Server status changed */}
                          {comparisonDiff.servers.status_changed.map(item => (
                            <div key={item.server_name} className="flex flex-col text-amber-500 border-l-2 border-amber-500/30 pl-2">
                              <span className="font-bold text-[10px] tracking-wide bg-amber-500/10 px-1 rounded self-start">Δ Status</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{item.server_name}</span>
                              <span className="text-[10px] text-slate-500 mt-0.5">{item.old_status} → {item.new_status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expirations alert section */}
                  {expiringDomains.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-5 shadow-sm">
                      <h2 className="text-sm font-bold text-amber-500 flex items-center gap-2 mb-4">
                        <AlertTriangle className="h-5 w-5" />
                        Domain Expirations Alert
                      </h2>
                      <div className="space-y-3">
                        {expiringDomains.map(([domain, info]) => {
                          const days = info.days_left;
                          const isExpired = days !== null && days < 0;
                          
                          return (
                            <div 
                              key={domain} 
                              className={`flex flex-col p-3 rounded-xl border text-xs ${
                                isExpired 
                                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-250' 
                                  : 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-250'
                              }`}
                            >
                              <div className="flex justify-between items-center font-bold">
                                <span>{domain}</span>
                                <span>{isExpired ? 'EXPIRED' : `${days} days left`}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                Expires: {info.expiry_date}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Snapshot Diffs Panel */}
                  {data.diff && (data.diff.dns.added.length > 0 || data.diff.dns.removed.length > 0 || data.diff.dns.modified.length > 0 || data.diff.servers.added.length > 0 || data.diff.servers.removed.length > 0 || data.diff.servers.status_changed.length > 0) ? (
                    <div className="glass-panel rounded-2xl p-5 border-slate-200 dark:border-slate-800 shadow-sm">
                      <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5 text-indigo-500" />
                        Changes Since Last Audit
                      </h2>
                      <div className="space-y-3 leading-relaxed">
                        {/* Added DNS */}
                        {data.diff.dns.added.map(item => (
                          <div key={item} className="flex items-center gap-1.5 text-emerald-500">
                            <span className="font-bold bg-emerald-500/10 px-1 rounded">+ DNS</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{item}</span>
                          </div>
                        ))}
                        {/* Removed DNS */}
                        {data.diff.dns.removed.map(item => (
                          <div key={item} className="flex items-center gap-1.5 text-rose-500">
                            <span className="font-bold bg-rose-500/10 px-1 rounded">- DNS</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{item}</span>
                          </div>
                        ))}
                        {/* Modified DNS */}
                        {data.diff.dns.modified.map(item => (
                          <div key={item.subdomain} className="flex flex-col text-indigo-500 border-l-2 border-indigo-500/30 pl-2">
                            <span className="font-bold text-[10px] tracking-wide bg-indigo-500/10 px-1 rounded self-start">Δ IP Change</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono mt-0.5">{item.subdomain}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-mono">{item.old_ip} <ArrowRight className="inline h-3 w-3 mx-0.5" /> {item.new_ip}</span>
                          </div>
                        ))}
                        {/* Server status changed */}
                        {data.diff.servers.status_changed.map(item => (
                          <div key={item.server_name} className="flex flex-col text-amber-500 border-l-2 border-amber-500/30 pl-2">
                            <span className="font-bold text-[10px] tracking-wide bg-amber-500/10 px-1 rounded self-start">Δ Status</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{item.server_name}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">{item.old_status} → {item.new_status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="glass-panel rounded-2xl p-5 border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
                      No changes detected since the previous audit scan.
                    </div>
                  )}

                  {/* Reverse Mapping Validation: Unmapped Hetzner Servers */}
                  <div className="glass-panel rounded-2xl p-5 border-slate-200 dark:border-slate-800 shadow-sm">
                    <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-rose-500">
                      <AlertTriangle className="h-5 w-5" />
                      Unmapped Hetzner Servers ({data.unmapped_servers?.length || 0})
                    </h2>
                    
                    <div className="space-y-3.5">
                      {data.unmapped_servers && data.unmapped_servers.length > 0 ? (
                        data.unmapped_servers.map(server => (
                          <div key={server.server_name} className="bg-rose-500/5 border border-rose-500/15 p-3 rounded-xl space-y-1">
                            <div className="flex justify-between font-bold text-slate-705 dark:text-slate-205">
                              <span>{server.server_name}</span>
                              <span className="text-rose-500">€{server.price_monthly.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>IP: {server.ip}</span>
                              <span>Project: {server.project}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-500 text-xs py-2">
                          All active Hetzner servers are mapped to subdomains.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Project cost breakdown */}
                  <div className="glass-panel rounded-2xl p-5 border-slate-200 dark:border-slate-800 shadow-sm">
                    <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
                      <DollarSign className="h-5 w-5 text-indigo-500" />
                      Costs by Hetzner Project
                    </h2>

                    <div className="space-y-4">
                      {projectCosts.map(([project, stats]) => {
                        const totalSpend = data.total_spending > 0 ? data.total_spending : 1;
                        const pct = (stats.total / totalSpend) * 100;
                        
                        return (
                          <div key={project} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-600 dark:text-slate-300">{project}</span>
                              <span className="text-slate-500 dark:text-slate-400 font-medium">
                                €{stats.total.toFixed(2)}
                                <span className="text-[10px] text-slate-550 ml-1">({stats.count} servers)</span>
                              </span>
                            </div>
                            {/* Share Bar */}
                            <div className="w-full bg-slate-202 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-850">
                              <div 
                                className="bg-indigo-500 h-full rounded-full" 
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* System Audit Connections Status */}
                  <div className="glass-panel rounded-2xl p-5 border-slate-200 dark:border-slate-800 shadow-sm">
                    <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
                      <ShieldCheck className="h-5 w-5 text-indigo-500" />
                      Auditing Node Status
                    </h2>
                    <div className="space-y-3.5 text-xs">
                      <div className="flex justify-between items-center border-b pb-2.5 border-slate-200 dark:border-slate-800/40 font-semibold">
                        <span className="text-slate-550 dark:text-slate-400">Cloudflare API Connection</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Stable</span>
                      </div>
                      <div className="flex justify-between items-center border-b pb-2.5 border-slate-200 dark:border-slate-800/40 font-semibold">
                        <span className="text-slate-550 dark:text-slate-400">Hetzner Cloud API Connection</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Stable</span>
                      </div>
                      <div className="flex justify-between items-center font-semibold">
                        <span className="text-slate-550 dark:text-slate-400">Scheduled Audit Mode</span>
                        <span className="font-mono text-indigo-650 dark:text-indigo-405 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-bold">Continuous</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* Cost & Billing breakdown Page */}
        {activePage === 'cost' && (
          <div className="space-y-8 animate-fade-in text-xs">
            {/* Top Cost summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Resource Spend</span>
                <span className="text-3xl font-black text-indigo-505 block mt-2">€{data.total_spending.toFixed(2)}</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Projected Annual Cost</span>
                <span className="text-3xl font-black text-indigo-405 block mt-2">€{(data.total_spending * 12).toFixed(2)}</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Average Resource Price</span>
                <span className="text-3xl font-black text-emerald-505 block mt-2">
                  €{(data.total_spending / (data.servers.length || 1)).toFixed(2)}
                </span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Cost Saving Recommendations</span>
                <span className={`text-3xl font-black block mt-2 ${data.recommendations && data.recommendations.filter(r => r.cost_impact > 0).length > 0 ? 'text-amber-505 animate-pulse font-bold' : 'text-slate-400'}`}>
                  {data.recommendations ? data.recommendations.filter(r => r.cost_impact > 0).length : 0}
                </span>
              </div>
            </div>

            {/* Visual breakdown grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Project and Location breakdowns */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Cost by project */}
                <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                    Costs by Hetzner Project
                  </h3>
                  <div className="space-y-4">
                    {projectCosts.map(([project, stats]) => {
                      const totalSpend = data.total_spending > 0 ? data.total_spending : 1;
                      const pct = (stats.total / totalSpend) * 100;
                      return (
                        <div key={project} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-755 dark:text-slate-300">{project}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              €{stats.total.toFixed(2)} ({stats.count} resources)
                            </span>
                          </div>
                          <div className="w-full bg-slate-202 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-850">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cost by datacenter location */}
                <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <Database className="h-5 w-5 text-emerald-500" />
                    Costs by Datacenter Location
                  </h3>
                  <div className="space-y-4">
                    {locationCosts.map(([loc, stats]) => {
                      const totalSpend = data.total_spending > 0 ? data.total_spending : 1;
                      const pct = (stats.total / totalSpend) * 100;
                      return (
                        <div key={loc} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-755 dark:text-slate-300 uppercase">{loc}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              €{stats.total.toFixed(2)} ({stats.count} resources)
                            </span>
                          </div>
                          <div className="w-full bg-slate-202 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-855">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cost by resource type */}
                <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <Layers className="h-5 w-5 text-indigo-400" />
                    Costs by Resource Type
                  </h3>
                  <div className="space-y-4">
                    {typeCosts.map(([type, stats]) => {
                      const totalSpend = data.total_spending > 0 ? data.total_spending : 1;
                      const pct = (stats.total / totalSpend) * 100;
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-755 dark:text-slate-300 capitalize">{type.replace('_', ' ')}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              €{stats.total.toFixed(2)} ({stats.count} items)
                            </span>
                          </div>
                          <div className="w-full bg-slate-202 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-350 dark:border-slate-850">
                            <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Right Column: Savings recommendations and Billing list */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Cost optimization recommendations */}
                <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5" />
                    Cost Saving Recommendations
                  </h3>
                  <div className="space-y-3">
                    {data.recommendations && data.recommendations.filter(r => r.cost_impact > 0).length > 0 ? (
                      data.recommendations
                        .filter(r => r.cost_impact > 0)
                        .map((rec, idx) => (
                          <div key={idx} className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl space-y-2">
                            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                              <span className="capitalize">{rec.resource_type.replace('_', ' ')}: {rec.resource_name}</span>
                              <span className="text-amber-550">Monthly waste: €{rec.cost_impact.toFixed(2)}</span>
                            </div>
                            <p className="text-slate-605 dark:text-slate-405 font-medium">{rec.description}</p>
                            <div className="bg-slate-100 dark:bg-slate-950/80 p-2.5 rounded border border-slate-202 dark:border-slate-852 font-semibold text-slate-705 dark:text-indigo-400 mt-1">
                              💡 Recommendation: {rec.suggestion}
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-slate-505 text-xs text-center py-4">No waste detected! All active Hetzner resources are currently matched to active domains.</p>
                    )}
                  </div>
                </div>

                {/* Detailed resource list */}
                <div className="glass-panel rounded-2xl overflow-hidden border-slate-200 dark:border-slate-800">
                  <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-sm font-bold">All Resource Billing Breakdown</h3>
                    <span className="text-[10px] font-bold bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 text-indigo-550 rounded-full">
                      {data.servers.length} Resources Total
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/50">
                          <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Resource</th>
                          <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Project</th>
                          <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Type / Model</th>
                          <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Location</th>
                          <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Status</th>
                          <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5 text-right">Cost / Mo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                        {data.servers
                          .slice()
                          .sort((a, b) => b.price_monthly - a.price_monthly)
                          .map((res, idx) => {
                            const isUnmapped = data.unmapped_servers?.some(us => us.server_name === res.server_name && us.project === res.project);
                            return (
                              <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 ${isUnmapped ? 'bg-rose-500/5 dark:bg-rose-950/5' : ''}`}>
                                <td className="py-3 px-5">
                                  <div className="font-bold text-slate-700 dark:text-slate-202 flex flex-col gap-0.5">
                                    <span>{res.server_name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono font-normal">IP: {res.ip}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-5 font-semibold text-slate-500">{res.project}</td>
                                <td className="py-3 px-5 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-850">
                                      {res.server_type}
                                    </span>
                                    {res.resource_type && res.resource_type !== 'server' && (
                                      <span className={`text-[9px] font-bold px-1 rounded uppercase ${
                                        res.resource_type === 'load_balancer' 
                                          ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' 
                                          : 'bg-amber-500/10 border border-amber-500/20 text-amber-405'
                                      }`}>
                                        {res.resource_type === 'load_balancer' ? 'LB' : 'FIP'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-5 uppercase font-mono font-bold text-slate-400">{res.location}</td>
                                <td className="py-3 px-5">
                                  {isUnmapped ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 animate-pulse">
                                      Unmapped / Idle
                                    </span>
                                  ) : res.status === 'running' || res.status === 'assigned' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                      Active / Routing
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-550 dark:text-slate-450 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                      {res.status}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-5 text-right font-mono text-indigo-550 dark:text-indigo-305 font-bold">
                                  €{res.price_monthly.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Domains & WHOIS Page */}
        {activePage === 'domains' && (
          <div className="space-y-8 animate-fade-in text-xs">
            {/* Domain filter selection */}
            <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-slate-550">Domain Expiration Filter:</span>
                <select
                  value={expiryFilter}
                  onChange={(e) => setExpiryFilter(e.target.value as 'all' | 'expired' | 'expiring-soon' | 'healthy')}
                  className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-750 dark:text-slate-300 font-semibold outline-none"
                >
                  <option value="all">All Domains</option>
                  <option value="expired">Expired Only</option>
                  <option value="expiring-soon">Expiring (≤ 30 days)</option>
                  <option value="healthy">Healthy (&gt; 30 days)</option>
                </select>

                <span className="font-bold text-slate-555 ml-2">Sort By:</span>
                <select
                  value={domainSortKey}
                  onChange={(e) => setDomainSortKey(e.target.value as 'name' | 'expiry' | 'cost' | 'records')}
                  className="bg-slate-105 dark:bg-slate-955 border border-slate-202 dark:border-slate-852 p-2 rounded-lg text-slate-755 dark:text-slate-305 font-semibold outline-none"
                >
                  <option value="name">Domain Name</option>
                  <option value="expiry">Expiration Days</option>
                  <option value="records">A Records Count</option>
                  <option value="cost">Monthly Spend</option>
                </select>
                <button
                  onClick={() => setDomainSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="bg-slate-105 hover:bg-slate-202 dark:bg-slate-955 dark:hover:bg-slate-900 border border-slate-202 dark:border-slate-852 p-2 rounded-lg text-slate-750 dark:text-slate-350 cursor-pointer font-bold transition"
                >
                  {domainSortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
              </div>
            </div>

            {/* Expirations timeline alert list */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Expiration Timeline Panel */}
              <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  Upcoming Expiration Timeline
                </h3>
                
                <div className="relative border-l border-slate-205 dark:border-slate-805 pl-4 ml-2 space-y-6 pt-2">
                  {Object.entries(data.domain_expirations)
                    .slice()
                    .sort((a, b) => (a[1].days_left ?? 9999) - (b[1].days_left ?? 9999))
                    .map(([domain, info]) => {
                      const days = info.days_left;
                      const isExpired = days !== null && days < 0;
                      let color = "bg-emerald-500";
                      if (isExpired) color = "bg-rose-500";
                      else if (days !== null && days <= 30) color = "bg-amber-500";
                      
                      return (
                        <div key={domain} className="relative">
                          {/* Timeline node */}
                          <span className={`absolute -left-[21px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#030712] ${color}`}></span>
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-705 dark:text-slate-205 block">{domain}</span>
                            <span className="text-[10px] text-slate-500 font-medium font-mono">
                              {days !== null ? (isExpired ? `Expired ${Math.abs(days)} days ago` : `${days} days remaining`) : 'Expiry unknown'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Detailed domains table */}
              <div className="lg:col-span-2 glass-panel rounded-2xl border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-sm font-bold">Cloudflare Zones Expiry & Summary</h3>
                  <span className="font-bold text-[10px] bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/25 text-indigo-550 rounded-full">
                    {Object.keys(data.domain_expirations).length} Zones
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/50">
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Domain Zone</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Expiration Date</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Days Left</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">A Records</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5 text-right">Zone Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                      {sortedDomains.map(([domain, records]) => {
                        const info = data.domain_expirations[domain];
                        const days = info?.days_left;
                        const isExpired = days !== null && days < 0;
                        const cost = records.reduce((sum, r) => sum + r.price_monthly, 0);

                        return (
                          <tr key={domain} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                            <td className="py-3.5 px-5 font-bold text-slate-700 dark:text-slate-202">{domain}</td>
                            <td className="py-3.5 px-5 font-mono text-slate-550 font-semibold">{info?.expiry_date || 'N/A'}</td>
                            <td className="py-3.5 px-5">
                              {days !== null ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  isExpired 
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                                    : days <= 30 
                                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-505' 
                                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                }`}>
                                  {isExpired ? `Expired (${Math.abs(days)}d)` : `${days} days left`}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 font-bold text-slate-550">{records.length} records</td>
                            <td className="py-3.5 px-5 text-right font-mono text-indigo-550 dark:text-indigo-305 font-bold">
                              €{cost.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Compute Resources Page */}
        {activePage === 'compute' && (
          <div className="space-y-8 animate-fade-in text-xs">
            {/* Top specs summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Active Compute Nodes</span>
                <span className="text-3xl font-black text-indigo-505 block mt-2">{computeStats.serversCount} Servers</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total vCPUs Allocated</span>
                <span className="text-3xl font-black text-indigo-405 block mt-2">{computeStats.cores} Cores</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total RAM Provisioned</span>
                <span className="text-3xl font-black text-emerald-505 block mt-2">{computeStats.memory} GB</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total SSD NVMe Storage</span>
                <span className="text-3xl font-black text-slate-105 block mt-2">{computeStats.disk} GB</span>
              </div>
            </div>

            {/* OS Breakdown and specifications */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* OS distribution */}
              <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-550" />
                  Operating System Distribution
                </h3>
                <div className="space-y-4 pt-2">
                  {osBreakdown.map(([os, count]) => {
                    const totalSrv = computeStats.serversCount > 0 ? computeStats.serversCount : 1;
                    const pct = (count / totalSrv) * 100;
                    return (
                      <div key={os} className="space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span className="text-slate-705 dark:text-slate-205">{os}</span>
                          <span className="text-slate-500 dark:text-slate-400">{count} servers ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-slate-202 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-850">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed specs table */}
              <div className="lg:col-span-2 glass-panel rounded-2xl border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-sm font-bold">Virtual Server Hardware Specifications</h3>
                  <span className="font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 text-emerald-500 rounded-full">
                    Compute List
                  </span>
                </div>
                
                <div className="overflow-x-auto text-[11px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/50">
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Server Name</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Specs (CPU/RAM/Disk)</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Image / OS</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Datacenter</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Status</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Protection</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                      {data.servers
                        .filter(s => s.resource_type === 'server' || !s.resource_type)
                        .map((srv, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                            <td className="py-3 px-5">
                              <div className="font-bold text-slate-705 dark:text-slate-202">
                                {srv.server_name}
                                <span className="text-[10px] text-slate-500 font-mono font-normal block">IP: {srv.ip}</span>
                              </div>
                            </td>
                            <td className="py-3 px-5 font-medium">
                              <div className="flex gap-1 items-center">
                                <span className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-350">{srv.cores} vCPU</span>
                                <span className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-350">{srv.memory} GB</span>
                                <span className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-350">{srv.disk} GB SSD</span>
                              </div>
                            </td>
                            <td className="py-3 px-5 font-semibold text-slate-500">{srv.image || 'N/A'}</td>
                            <td className="py-3 px-5 uppercase font-bold text-slate-400">
                              <div className="flex flex-col gap-0.2 select-none">
                                <span>{srv.location}</span>
                                <span className="text-[9px] font-normal text-slate-550 lowercase font-mono">{srv.datacenter}</span>
                              </div>
                            </td>
                            <td className="py-3 px-5">
                              {srv.status === 'running' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  Running
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                  {srv.status}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-5">
                              <div className="flex flex-wrap gap-1 font-mono text-[9px] select-none">
                                <span className={`px-1.5 py-0.2 rounded border ${srv.protection_delete ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold' : 'bg-slate-100 dark:bg-slate-955 border-slate-200 dark:border-slate-852 text-slate-400'}`}>
                                  Delete: {srv.protection_delete ? 'On' : 'Off'}
                                </span>
                                {srv.locked && (
                                  <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-1.5 py-0.2 rounded font-bold animate-pulse">
                                    LOCKED
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Security & Ports Page */}
        {activePage === 'security' && (
          <div className="space-y-8 animate-fade-in text-xs">
            {/* Top specs summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Scanned IPs</span>
                <span className="text-3xl font-black block mt-2 text-slate-105">{Object.keys(data.port_audit_results || {}).length} IPs</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">SSH Exposed (22)</span>
                <span className={`text-3xl font-black block mt-2 ${Object.values(data.port_audit_results || {}).filter(ports => ports["22"]).length > 0 ? 'text-amber-505 animate-pulse font-bold' : 'text-emerald-505'}`}>
                  {Object.values(data.port_audit_results || {}).filter(ports => ports["22"]).length} open
                </span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">RDP Exposed (3389)</span>
                <span className={`text-3xl font-black block mt-2 ${Object.values(data.port_audit_results || {}).filter(ports => ports["3389"]).length > 0 ? 'text-rose-505 animate-pulse font-bold' : 'text-emerald-555'}`}>
                  {Object.values(data.port_audit_results || {}).filter(ports => ports["3389"]).length} open
                </span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">HTTP Service (80)</span>
                <span className="text-3xl font-black text-indigo-505 block mt-2">
                  {Object.values(data.port_audit_results || {}).filter(ports => ports["80"]).length} open
                </span>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">HTTPS Secure (443)</span>
                <span className="text-3xl font-black text-emerald-505 block mt-2">
                  {Object.values(data.port_audit_results || {}).filter(ports => ports["443"]).length} open
                </span>
              </div>
            </div>

            {/* Security Alerts and details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Security alerts list */}
              <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  Management Port Security Alerts
                </h3>
                
                <div className="space-y-3 pt-2">
                  {(() => {
                    const rdpOpen = Object.entries(data.port_audit_results || {}).filter(([, ports]) => ports["3389"]);
                    const sshOpen = Object.entries(data.port_audit_results || {}).filter(([, ports]) => ports["22"]);
                    
                    if (rdpOpen.length === 0 && sshOpen.length === 0) {
                      return (
                        <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-xl text-center text-emerald-500 font-bold">
                          ✅ Zero management ports (SSH/RDP) are exposed directly to the public internet!
                        </div>
                      );
                    }
                    
                    return (
                      <>
                        {rdpOpen.map(([ip]) => {
                          const serverName = data.servers.find(s => s.ip === ip)?.server_name || "Unknown Server";
                          return (
                            <div key={ip} className="bg-rose-500/5 border border-rose-550/20 p-3 rounded-xl space-y-1">
                              <span className="font-bold text-rose-550 block">⚠️ CRITICAL: RDP Port 3389 Exposed</span>
                              <span className="text-[10px] text-slate-750 dark:text-slate-300 font-medium">Server '{serverName}' ({ip}) is exposing Remote Desktop. RDP ports are frequently targeted by brute-force network scanners.</span>
                            </div>
                          );
                        })}
                        {sshOpen.map(([ip]) => {
                          const serverName = data.servers.find(s => s.ip === ip)?.server_name || "Unknown Server";
                          return (
                            <div key={ip} className="bg-amber-550/5 border border-amber-500/20 p-3 rounded-xl space-y-1">
                              <span className="font-bold text-amber-555 block">⚠️ WARNING: SSH Port 22 Exposed</span>
                              <span className="text-[10px] text-slate-750 dark:text-slate-300 font-medium">Server '{serverName}' ({ip}) exposes standard SSH port 22. Ensure password authentication is disabled and use key-based auth.</span>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Detailed logs table */}
              <div className="lg:col-span-2 glass-panel rounded-2xl border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-sm font-bold">Port Audit Log details</h3>
                  <span className="font-bold text-[10px] bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 text-indigo-550 rounded-full">
                    Network Scan logs
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/50">
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Target IP</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Resource/Hostname</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">SSH (22)</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">HTTP (80)</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">HTTPS (443)</th>
                        <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">RDP (3389)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                      {Object.entries(data.port_audit_results || {}).map(([ip, ports]) => {
                        const srv = data.servers.find(s => s.ip === ip);
                        const labelName = srv ? `${srv.server_name} (${srv.project})` : "Unmapped Target / DNS Host";
                        
                        return (
                          <tr key={ip} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                            <td className="py-3 px-5 font-bold font-mono text-indigo-600 dark:text-indigo-400">{ip}</td>
                            <td className="py-3 px-5 font-semibold text-slate-500">{labelName}</td>
                            <td className="py-3 px-5">
                              <span className={`px-2 py-0.5 rounded font-bold ${ports["22"] ? 'bg-amber-500/15 text-amber-505' : 'bg-slate-100 dark:bg-slate-900 text-slate-450 dark:text-slate-655 border border-slate-202 dark:border-slate-802'}`}>
                                {ports["22"] ? "OPEN" : "closed"}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <span className={`px-2 py-0.5 rounded font-bold ${ports["80"] ? 'bg-sky-500/15 text-sky-550 font-bold' : 'bg-slate-100 dark:bg-slate-900 text-slate-450 dark:text-slate-655 border border-slate-202 dark:border-slate-802'}`}>
                                {ports["80"] ? "OPEN" : "closed"}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <span className={`px-2 py-0.5 rounded font-bold ${ports["443"] ? 'bg-emerald-500/15 text-emerald-555 font-bold' : 'bg-slate-100 dark:bg-slate-900 text-slate-455 dark:text-slate-655 border border-slate-202 dark:border-slate-802'}`}>
                                {ports["443"] ? "OPEN" : "closed"}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <span className={`px-2 py-0.5 rounded font-bold ${ports["3389"] ? 'bg-rose-500/15 text-rose-500 animate-pulse font-bold' : 'bg-slate-100 dark:bg-slate-900 text-slate-455 dark:text-slate-655 border border-slate-202 dark:border-slate-802'}`}>
                                {ports["3389"] ? "OPEN" : "closed"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t pt-8 pb-12 text-center text-slate-500 text-xs border-slate-200 dark:border-slate-900">
          <p>CloudMesh Auditor — Running production-grade network mapping audits.</p>
          <p className="mt-1">Generated report is strictly confidential and restricted to internal operations.</p>
        </footer>
      </div>

    </div>
  );
}
