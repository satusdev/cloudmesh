import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { AuditData, MappingItem } from '../types';

interface DomainsTabProps {
  data: AuditData;
  expiryFilter: 'all' | 'expired' | 'expiring-soon' | 'healthy';
  setExpiryFilter: (val: any) => void;
  domainSortKey: 'name' | 'expiry' | 'cost' | 'records';
  setDomainSortKey: (val: any) => void;
  domainSortOrder: 'asc' | 'desc';
  setDomainSortOrder: (val: any) => void;
  sortedDomains: [string, MappingItem[]][];
}

export const DomainsTab: React.FC<DomainsTabProps> = ({
  data,
  expiryFilter,
  setExpiryFilter,
  domainSortKey,
  setDomainSortKey,
  domainSortOrder,
  setDomainSortOrder,
  sortedDomains,
}) => {
  return (
    <div className="space-y-8 animate-fade-in text-xs">
      {/* Domain filter selection */}
      <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-550">Domain Expiration Filter:</span>
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value as any)}
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
            onChange={(e) => setDomainSortKey(e.target.value as any)}
            className="bg-slate-105 dark:bg-slate-955 border border-slate-202 dark:border-slate-852 p-2 rounded-lg text-slate-755 dark:text-slate-305 font-semibold outline-none"
          >
            <option value="name">Domain Name</option>
            <option value="expiry">Expiration Days</option>
            <option value="records">A Records Count</option>
            <option value="cost">Monthly Spend</option>
          </select>
          <button
            onClick={() => setDomainSortOrder(domainSortOrder === 'asc' ? 'desc' : 'asc')}
            className="bg-slate-105 hover:bg-slate-202 dark:bg-slate-955 dark:hover:bg-slate-900 border border-slate-202 dark:border-slate-852 p-2 rounded-lg text-slate-750 dark:text-slate-355 cursor-pointer font-bold transition"
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
          
          <div className="relative border-l border-slate-205 dark:border-slate-850 pl-4 ml-2 space-y-6 pt-2">
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
  );
};
