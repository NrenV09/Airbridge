import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HostOverview } from './components/HostOverview';
import { WifiProxySetup } from './components/WifiProxySetup';
import { WebRelayBrowser } from './components/WebRelayBrowser';
import { HotspotWizard } from './components/HotspotWizard';
import { ConnectedDevices } from './components/ConnectedDevices';
import { NetworkDiagnostics } from './components/NetworkDiagnostics';
import { LiveTrafficLog } from './components/LiveTrafficLog';
import { WebRtcPeerProxy } from './components/WebRtcPeerProxy';
import { HostStatus, ConnectedClient, ProxyLogItem } from './types';

export default function App() {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [logs, setLogs] = useState<ProxyLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('overview');

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/network/status');
      if (resp.ok) {
        const data = await resp.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to load network status', err);
    }
  }, []);

  const fetchClientsAndLogs = useCallback(async () => {
    try {
      const [clientsResp, logsResp] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/logs'),
      ]);
      if (clientsResp.ok) {
        const cData = await clientsResp.json();
        setClients(cData.clients || []);
      }
      if (logsResp.ok) {
        const lData = await logsResp.json();
        setLogs(lData.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch clients or logs', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchClientsAndLogs()]);
    setLoading(false);
  }, [fetchStatus, fetchClientsAndLogs]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => {
      fetchStatus();
      fetchClientsAndLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, [refreshAll, fetchStatus, fetchClientsAndLogs]);

  const handleToggleSharing = async () => {
    if (!status) return;
    const nextState = !status.isSharingActive;
    try {
      const resp = await fetch('/api/relay/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextState }),
      });
      if (resp.ok) {
        setStatus((prev) => (prev ? { ...prev, isSharingActive: nextState } : null));
      }
    } catch (err) {
      console.error('Failed to toggle sharing', err);
    }
  };

  const handleUpdatePasscode = async (requireAuth: boolean, passcode: string) => {
    try {
      const resp = await fetch('/api/relay/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirePasscode: requireAuth, passcode }),
      });
      if (resp.ok) {
        setStatus((prev) =>
          prev ? { ...prev, requireAuth, sharingPasscode: passcode } : null
        );
      }
    } catch (err) {
      console.error('Failed to update passcode', err);
    }
  };

  const handleToggleBlock = async (ip: string, newStatus: 'active' | 'blocked') => {
    try {
      const resp = await fetch(`/api/clients/${encodeURIComponent(ip)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (resp.ok) {
        setClients((prev) =>
          prev.map((c) => (c.ip === ip ? { ...c, status: newStatus } : c))
        );
      }
    } catch (err) {
      console.error('Failed to update client status', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        status={status}
        loading={loading}
        onRefresh={refreshAll}
        onToggleSharing={handleToggleSharing}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Render Tab Content */}
        {activeTab === 'overview' && (
          <>
            <HostOverview
              status={status}
              onSelectTab={setActiveTab}
              onUpdatePasscode={handleUpdatePasscode}
            />
            <LiveTrafficLog logs={logs} onRefresh={fetchClientsAndLogs} loading={loading} />
          </>
        )}

        {activeTab === 'webrtc' && <WebRtcPeerProxy status={status} />}

        {activeTab === 'proxy' && <WifiProxySetup status={status} />}

        {activeTab === 'relay' && <WebRelayBrowser status={status} />}

        {activeTab === 'hotspot' && <HotspotWizard status={status} />}

        {activeTab === 'clients' && (
          <>
            <ConnectedDevices
              clients={clients}
              onToggleBlock={handleToggleBlock}
              onRefresh={fetchClientsAndLogs}
              loading={loading}
            />
            <LiveTrafficLog logs={logs} onRefresh={fetchClientsAndLogs} loading={loading} />
          </>
        )}

        {activeTab === 'diagnostics' && <NetworkDiagnostics />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Wi-Fi Internet Relay &amp; Gateway Sharer</span>
          <span>
            Host Gateway Active on Port {status?.port || 3000} &bull; HTTP Proxy &amp; PAC Compliant
          </span>
        </div>
      </footer>
    </div>
  );
}
