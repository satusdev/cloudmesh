import React from 'react';
import { 
  TrendingUp, 
  ArrowRight, 
  Database, 
  CloudLightning, 
  DollarSign, 
  ShieldCheck,
  Calendar,
  AlertOctagon
} from 'lucide-react';
import type { AuditData, DomainExpiration, DiffDetails } from '../types';
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
  selectedSnapshotFile: string;
  setSelectedSnapshotFile: (val: string) => void;
  comparingError: string | null;
  comparisonDiff: DiffDetails | null;
  expiringDomains: [string, DomainExpiration][];
  generateSparkline: (data: number[]) => string;
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
  selectedSnapshotFile,
  setSelectedSnapshotFile,
  comparingError,
  comparisonDiff,
  expiringDomains,
  generateSparkline,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Live Metrics Panel & Sparklines */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Domains Stat */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider block">Audited Domains</span>
          <div className="flex items-center justify-between mt-3">
            <span className="text-3xl font-black">{data.total_domains}</span>
            {data.history_trends && data.history_trends.length > 1 && (
              <div className="opacity-80">
                <svg width="100" height="25" className="overflow-visible">
                  <path
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    d={generateSparkline(data.history_trends.map(t => t.total_domains))}
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* DNS Records Stat */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider block">DNS A / AAAA Records</span>
          <div className="flex items-center justify-between mt-3">
            <span className="text-3xl font-black">{data.total_a_records}</span>
            {data.history_trends && data.history_trends.length > 1 && (
              <div className="opacity-80">
                <svg width="100" height="25" className="overflow-visible">
                  <path
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    d={generateSparkline(data.history_trends.map(t => t.total_a_records))}
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Matched Servers Stat */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider block">Mapped Server Targets</span>
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-3xl font-black text-emerald-500">{data.matched_servers}</span>
              <span className="text-xs text-slate-400 font-semibold ml-1">/{data.servers?.length || 0}</span>
            </div>
            {data.history_trends && data.history_trends.length > 1 && (
              <div className="opacity-80">
                <svg width="100" height="25" className="overflow-visible">
                  <path
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    d={generateSparkline(data.history_trends.map(t => t.matched_servers))}
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Spend Stat */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider block">Hetzner Monthly Spend</span>
          <div className="flex items-center justify-between mt-3">
            <span className="text-3xl font-black text-indigo-500">€{data.total_spending.toFixed(2)}</span>
            {data.history_trends && data.history_trends.length > 1 && (
              <div className="opacity-80">
                <svg width="100" height="25" className="overflow-visible">
                  <path
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    d={generateSparkline(data.history_trends.map(t => t.total_spending))}
                  />
                </svg>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* View Mode Toggle: Overview or Topology */}
      <section className="flex gap-2">
        <button 
          onClick={() => setShowTopology(false)}
          className={`text-xs font-bold px-4 py-2.5 rounded-2xl border flex items-center gap-1.5 transition duration-200 cursor-pointer ${
            !showTopology 
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10' 
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <Database className="h-4 w-4" />
          Dashboard Overview
        </button>
        <button 
          onClick={() => setShowTopology(true)}
          className={`text-xs font-bold px-4 py-2.5 rounded-2xl border flex items-center gap-1.5 transition duration-200 cursor-pointer ${
            showTopology 
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10' 
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
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
        /* Simplified Overview Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
          
          {/* Left Column: Expirations and Diff Comparator */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Expiring Domains List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h2 className="text-sm font-black flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-indigo-500" />
                Domain Registration Expirations
              </h2>
              
              <div className="space-y-3">
                {expiringDomains.length > 0 ? (
                  expiringDomains.map(([domain, details]) => {
                    const daysLeft = details.days_left;
                    let badgeColor = "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
                    let label = `Expires in ${daysLeft} days`;

                    if (daysLeft !== null && daysLeft !== undefined) {
                      if (daysLeft < 0) {
                        badgeColor = "bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse font-extrabold";
                        label = `EXPIRED (${Math.abs(daysLeft)} days ago)`;
                      } else if (daysLeft <= 30) {
                        badgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold";
                        label = `Expiring soon: ${daysLeft} days`;
                      }
                    }

                    return (
                      <div key={domain} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-4.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{domain}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-semibold">{details.expiry_date}</span>
                          <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded ${badgeColor}`}>
                            {label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-slate-500 font-semibold py-4">
                    All domains are active and healthy.
                  </div>
                )}
              </div>
            </div>

            {/* Historical Snapshot Comparator */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-black flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-500" />
                    Auditing Snapshot Drift Comparison
                  </h2>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">Compare current system configuration with past backups</p>
                </div>
                
                {data.snapshots_list && data.snapshots_list.length > 0 && (
                  <select
                    value={selectedSnapshotFile}
                    onChange={(e) => setSelectedSnapshotFile(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none outline-none cursor-pointer"
                  >
                    <option value="">Compare against snapshot...</option>
                    {data.snapshots_list.map((snap) => (
                      <option key={snap.filename} value={snap.filename}>
                        {snap.timestamp} ({snap.filename.substring(0, 12)}...)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {comparingError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3 rounded-2xl font-semibold">
                  {comparingError}
                </div>
              )}

              {comparisonDiff ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* DNS diff */}
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 p-5 rounded-2xl space-y-3">
                    <h4 className="font-extrabold text-indigo-500 uppercase tracking-wider text-[10px]">Cloudflare DNS Updates</h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500">Added Records:</span>
                        <span className={`font-bold px-2 py-0.5 rounded ${comparisonDiff.dns.added.length > 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                          +{comparisonDiff.dns.added.length}
                        </span>
                      </div>
                      {comparisonDiff.dns.added.map((item, idx) => (
                        <div key={idx} className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 ml-2">
                          + {item}
                        </div>
                      ))}

                      <div className="flex justify-between items-center text-xs pt-1">
                        <span className="font-bold text-slate-500">Removed Records:</span>
                        <span className={`font-bold px-2 py-0.5 rounded ${comparisonDiff.dns.removed.length > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                          -{comparisonDiff.dns.removed.length}
                        </span>
                      </div>
                      {comparisonDiff.dns.removed.map((item, idx) => (
                        <div key={idx} className="font-mono text-[10px] text-rose-500 ml-2">
                          - {item}
                        </div>
                      ))}

                      <div className="flex justify-between items-center text-xs pt-1">
                        <span className="font-bold text-slate-500">Modified Records:</span>
                        <span className={`font-bold px-2 py-0.5 rounded ${comparisonDiff.dns.modified.length > 0 ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                          ~{comparisonDiff.dns.modified.length}
                        </span>
                      </div>
                      {comparisonDiff.dns.modified.map((item, idx) => (
                        <div key={idx} className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 ml-2">
                          ~ {item.subdomain}: <span className="font-mono text-rose-500">{item.old_ip}</span> <ArrowRight className="inline h-3 w-3 mx-1 text-slate-400" /> <span className="font-mono text-emerald-500">{item.new_ip}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Server diff */}
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 p-5 rounded-2xl space-y-3">
                    <h4 className="font-extrabold text-indigo-500 uppercase tracking-wider text-[10px]">Hetzner Compute Updates</h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500">Added Servers:</span>
                        <span className={`font-bold px-2 py-0.5 rounded ${comparisonDiff.servers.added.length > 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                          +{comparisonDiff.servers.added.length}
                        </span>
                      </div>
                      {comparisonDiff.servers.added.map((item, idx) => (
                        <div key={idx} className="font-semibold text-emerald-600 dark:text-emerald-400 ml-2">
                          + {item}
                        </div>
                      ))}

                      <div className="flex justify-between items-center text-xs pt-1">
                        <span className="font-bold text-slate-500">Removed Servers:</span>
                        <span className={`font-bold px-2 py-0.5 rounded ${comparisonDiff.servers.removed.length > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                          -{comparisonDiff.servers.removed.length}
                        </span>
                      </div>
                      {comparisonDiff.servers.removed.map((item, idx) => (
                        <div key={idx} className="font-semibold text-rose-500 ml-2">
                          - {item}
                        </div>
                      ))}

                      <div className="flex justify-between items-center text-xs pt-1">
                        <span className="font-bold text-slate-500">Status Changed:</span>
                        <span className={`font-bold px-2 py-0.5 rounded ${comparisonDiff.servers.status_changed.length > 0 ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                          ~{comparisonDiff.servers.status_changed.length}
                        </span>
                      </div>
                      {comparisonDiff.servers.status_changed.map((item, idx) => (
                        <div key={idx} className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 ml-2">
                          ~ {item.server_name}: <span className="font-bold text-rose-500">{item.old_status}</span> <ArrowRight className="inline h-3 w-3 mx-1 text-slate-400" /> <span className="font-bold text-emerald-500">{item.new_status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 font-semibold py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                  Select a historical snapshot snapshot file above to compare infrastructure drift.
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Unmapped servers and project costs breakdowns */}
          <div className="space-y-6">
            
            {/* Unmapped servers card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-black flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-rose-500 shrink-0" />
                  Idle Unmapped Compute Nodes
                </h2>
                <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
                  {data.unmapped_servers?.length || 0} waste
                </span>
              </div>

              <div className="space-y-3">
                {data.unmapped_servers && data.unmapped_servers.length > 0 ? (
                  data.unmapped_servers.map((server, idx) => (
                    <div key={idx} className="bg-rose-500/[0.03] border border-rose-500/10 hover:border-rose-500/20 transition p-4 rounded-2xl flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">{server.server_name}</span>
                        <span className="text-rose-500 font-extrabold">€{server.price_monthly.toFixed(2)}/mo</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mt-1">
                        <span>IP: {server.ip}</span>
                        <span>Project: {server.project}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 font-semibold py-4">
                    All active Hetzner servers are mapped to subdomains.
                  </div>
                )}
              </div>
            </div>

            {/* Project cost progress bar list */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h2 className="text-sm font-black flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-indigo-500" />
                Costs by Hetzner Project
              </h2>

              <div className="space-y-4">
                {projectCosts.map(([project, stats]) => {
                  const totalSpend = data.total_spending > 0 ? data.total_spending : 1;
                  const pct = (stats.total / totalSpend) * 100;
                  
                  return (
                    <div key={project} className="space-y-1.5">
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-600 dark:text-slate-300">{project}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          €{stats.total.toFixed(2)}
                          <span className="text-[10px] text-slate-400 ml-1">({stats.count} servers)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-200 dark:border-slate-800">
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

            {/* System Connection audit nodes */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h2 className="text-sm font-black flex items-center gap-2 mb-4">
                <ShieldCheck className="h-5 w-5 text-indigo-500" />
                Auditor Node Connection Status
              </h2>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center border-b pb-2.5 border-slate-100 dark:border-slate-800/60 font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Cloudflare API</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Online</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2.5 border-slate-100 dark:border-slate-800/60 font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Hetzner Cloud API</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Online</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Scheduled Daemon</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Continuous</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
