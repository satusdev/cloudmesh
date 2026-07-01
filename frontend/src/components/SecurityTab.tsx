import React, { useMemo } from 'react';
import { 
  ShieldAlert, 
  AlertOctagon, 
  AlertTriangle, 
  ShieldQuestion, 
  ShieldCheck
} from 'lucide-react';
import type { AuditData } from '../types';

interface SecurityTabProps {
  data: AuditData;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ data }) => {
  const alerts = data.security_alerts || [];
  
  const stats = useMemo(() => {
    const critical = alerts.filter(a => a.severity === 'critical').length;
    const high = alerts.filter(a => a.severity === 'high').length;
    const medium = alerts.filter(a => a.severity === 'medium').length;
    const low = alerts.filter(a => a.severity === 'low').length;
    return { total: alerts.length, critical, high, medium, low };
  }, [alerts]);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-rose-500/10 border-rose-550/30 text-rose-500',
          title: 'text-rose-500 font-extrabold',
          badge: 'bg-rose-600 text-white font-extrabold px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-wider',
          icon: <AlertOctagon className="h-5 w-5 text-rose-500 shrink-0" />
        };
      case 'high':
        return {
          bg: 'bg-orange-500/10 border-orange-550/20 text-orange-500',
          title: 'text-orange-500 font-extrabold',
          badge: 'bg-orange-500 text-white font-extrabold px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-wider',
          icon: <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
        };
      case 'medium':
        return {
          bg: 'bg-amber-500/10 border-amber-550/20 text-amber-600 dark:text-amber-400',
          title: 'text-amber-600 dark:text-amber-400 font-extrabold',
          badge: 'bg-amber-500 text-white dark:bg-amber-500/20 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-wider',
          icon: <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400',
          title: 'text-slate-650 dark:text-slate-400 font-bold',
          badge: 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider',
          icon: <ShieldQuestion className="h-5 w-5 text-slate-400 shrink-0" />
        };
    }
  };

  const openPortsMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    Object.entries(data.port_audit_results || {}).forEach(([ip, ports]) => {
      const open: number[] = [];
      Object.entries(ports).forEach(([p, isOpen]) => {
        if (isOpen) open.push(parseInt(p));
      });
      open.sort((a, b) => a - b);
      map[ip] = open;
    });
    return map;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Top Severity Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Total Alerts</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black">{stats.total}</span>
            <span className="text-xs text-slate-400 font-semibold">Checks failed</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider">Critical</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className={`text-3xl font-black ${stats.critical > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
              {stats.critical}
            </span>
            <span className="text-xs text-slate-400 font-semibold">Direct exploits</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-orange-500 font-semibold uppercase tracking-wider">High</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-orange-500">{stats.high}</span>
            <span className="text-xs text-slate-400 font-semibold">Exposed ports</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-amber-500 font-semibold uppercase tracking-wider">Medium</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-amber-500">{stats.medium}</span>
            <span className="text-xs text-slate-400 font-semibold">Configuration drift</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Low</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-500 dark:text-slate-400">{stats.low}</span>
            <span className="text-xs text-slate-400 font-semibold">Minor warnings</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side: Grouped Security Alerts List (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-black flex items-center gap-2 mb-4">
              <ShieldAlert className="h-5 w-5 text-rose-500" />
              Active Security Infrastructure Shortcomings
            </h3>

            <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-2">
              {alerts.length > 0 ? (
                alerts.map((alert) => {
                  const style = getSeverityStyles(alert.severity);
                  return (
                    <div 
                      key={alert.id} 
                      className={`border rounded-2xl p-4 transition duration-200 flex items-start gap-3.5 ${style.bg}`}
                    >
                      {style.icon}
                      <div className="space-y-1.5 flex-1 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className={`font-extrabold text-[13px] tracking-tight ${style.title}`}>
                            {alert.resource_name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase">
                              {alert.resource_type}
                            </span>
                            <span className={style.badge}>
                              {alert.severity}
                            </span>
                          </div>
                        </div>

                        <p className="text-slate-655 dark:text-slate-350 font-medium leading-relaxed">
                          {alert.description}
                        </p>

                        <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/40 mt-1 space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Mitigation Step</span>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">{alert.suggestion}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-2xl text-center space-y-2">
                  <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-500 inline-block">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h4 className="text-emerald-500 font-bold">Zero Security Findings</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Congratulations! Your infrastructure meets all audit standards.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Port scan logs (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800/50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black">Port Scanning Exposure Log</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">Active connection audits</p>
              </div>
              <span className="text-[10px] bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 text-indigo-500 rounded-full font-extrabold uppercase">
                {Object.keys(openPortsMap).length} IPs
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800/50">
                    <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">IP Address</th>
                    <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6">Resource Host</th>
                    <th className="font-bold text-slate-400 uppercase tracking-wider py-3.5 px-6 text-right">Open Ports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                  {Object.entries(openPortsMap).map(([ip, openPorts]) => {
                    const srv = data.servers.find(s => s.ip === ip);
                    const labelName = srv ? srv.server_name : "DNS Host / External IP";
                    const projectLabel = srv ? srv.project : "Unmapped";
                    
                    return (
                      <tr key={ip} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/20 transition">
                        <td className="py-3.5 px-6 font-bold font-mono text-indigo-650 dark:text-indigo-400">{ip}</td>
                        <td className="py-3.5 px-6">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-205">{labelName}</span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">{projectLabel}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {openPorts.length > 0 ? (
                              openPorts.map(p => {
                                const isSensitive = [3306, 5432, 27017, 6379, 9200, 21, 23, 3389].includes(p);
                                return (
                                  <span 
                                    key={p} 
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                      isSensitive 
                                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse' 
                                        : p === 22 
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
                                        : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                                    }`}
                                  >
                                    {p}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 font-semibold italic text-[11px]">All closed</span>
                            )}
                          </div>
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
