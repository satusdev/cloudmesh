import { useState, useMemo } from 'react';
import { 
  CheckCircle, 
  Search, 
  Copy, 
  ExternalLink,
  Info,
  Check
} from 'lucide-react';
import type { CleanupFlag } from '../types';

interface CleanupTabProps {
  cleanupFlags: CleanupFlag[];
}

export function CleanupTab({ cleanupFlags }: CleanupTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dangling_dns' | 'private_ip' | 'resolution_error' | 'dead_target'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredFlags = useMemo(() => {
    return cleanupFlags.filter(flag => {
      const hostname = flag.subdomain === '@' ? flag.domain : `${flag.subdomain}.${flag.domain}`;
      const matchesSearch = hostname.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            flag.ip.includes(searchTerm) ||
                            flag.reason.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || flag.flag_type === typeFilter;
      const matchesSeverity = severityFilter === 'all' || flag.severity === severityFilter;

      return matchesSearch && matchesType && matchesSeverity;
    });
  }, [cleanupFlags, searchTerm, typeFilter, severityFilter]);

  const stats = useMemo(() => {
    const total = cleanupFlags.length;
    const dangling = cleanupFlags.filter(f => f.flag_type === 'dangling_dns').length;
    const privateIp = cleanupFlags.filter(f => f.flag_type === 'private_ip').length;
    const resError = cleanupFlags.filter(f => f.flag_type === 'resolution_error').length;
    const deadTarget = cleanupFlags.filter(f => f.flag_type === 'dead_target').length;

    return { total, dangling, privateIp, resError, deadTarget };
  }, [cleanupFlags]);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return {
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
          badge: 'bg-rose-500 text-white dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30'
        };
      case 'medium':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
          badge: 'bg-amber-500 text-white dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30'
        };
      default:
        return {
          bg: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
          badge: 'bg-slate-500 text-white dark:bg-slate-800/80 dark:text-slate-400 border border-slate-700/50'
        };
    }
  };

  const getFlagTypeLabel = (type: string) => {
    switch (type) {
      case 'dangling_dns': return 'Dangling DNS';
      case 'private_ip': return 'Private IP Exposure';
      case 'resolution_error': return 'Resolution Error';
      case 'dead_target': return 'Unresponsive Host';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Total Flags</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black">{stats.total}</span>
            <span className="text-xs text-slate-400 font-semibold">Active alerts</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider">Orphaned/Dangling</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-rose-500">{stats.dangling}</span>
            <span className="text-xs text-slate-400 font-semibold">Takeover risks</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-amber-500 font-semibold uppercase tracking-wider">Private IP</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-amber-500">{stats.privateIp}</span>
            <span className="text-xs text-slate-400 font-semibold">Internal routing</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Resolution Failures</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-indigo-500">{stats.resError}</span>
            <span className="text-xs text-slate-400 font-semibold font-semibold">Bad domains</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl transition duration-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Unresponsive</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-650 dark:text-slate-300">{stats.deadTarget}</span>
            <span className="text-xs text-slate-400 font-semibold">Dead endpoints</span>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by domain, record or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:border-indigo-500 transition duration-200"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {/* Filter by flag type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-indigo-500 transition duration-200 cursor-pointer"
            >
              <option value="all">All Issue Types</option>
              <option value="dangling_dns">Dangling DNS</option>
              <option value="private_ip">Private IP Exposure</option>
              <option value="resolution_error">Resolution Errors</option>
              <option value="dead_target">Unresponsive Target</option>
            </select>

            {/* Filter by severity */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-indigo-500 transition duration-200 cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main flags list */}
      {filteredFlags.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredFlags.map((flag) => {
            const severityStyle = getSeverityStyles(flag.severity);
            const hostname = flag.subdomain === '@' ? flag.domain : `${flag.subdomain}.${flag.domain}`;
            
            return (
              <div 
                key={flag.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 rounded-3xl p-6 transition duration-250 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold tracking-tight">{hostname}</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20">
                      {flag.dns_type}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${severityStyle.badge}`}>
                      {getFlagTypeLabel(flag.flag_type)}
                    </span>
                    <span className="text-xs font-semibold font-mono text-slate-400 ml-1">
                      {flag.ip}
                    </span>
                  </div>

                  <p className="text-sm text-slate-655 dark:text-slate-350 font-medium leading-relaxed max-w-3xl">
                    {flag.description}
                  </p>

                  <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/80 p-3.5 rounded-2xl">
                    <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Recommended Mitigation</p>
                      <p className="text-xs text-slate-605 dark:text-slate-305 font-semibold mt-0.5">{flag.suggestion}</p>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col gap-2 w-full md:w-auto shrink-0 justify-end">
                  <button
                    onClick={() => handleCopy(flag.id, hostname)}
                    className="flex-1 md:flex-initial bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300"
                  >
                    {copiedId === flag.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500 animate-scale" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Host</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`https://dash.cloudflare.com/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 md:flex-initial bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Cloudflare Panel</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-10 flex flex-col items-center text-center space-y-3">
          <div className="bg-emerald-500/20 p-4 rounded-full text-emerald-500">
            <CheckCircle className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-bold text-emerald-500">No DNS Cleanup Required</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold max-w-md">
            All Cloudflare DNS A/AAAA records point to active servers or valid public targets. No takeover vulnerabilities, resolution issues, or private IP exposures were detected.
          </p>
        </div>
      )}
    </div>
  );
}
