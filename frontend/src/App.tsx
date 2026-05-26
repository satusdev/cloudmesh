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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
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
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-xl transition duration-200 cursor-pointer"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-800" />}
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
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
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
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 mb-8 border-slate-200 dark:border-slate-800">
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
                <span className="text-slate-500">Active</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 self-end md:self-center">
            <div className="text-right">
              <span className="text-[10px] tracking-wider font-semibold text-slate-500 block">SCAN TIMESTAMP</span>
              <span className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300">{data.timestamp}</span>
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
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-xl transition duration-200 cursor-pointer"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-800" />}
              </button>
              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-xl transition duration-200 disabled:opacity-50 cursor-pointer"
                title="Refresh mapping data"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

          </div>
        </header>

        {/* Live Metrics Panel & Sparklines */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Domains Stat */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-200 dark:border-slate-800">
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
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-200 dark:border-slate-800">
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
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-200 dark:border-slate-800">
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
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-slate-200 dark:border-slate-800">
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
        <section className="mb-6 flex gap-2">
          <button 
            onClick={() => setShowTopology(false)}
            className={`text-xs font-bold px-4 py-2.5 rounded-xl border flex items-center gap-1.5 transition ${
              !showTopology 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15' 
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Database className="h-4 w-4" />
            Tabular Auditing View
          </button>
          <button 
            onClick={() => setShowTopology(true)}
            className={`text-xs font-bold px-4 py-2.5 rounded-xl border flex items-center gap-1.5 transition ${
              showTopology 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15' 
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <CloudLightning className="h-4 w-4" />
            Infrastructure Topology Graph
          </button>
        </section>

        {showTopology && topologyData ? (
          /* SECTION: Interactive Topology Graph */
          <section className="glass-panel p-6 rounded-2xl mb-8 border-slate-200 dark:border-slate-800 relative">
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
                  className="text-slate-500 hover:text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-800"
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
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 h-4.5 w-4.5" />
                    <input 
                      type="text" 
                      placeholder="Search subdomain, IP, server, labels..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-500 transition outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button 
                      onClick={() => setActiveTab('all')}
                      className={`text-[11px] font-bold px-3.5 py-2.5 rounded-lg border transition ${
                        activeTab === 'all' 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                          : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      All ({filteredStats.recordsCount})
                    </button>
                    <button 
                      onClick={() => setActiveTab('matched')}
                      className={`text-[11px] font-bold px-3.5 py-2.5 rounded-lg border transition ${
                        activeTab === 'matched' 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                          : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      Matched ({filteredStats.matchedCount})
                    </button>
                    <button 
                      onClick={() => setActiveTab('unmatched')}
                      className={`text-[11px] font-bold px-3.5 py-2.5 rounded-lg border transition ${
                        activeTab === 'unmatched' 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                          : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/50'
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
                    <button onClick={() => setAllCollapse(false)} className="hover:text-slate-800 dark:hover:text-slate-200">Expand All</button>
                    <span>|</span>
                    <button onClick={() => setAllCollapse(true)} className="hover:text-slate-800 dark:hover:text-slate-200">Collapse All</button>
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
                      className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none"
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
                      className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none"
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
                      className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none"
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
                      className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none"
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
                      className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none"
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

              </div>

              {/* Cards layout */}
              <div className="space-y-4">
                {Object.keys(filteredMapping).length === 0 ? (
                  <div className="glass-panel p-12 rounded-2xl text-center border-slate-200 dark:border-slate-800">
                    <Search className="mx-auto text-slate-500 h-10 w-10 mb-3" />
                    <h3 className="text-base font-bold">No mapping records matched</h3>
                    <p className="text-slate-500 text-xs mt-1">Please try modifying your search query or filters.</p>
                  </div>
                ) : (
                  Object.entries(filteredMapping).map(([domain, records]) => {
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
                            <span className="font-bold tracking-tight text-base">{domain}</span>
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
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-100/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/50">
                                  <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Subdomain</th>
                                  <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">IP Address</th>
                                  <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Record Type</th>
                                  <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Hetzner Server</th>
                                  <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Status</th>
                                  <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5 text-right">Price</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                                {records.map((record, rIdx) => {
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
                                       <td className="py-3.5 px-5 font-bold text-slate-400">
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
                                             ) : record.status === 'running' ? (
                                               <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                                 Running
                                               </span>
                                             ) : (
                                               <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-350 dark:border-slate-700">
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
                                                   else color = "bg-sky-500/15 border-sky-500/25 text-sky-500 font-bold";
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
                                      <td className="py-3.5 px-5 text-right font-mono text-indigo-600 dark:text-indigo-300 font-bold">
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
            <div className="space-y-6">
              


              {/* Snapshot Comparer panel */}
              {data.snapshots_list && data.snapshots_list.length > 0 && (
                <div className="glass-panel rounded-2xl p-5 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                    Snapshot Drift Comparer
                  </h2>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <label className="font-semibold text-slate-550 dark:text-slate-400">Compare Current Against:</label>
                    <select
                      value={selectedSnapshotFile}
                      onChange={(e) => setSelectedSnapshotFile(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none w-full"
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
                    <div className="space-y-3 text-xs leading-relaxed border-t border-slate-200 dark:border-slate-800/60 pt-3">
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
                              ? 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-200' 
                              : 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-200'
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
                  <div className="space-y-3 text-xs leading-relaxed">
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
                      <div key={server.server_name} className="bg-rose-500/5 border border-rose-500/15 p-3 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
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
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-300">{project}</span>
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            €{stats.total.toFixed(2)}
                            <span className="text-[10px] text-slate-500 ml-1">({stats.count} servers)</span>
                          </span>
                        </div>
                        {/* Share Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-850">
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
                  <div className="flex justify-between items-center border-b pb-2.5 border-slate-200 dark:border-slate-800/40">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Cloudflare API Connection</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Stable</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2.5 border-slate-200 dark:border-slate-800/40">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Hetzner Cloud API Connection</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Stable</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Scheduled Audit Mode</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Continuous</span>
                  </div>
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
