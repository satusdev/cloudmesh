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
  projectCosts,
  locationCosts,
  typeCosts,
}) => {
  return (
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
          <span className="text-3xl font-black text-emerald-555 block mt-2">
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
                    <div className="w-full bg-slate-202 dark:bg-slate-955 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-850">
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
                    <div className="w-full bg-slate-202 dark:bg-slate-955 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-855">
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
                    <div className="w-full bg-slate-202 dark:bg-slate-955 rounded-full h-1.5 overflow-hidden border border-slate-350 dark:border-slate-850">
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
                          <td className="py-3 px-5 font-semibold text-slate-550">{res.project}</td>
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
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-550 dark:text-slate-450 bg-slate-105 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
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
  );
};
