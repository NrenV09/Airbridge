import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Wifi,
  Globe,
  Users,
  Activity,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Server,
  Lock,
  Unlock,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { HostStatus } from '../types';

interface HostOverviewProps {
  status: HostStatus | null;
  onSelectTab: (tab: string) => void;
  onUpdatePasscode: (requireAuth: boolean, passcode: string) => void;
}

export const HostOverview: React.FC<HostOverviewProps> = ({
  status,
  onSelectTab,
  onUpdatePasscode,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isAuthEnabled, setIsAuthEnabled] = useState(status?.requireAuth ?? false);
  const [passcode, setPasscode] = useState(status?.sharingPasscode ?? '');
  const [passcodeSaved, setPasscodeSaved] = useState(false);

  useEffect(() => {
    if (status?.primaryLocalIp) {
      const shareUrl = `http://${status.primaryLocalIp}:${status.port}`;
      QRCode.toDataURL(shareUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [status?.primaryLocalIp, status?.port]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSavePasscode = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePasscode(isAuthEnabled, passcode);
    setPasscodeSaved(true);
    setTimeout(() => setPasscodeSaved(false), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const hostUrl = status ? `http://${status.primaryLocalIp}:${status.port}` : '';
  const pacUrl = status ? `http://${status.primaryLocalIp}:${status.port}/proxy.pac` : '';

  return (
    <div className="space-y-6">
      {/* Visual Architecture Flow Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Active Relay Gateway</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Sharing Wi-Fi Connection from this Computer
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              This machine is currently connected to the Internet and acts as a bridge. Other users
              or devices on your local network that cannot access the Internet can route their web
              traffic directly through this computer.
            </p>
          </div>

          {/* Quick Flow Visualization */}
          <div className="w-full lg:w-auto flex items-center justify-center gap-2 sm:gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 mb-1">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-slate-400 font-medium">Other Users</span>
              <p className="text-[10px] text-rose-400">No Internet</p>
            </div>

            <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />

            <div className="text-center relative">
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] bg-blue-600 text-white font-semibold uppercase tracking-wider">
                This PC
              </span>
              <div className="w-11 h-11 mx-auto rounded-lg bg-blue-950/80 border border-blue-500 flex items-center justify-center text-blue-400 mb-1">
                <Server className="w-6 h-6" />
              </div>
              <span className="text-white font-medium">Relay Host</span>
              <p className="text-[10px] text-amber-300 font-mono">{status?.primaryLocalIp}</p>
            </div>

            <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />

            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-lg bg-emerald-950/50 border border-emerald-500/60 flex items-center justify-center text-emerald-400 mb-1">
                <Globe className="w-5 h-5" />
              </div>
              <span className="text-slate-300 font-medium">World Wide Web</span>
              <p className="text-[10px] text-emerald-400">Connected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Internet Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Upstream Internet
            </span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status?.internetConnected ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
          </div>
          <div>
            <div className="text-xl font-bold text-white flex items-baseline gap-2">
              {status?.internetConnected ? 'Online' : 'Offline'}
              {status?.internetConnected && (
                <span className="text-xs font-normal text-emerald-400 font-mono">
                  {status.latencyMs}ms ping
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Target: {status?.upstreamTarget || '1.1.1.1 (Cloudflare)'}
            </p>
          </div>
        </div>

        {/* Local Gateway Address */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Host Local IP &amp; Port
            </span>
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-300 font-mono">
              {status?.primaryLocalIp || 'Detecting...'}:{status?.port || 3000}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-slate-400 truncate">PAC Auto-Config Ready</span>
              <button
                onClick={() => copyToClipboard(pacUrl, 'pac')}
                className="text-slate-400 hover:text-white p-0.5"
                title="Copy PAC Auto-Config URL"
              >
                {copiedField === 'pac' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Active Clients */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Connected Clients
            </span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">
              {status?.activeClientsCount ?? 0}{' '}
              <span className="text-xs font-normal text-slate-400">devices active</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {status?.totalRequestsHandled ?? 0} total requests routed
            </p>
          </div>
        </div>

        {/* Bandwidth Forwarded */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Data Forwarded
            </span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-400">
              {formatBytes(status?.totalBytesForwarded ?? 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Shared with local network peers</p>
          </div>
        </div>
      </div>

      {/* Main Action Hub: Sharing Methods */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Choose How Other Devices Connect &amp; Share
            </h2>
            <p className="text-xs text-slate-400">
              Select the sharing method best suited for their devices (phones, laptops, tablets):
            </p>
          </div>
          <button
            onClick={() => onSelectTab('webrtc')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 text-xs font-medium hover:bg-blue-600/30 transition-colors w-fit"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Launch WebRTC QR Tunnel</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: WebRTC P2P DataChannel */}
          <div
            id="card-method-webrtc"
            onClick={() => onSelectTab('webrtc')}
            className="group cursor-pointer bg-slate-950/80 hover:bg-slate-800/90 border border-blue-500/30 hover:border-blue-400 rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                  QR Code P2P
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                WebRTC DataChannel Relay
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Direct browser-to-browser tunnel with zero external signaling. Scan QR codes between devices to relay URLs, APIs, and images.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs text-blue-400 font-medium gap-1">
              <span>Connect via QR Code</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 1: Web Relay Browser */}
          <div
            id="card-method-relay"
            onClick={() => onSelectTab('relay')}
            className="group cursor-pointer bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/50 rounded-xl p-4 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium">
                  No Setup
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                Instant Web Relay
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Other users open your computer&apos;s link in their browser. Browse external websites through your connection without changing device settings.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs text-cyan-400 font-medium gap-1">
              <span>Open Web Relay Browser</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Wi-Fi Proxy / PAC */}
          <div
            id="card-method-proxy"
            onClick={() => onSelectTab('proxy')}
            className="group cursor-pointer bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Wifi className="w-5 h-5" />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                  System-Wide
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">
                Wi-Fi Proxy &amp; PAC Gateway
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Configure proxy settings on phones, iPads, and laptops. All apps, emails, messaging, and browsers tunnel through this host.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs text-indigo-400 font-medium gap-1">
              <span>View OS Setup Guides</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Virtual Hotspot */}
          <div
            id="card-method-hotspot"
            onClick={() => onSelectTab('hotspot')}
            className="group cursor-pointer bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  Hardware AP
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                Virtual Hotspot &amp; NAT
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Broadcast a fresh Wi-Fi SSID directly from this computer&apos;s wireless adapter. Uses hardware NAT routing so devices connect directly.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs text-emerald-400 font-medium gap-1">
              <span>Generate OS Hotspot Script</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* QR Code & Quick Connect Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Share Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row lg:flex-col items-center gap-5 text-center sm:text-left lg:text-center">
          <div className="p-2.5 bg-white rounded-xl shadow-md shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code for connecting to this host"
                className="w-36 h-36 rounded"
              />
            ) : (
              <div className="w-36 h-36 bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                Generating QR...
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Scan to Connect</h3>
            <p className="text-xs text-slate-300">
              Users on the same network can point their smartphone camera to open the Web Relay or
              configure proxy credentials instantly.
            </p>
            <div className="pt-1 flex flex-wrap gap-2 justify-center sm:justify-start lg:justify-center">
              <button
                onClick={() => copyToClipboard(hostUrl, 'hostUrl')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              >
                {copiedField === 'hostUrl' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Link</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Web URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Network Interfaces Detected on this Computer */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Host Network Interfaces ({status?.interfaces?.length || 0})
                </h3>
                <p className="text-xs text-slate-400">
                  Detected network adapters on this computer ({status?.osType || 'Host Machine'})
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Hostname: {status?.hostname || 'localhost'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="pb-2">Adapter</th>
                    <th className="pb-2">IPv4 Address</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Subnet Mask</th>
                    <th className="pb-2 text-right">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {status?.interfaces && status.interfaces.length > 0 ? (
                    status.interfaces.map((iface, idx) => {
                      const isPrimary = iface.address === status.primaryLocalIp;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-2.5 text-slate-200 font-semibold">{iface.name}</td>
                          <td className="py-2.5 text-amber-300 font-medium">{iface.address}</td>
                          <td className="py-2.5 text-slate-400">
                            {iface.internal ? 'Loopback (127.0.0.1)' : iface.isWifiCandidate ? 'Wi-Fi Adapter' : 'Ethernet / LAN'}
                          </td>
                          <td className="py-2.5 text-slate-400">{iface.netmask}</td>
                          <td className="py-2.5 text-right font-sans">
                            {isPrimary ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-medium border border-emerald-500/30">
                                Primary Gateway
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Interface</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        Scanning adapters...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Access Control / Passcode Form */}
          <form
            onSubmit={handleSavePasscode}
            className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={isAuthEnabled}
                  onChange={(e) => setIsAuthEnabled(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="font-medium">Require Passcode to Relay</span>
              </label>

              {isAuthEnabled && (
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter passcode..."
                    className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center gap-1"
            >
              {passcodeSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Update Access Security</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
