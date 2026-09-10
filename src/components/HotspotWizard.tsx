import React, { useState } from 'react';
import {
  Radio,
  Download,
  Copy,
  Check,
  Laptop,
  Terminal,
  Shield,
  Info,
  ExternalLink,
  ChevronRight,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { HostStatus } from '../types';

interface HotspotWizardProps {
  status: HostStatus | null;
}

type OsTab = 'windows' | 'macos' | 'linux';

export const HotspotWizard: React.FC<HotspotWizardProps> = ({ status }) => {
  const [activeOs, setActiveOs] = useState<OsTab>('windows');
  const [ssid, setSsid] = useState<string>('Host_Shared_WiFi');
  const [password, setPassword] = useState<string>('SharePass1234');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getDownloadUrl = (platform: OsTab) => {
    return `/api/scripts/${platform}?ssid=${encodeURIComponent(ssid)}&password=${encodeURIComponent(
      password
    )}`;
  };

  const windowsCmd = `REM 1. Configure Hosted Virtual Wi-Fi Network
netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"

REM 2. Start the Wi-Fi Broadcast
netsh wlan start hostednetwork

REM 3. Ensure Firewall Allows Local Port 3000
netsh advfirewall firewall add rule name="WiFi Relay Port" dir=in action=allow protocol=TCP localport=3000`;

  const windowsPowerShell = `# Windows 10/11 Mobile Hotspot Automation via PowerShell
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}
$connectionProfile = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
$tetheringManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($connectionProfile)
$tetheringConfig = $tetheringManager.GetCurrentAccessPointConfiguration()
$tetheringConfig.Ssid = "${ssid}"
$tetheringConfig.Passphrase = "${password}"
$tetheringManager.ConfigureAccessPointAsync($tetheringConfig)
Await ($tetheringManager.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
Write-Host "Hotspot '${ssid}' is now LIVE!" -ForegroundColor Green`;

  const linuxCmd = `# 1. Create Hotspot with NetworkManager (One-command)
sudo nmcli dev wifi hotspot ifname wlan0 ssid "${ssid}" password "${password}"

# 2. Enable IP packet forwarding in Kernel
sudo sysctl -w net.ipv4.ip_forward=1

# 3. Enable NAT Masquerading via iptables
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE || sudo iptables -t nat -A POSTROUTING -o wlan0 -j MASQUERADE`;

  const macCmd = `# Enable IP Packet Forwarding
sudo sysctl -w net.inet.ip.forwarding=1

# In macOS GUI (Recommended):
# 1. Open System Settings > General > Sharing
# 2. Click the (i) next to 'Internet Sharing'
# 3. Share connection from: Wi-Fi or Ethernet
# 4. To computers using: Wi-Fi
# 5. Configure Wi-Fi Options: SSID="${ssid}", Security=WPA2 Personal, Password="${password}"`;

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
              <Radio className="w-3.5 h-3.5" />
              <span>Hardware Wi-Fi Broadcast &amp; NAT Router</span>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Turn this Computer into a Dedicated Wi-Fi Hotspot
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              If other devices on your premises have no internet and you want to broadcast a completely
              new Wi-Fi network with its own SSID and password, use this hardware hotspot wizard.
            </p>
          </div>
        </div>

        {/* Hotspot Credentials Configurator */}
        <div className="mt-5 p-4 bg-slate-950/80 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Network Name (SSID)
            </label>
            <input
              type="text"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="e.g. MySharedWiFi"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              This is the Wi-Fi name other devices will see in their Wi-Fi list.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Wi-Fi Password (WPA2-PSK)
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Must be at least 8 characters.
            </span>
          </div>
        </div>
      </div>

      {/* OS Scripts & Commands */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Select Host Operating System</h3>
          </div>

          {/* OS Switcher */}
          <div className="flex gap-1.5">
            {[
              { id: 'windows', label: 'Windows (CMD & PowerShell)' },
              { id: 'macos', label: 'macOS (Sharing & Terminal)' },
              { id: 'linux', label: 'Linux (nmcli & iptables)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveOs(tab.id as OsTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeOs === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content for Windows */}
        {activeOs === 'windows' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-950/20 border border-blue-500/20 rounded-lg p-3">
              <div className="text-xs text-blue-200">
                <strong>One-Click Windows Script:</strong> Download and double-click the setup batch
                file as Administrator.
              </div>
              <a
                href={getDownloadUrl('windows')}
                download="setup-wifi-hotspot.bat"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .BAT Script</span>
              </a>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Command Prompt (Admin) Commands:
                </span>
                <button
                  onClick={() => copyToClipboard(windowsCmd, 'winCmd')}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedKey === 'winCmd' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'winCmd' ? 'Copied' : 'Copy Commands'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-amber-300 font-mono text-xs rounded-lg border border-slate-800 overflow-x-auto select-all">
                {windowsCmd}
              </pre>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Alternative: Windows 10/11 Mobile Hotspot CLI (PowerShell):
                </span>
                <button
                  onClick={() => copyToClipboard(windowsPowerShell, 'winPs')}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedKey === 'winPs' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'winPs' ? 'Copied' : 'Copy PowerShell'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-xs rounded-lg border border-slate-800 overflow-x-auto max-h-48 select-all">
                {windowsPowerShell}
              </pre>
            </div>
          </div>
        )}

        {/* Content for macOS */}
        {activeOs === 'macos' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-950/20 border border-blue-500/20 rounded-lg p-3">
              <div className="text-xs text-blue-200">
                <strong>macOS Helper Script:</strong> Enables sysctl packet forwarding between
                network interfaces.
              </div>
              <a
                href={getDownloadUrl('macos')}
                download="setup-macos-sharing.sh"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .SH Script</span>
              </a>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  macOS Native Sharing Instructions &amp; Terminal:
                </span>
                <button
                  onClick={() => copyToClipboard(macCmd, 'macCmd')}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedKey === 'macCmd' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'macCmd' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-amber-300 font-mono text-xs rounded-lg border border-slate-800 overflow-x-auto select-all">
                {macCmd}
              </pre>
            </div>
          </div>
        )}

        {/* Content for Linux */}
        {activeOs === 'linux' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-950/20 border border-blue-500/20 rounded-lg p-3">
              <div className="text-xs text-blue-200">
                <strong>Linux Hotspot &amp; NAT Masquerade:</strong> Creates hotspot via NetworkManager
                and sets up iptables NAT routing.
              </div>
              <a
                href={getDownloadUrl('linux')}
                download="setup-linux-hotspot.sh"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .SH Script</span>
              </a>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Terminal Bash Commands:</span>
                <button
                  onClick={() => copyToClipboard(linuxCmd, 'linuxCmd')}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedKey === 'linuxCmd' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'linuxCmd' ? 'Copied' : 'Copy Commands'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-amber-300 font-mono text-xs rounded-lg border border-slate-800 overflow-x-auto select-all">
                {linuxCmd}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
