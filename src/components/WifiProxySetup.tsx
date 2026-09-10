import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Wifi,
  Smartphone,
  Laptop,
  Check,
  Copy,
  Info,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Terminal,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { HostStatus } from '../types';

interface WifiProxySetupProps {
  status: HostStatus | null;
}

type DeviceOs = 'ios' | 'android' | 'windows' | 'macos' | 'linux';

export const WifiProxySetup: React.FC<WifiProxySetupProps> = ({ status }) => {
  const [activeOs, setActiveOs] = useState<DeviceOs>('ios');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pacQrCode, setPacQrCode] = useState<string>('');

  const hostIp = status?.primaryLocalIp || '192.168.1.100';
  const port = status?.port || 3000;
  const pacUrl = `http://${hostIp}:${port}/proxy.pac`;
  const manualProxy = `${hostIp}:${port}`;

  useEffect(() => {
    QRCode.toDataURL(pacUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setPacQrCode(url))
      .catch(() => {});
  }, [pacUrl]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium border border-indigo-500/20">
              <Wifi className="w-3.5 h-3.5" />
              <span>Full System Proxy Routing</span>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Connect Any Device via Wi-Fi Proxy / PAC
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              When other users or your own mobile devices are connected to the same Wi-Fi router or
              local network but cannot access the Internet (e.g. captive portal block, no login, or
              firewall), configuring this proxy forwards their entire device traffic through this computer.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              No Software Installation Required on Client
            </span>
          </div>
        </div>

        {/* Quick Connection Details Banner */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Method A: PAC Auto-Config (Recommended for Phones) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Method 1: Auto-Configuration (PAC URL)
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              In your phone&apos;s Wi-Fi Proxy settings, select <strong>Automatic</strong> and paste:
            </p>
            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700/80 font-mono text-xs text-amber-300 overflow-x-auto">
              <span className="flex-1 truncate select-all">{pacUrl}</span>
              <button
                id="copy-pac-url-btn"
                onClick={() => copyToClipboard(pacUrl, 'pacUrl')}
                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedField === 'pacUrl' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Method B: Manual Proxy */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Method 2: Manual Proxy (Server + Port)
              </span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                Universal
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              In Wi-Fi Proxy settings, select <strong>Manual</strong> and enter:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-700/80 flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Server / Host</div>
                  <div className="text-amber-300 font-medium truncate">{hostIp}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(hostIp, 'hostIp')}
                  className="text-slate-400 hover:text-white p-1"
                  title="Copy IP"
                >
                  {copiedField === 'hostIp' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="bg-slate-900 p-2 rounded-lg border border-slate-700/80 flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-sans">Port</div>
                  <div className="text-amber-300 font-medium">{port}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(String(port), 'port')}
                  className="text-slate-400 hover:text-white p-1"
                  title="Copy Port"
                >
                  {copiedField === 'port' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Step-by-Step Operating System Guides */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Guides */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-400" />
              <span>Step-by-Step Setup by Device OS</span>
            </h3>
            <span className="text-xs text-slate-400">Select target device:</span>
          </div>

          {/* OS Selector Tabs */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {[
              { id: 'ios', label: 'iPhone / iPad (iOS)', icon: Smartphone },
              { id: 'android', label: 'Android (Pixel / Samsung)', icon: Smartphone },
              { id: 'windows', label: 'Windows 10 / 11', icon: Laptop },
              { id: 'macos', label: 'macOS (MacBook / Mac)', icon: Laptop },
              { id: 'linux', label: 'Linux (Ubuntu / Debian)', icon: Terminal },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`btn-os-${tab.id}`}
                  onClick={() => setActiveOs(tab.id as DeviceOs)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeOs === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* OS-Specific Instructions */}
          <div className="space-y-4">
            {activeOs === 'ios' && (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    1
                  </span>
                  <div>
                    <strong className="text-white">Open iPhone Settings:</strong> Go to{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                      Settings &gt; Wi-Fi
                    </code>
                    .
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    2
                  </span>
                  <div>
                    <strong className="text-white">Select Connected Wi-Fi:</strong> Tap the blue{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 font-bold">
                      (i)
                    </code>{' '}
                    info icon next to your current Wi-Fi network.
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    3
                  </span>
                  <div>
                    <strong className="text-white">Configure HTTP Proxy:</strong> Scroll down to the
                    bottom and tap <strong>Configure Proxy</strong>.
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    4
                  </span>
                  <div>
                    <strong className="text-white">Enter Proxy URL:</strong> Select{' '}
                    <strong>Automatic</strong> and paste the PAC URL:{' '}
                    <code className="text-amber-300 font-mono font-medium">{pacUrl}</code>. Tap{' '}
                    <strong>Save</strong> at the top right.
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    Your iPhone/iPad is now connected! All apps, Safari, and iMessage will now tunnel
                    through this host computer.
                  </span>
                </div>
              </div>
            )}

            {activeOs === 'android' && (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    1
                  </span>
                  <div>
                    <strong className="text-white">Wi-Fi Settings:</strong> Go to{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                      Settings &gt; Network &amp; internet &gt; Internet (or Wi-Fi)
                    </code>
                    .
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    2
                  </span>
                  <div>
                    <strong className="text-white">Edit Network:</strong> Tap the{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-400">
                      Gear icon / Pencil
                    </code>{' '}
                    next to the Wi-Fi network you are connected to.
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    3
                  </span>
                  <div>
                    <strong className="text-white">Advanced Options:</strong> Expand{' '}
                    <strong>Advanced options</strong>, tap <strong>Proxy</strong>, and select{' '}
                    <strong>Proxy Auto-Config</strong> (or Manual).
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    4
                  </span>
                  <div>
                    <strong className="text-white">PAC Web Address:</strong> Enter{' '}
                    <code className="text-amber-300 font-mono font-medium">{pacUrl}</code> and tap{' '}
                    <strong>Save</strong>.
                  </div>
                </div>
              </div>
            )}

            {activeOs === 'windows' && (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    1
                  </span>
                  <div>
                    <strong className="text-white">Windows Settings:</strong> Press{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono">
                      Win + I
                    </kbd>{' '}
                    and navigate to{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                      Network &amp; internet &gt; Proxy
                    </code>
                    .
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    2
                  </span>
                  <div>
                    <strong className="text-white">Automatic Proxy Setup:</strong> Under{' '}
                    <strong>Use setup script</strong>, click <strong>Set up</strong>.
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    3
                  </span>
                  <div>
                    <strong className="text-white">Script Address:</strong> Toggle to{' '}
                    <strong>On</strong>, enter Script address:{' '}
                    <code className="text-amber-300 font-mono font-medium">{pacUrl}</code>, and
                    click <strong>Save</strong>.
                  </div>
                </div>
              </div>
            )}

            {activeOs === 'macos' && (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    1
                  </span>
                  <div>
                    <strong className="text-white">macOS System Settings:</strong> Open{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                      Apple Menu &gt; System Settings &gt; Network &gt; Wi-Fi
                    </code>
                    .
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    2
                  </span>
                  <div>
                    <strong className="text-white">Network Details:</strong> Click{' '}
                    <strong>Details...</strong> next to your active network, then select the{' '}
                    <strong>Proxies</strong> tab in the sidebar.
                  </div>
                </div>

                <div className="flex gap-3 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    3
                  </span>
                  <div>
                    <strong className="text-white">Enable Auto Proxy:</strong> Switch on{' '}
                    <strong>Auto proxy discovery</strong> or{' '}
                    <strong>Automatic proxy configuration</strong> and paste URL:{' '}
                    <code className="text-amber-300 font-mono font-medium">{pacUrl}</code>. Click{' '}
                    <strong>OK</strong>.
                  </div>
                </div>
              </div>
            )}

            {activeOs === 'linux' && (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                  <strong className="text-white block mb-1">Terminal Shell Environment:</strong>
                  <p className="text-slate-400 mb-2">
                    Export proxy variables so curl, wget, npm, apt, and git tunnel through this host:
                  </p>
                  <pre className="p-2.5 rounded bg-slate-900 text-amber-300 font-mono text-[11px] overflow-x-auto select-all">
{`export http_proxy="http://${hostIp}:${port}"
export https_proxy="http://${hostIp}:${port}"
export all_proxy="http://${hostIp}:${port}"`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: QR Code Card & Quick Check */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Scan for Fast Setup</h3>
            <p className="text-xs text-slate-400 mb-4">
              Point your phone camera to quickly copy the PAC Auto-Config URL or open instructions.
            </p>

            <div className="p-3 bg-white rounded-xl shadow-md mx-auto w-fit mb-4">
              {pacQrCode ? (
                <img src={pacQrCode} alt="PAC URL QR Code" className="w-40 h-40 rounded" />
              ) : (
                <div className="w-40 h-40 bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                  Loading QR...
                </div>
              )}
            </div>

            <div className="text-center space-y-1">
              <span className="text-[11px] text-slate-400">Encoded PAC URL:</span>
              <div className="font-mono text-xs text-amber-300 truncate max-w-xs mx-auto">
                {pacUrl}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Why is this better than tethering?</span>
            </div>
            <p>
              Tethering usually requires a cellular plan with hotspot quota. With this Wi-Fi proxy,
              your computer uses its <strong>regular Wi-Fi connection</strong> to share internet with
              unlimited devices without consuming cellular mobile hotspot data!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
