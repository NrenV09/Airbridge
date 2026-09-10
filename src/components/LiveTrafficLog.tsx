import React from 'react';
import { Radio, Database, Clock, Globe, ArrowUpRight, RefreshCw } from 'lucide-react';
import { ProxyLogItem } from '../types';

interface LiveTrafficLogProps {
  logs: ProxyLogItem[];
  onRefresh: () => void;
  loading: boolean;
}

export const LiveTrafficLog: React.FC<LiveTrafficLogProps> = ({ logs, onRefresh, loading }) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Live Relay Traffic Stream</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-xs text-slate-400">
            Real-time HTTP requests tunneled through this computer&apos;s Internet connection.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          title="Refresh traffic logs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto max-h-72 divide-y divide-slate-800/60 font-mono text-xs">
        {logs.length > 0 ? (
          logs.map((log) => {
            const isSuccess = log.status >= 200 && log.status < 400;
            return (
              <div
                key={log.id}
                className="py-2.5 px-2 hover:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[11px] text-slate-500">{formatTime(log.timestamp)}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-semibold">
                    {log.clientIp}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      isSuccess
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-slate-300 truncate max-w-xs sm:max-w-md font-sans text-xs">
                    {log.targetUrl}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-slate-400 text-[11px] shrink-0 font-sans">
                  <span>{formatBytes(log.bytes)}</span>
                  <span className="text-slate-500 font-mono">{log.durationMs}ms</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-6 text-center text-slate-500 text-xs font-sans">
            No relayed requests yet. Devices routing traffic through this host will show here in real-time.
          </div>
        )}
      </div>
    </div>
  );
};
