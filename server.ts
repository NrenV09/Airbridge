import express from 'express';
import os from 'os';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory telemetry and client state
interface ClientRecord {
  id: string;
  ip: string;
  userAgent: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  firstSeen: number;
  lastSeen: number;
  bytesReceived: number;
  bytesSent: number;
  requestCount: number;
  status: 'active' | 'idle' | 'blocked';
}

interface LogRecord {
  id: string;
  timestamp: number;
  clientIp: string;
  targetUrl: string;
  method: string;
  status: number;
  bytes: number;
  durationMs: number;
}

const clientsMap = new Map<string, ClientRecord>();
const requestLogs: LogRecord[] = [];
const blockedIps = new Set<string>();

let isSharingActive = true;
let totalBytesForwarded = 0;
let totalRequestsHandled = 0;
let sharingPasscode = '';
let requireAuth = false;

function detectDeviceType(ua: string): 'mobile' | 'desktop' | 'tablet' | 'unknown' {
  if (!ua) return 'unknown';
  const lower = ua.toLowerCase();
  if (lower.includes('ipad') || lower.includes('tablet') || lower.includes('playbook')) return 'tablet';
  if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) return 'mobile';
  if (lower.includes('windows') || lower.includes('macintosh') || lower.includes('linux') || lower.includes('x11')) return 'desktop';
  return 'unknown';
}

function getLocalInterfaces() {
  const interfaces = os.networkInterfaces();
  const result: Array<{
    name: string;
    address: string;
    family: string;
    internal: boolean;
    mac: string;
    netmask: string;
    isWifiCandidate?: boolean;
  }> = [];

  let primaryIp = '127.0.0.1';

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4') {
        const isWifi = /wi-fi|wlan|en0|wlp|wl/i.test(name);
        result.push({
          name,
          address: addr.address,
          family: addr.family,
          internal: addr.internal,
          mac: addr.mac,
          netmask: addr.netmask,
          isWifiCandidate: isWifi,
        });

        // Heuristic for primary LAN IP: non-internal starting with 192.168 or 10. or 172.
        if (!addr.internal) {
          if (
            addr.address.startsWith('192.168.') ||
            addr.address.startsWith('10.') ||
            addr.address.startsWith('172.')
          ) {
            if (primaryIp === '127.0.0.1' || isWifi) {
              primaryIp = addr.address;
            }
          } else if (primaryIp === '127.0.0.1') {
            primaryIp = addr.address;
          }
        }
      }
    }
  }

  return { interfaces: result, primaryIp };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health / Network Status
app.get('/api/network/status', async (req, res) => {
  const { interfaces, primaryIp } = getLocalInterfaces();

  // Test upstream internet connection
  let internetConnected = false;
  let latencyMs = 0;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const pingRes = await fetch('https://1.1.1.1/cdn-cgi/trace', {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (pingRes.ok) {
      internetConnected = true;
      latencyMs = Date.now() - start;
    }
  } catch {
    // Upstream check failed or timed out
    internetConnected = false;
  }

  // Count active clients in last 5 minutes
  const now = Date.now();
  let activeClientsCount = 0;
  clientsMap.forEach(client => {
    if (now - client.lastSeen < 300000 && client.status !== 'blocked') {
      activeClientsCount++;
    }
  });

  res.json({
    isSharingActive,
    port: PORT,
    primaryLocalIp: primaryIp,
    hostname: os.hostname(),
    osType: `${os.type()} ${os.arch()}`,
    interfaces,
    internetConnected,
    latencyMs,
    upstreamTarget: 'Cloudflare 1.1.1.1',
    totalBytesForwarded,
    totalRequestsHandled,
    activeClientsCount,
    sharingPasscode,
    requireAuth,
  });
});

// Upstream Ping Test to multiple endpoints
app.get('/api/network/ping', async (req, res) => {
  const targets = [
    { name: 'Cloudflare DNS', url: 'https://1.1.1.1/cdn-cgi/trace' },
    { name: 'Google Web', url: 'https://www.google.com/generate_204' },
    { name: 'Wikipedia', url: 'https://en.wikipedia.org/favicon.ico' },
    { name: 'GitHub Status', url: 'https://github.com/favicon.ico' },
  ];

  const results = await Promise.all(
    targets.map(async target => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(target.url, {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);
        return {
          name: target.name,
          url: target.url,
          status: resp.ok || resp.status === 204 ? 'online' : 'failed',
          latencyMs: Date.now() - start,
        };
      } catch {
        return {
          name: target.name,
          url: target.url,
          status: 'failed',
          latencyMs: -1,
        };
      }
    })
  );

  res.json({ results });
});

