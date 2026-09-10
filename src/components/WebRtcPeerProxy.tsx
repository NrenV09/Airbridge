import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Wifi,
  QrCode,
  Camera,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  Download,
  Terminal,
  Activity,
  Maximize2,
  RefreshCw,
  Send,
  Zap,
  Globe,
  FileCode,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import {
  WebRtcRole,
  WebRtcConnectionState,
  WebRtcFetchRequest,
  WebRtcFetchResponse,
  WebRtcChunkMessage,
  WebRtcLogItem,
  HostStatus,
} from '../types';
import { QrCodeScannerModal } from './QrCodeScannerModal';
import {
  generateQrDataUrl,
  chunkPayload,
  ChunkReassembler,
  generateStandaloneHtml,
  MAX_SAFE_CHUNK_SIZE,
} from '../utils/webrtcHelper';

interface WebRtcPeerProxyProps {
  status: HostStatus | null;
}

export const WebRtcPeerProxy: React.FC<WebRtcPeerProxyProps> = ({ status }) => {
  // Role & Peer State
  const [role, setRole] = useState<WebRtcRole | null>(null);
  const [connState, setConnState] = useState<WebRtcConnectionState>('idle');
  const [dataChannelOpen, setDataChannelOpen] = useState<boolean>(false);
  const [instruction, setInstruction] = useState<string>('Select a role to begin peer-to-peer setup.');

  // Signaling tokens
  const [localSdp, setLocalSdp] = useState<string>('');
  const [localQrUrl, setLocalQrUrl] = useState<string>('');
  const [remoteSdp, setRemoteSdp] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [enlargeQr, setEnlargeQr] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Client Request Form
  const [targetUrl, setTargetUrl] = useState<string>('https://dummyjson.com/quotes/random');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'HEAD'>('GET');
  const [customBody, setCustomBody] = useState<string>('');
  const [showAdvancedRequest, setShowAdvancedRequest] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);

  // Client Response State
  const [activeResponse, setActiveResponse] = useState<WebRtcFetchResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'body' | 'headers'>('preview');

  // Relayed Request History & Logs
  const [requestHistory, setRequestHistory] = useState<WebRtcFetchResponse[]>([]);
  const [logs, setLogs] = useState<WebRtcLogItem[]>([]);

  // Host Settings
  const [useCorsBypassRelay, setUseCorsBypassRelay] = useState<boolean>(true);

  // WebRTC Native Objects
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const reassemblerRef = useRef<ChunkReassembler>(new ChunkReassembler());
  const pendingRequestsRef = useRef<Map<string, number>>(new Map()); // id -> timestamp

  const addLog = useCallback((type: WebRtcLogItem['type'], message: string) => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type,
        message,
      },
      ...prev.slice(0, 199),
    ]);
  }, []);

  // Initialize Peer Connection
  const createPeerConnection = useCallback(() => {
    // Empty iceServers forces local LAN host candidates
    const pc = new RTCPeerConnection({ iceServers: [] });
    pcRef.current = pc;

    pc.onicecandidate = async (event) => {
      if (!event.candidate) {
        // ICE gathering finished, description contains all host candidates
        if (pc.localDescription) {
          const sdpString = JSON.stringify(pc.localDescription);
          setLocalSdp(sdpString);
          try {
            const qrUrl = await generateQrDataUrl(sdpString);
            setLocalQrUrl(qrUrl);
          } catch (e) {
            console.error('Error generating QR', e);
          }
          addLog('success', 'Local SDP token and QR code ready for signaling.');
          setConnState('waiting-remote');
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      addLog('info', `PeerConnection state: ${state}`);
      if (state === 'connected') {
        setConnState('connected');
        addLog('success', 'WebRTC direct P2P link established over local network!');
      } else if (state === 'disconnected' || state === 'failed') {
        setConnState('disconnected');
        setDataChannelOpen(false);
        addLog('warn', `Peer connection ${state}.`);
      }
    };

    return pc;
  }, [addLog]);

  // Setup DataChannel Event Handlers
  const setupChannelEvents = useCallback(
    (channel: RTCDataChannel, isHostPeer: boolean) => {
      channel.onopen = () => {
        setDataChannelOpen(true);
        setConnState('connected');
        addLog('success', 'DataChannel "resourceProxy" OPEN! P2P data tunnel is live.');
      };

      channel.onclose = () => {
        setDataChannelOpen(false);
        addLog('warn', 'DataChannel closed.');
      };

      channel.onerror = (err) => {
        addLog('error', `DataChannel error: ${JSON.stringify(err)}`);
      };

      channel.onmessage = async (event) => {
        try {
          const parsed = JSON.parse(event.data);

          // Handle incoming chunk
          if (parsed.type === 'FETCH_CHUNK') {
            const chunkMsg = parsed as WebRtcChunkMessage;
            setFetchProgress(`Receiving chunk ${chunkMsg.chunkIndex + 1} of ${chunkMsg.totalChunks}...`);

            const fullText = reassemblerRef.current.handleChunk(chunkMsg, (rec, tot) => {
              setFetchProgress(`Chunk ${rec}/${tot} (${Math.round((rec / tot) * 100)}%)`);
            });

            if (fullText) {
              setFetchProgress(null);
              // Fully reassembled
              const completeMsg = JSON.parse(fullText);
              handleCompleteMessage(completeMsg, isHostPeer, channel);
            }
            return;
          }

          // Handle single-frame message
          handleCompleteMessage(parsed, isHostPeer, channel);
        } catch (err: unknown) {
          console.error('DataChannel message handling error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          addLog('error', `Failed to process incoming channel message: ${msg}`);
        }
      };
    },
    [addLog]
  );

  // Dispatch fully received messages
  const handleCompleteMessage = useCallback(
    async (msg: any, isHostPeer: boolean, channel: RTCDataChannel) => {
      // --- HOST: Relays request to the Internet ---
      if (isHostPeer && msg.type === 'FETCH_REQUEST') {
        const req = msg as WebRtcFetchRequest;
        addLog('req', `Host relaying: ${req.method || 'GET'} ${req.url}`);
        const startTime = Date.now();

        try {
          let respStatus = 200;
          let respStatusText = 'OK';
          let bodyText = '';
          let isBinary = false;
          let contentType = 'text/plain';
          const headersMap: Record<string, string> = {};

          // Attempt browser fetch, or fallback to host Node relay if CORS blocks it
          let fetchSucceeded = false;
          try {
            const fetchOpts: RequestInit = {
              method: req.method || 'GET',
              headers: req.headers,
              body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            };
            const directResp = await fetch(req.url, fetchOpts);
            respStatus = directResp.status;
            respStatusText = directResp.statusText;
            contentType = directResp.headers.get('content-type') || 'text/plain';
            directResp.headers.forEach((val, key) => {
              headersMap[key] = val;
            });

            if (contentType.includes('image') || contentType.includes('pdf') || contentType.includes('octet-stream')) {
              isBinary = true;
              const buffer = await directResp.arrayBuffer();
              const base64 = btoa(
                new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              bodyText = base64;
            } else {
              bodyText = await directResp.text();
            }
            fetchSucceeded = true;
          } catch (browserFetchErr: any) {
            // Browser fetch failed (often CORS)
            if (useCorsBypassRelay) {
              addLog('warn', `Direct browser fetch blocked (CORS). Using Host Node Relay for: ${req.url}`);
              const relayResp = await fetch('/api/relay/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: req.url,
                  method: req.method || 'GET',
                  headers: req.headers,
                }),
              });
              const relayJson = await relayResp.json();
              respStatus = relayJson.status || 200;
              respStatusText = 'Relayed via Host Engine';
              bodyText = relayJson.body || '';
              contentType = relayJson.contentType || 'text/html';
              Object.assign(headersMap, relayJson.headers || {});
              fetchSucceeded = true;
            } else {
              throw browserFetchErr;
            }
          }

          const durationMs = Date.now() - startTime;
          const totalBytes = bodyText.length;

          const responsePayload: WebRtcFetchResponse = {
            id: req.id,
            type: 'FETCH_RESPONSE',
            url: req.url,
            status: respStatus,
            statusText: respStatusText,
            headers: headersMap,
            body: bodyText,
            isBinary,
            contentType,
            totalBytes,
            durationMs,
          };

          const rawPayloadStr = JSON.stringify(responsePayload);

          // If payload is large, split into chunks
          if (rawPayloadStr.length > MAX_SAFE_CHUNK_SIZE) {
            const chunks = chunkPayload(req.id, rawPayloadStr, MAX_SAFE_CHUNK_SIZE);
            addLog(
              'resp',
              `Sending chunked response (${chunks.length} chunks, ${(totalBytes / 1024).toFixed(1)} KB)`
            );
            for (const chunk of chunks) {
              channel.send(JSON.stringify(chunk));
            }
          } else {
            channel.send(rawPayloadStr);
          }

          addLog('resp', `Relayed HTTP ${respStatus} to Client (${totalBytes} bytes, ${durationMs}ms)`);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          addLog('error', `Host fetch failed for ${req.url}: ${errMsg}`);
          const errorPayload: WebRtcFetchResponse = {
            id: req.id,
            type: 'FETCH_RESPONSE',
            url: req.url,
            status: 502,
            statusText: 'Bad Gateway / Host Fetch Failed',
            headers: { 'x-relay-error': 'true' },
            body: `Relay Error: ${errMsg}`,
            totalBytes: errMsg.length,
            durationMs: Date.now() - startTime,
          };
          channel.send(JSON.stringify(errorPayload));
        }
      }

      // --- CLIENT: Receives fetched response from Host ---
      if (!isHostPeer && msg.type === 'FETCH_RESPONSE') {
        const resp = msg as WebRtcFetchResponse;
        setIsFetching(false);
        setFetchProgress(null);
        setActiveResponse(resp);
        setRequestHistory((prev) => [resp, ...prev.slice(0, 19)]);

        const roundtripTime = pendingRequestsRef.current.get(resp.id)
          ? Date.now() - pendingRequestsRef.current.get(resp.id)!
          : resp.durationMs;
        pendingRequestsRef.current.delete(resp.id);

        addLog(
          'resp',
          `Received HTTP ${resp.status} (${(resp.totalBytes / 1024).toFixed(1)} KB, roundtrip: ${roundtripTime}ms)`
        );
      }
    },
    [addLog, useCorsBypassRelay]
  );

  // Initialize Host Role
  const handleInitHost = async () => {
    setRole('host');
    setConnState('generating');
    setInstruction('Generating Host SDP Offer. Gathers local candidates...');
    addLog('info', 'Initializing as Internet Host (Online)...');

    const pc = createPeerConnection();
    const dc = pc.createDataChannel('resourceProxy');
    dataChannelRef.current = dc;
    setupChannelEvents(dc, true);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setInstruction('1. Scan Host QR Code on Client. 2. Paste or scan Client Answer into Remote SDP.');
      addLog('info', 'Host offer created. Gathering local candidates...');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog('error', `Failed to create Host offer: ${msg}`);
      setConnState('failed');
    }
  };

  // Initialize Client Role
  const handleInitClient = () => {
    setRole('client');
    setConnState('waiting-remote');
    setInstruction('1. Scan Host QR Code (or paste into Remote SDP). 2. Click "Apply Remote SDP".');
    addLog('info', 'Initializing as Resource Client (Offline)...');

    const pc = createPeerConnection();

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dataChannelRef.current = dc;
      setupChannelEvents(dc, false);
      addLog('info', `Received DataChannel: ${dc.label}`);
    };
  };

  // Apply Remote SDP Token (from other device)
  const handleApplyRemoteSdp = async (customSdp?: string) => {
    const raw = (customSdp || remoteSdp).trim();
    if (!raw) {
      alert('Please scan or paste the remote SDP token first.');
      return;
    }

    const pc = pcRef.current;
    if (!pc) {
      alert('Please choose a role (Host or Client) first.');
      return;
    }

    try {
      const sdpObj = JSON.parse(raw);
      if (!sdpObj.type || !sdpObj.sdp) {
        throw new Error('Missing "type" or "sdp" fields in JSON token.');
      }

      if (role === 'client' && sdpObj.type === 'offer') {
        addLog('info', 'Applying Host SDP Offer...');
        await pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        setInstruction('Offer applied! Scan your Client Answer QR Code on the Host device to complete the handshake.');
        addLog('success', 'Client Answer generated. Showing QR code for Host to scan...');
      } else if (role === 'host' && sdpObj.type === 'answer') {
        addLog('info', 'Applying Client SDP Answer...');
        await pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
        setInstruction('Handshake complete! DataChannel opening...');
        addLog('success', 'Handshake applied! Waiting for DataChannel to open...');
      } else {
        alert(`Unexpected SDP type "${sdpObj.type}" for role "${role}".`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error applying remote SDP:', err);
      addLog('error', `Failed to apply remote SDP: ${msg}`);
      alert(`Invalid SDP Token: ${msg}`);
    }
  };

  // Handle Scanned QR Code
  const handleQrScanResult = (decodedText: string) => {
    setIsScannerOpen(false);
    setRemoteSdp(decodedText);
    addLog('success', 'QR Code scanned successfully!');
    // Auto-apply if ready
    handleApplyRemoteSdp(decodedText);
  };

  // Client: Send Request across WebRTC Tunnel
  const handleSendRequest = () => {
    const url = targetUrl.trim();
    if (!url) {
      alert('Please enter a target URL.');
      return;
    }
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== 'open') {
      alert('DataChannel is not open yet. Establish the P2P connection first.');
      return;
    }

    const reqId = Math.random().toString(36).substring(2, 9);
    pendingRequestsRef.current.set(reqId, Date.now());

    const requestPayload: WebRtcFetchRequest = {
      id: reqId,
      type: 'FETCH_REQUEST',
      url,
      method: httpMethod,
      body: customBody ? customBody : undefined,
    };

    setIsFetching(true);
    setFetchProgress('Sending request through WebRTC DataChannel...');
    addLog('req', `Client requesting: ${httpMethod} ${url}`);

    dc.send(JSON.stringify(requestPayload));
  };

  // Copy local SDP to clipboard
  const handleCopyLocalSdp = () => {
    if (!localSdp) return;
    navigator.clipboard.writeText(localSdp).then(() => {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
      addLog('info', 'Copied local SDP token to clipboard.');
    });
  };

  // Export Standalone HTML
  const handleDownloadStandaloneHtml = () => {
    const htmlContent = generateStandaloneHtml();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'webrtc-peer-relay.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('success', 'Downloaded standalone webrtc-peer-relay.html');
  };

  // Reset Session
  const handleResetSession = () => {
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (e) {}
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
    }
    pcRef.current = null;
    dataChannelRef.current = null;
    setRole(null);
    setConnState('idle');
    setDataChannelOpen(false);
    setLocalSdp('');
    setLocalQrUrl('');
    setRemoteSdp('');
    setActiveResponse(null);
    setInstruction('Select a role to begin peer-to-peer setup.');
    addLog('info', 'WebRTC session reset.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Concept & Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Radio className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                WebRTC DataChannels Peer-to-Peer Relay
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Serverless &bull; QR Code Signaling
              </span>
            </div>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Establish a direct, encrypted browser-to-browser data tunnel across your local Wi-Fi or hotspot.
              The offline client requests any URL or API, and the online host fetches it and streams the
              response back across the DataChannel. No external signaling servers needed!
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="download-standalone-html-btn"
              onClick={handleDownloadStandaloneHtml}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm"
              title="Download single-file HTML to transfer to an offline device"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>Export Standalone HTML</span>
            </button>
            {role && (
              <button
                id="reset-webrtc-session-btn"
                onClick={handleResetSession}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Peer</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual Tunnel Architecture Diagram */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white block">1. Device A (Online Host)</span>
              <span className="text-slate-400 text-[11px]">Connected to Internet Wi-Fi/Ethernet</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white block">2. QR Code Signaling</span>
              <span className="text-slate-400 text-[11px]">Zero-server SDP handshake via camera</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white block">3. RTCDataChannel Tunnel</span>
              <span className="text-slate-400 text-[11px]">Encrypted direct stream (Local LAN/Hotspot)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Setup Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Role & Signaling (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: Role Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  1
                </span>
                <h3 className="font-semibold text-white text-sm">Choose Device Role</h3>
              </div>
              {role && (
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    role === 'host'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {role === 'host' ? 'Host (Online Relay)' : 'Client (Offline)'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="act-as-host-btn"
                onClick={handleInitHost}
                disabled={role !== null}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  role === 'host'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white ring-1 ring-emerald-500/40'
                    : role === null
                    ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200'
                    : 'opacity-40 border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-xs text-white">Act as Internet Host</span>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  This computer is online. It generates the SDP Offer and relays requests to the web.
                </p>
              </button>

              <button
                id="act-as-client-btn"
                onClick={handleInitClient}
                disabled={role !== null}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  role === 'client'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white ring-1 ring-amber-500/40'
                    : role === null
                    ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-200'
                    : 'opacity-40 border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-xs text-white">Act as Resource Client</span>
                  <Radio className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  This device is offline. It scans the Host's QR Code and queries remote resources.
                </p>
              </button>
            </div>
          </div>

          {/* Step 2: Signaling & QR Code Handshake */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  2
                </span>
                <h3 className="font-semibold text-white text-sm">Signaling Handshake via QR Code</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    dataChannelOpen
                      ? 'bg-emerald-400 animate-pulse'
                      : connState === 'waiting-remote'
                      ? 'bg-amber-400'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="text-[11px] font-medium text-slate-300">
                  {dataChannelOpen
                    ? 'Tunnel Active'
                    : connState === 'waiting-remote'
                    ? 'Waiting for Token'
                    : connState}
                </span>
              </div>
            </div>

            {/* Instruction Notice */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>{instruction}</span>
            </div>

            {/* Local Token & QR Code */}
            {localSdp ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">
                    Local SDP Token ({role === 'host' ? 'Offer' : 'Answer'}):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEnlargeQr(true)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                      title="Enlarge QR Code"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Enlarge</span>
                    </button>
                    <button
                      id="copy-sdp-btn"
                      onClick={handleCopyLocalSdp}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken ? 'Copied!' : 'Copy String'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  {localQrUrl && (
                    <div
                      onClick={() => setEnlargeQr(true)}
                      className="cursor-pointer group relative bg-white p-2 rounded-xl shadow-md shrink-0 transition-transform hover:scale-105"
                      title="Click to enlarge QR code for easy scanning"
                    >
                      <img src={localQrUrl} alt="Local WebRTC SDP QR Code" className="w-28 h-28 object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  )}

                  <div className="flex-1 w-full space-y-2">
                    <textarea
                      id="local-sdp-textarea"
                      readOnly
                      value={localSdp}
                      className="w-full h-24 bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-300 resize-none focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Token size: {localSdp.length} bytes</span>
                      <span className="text-emerald-400">ICE Candidates included</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : role ? (
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">
                  {role === 'host'
                    ? 'Gathering local network candidates for Offer...'
                    : 'Awaiting Host SDP Offer to generate Answer...'}
                </p>
              </div>
            ) : null}

            {/* Remote Token Input & Scanner */}
            {role && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">
                    Remote SDP Token ({role === 'host' ? "Client's Answer" : "Host's Offer"}):
                  </span>
                  <button
                    id="open-camera-scanner-btn"
                    onClick={() => setIsScannerOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[11px] font-medium transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan with Camera</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <textarea
                    id="remote-sdp-textarea"
                    value={remoteSdp}
                    onChange={(e) => setRemoteSdp(e.target.value)}
                    placeholder={
                      role === 'client'
                        ? 'Paste Host Offer SDP JSON here (or click "Scan with Camera")...'
                        : 'Paste Client Answer SDP JSON here (or click "Scan with Camera")...'
                    }
                    className="w-full h-20 bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-300 resize-none focus:outline-none focus:border-blue-500"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.readText().then((text) => {
                          if (text) {
                            setRemoteSdp(text);
                            addLog('info', 'Pasted token from clipboard.');
                          }
                        });
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 underline"
                    >
                      Paste from Clipboard
                    </button>

                    <button
                      id="apply-remote-sdp-btn"
                      onClick={() => handleApplyRemoteSdp()}
                      disabled={!remoteSdp.trim() || dataChannelOpen}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition-colors"
                    >
                      <span>Apply Remote SDP</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Host Options */}
            {role === 'host' && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>CORS Bypass Relay (Host Node Engine)</span>
                  <input
                    type="checkbox"
                    checked={useCorsBypassRelay}
                    onChange={(e) => setUseCorsBypassRelay(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </label>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Automatically relays requests through the Host's local backend if target websites lack browser CORS headers.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tunnel Active & Resource Requester (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Connection Status Box */}
          <div
            className={`rounded-2xl p-5 border transition-all ${
              dataChannelOpen
                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-500/5'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    dataChannelOpen
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">
                      {dataChannelOpen ? 'WebRTC DataChannel Active' : 'Peer Tunnel Standby'}
                    </h3>
                    {dataChannelOpen && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-slate-950 uppercase tracking-wide">
                        Ready
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {dataChannelOpen
                      ? 'Encrypted peer-to-peer data tunnel established. Streaming resources directly.'
                      : 'Complete the QR code handshake on both devices to open the tunnel.'}
                  </p>
                </div>
              </div>

              {dataChannelOpen && (
                <div className="text-right text-xs">
                  <span className="text-slate-400 block text-[10px] uppercase">Protocol</span>
                  <span className="font-mono text-emerald-400 font-semibold">SCTP / DataChannel</span>
                </div>
              )}
            </div>
          </div>

          {/* Client: Resource Requester Bar */}
          {role === 'client' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    3
                  </span>
                  <h3 className="font-semibold text-white text-sm">Request Remote Resource via Host</h3>
                </div>
                <button
                  onClick={() => setShowAdvancedRequest(!showAdvancedRequest)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  {showAdvancedRequest ? 'Simple Mode' : 'Advanced Method/Body'}
                </button>
              </div>

              {/* URL Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                {showAdvancedRequest && (
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 shrink-0"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                )}

                <div className="relative flex-1">
                  <input
                    type="text"
                    id="target-url-input"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://example.com/api/data.json or web page"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  id="fetch-via-host-btn"
                  onClick={handleSendRequest}
                  disabled={!dataChannelOpen || isFetching}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-sm shrink-0"
                >
                  {isFetching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Fetch via Host</span>
                    </>
                  )}
                </button>
              </div>

              {/* Advanced Request Body */}
              {showAdvancedRequest && httpMethod === 'POST' && (
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Request Body (JSON or Form Data):</label>
                  <textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder='{"query": "data"}'
                    className="w-full h-16 bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-300 resize-none focus:outline-none"
                  />
                </div>
              )}

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400">Quick Test Endpoints:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Quotes API', url: 'https://dummyjson.com/quotes/random' },
                    { label: 'IP Geolocation', url: 'https://ipapi.co/json/' },
                    { label: 'Cat Fact', url: 'https://catfact.ninja/fact' },
                    { label: 'Wikipedia Wi-Fi', url: 'https://en.wikipedia.org/api/rest_v1/page/summary/Wi-Fi' },
                    { label: 'Random Image', url: 'https://picsum.photos/400/300' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setTargetUrl(preset.url)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transfer Progress Indicator */}
              {fetchProgress && (
                <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                  <span>{fetchProgress}</span>
                </div>
              )}
            </div>
          )}

          {/* Host: Incoming Traffic & Requests Feed */}
          {role === 'host' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-white text-sm">Host Relay Gateway Activity</h3>
                </div>
                <span className="text-xs text-slate-400">
                  {dataChannelOpen ? 'Actively listening on RTCDataChannel' : 'Waiting for connection'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                When the offline peer requests a resource, this host uses its active Internet connection to execute{' '}
                <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">fetch()</code> and stream the
                bytes back over the WebRTC data tunnel.
              </p>
            </div>
          )}

          {/* Response Inspector (Client) */}
          {activeResponse && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      activeResponse.status >= 200 && activeResponse.status < 300
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    HTTP {activeResponse.status} {activeResponse.statusText}
                  </span>
                  <span className="font-mono text-xs text-slate-300 truncate max-w-xs">
                    {activeResponse.url}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Size: {(activeResponse.totalBytes / 1024).toFixed(1)} KB</span>
                  <span>Latency: {activeResponse.durationMs}ms</span>
                </div>
              </div>

              {/* Response Sub-tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Visual Preview
                </button>
                <button
                  onClick={() => setActiveTab('body')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'body'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Raw / Formatted Payload
                </button>
                <button
                  onClick={() => setActiveTab('headers')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'headers'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Headers
                </button>
              </div>

              {/* Tab Contents */}
              <div>
                {activeTab === 'preview' && (
                  <div className="space-y-3">
                    {activeResponse.isBinary ? (
                      <div className="p-4 bg-slate-950 rounded-xl text-center border border-slate-800">
                        <img
                          src={`data:${activeResponse.contentType || 'image/jpeg'};base64,${activeResponse.body}`}
                          alt="Relayed Binary Media"
                          className="max-h-72 mx-auto rounded-lg object-contain shadow"
                        />
                        <span className="text-[11px] text-slate-500 block mt-2">
                          Binary payload streamed over RTCDataChannel
                        </span>
                      </div>
                    ) : (
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-72 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {activeResponse.body}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'body' && (
                  <div className="relative">
                    <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-72 overflow-y-auto font-mono text-xs text-slate-200 whitespace-pre-wrap break-all">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(activeResponse.body), null, 2);
                        } catch {
                          return activeResponse.body;
                        }
                      })()}
                    </pre>
                  </div>
                )}

                {activeTab === 'headers' && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-60 overflow-y-auto">
                    <table className="w-full text-xs text-left font-mono">
                      <tbody>
                        {Object.entries(activeResponse.headers || {}).map(([key, value]) => (
                          <tr key={key} className="border-b border-slate-900">
                            <td className="py-1 text-slate-400 pr-3">{key}:</td>
                            <td className="py-1 text-slate-200 break-all">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WebRTC Live Tunnel Telemetry Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-white text-sm">P2P Tunnel Diagnostics &amp; Logs</h3>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-[11px] text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            </div>

            <div className="h-44 overflow-y-auto bg-slate-950 border border-slate-800/80 rounded-xl p-3 font-mono text-[11px] space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic py-4 text-center">No tunnel logs yet.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="leading-tight flex items-start gap-2">
                    <span className="text-slate-600 select-none">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`font-semibold ${
                        log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'error'
                          ? 'text-rose-400'
                          : log.type === 'warn'
                          ? 'text-amber-400'
                          : log.type === 'req'
                          ? 'text-blue-400'
                          : log.type === 'resp'
                          ? 'text-cyan-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Enlarge QR Modal */}
      {enlargeQr && localQrUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setEnlargeQr(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Scan with {role === 'host' ? 'Client' : 'Host'} Camera
              </h3>
              <button
                onClick={() => setEnlargeQr(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl inline-block shadow">
              <img src={localQrUrl} alt="WebRTC SDP Token" className="w-64 h-64 object-contain" />
            </div>
            <p className="text-xs text-slate-400">
              Hold the other device camera up to this screen to automatically establish the WebRTC tunnel.
            </p>
            <button
              onClick={() => setEnlargeQr(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QrCodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleQrScanResult}
        title={`Scan ${role === 'client' ? "Host's Offer" : "Client's Answer"} QR Code`}
        description="Point your device camera at the QR code displayed on the other screen, or upload a captured screenshot photo."
      />
    </div>
  );
};
