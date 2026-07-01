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
  ShieldCheck,
  AlertTriangle,
  LayoutDashboard,
  Trash2,
  Menu,
  X
} from 'lucide-react';
import type { AuditData, MappingItem, DiffDetails } from './types';
import { OverviewTab } from './components/OverviewTab';
import { CostTab } from './components/CostTab';
import { MappingsTab } from './components/MappingsTab';
import { ComputeTab } from './components/ComputeTab';
import { SecurityTab } from './components/SecurityTab';
import { CleanupTab } from './components/CleanupTab';

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
    document.documentElement.classList.add('dark');
    return 'dark';
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const [activePage, setActivePage] = useState<'overview' | 'mappings' | 'compute' | 'cost' | 'security' | 'cleanup'>('overview');
  
  interface SelectedNode {
    type: string;
    id: string;
    label?: string;
    ip?: string;
  }
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<SelectedNode | null>(null);
  const [showTopology, setShowTopology] = useState(false);

  // Custom Comparison Snapshot State
  const [selectedSnapshotFile, setSelectedSnapshotFile] = useState<string>('');
  const [comparisonDiff, setComparisonDiff] = useState<DiffDetails | null>(null);
  const [comparingError, setComparingError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch('/data.json');
      if (!response.ok) {
        throw new Error('Please run the python script first to generate the initial audit report (data.json).');
      }
      const jsonData: AuditData = await response.json();
      setData(jsonData);
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

  // Load custom comparison on dropdown selection
  useEffect(() => {
    if (!selectedSnapshotFile || !data) {
      setComparisonDiff(null);
      return;
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

  // Sparkline Chart SVG Path Generator
  const generateSparkline = (points: number[]) => {
    if (points.length < 2) return '';
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;
    const width = 100;
    const height = 25;

    return points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  // Node Topology calculation
  const topologyData = useMemo(() => {
    if (!data) return null;
    const flatRecords = Object.entries(data.mapping_by_domain).flatMap(([domain, items]) => 
      items.map(item => ({ ...item, domain }))
    );

    const domains = Array.from(new Set(flatRecords.map(r => r.domain))).sort().slice(0, 8); 
    const records = flatRecords.filter(r => domains.includes(r.domain)).slice(0, 15);
    const ips = Array.from(new Set(records.map(r => r.ip))).sort();
    const servers = Array.from(new Set(records.map(r => r.server_name))).sort();
    const projects = Array.from(new Set(records.filter(r => r.project !== 'N/A').map(r => r.project))).sort();

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

    const edges: { x1: number; y1: number; x2: number; y2: number; isOrphan: boolean }[] = [];

    recordNodes.forEach(rn => {
      const dNode = domainNodes.find(dn => dn.id === rn.parentDomain);
      if (dNode) {
        edges.push({ x1: dNode.x, y1: dNode.y, x2: rn.x, y2: rn.y, isOrphan: rn.label === 'No match' });
      }
      const ipNode = ipNodes.find(ipn => ipn.id === rn.ip);
      if (ipNode) {
        edges.push({ x1: rn.x, y1: rn.y, x2: ipNode.x, y2: ipNode.y, isOrphan: rn.label === 'No match' });
      }
    });

    records.forEach(r => {
      const ipNode = ipNodes.find(ipn => ipn.id === r.ip);
      const sNode = serverNodes.find(sn => sn.id === r.server_name);
      if (ipNode && sNode) {
        edges.push({ x1: ipNode.x, y1: ipNode.y, x2: sNode.x, y2: sNode.y, isOrphan: r.server_name === 'No match' });
      }
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
  }, [data]);

  // Project billing summary
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

  // Location billing summary
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

  // Type billing summary
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

  // Hardware specs summary
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

  // OS Distribution breakdown
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

  // Expiration of domains list sorted by urgency
  const expiringDomains = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.domain_expirations)
      .sort((a, b) => {
        const daysA = a[1].days_left ?? 999999;
        const daysB = b[1].days_left ?? 999999;
        return daysA - daysB; 
      });
  }, [data]);

  if (loading) {
    return (
      <div className={`min-h-screen transition-colors duration-250 flex flex-col items-center justify-center p-4 ${theme === 'dark' ? 'bg-[#030712] text-slate-100' : 'bg-[#f8fafc] text-slate-950'}`}>
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-10 w-10 text-indigo-550 animate-spin" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Loading Auditor Dashboard...</h2>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`min-h-screen transition-colors duration-250 flex flex-col items-center justify-center p-4 ${theme === 'dark' ? 'bg-[#030712] text-slate-100' : 'bg-[#f8fafc] text-slate-950'}`}>
        <div className="max-w-md w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-850 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
          <AlertTriangle className="h-12 w-12 text-rose-500 mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Audit Session Inactive</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            {error || 'No audit records were parsed from cache or cloud credentials.'}
          </p>
          <div className="bg-slate-955 rounded-xl p-3.5 text-left font-mono text-xs text-indigo-400 mb-6 border border-slate-250 dark:border-slate-800 w-full">
            <span className="text-slate-500">$</span> ./venv/bin/python3 script.py
          </div>
          <button 
            onClick={handleRefresh}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 px-4 font-bold text-sm transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
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
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 p-2 rounded-xl transition duration-200 cursor-pointer"
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

  const criticalAlertsCount = (data.security_alerts || []).filter(a => a.severity === 'critical' || a.severity === 'high').length;
  const cleanupFlagsCount = (data.cleanup_flags || []).length;

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'mappings', label: 'DNS & Mappings', icon: Layers },
    { id: 'compute', label: 'Compute Resources', icon: Server },
    { id: 'cost', label: 'Financial Auditing', icon: DollarSign },
    { 
      id: 'security', 
      label: 'Security & Ports', 
      icon: ShieldCheck,
      badge: criticalAlertsCount > 0 ? { count: criticalAlertsCount, type: 'critical' } : null
    },
    { 
      id: 'cleanup', 
      label: 'DNS Cleanup', 
      icon: Trash2,
      badge: cleanupFlagsCount > 0 ? { count: cleanupFlagsCount, type: 'warning' } : null
    },
  ];

  return (
    <div className={`min-h-screen flex transition-colors duration-250 ${theme === 'dark' ? 'bg-[#030712] text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>
      
      {/* Sidebar Layout */}
      <aside className="w-68 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shrink-0 hidden lg:flex flex-col justify-between p-6">
        <div className="space-y-8">
          {/* Logo Header */}
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/10 p-2.5 rounded-2xl border border-indigo-500/20 text-indigo-650 dark:text-indigo-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">
                CloudMesh
              </h1>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Auditor Engine</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            {navigationItems.map(item => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition duration-200 cursor-pointer ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${
                      item.badge.type === 'critical' 
                        ? 'bg-rose-500 text-white dark:bg-rose-500/20 dark:text-rose-400' 
                        : 'bg-amber-500 text-white dark:bg-amber-500/20 dark:text-amber-400'
                    }`}>
                      {item.badge.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Utilities */}
        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Report Timestamp</span>
            <span className="text-[11px] font-mono font-bold text-slate-655 dark:text-slate-300">{data.timestamp}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleTheme}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 p-2 rounded-xl transition duration-200 cursor-pointer"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5" />}
              </button>
              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 p-2 rounded-xl transition duration-200 disabled:opacity-50 cursor-pointer"
                title="Refresh mapping data"
              >
                <RefreshCw className={`h-4.5 w-4.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {data.passcode_hash && (
              <button 
                onClick={handleLock}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-205 dark:border-slate-800/60 text-rose-500 p-2 rounded-xl transition duration-200 cursor-pointer"
                title="Lock Session"
              >
                <Lock className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header Bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" />
            <span className="font-extrabold text-sm tracking-tight">CloudMesh</span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className="text-slate-500 dark:text-slate-400 p-1.5"
            >
              {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-500 dark:text-slate-400 p-1.5"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Nav Dropdown */}
        {isMobileMenuOpen && (
          <nav className="lg:hidden bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 px-6 py-4 space-y-1 animate-slide-down">
            {navigationItems.map(item => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
                    isActive 
                      ? 'bg-indigo-650 text-white' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="bg-rose-500 text-white dark:bg-rose-500/20 dark:text-rose-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">
                      {item.badge.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
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
              selectedSnapshotFile={selectedSnapshotFile}
              setSelectedSnapshotFile={setSelectedSnapshotFile}
              comparingError={comparingError}
              comparisonDiff={comparisonDiff}
              expiringDomains={expiringDomains}
              generateSparkline={generateSparkline}
            />
          )}

          {activePage === 'mappings' && (
            <MappingsTab data={data} />
          )}

          {activePage === 'compute' && (
            <ComputeTab
              data={data}
              computeStats={computeStats}
              osBreakdown={osBreakdown}
            />
          )}

          {activePage === 'cost' && (
            <CostTab
              data={data}
              projectCosts={projectCosts}
              locationCosts={locationCosts}
              typeCosts={typeCosts}
            />
          )}

          {activePage === 'security' && (
            <SecurityTab data={data} />
          )}

          {activePage === 'cleanup' && (
            <CleanupTab cleanupFlags={data.cleanup_flags || []} />
          )}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          <p>CloudMesh Auditor — Running production-grade network mapping audits.</p>
          <p className="mt-1">Generated report is strictly confidential and restricted to internal operations.</p>
        </footer>
      </div>

    </div>
  );
}
