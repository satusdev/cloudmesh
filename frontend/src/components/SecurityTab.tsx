import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AuditData } from '../types';

interface SecurityTabProps {
  data: AuditData;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ data }) => {
  const rdpOpen = Object.entries(data.port_audit_results || {}).filter(([, ports]) => ports["3389"]);
  const sshOpen = Object.entries(data.port_audit_results || {}).filter(([, ports]) => ports["22"]);

  return (
    <div className="space-y-8 animate-fade-in text-xs">
      {/* Top specs summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Scanned IPs</span>
          <span className="text-3xl font-black block mt-2 text-slate-105">{Object.keys(data.port_audit_results || {}).length} IPs</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">SSH Exposed (22)</span>
          <span className={`text-3xl font-black block mt-2 ${sshOpen.length > 0 ? 'text-amber-505 animate-pulse font-bold' : 'text-emerald-505'}`}>
            {sshOpen.length} open
          </span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">RDP Exposed (3389)</span>
          <span className={`text-3xl font-black block mt-2 ${rdpOpen.length > 0 ? 'text-rose-505 animate-pulse font-bold' : 'text-emerald-555'}`}>
            {rdpOpen.length} open
          </span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">HTTP Service (80)</span>
          <span className="text-3xl font-black text-indigo-505 block mt-2">
            {Object.values(data.port_audit_results || {}).filter(ports => ports["80"]).length} open
          </span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">HTTPS Secure (443)</span>
          <span className="text-3xl font-black text-emerald-505 block mt-2">
            {Object.values(data.port_audit_results || {}).filter(ports => ports["443"]).length} open
          </span>
        </div>
      </div>

      {/* Security Alerts and details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Security alerts list */}
        <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            Management Port Security Alerts
          </h3>
          
          <div className="space-y-3 pt-2">
            {rdpOpen.length === 0 && sshOpen.length === 0 ? (
              <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-xl text-center text-emerald-500 font-bold">
                ✅ Zero management ports (SSH/RDP) are exposed directly to the public internet!
              </div>
            ) : (
              <>
                {rdpOpen.map(([ip]) => {
                  const serverName = data.servers.find(s => s.ip === ip)?.server_name || "Unknown Server";
                  return (
                    <div key={ip} className="bg-rose-500/5 border border-rose-550/20 p-3 rounded-xl space-y-1">
                      <span className="font-bold text-rose-550 block">⚠️ CRITICAL: RDP Port 3389 Exposed</span>
                      <span className="text-[10px] text-slate-750 dark:text-slate-300 font-medium">Server '{serverName}' ({ip}) is exposing Remote Desktop. RDP ports are frequently targeted by brute-force network scanners.</span>
                    </div>
                  );
                })}
                {sshOpen.map(([ip]) => {
                  const serverName = data.servers.find(s => s.ip === ip)?.server_name || "Unknown Server";
                  return (
                    <div key={ip} className="bg-amber-550/5 border border-amber-500/20 p-3 rounded-xl space-y-1">
                      <span className="font-bold text-amber-555 block">⚠️ WARNING: SSH Port 22 Exposed</span>
                      <span className="text-[10px] text-slate-750 dark:text-slate-300 font-medium">Server '{serverName}' ({ip}) exposes standard SSH port 22. Ensure password authentication is disabled and use key-based auth.</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Detailed logs table */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-sm font-bold">Port Audit Log details</h3>
            <span className="font-bold text-[10px] bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 text-indigo-550 rounded-full">
              Network Scan logs
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/50">
                  <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Target IP</th>
                  <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">Resource/Hostname</th>
                  <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">SSH (22)</th>
                  <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">HTTP (80)</th>
                  <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">HTTPS (443)</th>
                  <th className="font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider py-3 px-5">RDP (3389)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                {Object.entries(data.port_audit_results || {}).map(([ip, ports]) => {
                  const srv = data.servers.find(s => s.ip === ip);
                  const labelName = srv ? `${srv.server_name} (${srv.project})` : "Unmapped Target / DNS Host";
                  
                  return (
                    <tr key={ip} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="py-3 px-5 font-bold font-mono text-indigo-600 dark:text-indigo-400">{ip}</td>
                      <td className="py-3 px-5 font-semibold text-slate-550">{labelName}</td>
                      <td className="py-3 px-5">
                        <span className={`px-2 py-0.5 rounded font-bold ${ports["22"] ? 'bg-amber-500/15 text-amber-505' : 'bg-slate-100 dark:bg-slate-900 text-slate-450 dark:text-slate-655 border border-slate-202 dark:border-slate-802'}`}>
                          {ports["22"] ? "OPEN" : "closed"}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`px-2 py-0.5 rounded font-bold ${ports["80"] ? 'bg-sky-500/15 text-sky-550 font-bold' : 'bg-slate-100 dark:bg-slate-900 text-slate-450 dark:text-slate-655 border border-slate-202 dark:border-slate-802'}`}>
                          {ports["80"] ? "OPEN" : "closed"}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`px-2 py-0.5 rounded font-bold ${ports["443"] ? 'bg-emerald-500/15 text-emerald-555 font-bold' : 'bg-slate-100 dark:bg-slate-900 text-slate-455 dark:text-slate-655 border border-slate-202 dark:border-slate-802'}`}>
                          {ports["443"] ? "OPEN" : "closed"}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`px-2 py-0.5 rounded font-bold ${ports["3389"] ? 'bg-rose-500/15 text-rose-500 animate-pulse font-bold' : 'bg-slate-100 dark:bg-slate-900 text-slate-455 dark:text-slate-655 border border-slate-202 dark:border-slate-802'}`}>
                          {ports["3389"] ? "OPEN" : "closed"}
                        </span>
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
