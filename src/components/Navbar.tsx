import React from 'react';
import { Wifi, WifiOff, Globe, Shield, RefreshCw } from 'lucide-react';
import { HostStatus } from '../types';

interface NavbarProps {
  status: HostStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onToggleSharing: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  loading,
  onRefresh,
  onToggleSharing,
  activeTab,
  setActiveTab,
}) => {
  const isOnline = status?.internetConnected ?? false;
  const isSharing = status?.isSharingActive ?? false;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-white">
                  Wi-Fi Internet Relay
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Host Gateway
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Share host Wi-Fi connection with local network users
              </p>
            </div>
          </div>

          {/* Quick Stats & Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Internet Upstream Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-300">
                Internet:{' '}
                <strong className={isOnline ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                  {isOnline ? `Connected (${status?.latencyMs || 12}ms)` : 'Disconnected'}
                </strong>
              </span>
            </div>

            {/* Host IP Indicator */}
            {status?.primaryLocalIp && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Host IP:</span>
                <span className="font-mono text-amber-300 font-medium">
                  {status.primaryLocalIp}:{status.port}
                </span>
              </div>
            )}

            {/* Refresh Button */}
            <button
              id="refresh-network-btn"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh network and clients state"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            {/* Master Sharing Toggle */}
            <button
              id="master-sharing-toggle-btn"
              onClick={onToggleSharing}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
                isSharing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isSharing ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isSharing ? 'Sharing Active' : 'Sharing Paused'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-800 overflow-x-auto no-scrollbar py-1 gap-1">
          {[
            { id: 'overview', label: 'Host Dashboard' },
            { id: 'webrtc', label: 'WebRTC P2P Relay (QR Codes)' },
            { id: 'proxy', label: 'Wi-Fi Proxy & PAC (Devices)' },
            { id: 'relay', label: 'Web Relay Browser (Zero Setup)' },
            { id: 'hotspot', label: 'Virtual Hotspot & NAT' },
            { id: 'clients', label: `Connected Devices (${status?.activeClientsCount ?? 0})` },
            { id: 'diagnostics', label: 'Diagnostics & Captive Portal' },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-blue-400 font-semibold border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
