import React from 'react';
import { 
  TrendingUp, AlertTriangle, ArrowRight, ChevronUp, ChevronDown, 
  Database, CloudLightning, SlidersHorizontal, 
  DollarSign, Search, ShieldCheck 
} from 'lucide-react';
import type { AuditData, MappingItem, DomainExpiration, DiffDetails } from '../types';
import { TopologyGraph } from './TopologyGraph';

interface OverviewTabProps {
  data: AuditData;
  theme: 'light' | 'dark';
  showTopology: boolean;
  setShowTopology: (val: boolean) => void;
  topologyData: any;
  selectedNodeDetails: any;
  setSelectedNodeDetails: (node: any) => void;
  projectCosts: [string, { total: number; count: number }][];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  activeTab: 'all' | 'matched' | 'unmatched';
  setActiveTab: (val: 'all' | 'matched' | 'unmatched') => void;
  filteredStats: { recordsCount: number; matchedCount: number; unmatchedCount: number };
  proxyFilter: 'all' | 'proxied' | 'dns-only';
  setProxyFilter: (val: 'all' | 'proxied' | 'dns-only') => void;
  dnsTypeFilter: 'all' | 'A' | 'AAAA';
  setDnsTypeFilter: (val: 'all' | 'A' | 'AAAA') => void;
  wildcardFilter: 'all' | 'wildcard' | 'standard';
  setWildcardFilter: (val: 'all' | 'wildcard' | 'standard') => void;
  expiryFilter: 'all' | 'expired' | 'expiring-soon' | 'healthy';
  setExpiryFilter: (val: 'all' | 'expired' | 'expiring-soon' | 'healthy') => void;
  selectedProject: string;
  setSelectedProject: (val: string) => void;
  projectList: string[];
  costRange: number;
  setCostRange: (val: number) => void;
  domainSortKey: 'name' | 'expiry' | 'cost' | 'records';
  setDomainSortKey: (val: 'name' | 'expiry' | 'cost' | 'records') => void;
  domainSortOrder: 'asc' | 'desc';
  setDomainSortOrder: (val: 'asc' | 'desc') => void;
  dnsSortKey: 'subdomain' | 'latency' | 'price';
  setDnsSortKey: (val: 'subdomain' | 'latency' | 'price') => void;
  dnsSortOrder: 'asc' | 'desc';
  setDnsSortOrder: (val: 'asc' | 'desc') => void;
  sortedDomains: [string, MappingItem[]][];
  collapsedDomains: Record<string, boolean>;
  toggleDomain: (domain: string) => void;
  setAllCollapse: (val: boolean) => void;
  selectedSnapshotFile: string;
  setSelectedSnapshotFile: (val: string) => void;
  comparingError: string | null;
  comparisonDiff: DiffDetails | null;
  expiringDomains: [string, DomainExpiration][];
  generateSparkline: (data: number[]) => string;
  getSortedRecords: (records: MappingItem[]) => MappingItem[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  data,
  theme,
  showTopology,
  setShowTopology,
  topologyData,
  selectedNodeDetails,
  setSelectedNodeDetails,
  projectCosts,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  filteredStats,
  proxyFilter,
  setProxyFilter,
  dnsTypeFilter,
  setDnsTypeFilter,
  wildcardFilter,
  setWildcardFilter,
  expiryFilter,
  setExpiryFilter,
  selectedProject,
  setSelectedProject,
  projectList,
  costRange,
  setCostRange,
  domainSortKey,
  setDomainSortKey,
  domainSortOrder,
  setDomainSortOrder,
  dnsSortKey,
  setDnsSortKey,
  dnsSortOrder,
  setDnsSortOrder,
  sortedDomains,
  collapsedDomains,
  toggleDomain,
  setAllCollapse,
  selectedSnapshotFile,
  setSelectedSnapshotFile,
  comparingError,
  comparisonDiff,
  expiringDomains,
  generateSparkline,
  getSortedRecords,
}) => {
  return (
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
        <TopologyGraph 
          topologyData={topologyData}
          theme={theme}
          projectCosts={projectCosts}
          selectedNodeDetails={selectedNodeDetails}
          setSelectedNodeDetails={setSelectedNodeDetails}
        />
      ) : (
        /* Tabular Auditing Grid */
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
                    className="w-full bg-slate-100 dark:bg-slate-955 border border-slate-205 dark:border-slate-805 hover:border-slate-305 dark:hover:border-slate-705 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-500 transition outline-none"
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
                
                {/* Proxy Filter */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Cloudflare Proxy Mode</label>
                  <select 
                    value={proxyFilter}
                    onChange={(e) => setProxyFilter(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
                  >
                    <option value="all">All Records</option>
                    <option value="proxied">Proxied Only</option>
                    <option value="dns-only">DNS Only (Bypassed)</option>
                  </select>
                </div>

                {/* DNS Type Filter */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">DNS record Type</label>
                  <select 
                    value={dnsTypeFilter}
                    onChange={(e) => setDnsTypeFilter(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
                  >
                    <option value="all">All (A & AAAA)</option>
                    <option value="A">A Records (IPv4)</option>
                    <option value="AAAA">AAAA Records (IPv6)</option>
                  </select>
                </div>

                {/* Subdomain wildcard Filter */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Subdomain Format</label>
                  <select 
                    value={wildcardFilter}
                    onChange={(e) => setWildcardFilter(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
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
                    onChange={(e) => setExpiryFilter(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
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
                    className="bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300 outline-none font-semibold"
                  >
                    <option value="all">All Projects</option>
                    {projectList.map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
                    ))}
                  </select>
                </div>

                {/* Cost range Filter */}
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
                    onChange={(e) => setDomainSortKey(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-955 border border-slate-202 dark:border-slate-852 p-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-semibold outline-none"
                  >
                    <option value="name">Domain Name</option>
                    <option value="expiry">Expiration Date</option>
                    <option value="cost">Monthly Spend</option>
                    <option value="records">Records Count</option>
                  </select>
                  <button
                    onClick={() => setDomainSortOrder(domainSortOrder === 'asc' ? 'desc' : 'asc')}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-955 dark:hover:bg-slate-900 border border-slate-202 dark:border-slate-852 p-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-bold cursor-pointer transition"
                  >
                    {domainSortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500">Sort Records By:</span>
                  <select
                    value={dnsSortKey}
                    onChange={(e) => setDnsSortKey(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-955 border border-slate-202 dark:border-slate-852 p-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-semibold outline-none"
                  >
                    <option value="subdomain">Subdomain name</option>
                    <option value="latency">DNS Resolution latency</option>
                    <option value="price">Monthly cost</option>
                  </select>
                  <button
                    onClick={() => setDnsSortOrder(dnsSortOrder === 'asc' ? 'desc' : 'asc')}
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
                                <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Subdomain</th>
                                <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">IP Address</th>
                                <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Record Type</th>
                                <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Hetzner Server</th>
                                <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Status</th>
                                <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5 text-right">Price</th>
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
                                    <td className="py-3.5 px-5 font-bold text-slate-700 dark:text-slate-300">
                                      {record.subdomain === '@' ? (
                                        <span className="text-slate-400 dark:text-slate-500 font-semibold">@ (root)</span>
                                      ) : (
                                        record.subdomain
                                      )}
                                    </td>
                                    
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
                                    
                                    <td className="py-3.5 px-5 font-bold text-slate-455">
                                      {record.dns_type || 'A'}
                                    </td>

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
                    className="bg-slate-105 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2 rounded-lg text-slate-705 dark:text-slate-355 outline-none w-full font-semibold"
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
                    
                    {comparisonDiff.dns.added.map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-emerald-500">
                        <span className="font-bold bg-emerald-500/10 px-1 rounded">+ DNS</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{item}</span>
                      </div>
                    ))}
                    {comparisonDiff.dns.removed.map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-rose-500">
                        <span className="font-bold bg-rose-500/10 px-1 rounded">- DNS</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{item}</span>
                      </div>
                    ))}
                    {comparisonDiff.dns.modified.map(item => (
                      <div key={item.subdomain} className="flex flex-col text-indigo-500 border-l-2 border-indigo-500/30 pl-2">
                        <span className="font-bold text-[10px] tracking-wide bg-indigo-500/10 px-1 rounded self-start">Δ IP Change</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono mt-0.5">{item.subdomain}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 font-mono">{item.old_ip} <ArrowRight className="inline h-3 w-3 mx-0.5" /> {item.new_ip}</span>
                      </div>
                    ))}
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

            {/* Unmapped Hetzner Servers */}
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
                  <span className="font-mono text-indigo-650 dark:text-indigo-405 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Continuous</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
