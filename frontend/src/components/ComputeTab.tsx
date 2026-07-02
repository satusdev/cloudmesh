import React from 'react';
import { 
  Database, 
  ShieldAlert, 
  ShieldCheck, 
  Key, 
  CloudLightning,
  AlertTriangle
} from 'lucide-react';
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
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedProject, setSelectedProject] = React.useState('All');

  const isEolOS = (osName: string) => {
    const lower = osName.toLowerCase();
    return lower.includes('ubuntu 16') || 
           lower.includes('ubuntu 18') || 
           lower.includes('ubuntu 14') || 
           lower.includes('debian 9') || 
           lower.includes('debian 8') || 
           lower.includes('centos 7') || 
           lower.includes('centos 6');
  };

  const activeServers = React.useMemo(() => {
    return data.servers.filter(s => s.resource_type === 'server' || !s.resource_type);
  }, [data.servers]);

  // Unique list of projects
  const projects = React.useMemo(() => {
    const list = activeServers.map(s => s.project).filter(Boolean);
    return ['All', ...Array.from(new Set(list))];
  }, [activeServers]);

  // Filtered servers
  const filteredServers = React.useMemo(() => {
    return activeServers.filter(s => {
      const matchesProject = selectedProject === 'All' || s.project === selectedProject;
      const matchesSearch = !searchTerm || 
        s.server_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.server_type && s.server_type.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesProject && matchesSearch;
    });
  }, [activeServers, selectedProject, searchTerm]);

  // Recalculated stats based on filters
  const stats = React.useMemo(() => {
    return filteredServers.reduce(
      (acc, s) => {
        acc.serversCount += 1;
        acc.cores += s.cores || 0;
        acc.memory += s.memory || 0;
        acc.disk += s.disk || 0;
        return acc;
      },
      { serversCount: 0, cores: 0, memory: 0, disk: 0 }
    );
  }, [filteredServers]);

  // Recalculated OS distribution based on filters
  const filteredOsBreakdown = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredServers.forEach(s => {
      const os = s.image || 'Custom Image';
      counts[os] = (counts[os] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredServers]);

  return (
    <div className="space-y-6">
      {/* Top Specs Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Active Compute Nodes</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black">{stats.serversCount}</span>
            <span className="text-xs text-slate-400 font-semibold">VPS instances</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">vCPUs Allocated</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-indigo-500">{stats.cores}</span>
            <span className="text-xs text-slate-400 font-semibold">Physical cores</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wider">RAM Provisioned</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-emerald-500">{stats.memory} GB</span>
            <span className="text-xs text-slate-400 font-semibold">Memory cache</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">SSD NVMe Storage</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black">{stats.disk} GB</span>
            <span className="text-xs text-slate-400 font-semibold">Disk volume</span>
          </div>
        </div>
      </div>

      {/* OS Breakdown and Server Listing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        
        {/* OS distribution Card */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-indigo-500" />
              Operating System Distribution
            </h3>
            <div className="space-y-4 pt-2">
              {filteredOsBreakdown.map(([os, count]) => {
                const totalSrv = stats.serversCount > 0 ? stats.serversCount : 1;
                const pct = (count / totalSrv) * 100;
                const isEol = isEolOS(os);
                
                return (
                  <div key={os} className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className={`flex items-center gap-1.5 ${isEol ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}`}>
                        {isEol && <span title="End of Life operating system"><AlertTriangle className="h-3.5 w-3.5" /></span>}
                        {os}
                      </span>
                      <span className="text-slate-400">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-200 dark:border-slate-800">
                      <div 
                        className={`h-full rounded-full ${isEol ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {filteredOsBreakdown.length === 0 && (
                <div className="text-center py-8 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  No operating systems found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Specs and Security Status Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black">Virtual Server Infrastructure & Configuration</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider font-semibold">Instance audit records</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search server, IP, type..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-[11px] focus:outline-none focus:border-indigo-500 w-36"
              />
              <select
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-[11px] focus:outline-none focus:border-indigo-500"
              >
                {projects.map(p => (
                  <option key={p} value={p}>{p === 'All' ? 'All Projects' : p}</option>
                ))}
              </select>
              <span className="text-[10px] bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20 text-emerald-500 rounded-full font-extrabold uppercase">
                Hetzner Cloud
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/50">
                  <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">Server Name & Specs</th>
                  <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">OS Image / Location</th>
                  <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">Security Config</th>
                  <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6 text-right">Actions / State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                {filteredServers.map((srv, idx) => {
                  const isEol = srv.image ? isEolOS(srv.image) : false;
                  const hasFirewall = srv.firewalls && srv.firewalls.length > 0;
                  const hasSshKeys = srv.ssh_keys && srv.ssh_keys.length > 0;
                  const hasBackups = srv.backup_window !== null && srv.backup_window !== undefined && srv.backup_window !== '';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-950 transition">
                      {/* Name & Specs */}
                      <td className="py-3.5 px-6">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm tracking-tight">{srv.server_name}</span>
                            <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 px-1.5 py-0.2 rounded font-extrabold uppercase">
                              {srv.project}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-slate-500 dark:text-slate-400 text-[10px]">
                              {srv.server_type}
                            </span>
                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-slate-500 dark:text-slate-400 text-[10px]">
                              {srv.cores} vCPU
                            </span>
                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-slate-500 dark:text-slate-400 text-[10px]">
                              {srv.memory} GB
                            </span>
                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-slate-500 dark:text-slate-400 text-[10px]">
                              {srv.disk} GB
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">IP: {srv.ip}</span>
                        </div>
                      </td>

                      {/* OS & Location */}
                      <td className="py-3.5 px-6">
                        <div className="flex flex-col gap-1">
                          <span className={`font-bold flex items-center gap-1 text-[11px] ${isEol ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                            {isEol && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                            {srv.image || 'Custom Image'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {srv.location} ({srv.datacenter})
                          </span>
                        </div>
                      </td>

                      {/* Security Checks */}
                      <td className="py-3.5 px-6">
                        <div className="flex flex-col gap-1">
                          {/* Firewall Badge */}
                          <div className="flex items-center gap-1.5">
                            {hasFirewall ? (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  Firewall: Active ({srv.firewalls?.length})
                                </span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-rose-500">
                                  No Firewall Connected
                                </span>
                              </>
                            )}
                          </div>

                          {/* SSH Keys Badge */}
                          <div className="flex items-center gap-1.5">
                            {hasSshKeys ? (
                              <>
                                <Key className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  SSH Auth: Keys set
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                                <span className="text-[10px] font-bold text-orange-500">
                                  Password-only (No keys)
                                </span>
                              </>
                            )}
                          </div>

                          {/* Backup Badge */}
                          <div className="flex items-center gap-1.5">
                            {hasBackups ? (
                              <>
                                <CloudLightning className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  Backups: Enabled
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-[10px] font-bold text-amber-500">
                                  Backups: Disabled
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status / State */}
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {srv.status === 'running' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              Running
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {srv.status}
                            </span>
                          )}
                          <div className="flex gap-1 font-mono text-[9px]">
                            <span className={`px-1.5 py-0.2 rounded border ${srv.protection_delete ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                              Delete Protection: {srv.protection_delete ? 'On' : 'Off'}
                            </span>
                          </div>
                          {srv.locked && (
                            <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-1.5 py-0.2 rounded font-bold animate-pulse text-[9px]">
                              LOCKED
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredServers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      No servers match the selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
