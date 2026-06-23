import { useEffect, useState, useMemo } from 'react';
import { 
  Server, 
  RefreshCw, 
  Sun, 
  Moon, 
  Layers, 
  Lock, 
  Unlock,
  DollarSign,
  Search,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import type { AuditData, MappingItem, DiffDetails } from './types';
import { OverviewTab } from './components/OverviewTab';
import { CostTab } from './components/CostTab';
import { DomainsTab } from './components/DomainsTab';
import { ComputeTab } from './components/ComputeTab';
import { SecurityTab } from './components/SecurityTab';

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

        {/* Overview Tab Content */}
        {activePage === 'overview' && (
          <OverviewTab
            data={data}
            theme={theme}
            showTopology={showTopology}
            setShowTopology={setShowTopology}
            topologyData={topologyData}
            selectedNodeDetails={selectedNodeDetails}
            setSelectedNodeDetails={setSelectedNodeDetails}
            projectCosts={projectCosts}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            filteredStats={filteredStats}
            proxyFilter={proxyFilter}
            setProxyFilter={setProxyFilter}
            dnsTypeFilter={dnsTypeFilter}
            setDnsTypeFilter={setDnsTypeFilter}
            wildcardFilter={wildcardFilter}
            setWildcardFilter={setWildcardFilter}
            expiryFilter={expiryFilter}
            setExpiryFilter={setExpiryFilter}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            projectList={projectList}
            costRange={costRange}
            setCostRange={setCostRange}
            domainSortKey={domainSortKey}
            setDomainSortKey={setDomainSortKey}
            domainSortOrder={domainSortOrder}
            setDomainSortOrder={setDomainSortOrder}
            dnsSortKey={dnsSortKey}
            setDnsSortKey={setDnsSortKey}
            dnsSortOrder={dnsSortOrder}
            setDnsSortOrder={setDnsSortOrder}
            sortedDomains={sortedDomains}
            collapsedDomains={collapsedDomains}
            toggleDomain={toggleDomain}
            setAllCollapse={setAllCollapse}
            selectedSnapshotFile={selectedSnapshotFile}
            setSelectedSnapshotFile={setSelectedSnapshotFile}
            comparingError={comparingError}
            comparisonDiff={comparisonDiff}
            expiringDomains={expiringDomains}
            generateSparkline={generateSparkline}
            getSortedRecords={getSortedRecords}
          />
        )}

        {/* Cost Tab Content */}
        {activePage === 'cost' && (
          <CostTab
            data={data}
            projectCosts={projectCosts}
            locationCosts={locationCosts}
            typeCosts={typeCosts}
          />
        )}

        {/* Domains Tab Content */}
        {activePage === 'domains' && (
          <DomainsTab
            data={data}
            expiryFilter={expiryFilter}
            setExpiryFilter={setExpiryFilter}
            domainSortKey={domainSortKey}
            setDomainSortKey={setDomainSortKey}
            domainSortOrder={domainSortOrder}
            setDomainSortOrder={setDomainSortOrder}
            sortedDomains={sortedDomains}
          />
        )}

        {/* Compute Tab Content */}
        {activePage === 'compute' && (
          <ComputeTab
            data={data}
            computeStats={computeStats}
            osBreakdown={osBreakdown}
          />
        )}

        {/* Security Tab Content */}
        {activePage === 'security' && (
          <SecurityTab
            data={data}
          />
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
