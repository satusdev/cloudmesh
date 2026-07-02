import React from 'react';
import { TrendingUp, Database, Layers, Sparkles } from 'lucide-react';
import type { AuditData } from '../types';

interface CostTabProps {
  data: AuditData;
  projectCosts: [string, { total: number; count: number }][];
  locationCosts: [string, { total: number; count: number }][];
  typeCosts: [string, { total: number; count: number }][];
}

export const CostTab: React.FC<CostTabProps> = ({
  data,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedProject, setSelectedProject] = React.useState('All');
  const [isRecsExpanded, setIsRecsExpanded] = React.useState(false);

  // Unique list of projects
  const projectsList = React.useMemo(() => {
    const list = data.servers.map(s => s.project).filter(Boolean);
    return ['All', ...Array.from(new Set(list))];
  }, [data.servers]);

  // Filtered resources
  const filteredResources = React.useMemo(() => {
    return data.servers.filter(s => {
      const matchesProject = selectedProject === 'All' || s.project === selectedProject;
      const matchesSearch = !searchTerm || 
        s.server_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.ip && s.ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.server_type && s.server_type.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesProject && matchesSearch;
    });
  }, [data.servers, selectedProject, searchTerm]);

  // Recalculated metrics
  const totalSpend = React.useMemo(() => {
    return filteredResources.reduce((sum, r) => sum + (r.price_monthly || 0), 0);
  }, [filteredResources]);

  const avgPrice = React.useMemo(() => {
    return filteredResources.length > 0 ? totalSpend / filteredResources.length : 0;
  }, [filteredResources, totalSpend]);

  // Dynamic breakdowns based on filtered resources
  const computedProjectCosts = React.useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredResources.forEach(r => {
      const p = r.project || 'Unknown';
      if (!map[p]) map[p] = { total: 0, count: 0 };
      map[p].total += r.price_monthly || 0;
      map[p].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredResources]);

  const computedLocationCosts = React.useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredResources.forEach(r => {
      const l = r.location || 'N/A';
      if (!map[l]) map[l] = { total: 0, count: 0 };
      map[l].total += r.price_monthly || 0;
      map[l].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredResources]);

  const computedTypeCosts = React.useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredResources.forEach(r => {
      const t = r.resource_type || 'server';
      if (!map[t]) map[t] = { total: 0, count: 0 };
      map[t].total += r.price_monthly || 0;
      map[t].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredResources]);

  // Filtered recommendations
  const filteredRecommendations = React.useMemo(() => {
    if (!data.recommendations) return [];
    return data.recommendations
      .filter(r => r.cost_impact > 0)
      .filter(rec => {
        // Find if this resource is still in the filtered list
        return filteredResources.some(f => f.server_name === rec.resource_name);
      });
  }, [data.recommendations, filteredResources]);

  return (
    <div className="space-y-8 animate-fade-in text-xs">
      {/* Top Cost summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Resource Spend</span>
          <span className="text-3xl font-black text-indigo-500 block mt-2">€{totalSpend.toFixed(2)}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Projected Annual Cost</span>
          <span className="text-3xl font-black text-indigo-400 block mt-2">€{(totalSpend * 12).toFixed(2)}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Average Resource Price</span>
          <span className="text-3xl font-black text-emerald-500 block mt-2">
            €{avgPrice.toFixed(2)}
          </span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Cost Saving Recommendations</span>
          <span className={`text-3xl font-black block mt-2 ${filteredRecommendations.length > 0 ? 'text-amber-500 animate-pulse font-bold' : 'text-slate-400'}`}>
            {filteredRecommendations.length}
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
              {computedProjectCosts.map(([project, stats]) => {
                const divisor = totalSpend > 0 ? totalSpend : 1;
                const pct = (stats.total / divisor) * 100;
                return (
                  <div key={project} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">{project}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        €{stats.total.toFixed(2)} ({stats.count} resources)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-800">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {computedProjectCosts.length === 0 && (
                <div className="text-center py-4 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  No project costs found
                </div>
              )}
            </div>
          </div>

          {/* Cost by datacenter location */}
          <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-emerald-500" />
              Costs by Datacenter Location
            </h3>
            <div className="space-y-4">
              {computedLocationCosts.map(([loc, stats]) => {
                const divisor = totalSpend > 0 ? totalSpend : 1;
                const pct = (stats.total / divisor) * 100;
                return (
                  <div key={loc} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300 uppercase">{loc}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        €{stats.total.toFixed(2)} ({stats.count} resources)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-800">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {computedLocationCosts.length === 0 && (
                <div className="text-center py-4 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  No location costs found
                </div>
              )}
            </div>
          </div>

          {/* Cost by resource type */}
          <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
              <Layers className="h-5 w-5 text-indigo-400" />
              Costs by Resource Type
            </h3>
            <div className="space-y-4">
              {computedTypeCosts.map(([type, stats]) => {
                const divisor = totalSpend > 0 ? totalSpend : 1;
                const pct = (stats.total / divisor) * 100;
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300 capitalize">{type.replace('_', ' ')}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        €{stats.total.toFixed(2)} ({stats.count} items)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-800">
                      <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {computedTypeCosts.length === 0 && (
                <div className="text-center py-4 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  No resource type costs found
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Savings recommendations and Billing list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Cost optimization recommendations */}
          <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
            <button 
              onClick={() => setIsRecsExpanded(!isRecsExpanded)}
              className="w-full flex items-center justify-between text-sm font-bold text-amber-500 hover:text-amber-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 animate-pulse" />
                Cost Saving Recommendations ({filteredRecommendations.length})
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20">
                {isRecsExpanded ? 'Collapse' : 'Expand'}
              </span>
            </button>
            
            {isRecsExpanded && (
              <div className="space-y-3 mt-4">
                {filteredRecommendations.length > 0 ? (
                  filteredRecommendations
                    .sort((a, b) => b.cost_impact - a.cost_impact)
                    .map((rec, idx) => (
                      <div key={idx} className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between items-start font-bold text-slate-800 dark:text-slate-200">
                          <span className="capitalize">{rec.resource_type.replace('_', ' ')}: {rec.resource_name}</span>
                          <div className="text-right">
                            <span className="text-amber-500 font-extrabold">Monthly waste: €{rec.cost_impact.toFixed(2)}</span>
                            {rec.resource_type === 'server' && rec.price_base !== undefined && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-normal mt-0.5">
                                (€{rec.price_base.toFixed(2)} base
                                {rec.price_backups ? ` + €${rec.price_backups.toFixed(2)} backup (20%)` : ''}
                                {rec.price_primary_ip ? ` + €${rec.price_primary_ip.toFixed(2)} IP` : ''})
                              </div>
                            )}
                            {rec.resource_type === 'volume' && rec.volume_size_gb !== undefined && rec.volume_price_per_gb !== undefined && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-normal mt-0.5">
                                ({rec.volume_size_gb}GB × €{rec.volume_price_per_gb.toFixed(4)}/GB)
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 font-medium">{rec.description}</p>
                        <div className="bg-slate-100 dark:bg-slate-950/80 p-2.5 rounded border border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-indigo-400 mt-1">
                          💡 Recommendation: {rec.suggestion}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-slate-500 dark:text-slate-400 text-xs text-center py-4 font-semibold uppercase tracking-wider text-[10px]">
                    No waste detected in selected subset! All matched resources are currently active.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Detailed resource list */}
          <div className="glass-panel rounded-2xl overflow-hidden border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-sm font-bold">All Resource Billing Breakdown</h3>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search resource..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1 text-[11px] focus:outline-none focus:border-indigo-500 w-32"
                />
                <select
                  value={selectedProject}
                  onChange={e => setSelectedProject(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 text-[11px] focus:outline-none focus:border-indigo-500"
                >
                  {projectsList.map(p => (
                    <option key={p} value={p}>{p === 'All' ? 'All Projects' : p}</option>
                  ))}
                </select>
                <span className="text-[10px] font-bold bg-indigo-500/10 px-2.5 py-0.5 border border-indigo-500/20 text-indigo-500 rounded-full uppercase">
                  {filteredResources.length} Resources Filtered
                </span>
              </div>
            </div>
            
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/50">
                    <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Resource</th>
                    <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Project</th>
                    <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Type / Model</th>
                    <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Location</th>
                    <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Status</th>
                    <th className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 px-5 text-right">Cost / Mo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                  {filteredResources
                    .slice()
                    .sort((a, b) => b.price_monthly - a.price_monthly)
                    .map((res, idx) => {
                      const isUnmapped = data.unmapped_servers?.some(us => us.server_name === res.server_name && us.project === res.project);
                      return (
                        <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 ${isUnmapped ? 'bg-rose-500/5 dark:bg-rose-950/5' : ''}`}>
                          <td className="py-3 px-5">
                            <div className="font-bold text-slate-700 dark:text-slate-200 flex flex-col gap-0.5">
                              <span>{res.server_name}</span>
                              {res.ip && <span className="text-[10px] text-slate-500 font-mono font-normal">IP: {res.ip}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-5 font-semibold text-slate-500">{res.project}</td>
                          <td className="py-3 px-5 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                {res.server_type}
                              </span>
                              {res.resource_type && res.resource_type !== 'server' && (
                                <span className={`text-[9px] font-bold px-1 rounded uppercase ${
                                  res.resource_type === 'load_balancer' 
                                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' 
                                    : res.resource_type === 'volume'
                                    ? 'bg-slate-500/10 border border-slate-500/20 text-slate-400'
                                    : res.resource_type === 'object_storage'
                                    ? 'bg-teal-500/10 border border-teal-500/20 text-teal-400'
                                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                }`}>
                                  {res.resource_type === 'load_balancer' 
                                    ? 'LB' 
                                    : res.resource_type === 'volume' 
                                    ? 'VOL' 
                                    : res.resource_type === 'object_storage' 
                                    ? 'S3' 
                                    : 'FIP'}
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
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {res.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-5 text-right font-medium">
                            <div className="font-mono text-indigo-500 dark:text-indigo-300 font-bold">
                              €{res.price_monthly.toFixed(2)}
                            </div>
                            {res.resource_type === 'server' && res.price_base !== undefined && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 leading-none">
                                €{res.price_base.toFixed(2)} base
                                {res.price_backups ? ` + €${res.price_backups.toFixed(2)} backup` : ''}
                                {res.price_primary_ip ? ` + €${res.price_primary_ip.toFixed(2)} IP` : ''}
                              </div>
                            )}
                            {res.resource_type === 'volume' && res.volume_size_gb !== undefined && res.volume_price_per_gb !== undefined && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 leading-none">
                                {res.volume_size_gb}GB × €{res.volume_price_per_gb.toFixed(4)}
                              </div>
                            )}
                            {res.resource_type === 'object_storage' && res.price_base !== undefined && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 leading-none">
                                €{res.price_base.toFixed(2)} base
                                {res.price_excess ? ` + €${res.price_excess.toFixed(2)} excess` : ''}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {filteredResources.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        No resources match the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
