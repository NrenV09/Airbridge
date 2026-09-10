import React, { useState } from 'react';
import {
  Users,
  Smartphone,
  Laptop,
  Tablet,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  Search,
  ArrowUpDown,
  RefreshCw,
  Ban,
  CheckCircle,
} from 'lucide-react';
import { ConnectedClient } from '../types';

interface ConnectedDevicesProps {
  clients: ConnectedClient[];
  onToggleBlock: (ip: string, newStatus: 'active' | 'blocked') => void;
  onRefresh: () => void;
  loading: boolean;
}

export const ConnectedDevices: React.FC<ConnectedDevicesProps> = ({
  clients,
  onToggleBlock,
  onRefresh,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const getDeviceIcon = (type: ConnectedClient['deviceType']) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-blue-400" />;
      case 'desktop':
        return <Laptop className="w-4 h-4 text-indigo-400" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-emerald-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.ip.includes(searchTerm) ||
      c.userAgent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.deviceType.includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Connected Devices &amp; Clients</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                {clients.length} Total Registered
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Devices on your Wi-Fi/LAN actively routing traffic through this host computer.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by IP or device..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors shrink-0"
              title="Refresh device list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Devices Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="pb-3 pl-2">Device &amp; IP</th>
                <th className="pb-3">Type / OS</th>
                <th className="pb-3">Requests</th>
                <th className="pb-3">Data Transferred</th>
                <th className="pb-3">Last Active</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-2 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length > 0 ? (
                filtered.map((client) => {
                  const isBlocked = client.status === 'blocked';
                  const isRecent = Date.now() - client.lastSeen < 300000;

                  return (
                    <tr key={client.ip} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-2 font-mono text-white font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center">
                            {getDeviceIcon(client.deviceType)}
                          </div>
                          <div>
                            <div className="font-semibold text-amber-300">{client.ip}</div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              {client.ip === '127.0.0.1' ? 'Local Machine' : 'Remote Peer'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 text-slate-300 max-w-xs">
                        <div className="capitalize font-medium text-white">{client.deviceType}</div>
                        <div className="text-[10px] text-slate-400 truncate" title={client.userAgent}>
                          {client.userAgent || 'Standard HTTP Client'}
                        </div>
                      </td>

                      <td className="py-3 text-slate-300 font-mono">{client.requestCount}</td>

                      <td className="py-3 text-emerald-400 font-mono font-medium">
                        {formatBytes(client.bytesReceived)}
                      </td>

                      <td className="py-3 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isRecent ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          <span>{formatRelativeTime(client.lastSeen)}</span>
                        </div>
                      </td>

                      <td className="py-3">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-medium border border-rose-500/30">
                            <ShieldAlert className="w-3 h-3" />
                            Blocked
                          </span>
                        ) : isRecent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-medium border border-emerald-500/30">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                            Idle
                          </span>
                        )}
                      </td>

                      <td className="py-3 pr-2 text-right">
                        <button
                          onClick={() => onToggleBlock(client.ip, isBlocked ? 'active' : 'blocked')}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            isBlocked
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isBlocked ? 'Unblock' : 'Restrict'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p className="font-medium text-slate-300">No client devices recorded yet</p>
                      <p className="text-[11px] text-slate-400">
                        When other users open your link or set their Wi-Fi proxy to this computer,
                        they will show up here in real-time.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
