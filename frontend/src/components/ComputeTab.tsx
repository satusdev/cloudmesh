import React from 'react';
import { Database } from 'lucide-react';
import type { AuditData } from '../types';

interface ComputeTabProps {
  data: AuditData;
  computeStats: {
    serversCount: number;
    cores: number;
    memory: number;
    disk: number;
  };
  osBreakdown: [string, number][];
}

export const ComputeTab: React.FC<ComputeTabProps> = ({
  data,
  computeStats,
  osBreakdown,
}) => {
  return (
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
                    <span className="text-slate-755 dark:text-slate-205">{os}</span>
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
                          <span className="bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-350">{srv.cores} vCPU</span>
                          <span className="bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-350">{srv.memory} GB</span>
                          <span className="bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600 dark:text-slate-350">{srv.disk} GB SSD</span>
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-105 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
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
  );
};
