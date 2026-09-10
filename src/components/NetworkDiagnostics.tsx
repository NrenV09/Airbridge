import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCw,
  Globe,
  Shield,
  HelpCircle,
  Server,
  Zap,
  Lock,
} from 'lucide-react';
import { DiagnosticTarget } from '../types';

export const NetworkDiagnostics: React.FC = () => {
  const [targets, setTargets] = useState<DiagnosticTarget[]>([
    { name: 'Cloudflare Anycast (1.1.1.1)', url: 'https://1.1.1.1', status: 'pending', latencyMs: 0 },
    { name: 'Google DNS & Web (8.8.8.8)', url: 'https://www.google.com', status: 'pending', latencyMs: 0 },
    { name: 'Wikipedia Global CDN', url: 'https://en.wikipedia.org', status: 'pending', latencyMs: 0 },
    { name: 'GitHub Status Endpoint', url: 'https://github.com', status: 'pending', latencyMs: 0 },
  ]);
  const [running, setRunning] = useState<boolean>(false);
  const [lastTested, setLastTested] = useState<number | null>(null);

  const runTest = async () => {
    setRunning(true);
    try {
      const resp = await fetch('/api/network/ping');
      const data = await resp.json();
      if (data && data.results) {
        setTargets(data.results);
      }
      setLastTested(Date.now());
    } catch {
      // Fallback
      setTargets((prev) =>
        prev.map((t) => ({ ...t, status: 'failed', latencyMs: -1 }))
      );
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="space-y-6">
      {/* Upstream Latency Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Host Internet Upstream Health Check</span>
            </h3>
            <p className="text-xs text-slate-400">
              Live probes verify that this computer can reach global networks and route packets.
            </p>
          </div>

          <button
            onClick={runTest}
            disabled={running}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Pinging Upstreams...' : 'Re-Run Probes'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {targets.map((t) => {
            const isOnline = t.status === 'online';
            return (
              <div
                key={t.name}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300 truncate">{t.name}</span>
                  {t.status === 'pending' ? (
                    <RotateCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  ) : isOnline ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                </div>

                <div>
                  <div className="text-lg font-bold font-mono">
                    {t.status === 'pending' ? (
                      <span className="text-slate-500 text-sm">Testing...</span>
                    ) : isOnline ? (
                      <span className="text-emerald-400">{t.latencyMs} ms</span>
                    ) : (
                      <span className="text-rose-400 text-sm">Timeout / Unreachable</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                    {isOnline ? 'Roundtrip OK' : 'Failed to reach endpoint'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Captive Portal / Hotel Wi-Fi Bypass Explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">
            How This Fixes &ldquo;Connected to Wi-Fi, No Internet Access&rdquo;
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <strong className="text-slate-200 block text-xs">1. Captive Portal 1-Device Limit</strong>
            <p className="text-slate-400 leading-relaxed">
              In hotels, airports, or dorms, the Wi-Fi router only authorizes 1 MAC address after you
              log in with a room number or voucher. Other devices get stuck at a blank login screen.
            </p>
          </div>

          <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <strong className="text-slate-200 block text-xs">2. Host Computer as Authorized Bridge</strong>
            <p className="text-slate-400 leading-relaxed">
              Because this computer has already completed authentication with the Wi-Fi network, its
              MAC address has full internet clearance.
            </p>
          </div>

          <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <strong className="text-slate-200 block text-xs">3. Transparent Relay to All Devices</strong>
            <p className="text-slate-400 leading-relaxed">
              By setting this computer&apos;s IP as their proxy or connecting to its virtual hotspot,
              all packet requests travel through this computer&apos;s authorized connection to reach the
              Internet.
            </p>
          </div>
        </div>
      </div>

      {/* Common Blockers Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <span>Troubleshooting &amp; Common Blockers</span>
        </h3>

        <div className="space-y-2.5 text-xs text-slate-300">
          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Same Wi-Fi Network Check:</strong>
              <p className="text-slate-400 mt-0.5">
                Ensure both this host computer and the other devices are connected to the exact same
                Wi-Fi network (e.g. &ldquo;Guest-WiFi&rdquo;), or connect them directly to the Hotspot SSID.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">AP Isolation / Client Isolation:</strong>
              <p className="text-slate-400 mt-0.5">
                Some strict hotel or enterprise routers forbid devices from talking to each other
                directly (Client Isolation). If devices cannot ping this host IP, use{' '}
                <strong>Tab 3: Virtual Hotspot</strong> so they connect directly to your laptop&apos;s
                own Wi-Fi signal.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Windows Firewall Port 3000:</strong>
              <p className="text-slate-400 mt-0.5">
                Windows Defender Firewall might block incoming TCP connections on port 3000. Run{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono">
                  netsh advfirewall firewall add rule name=&quot;WiFi Relay&quot; dir=in action=allow
                  protocol=TCP localport=3000
                </code>{' '}
                in Command Prompt (Admin).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
