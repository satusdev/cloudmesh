import { useState, useMemo } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
  Check, 
  Copy, 
  ShieldCheck, 
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';
import type { AuditData, MappingItem } from '../types';

interface MappingsTabProps {
  data: AuditData;
}

export function MappingsTab({ data }: MappingsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [proxyFilter, setProxyFilter] = useState<'all' | 'proxied' | 'dns-only'>('all');
  const [dnsTypeFilter, setDnsTypeFilter] = useState<'all' | 'A' | 'AAAA'>('all');
  const [wildcardFilter, setWildcardFilter] = useState<'all' | 'wildcard' | 'standard'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'expiring-soon' | 'healthy'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  
  const [domainSortKey, setDomainSortKey] = useState<'name' | 'expiry' | 'cost' | 'records'>('name');
  const [domainSortOrder, setDomainSortOrder] = useState<'asc' | 'desc'>('asc');
  const [dnsSortKey, setDnsSortKey] = useState<'subdomain' | 'latency' | 'price'>('subdomain');
  const [dnsSortOrder, setDnsSortOrder] = useState<'asc' | 'desc'>('asc');

  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const toggleDomain = (domain: string) => {
    setCollapsedDomains(prev => ({
      ...prev,
      [domain]: !prev[domain]
    }));
  };

  const handleCopy = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Projects list for dropdown filter
  const projectsList = useMemo(() => {
    const list = new Set<string>();
    Object.values(data.mapping_by_domain).forEach(records => {
      records.forEach(r => {
        if (r.project && r.project !== 'N/A') {
          list.add(r.project);
        }
      });
    });
    return Array.from(list);
  }, [data]);

  // Filtered mapping logic
  const filteredMapping = useMemo(() => {
    const filtered: Record<string, MappingItem[]> = {};

    Object.entries(data.mapping_by_domain).forEach(([domain, records]) => {
      // Expiration checks
      const exp = data.domain_expirations[domain];
      const daysLeft = exp?.days_left;
      
      if (expiryFilter !== 'all') {
        if (daysLeft === null || daysLeft === undefined) return;
        if (expiryFilter === 'expired' && daysLeft >= 0) return;
        if (expiryFilter === 'expiring-soon' && (daysLeft < 0 || daysLeft > 30)) return;
        if (expiryFilter === 'healthy' && daysLeft <= 30) return;
      }

      const matchingRecords = records.filter(record => {
        // Tab check
        const isMatched = record.server_name !== 'No match';
        if (activeTab === 'matched' && !isMatched) return false;
        if (activeTab === 'unmatched' && isMatched) return false;

        // Proxy check
        if (proxyFilter === 'proxied' && !record.proxied) return false;
        if (proxyFilter === 'dns-only' && record.proxied) return false;

        // DNS Type check
        if (dnsTypeFilter !== 'all' && record.dns_type !== dnsTypeFilter) return false;

        // Wildcard check
        const isWildcard = record.subdomain.startsWith('*');
        if (wildcardFilter === 'wildcard' && !isWildcard) return false;
        if (wildcardFilter === 'standard' && isWildcard) return false;

        // Project filter
        if (selectedProject !== 'all' && record.project !== selectedProject) return false;

        // Search check
        const searchLower = searchQuery.toLowerCase();
        const hostname = record.subdomain === '@' ? domain : `${record.subdomain}.${domain}`;
        const matchText = `${hostname} ${record.ip} ${record.server_name} ${record.project} ${record.dns_type}`.toLowerCase();
        
        return matchText.includes(searchLower);
      });

      if (matchingRecords.length > 0) {
        filtered[domain] = matchingRecords;
      }
    });

    return filtered;
  }, [data, searchQuery, activeTab, proxyFilter, dnsTypeFilter, wildcardFilter, expiryFilter, selectedProject]);

  // Sort Domain Zones
  const sortedDomains = useMemo(() => {
    return Object.entries(filteredMapping).sort(([domA, recsA], [domB, recsB]) => {
      let comparison = 0;
      
      if (domainSortKey === 'name') {
        comparison = domA.localeCompare(domB);
      } else if (domainSortKey === 'records') {
        comparison = recsA.length - recsB.length;
      } else if (domainSortKey === 'expiry') {
        const expA = data.domain_expirations[domA]?.days_left ?? 9999;
        const expB = data.domain_expirations[domB]?.days_left ?? 9999;
        comparison = expA - expB;
      } else if (domainSortKey === 'cost') {
        const costA = recsA.reduce((sum, r) => sum + r.price_monthly, 0);
        const costB = recsB.reduce((sum, r) => sum + r.price_monthly, 0);
        comparison = costA - costB;
      }

      return domainSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredMapping, domainSortKey, domainSortOrder, data]);

  // Sort sub-records inside a Domain Zone
  const getSortedRecords = (records: MappingItem[]) => {
    return [...records].sort((a, b) => {
      let comparison = 0;
      if (dnsSortKey === 'subdomain') {
        comparison = a.subdomain.localeCompare(b.subdomain);
      } else if (dnsSortKey === 'latency') {
        comparison = (a.dns_latency ?? 0) - (b.dns_latency ?? 0);
      } else if (dnsSortKey === 'price') {
        comparison = a.price_monthly - b.price_monthly;
      }
      return dnsSortOrder === 'asc' ? comparison : -comparison;
    });
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search domain zones, subdomains, IPs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition duration-200"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Filter buttons */}
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-2xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                activeTab === 'all' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              All Records
            </button>
            <button
              onClick={() => setActiveTab('matched')}
              className={`rounded-2xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                activeTab === 'matched' 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Matched Servers
            </button>
            <button
              onClick={() => setActiveTab('unmatched')}
              className={`rounded-2xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                activeTab === 'unmatched' 
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/10' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Unmatched Records
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Cloudflare Proxy</label>
            <select
              value={proxyFilter}
              onChange={(e) => setProxyFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Modes</option>
              <option value="proxied">Proxied (Orange)</option>
              <option value="dns-only">DNS Only (Grey)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">DNS Record Type</label>
            <select
              value={dnsTypeFilter}
              onChange={(e) => setDnsTypeFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="A">A Records</option>
              <option value="AAAA">AAAA Records</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Wildcard Mode</label>
            <select
              value={wildcardFilter}
              onChange={(e) => setWildcardFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Records</option>
              <option value="wildcard">Wildcard Only</option>
              <option value="standard">Standard Only</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Domain Expiry</label>
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Expiries</option>
              <option value="expired">Expired Domains</option>
              <option value="expiring-soon">Expiring in 30 Days</option>
              <option value="healthy">Healthy Domains</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Hetzner Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Projects</option>
              {projectsList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sorting controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sort Domains By:</span>
          <select
            value={domainSortKey}
            onChange={(e) => setDomainSortKey(e.target.value as any)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl font-bold outline-none cursor-pointer"
          >
            <option value="name">Domain Zone Name</option>
            <option value="records">Record Count</option>
            <option value="expiry">Days to Expiration</option>
            <option value="cost">Domain Total Cost</option>
          </select>
          <button
            onClick={() => setDomainSortOrder(domainSortOrder === 'asc' ? 'desc' : 'asc')}
            className="bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-extrabold cursor-pointer transition flex items-center gap-1"
          >
            <ArrowUpDown className="h-3 w-3" />
            <span>{domainSortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sort Subrecords:</span>
          <select
            value={dnsSortKey}
            onChange={(e) => setDnsSortKey(e.target.value as any)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl font-bold outline-none cursor-pointer"
          >
            <option value="subdomain">Subdomain Label</option>
            <option value="latency">DNS Query Latency</option>
            <option value="price">Server Pricing</option>
          </select>
          <button
            onClick={() => setDnsSortOrder(dnsSortOrder === 'asc' ? 'desc' : 'asc')}
            className="bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-extrabold cursor-pointer transition flex items-center gap-1"
          >
            <ArrowUpDown className="h-3 w-3" />
            <span>{dnsSortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
          </button>
        </div>
      </div>

      {/* Domain Zones list */}
      <div className="space-y-4">
        {sortedDomains.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-3xl text-center shadow-sm">
            <Search className="mx-auto text-slate-500 h-10 w-10 mb-3" />
            <h3 className="text-base font-bold">No mapping records matched</h3>
            <p className="text-slate-500 text-xs mt-1">Try resetting filters or modifying your search query.</p>
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
              <div 
                key={domain} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition duration-150"
              >
                {/* Domain Header */}
                <div 
                  onClick={() => toggleDomain(domain)}
                  className="bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-950 px-6 py-4.5 flex items-center justify-between cursor-pointer transition border-b border-slate-200 dark:border-slate-800/40"
                >
                  <div className="flex items-center gap-3">
                    <button className="text-slate-400">
                      {isCollapsed ? <ChevronUp className="-rotate-90 transition duration-200 h-4 w-4" /> : <ChevronDown className="transition duration-200 h-4 w-4" />}
                    </button>
                    <span className="font-extrabold tracking-tight text-sm">{domain}</span>
                    <span className="text-[10px] font-extrabold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                      {records.length} records
                    </span>
                  </div>

                  {expiration && (
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-xl border ${expiryColor}`}>
                      {expiryLabel}
                    </span>
                  )}
                </div>

                {/* Table Content */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800/50">
                          <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">Subdomain</th>
                          <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">IP Address</th>
                          <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">Type & Proxy</th>
                          <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">Hetzner Server Target</th>
                          <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">Project</th>
                          <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                        {sortedRecs.map((record, rIdx) => {
                          const isMatched = record.server_name !== 'No match';
                          
                          return (
                            <tr 
                              key={rIdx} 
                              className={`transition hover:bg-slate-50/60 dark:hover:bg-slate-950/20 ${
                                isMatched ? '' : 'bg-rose-500/[0.02] dark:bg-rose-950/[0.02]'
                              }`}
                            >
                              <td className="py-3.5 px-6 font-bold text-slate-800 dark:text-slate-200">
                                {record.subdomain === '@' ? (
                                  <span className="text-slate-400 dark:text-slate-500 font-semibold">@ (root)</span>
                                ) : (
                                  record.subdomain
                                )}
                              </td>
                              
                              <td className="py-3.5 px-6 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                <div className="flex items-center gap-2">
                                  <span>{record.ip}</span>
                                  <button
                                    onClick={() => handleCopy(record.ip)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                                    title="Copy IP"
                                  >
                                    {copiedIp === record.ip ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                  </button>
                                </div>
                              </td>

                              <td className="py-3.5 px-6">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-slate-200 dark:border-slate-700">
                                    {record.dns_type}
                                  </span>
                                  {record.proxied ? (
                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                      Proxied
                                    </span>
                                  ) : (
                                    <span className="bg-slate-500/10 text-slate-500 border border-slate-500/20 dark:text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                      DNS Only
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-6 font-semibold">
                                {isMatched ? (
                                  <div className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{record.server_name}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                      ({record.server_type})
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                                    <span className="text-rose-500 font-bold">Unmapped Target</span>
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-6 font-semibold text-slate-500 dark:text-slate-400">
                                {record.project && record.project !== 'N/A' ? record.project : '-'}
                              </td>

                              <td className="py-3.5 px-6 font-extrabold text-right text-slate-800 dark:text-slate-200">
                                {record.price_monthly > 0 ? `€${record.price_monthly.toFixed(2)}` : '-'}
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
  );
}
