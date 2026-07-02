import React from 'react';
import { Sparkles } from 'lucide-react';

interface TopologyGraphProps {
  topologyData: {
    nodes: {
      domains: any[];
      records: any[];
      ips: any[];
      servers: any[];
      projects: any[];
    };
    edges: any[];
  };
  theme: 'light' | 'dark';
  projectCosts: [string, { total: number; count: number }][];
  selectedNodeDetails: { type: string; id: string; label?: string; ip?: string } | null;
  setSelectedNodeDetails: (node: any) => void;
}

export const TopologyGraph: React.FC<TopologyGraphProps> = ({
  topologyData,
  theme,
  projectCosts,
  selectedNodeDetails,
  setSelectedNodeDetails,
}) => {
  return (
    <section className="glass-panel p-6 rounded-2xl border-slate-200 dark:border-slate-800 relative">
      <h2 className="text-sm font-bold text-slate-400 mb-6 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-400" />
        Dynamic Infrastructure Topology Map
      </h2>

      <div className="overflow-x-auto">
        <svg width="780" height="400" className="mx-auto block overflow-visible">
          {/* Column Headers */}
          <text x="40" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Domain</text>
          <text x="210" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Cloudflare Record</text>
          <text x="390" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Resolved IP</text>
          <text x="570" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Hetzner Server</text>
          <text x="740" y="15" fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-wider">Project</text>

          {/* Edges / Paths */}
          {topologyData.edges.map((edge: any, idx: number) => {
            const dx = edge.x2 - edge.x1;
            const path = `M ${edge.x1} ${edge.y1} C ${edge.x1 + dx/2} ${edge.y1}, ${edge.x1 + dx/2} ${edge.y2}, ${edge.x2} ${edge.y2}`;
            return (
              <path
                key={idx}
                d={path}
                fill="none"
                stroke={edge.isOrphan ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.15)'}
                strokeWidth={edge.isOrphan ? 2 : 1.5}
                strokeDasharray={edge.isOrphan ? "4,4" : undefined}
              />
            );
          })}

          {/* Domain Nodes */}
          {topologyData.nodes.domains.map((node: any) => (
            <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNodeDetails({ type: 'domain', id: node.id })}>
              <circle cx={node.x} cy={node.y} r="8" fill="#4f46e5" />
              <text x={node.x - 12} y={node.y + 4} fill={theme === 'dark' ? '#cbd5e1' : '#1e293b'} fontSize="9" fontWeight="bold" textAnchor="end">{node.id}</text>
            </g>
          ))}

          {/* Cloudflare Record Nodes */}
          {topologyData.nodes.records.map((node: any) => (
            <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNodeDetails({ type: 'record', id: node.id, label: node.label, ip: node.ip })}>
              <circle cx={node.x} cy={node.y} r="5" fill={node.label === 'No match' ? '#ef4444' : '#818cf8'} />
              <text x={node.x + 8} y={node.y - 4} fill="#64748b" fontSize="8" fontWeight="medium">{node.label}</text>
            </g>
          ))}

          {/* IP Nodes */}
          {topologyData.nodes.ips.map((node: any) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="4" fill="#a7f3d0" />
              <text x={node.x + 8} y={node.y + 3} fill="#10b981" fontSize="8" fontFamily="monospace">{node.id}</text>
            </g>
          ))}

          {/* Server / LB / Floating IP Nodes */}
          {topologyData.nodes.servers.map((node: any) => {
            let fill = '#10b981';
            if (node.id === 'No match') {
              fill = '#ef4444';
            } else if (node.resourceType === 'load_balancer') {
              fill = '#6366f1';
            } else if (node.resourceType === 'floating_ip') {
              fill = '#f59e0b';
            }
            
            return (
              <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNodeDetails({ type: node.resourceType || 'server', id: node.id })}>
                <circle cx={node.x} cy={node.y} r="7" fill={fill} />
                <text x={node.x + 10} y={node.y + 3} fill={fill} fontSize="8" fontWeight="bold">{node.id}</text>
              </g>
            );
          })}

          {/* Project Nodes */}
          {topologyData.nodes.projects.map((node: any) => {
            const pCost = projectCosts.find(pc => pc[0] === node.id)?.[1]?.total || 0;
            const radius = Math.max(5, Math.min(15, 5 + pCost / 5)); // Weight project node by cost
            return (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r={radius} fill="#f59e0b" />
                <text x={node.x + radius + 4} y={node.y + 3} fill="#b45309" fontSize="8" fontWeight="bold">{node.id}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Topology Node Click Overlay */}
      {selectedNodeDetails && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs flex justify-between items-start gap-4">
          <div>
            <h4 className="font-bold text-indigo-400 capitalize mb-1">{selectedNodeDetails.type} Node Details</h4>
            <p className="text-slate-300 font-medium">Identifier: <span className="font-mono text-slate-100">{selectedNodeDetails.id}</span></p>
            {selectedNodeDetails.ip && <p className="text-slate-400 mt-0.5">Points to IP: <span className="font-mono text-slate-300">{selectedNodeDetails.ip}</span></p>}
          </div>
          <button 
            onClick={() => setSelectedNodeDetails(null)}
            className="text-slate-500 hover:text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
};
