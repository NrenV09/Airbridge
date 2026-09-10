export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: string;
  internal: boolean;
  mac: string;
  netmask: string;
  isWifiCandidate?: boolean;
}

export interface HostStatus {
  isSharingActive: boolean;
  port: number;
  primaryLocalIp: string;
  hostname: string;
  osType: string;
  interfaces: NetworkInterfaceInfo[];
  internetConnected: boolean;
  latencyMs: number;
  upstreamTarget: string;
  publicIp?: string;
  totalBytesForwarded: number;
  totalRequestsHandled: number;
  activeClientsCount: number;
  sharingPasscode?: string;
  requireAuth: boolean;
}

export interface ConnectedClient {
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

export interface ProxyLogItem {
  id: string;
  timestamp: number;
  clientIp: string;
  targetUrl: string;
  method: string;
  status: number;
  bytes: number;
  durationMs: number;
}

export interface DiagnosticTarget {
  name: string;
  url: string;
  status: 'pending' | 'online' | 'failed';
  latencyMs: number;
}

export interface HotspotSettings {
  ssid: string;
  passphrase: string;
  band: '2.4GHz' | '5GHz' | 'any';
  ipRange: string;
  sharingInterface: string;
}

export type WebRtcRole = 'host' | 'client';

export type WebRtcConnectionState =
  | 'idle'
  | 'generating'
  | 'waiting-remote'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed';

export interface WebRtcFetchRequest {
  id: string;
  type: 'FETCH_REQUEST';
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface WebRtcFetchResponse {
  id: string;
  type: 'FETCH_RESPONSE';
  url: string;
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  body: string;
  isBinary?: boolean;
  contentType?: string;
  totalBytes: number;
  durationMs: number;
}

export interface WebRtcChunkMessage {
  type: 'FETCH_CHUNK';
  id: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string;
}

export interface WebRtcLogItem {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warn' | 'error' | 'req' | 'resp';
  message: string;
}