// Toggle Sharing
app.post('/api/relay/toggle', (req, res) => {
  const { active, requirePasscode, passcode } = req.body;
  if (typeof active === 'boolean') {
    isSharingActive = active;
  }
  if (typeof requirePasscode === 'boolean') {
    requireAuth = requirePasscode;
  }
  if (typeof passcode === 'string') {
    sharingPasscode = passcode.trim();
  }
  res.json({ success: true, isSharingActive, requireAuth, sharingPasscode });
});

// Connected Clients List
app.get('/api/clients', (req, res) => {
  const list = Array.from(clientsMap.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  res.json({ clients: list });
});

// Block/Unblock IP
app.post('/api/clients/:ip/status', (req, res) => {
  const targetIp = req.params.ip;
  const { status } = req.body; // 'active' | 'blocked'
  if (status === 'blocked') {
    blockedIps.add(targetIp);
  } else {
    blockedIps.delete(targetIp);
  }

  const existing = clientsMap.get(targetIp);
  if (existing) {
    existing.status = status;
  }

  res.json({ success: true, targetIp, status });
});

// Recent Proxy Logs
app.get('/api/logs', (req, res) => {
  res.json({ logs: requestLogs.slice(-50).reverse() });
});

// Proxy Auto-Config (PAC) file
app.get(['/proxy.pac', '/api/pac'], (req, res) => {
  const { primaryIp } = getLocalInterfaces();
  const hostIp = req.query.host || primaryIp || '127.0.0.1';
  const proxyPort = PORT;

  const pacContent = `function FindProxyForURL(url, host) {
    // Direct connection for internal/local hostnames and IPs
    if (isPlainHostName(host) ||
        shExpMatch(host, "*.local") ||
        isInNet(dnsResolve(host), "10.0.0.0", "255.0.0.0") ||
        isInNet(dnsResolve(host), "172.16.0.0", "255.240.0.0") ||
        isInNet(dnsResolve(host), "192.168.0.0", "255.255.0.0") ||
        isInNet(dnsResolve(host), "127.0.0.0", "255.0.0.0")) {
        return "DIRECT";
    }

    // Route all other Internet traffic through this Host Computer
    return "PROXY ${hostIp}:${proxyPort}; DIRECT";
}`;

  res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig');
  res.setHeader('Content-Disposition', 'inline; filename="proxy.pac"');
  res.send(pacContent);
});

// Real Internet Proxy Endpoint for Local Network Devices
// Devices on LAN without direct internet access call /api/proxy?url=https://...
app.all('/api/proxy', async (req, res) => {
  if (!isSharingActive) {
    return res.status(503).json({ error: 'Internet Sharing on Host is currently disabled.' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

  if (blockedIps.has(clientIp)) {
    return res.status(403).json({ error: 'This device has been restricted by the Host Administrator.' });
  }

  if (requireAuth && sharingPasscode) {
    const authHeader = req.headers['x-share-passcode'] || req.query.passcode;
    if (authHeader !== sharingPasscode) {
      return res.status(401).json({ error: 'Internet Relay Passcode Required' });
    }
  }

  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    return res.status(400).json({ error: 'Missing "url" parameter. Example: /api/proxy?url=https://example.com' });
  }

  let targetUrl = rawUrl;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  // Record client interaction
  const ua = req.headers['user-agent'] || '';
  const now = Date.now();
  let client = clientsMap.get(clientIp);
  if (!client) {
    client = {
      id: clientIp,
      ip: clientIp,
      userAgent: ua,
      deviceType: detectDeviceType(ua),
      firstSeen: now,
      lastSeen: now,
      bytesReceived: 0,
      bytesSent: 0,
      requestCount: 1,
      status: 'active',
    };
    clientsMap.set(clientIp, client);
  } else {
    client.lastSeen = now;
    client.requestCount++;
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    // Forward request headers safely
    const forwardHeaders: Record<string, string> = {
      'User-Agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': req.headers['accept'] || '*/*',
      'Accept-Language': (req.headers['accept-language'] as string) || 'en-US,en;q=0.9',
    };

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: forwardHeaders,
      signal: controller.signal,
      redirect: 'follow',
    };

    const upstreamResponse = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeout);

    const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream';
    const status = upstreamResponse.status;

    res.status(status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('X-Relayed-By', 'Host-Wi-Fi-Sharer');

    const buffer = await upstreamResponse.arrayBuffer();
    const byteLength = buffer.byteLength;

    // Update telemetry
    totalBytesForwarded += byteLength;
    totalRequestsHandled++;
    client.bytesReceived += byteLength;

    requestLogs.push({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: now,
      clientIp,
      targetUrl,
      method: req.method,
      status,
      bytes: byteLength,
      durationMs: Date.now() - startTime,
    });
    if (requestLogs.length > 200) requestLogs.shift();

    // If HTML, we can provide a small helpful badge or direct content
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    const duration = Date.now() - startTime;
    requestLogs.push({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: now,
      clientIp,
      targetUrl,
      method: req.method,
      status: 502,
      bytes: 0,
      durationMs: duration,
    });
    res.status(502).json({
      error: 'Gateway Connection Failed',
      message: err.message || 'Host computer was unable to reach the destination address.',
      targetUrl,
    });
  }
});

// Downloadable setup scripts generator for OS Hotspot & ICS
app.get('/api/scripts/:platform', (req, res) => {
  const platform = req.params.platform;
  const { primaryIp } = getLocalInterfaces();
  const ssid = (req.query.ssid as string) || 'Shared_WiFi_Net';
  const pass = (req.query.password as string) || 'SharePass123';

  if (platform === 'windows') {
    const script = `@echo off
title Windows Wi-Fi Hotspot & Internet Connection Sharer
color 0A
echo ========================================================
echo   TURNING THIS COMPUTER INTO A WI-FI HOTSPOT & GATEWAY
echo ========================================================
echo.
echo 1. Configuring Hosted Network Wi-Fi...
netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${pass}"
echo.
echo 2. Starting Hosted Wi-Fi Broadcast...
netsh wlan start hostednetwork
echo.
echo 3. Opening Port 3000 in Windows Defender Firewall...
netsh advfirewall firewall add rule name="WiFi Relay Proxy" dir=in action=allow protocol=TCP localport=3000
echo.
echo ========================================================
echo   HOTSPOT ACTIVE!
echo   Network Name (SSID): ${ssid}
echo   Password:            ${pass}
echo   Host IP:             ${primaryIp}
echo   Proxy / PAC URL:     http://${primaryIp}:3000/proxy.pac
echo ========================================================
pause
`;
    res.setHeader('Content-Disposition', 'attachment; filename="setup-wifi-hotspot.bat"');
    res.setHeader('Content-Type', 'text/plain');
    return res.send(script);
  }

  if (platform === 'linux') {
    const script = `#!/bin/bash
# Linux Wi-Fi Hotspot and NAT IP Forwarding Script
echo "=== Setting up Linux Wi-Fi Hotspot & NAT Router ==="

SSID="${ssid}"
PASSWORD="${pass}"

# Check for NetworkManager CLI
if command -v nmcli &> /dev/null; then
    echo "Creating Hotspot using NetworkManager..."
    nmcli dev wifi hotspot ifname wlan0 ssid "$SSID" password "$PASSWORD"
else
    echo "nmcli not found. Enabling kernel IP Forwarding & iptables NAT..."
fi

# Enable IP packet forwarding in Linux Kernel
sudo sysctl -w net.ipv4.ip_forward=1

# Configure NAT Masquerading on outward interface
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE || sudo iptables -t nat -A POSTROUTING -o wlan0 -j MASQUERADE

# Allow traffic on port 3000 for relay proxy
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT

echo "Hotspot and Packet Forwarding configured!"
echo "Other devices can connect to SSID: $SSID"
echo "Or configure Proxy IP: ${primaryIp} Port: 3000"
`;
    res.setHeader('Content-Disposition', 'attachment; filename="setup-linux-hotspot.sh"');
    res.setHeader('Content-Type', 'text/x-sh');
    return res.send(script);
  }

  if (platform === 'macos') {
    const script = `#!/bin/bash
# macOS NAT & Internet Forwarding Configuration
echo "=== macOS Internet Forwarding Setup ==="
echo "1. Enabling sysctl packet forwarding..."
sudo sysctl -w net.inet.ip.forwarding=1

echo "2. For direct native Wi-Fi Hotspot on macOS:"
echo "   Go to: Apple Menu -> System Settings -> General -> Sharing"
echo "   Enable 'Internet Sharing'"
echo "   Share your connection from: (Active Internet e.g. iPhone USB/Ethernet/Wi-Fi)"
echo "   To computers using: Wi-Fi"
echo ""
echo "Or on devices connected to this Wi-Fi, open Wi-Fi Settings:"
echo "Configure Proxy -> Automatic -> URL: http://${primaryIp}:3000/proxy.pac"
`;
    res.setHeader('Content-Disposition', 'attachment; filename="setup-macos-sharing.sh"');
    res.setHeader('Content-Type', 'text/x-sh');
    return res.send(script);
  }

  res.status(400).send('Unknown platform');
});

// ----------------------------------------------------
// VITE MIDDLEWARE SETUP
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Wi-Fi Internet Relay Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
