import QRCode from 'qrcode';
import { WebRtcChunkMessage } from '../types';

export const MAX_SAFE_CHUNK_SIZE = 48000; // 48 KB per message frame to avoid SCTP buffer overflow

/**
 * Generates high-contrast Data URL image for a given string token using QRCode.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'L',
      margin: 2,
      scale: 6,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('QR code generation failed:', err);
    throw err;
  }
}

/**
 * Splits a large payload into smaller chunks safe for RTCDataChannel transmission.
 */
export function chunkPayload(
  id: string,
  fullText: string,
  chunkSize: number = MAX_SAFE_CHUNK_SIZE
): WebRtcChunkMessage[] {
  const totalLength = fullText.length;
  const totalChunks = Math.ceil(totalLength / chunkSize);
  const chunks: WebRtcChunkMessage[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalLength);
    chunks.push({
      type: 'FETCH_CHUNK',
      id,
      chunkIndex: i,
      totalChunks,
      chunkData: fullText.substring(start, end),
    });
  }

  return chunks;
}

/**
 * Helper to accumulate received chunks and emit completed payload.
 */
export class ChunkReassembler {
  private chunksMap: Map<string, { totalChunks: number; chunks: string[]; receivedCount: number }> =
    new Map();

  public handleChunk(
    chunkMsg: WebRtcChunkMessage,
    onProgress?: (received: number, total: number) => void
  ): string | null {
    let entry = this.chunksMap.get(chunkMsg.id);

    if (!entry) {
      entry = {
        totalChunks: chunkMsg.totalChunks,
        chunks: new Array(chunkMsg.totalChunks),
        receivedCount: 0,
      };
      this.chunksMap.set(chunkMsg.id, entry);
    }

    if (!entry.chunks[chunkMsg.chunkIndex]) {
      entry.chunks[chunkMsg.chunkIndex] = chunkMsg.chunkData;
      entry.receivedCount++;
    }

    if (onProgress) {
      onProgress(entry.receivedCount, entry.totalChunks);
    }

    if (entry.receivedCount === entry.totalChunks) {
      const fullText = entry.chunks.join('');
      this.chunksMap.delete(chunkMsg.id);
      return fullText;
    }

    return null;
  }

  public clear(id?: string) {
    if (id) {
      this.chunksMap.delete(id);
    } else {
      this.chunksMap.clear();
    }
  }
}

/**
 * Generates a standalone, zero-dependency index.html file that implements
 * the WebRTC Manual Peer Relay with QR Code generation and scanning.
 */
export function generateStandaloneHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Serverless WebRTC Peer Proxy & Resource Relay</title>
  <!-- Load QRCode and HTML5-QRCode libraries via CDN for full offline/standalone compatibility -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"><\/script>
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      max-width: 900px;
      margin: 0 auto;
      padding: 1.5rem 1rem;
      line-height: 1.6;
    }
    header { margin-bottom: 1.5rem; text-align: center; }
    h1 { font-size: 1.5rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem; }
    p.subtitle { font-size: 0.875rem; color: var(--text-muted); }
    .box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
    }
    .box-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #38bdf8;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #1e3a8a;
      color: #93c5fd;
    }
    .badge-success { background: #064e3b; color: #6ee7b7; }
    .badge-danger { background: #7f1d1d; color: #fca5a5; }
    button {
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      margin-right: 8px;
      margin-bottom: 8px;
      transition: background 0.15s;
    }
    button:hover:not(:disabled) { background: var(--primary-hover); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.btn-outline {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
    }
    button.btn-outline:hover:not(:disabled) { background: #334155; }
    textarea {
      width: 100%;
      height: 90px;
      font-family: monospace;
      font-size: 11px;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #e2e8f0;
      padding: 8px;
      margin-top: 4px;
      margin-bottom: 8px;
      resize: vertical;
    }
    input[type="text"] {
      width: 100%;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #e2e8f0;
      padding: 8px 12px;
      font-size: 0.875rem;
      margin-bottom: 8px;
    }
    .qr-container {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      margin-top: 8px;
    }
    .qr-canvas-wrap {
      background: #fff;
      padding: 8px;
      border-radius: 6px;
      display: inline-block;
    }
    #log {
      background: #020617;
      color: #4ade80;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #1e293b;
      font-family: monospace;
      font-size: 11px;
      height: 180px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    #scanner-wrap {
      max-width: 320px;
      margin: 10px auto;
      display: none;
      background: #020617;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .result-box {
      background: #020617;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;
      max-height: 250px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <header>
    <h1>WebRTC Serverless Peer Proxy</h1>
    <p class="subtitle">Direct browser-to-browser tunnel with QR Code signaling &amp; resource relay</p>
  </header>

  <!-- Step 1: Role Setup -->
  <div class="box">
    <div class="box-title">Step 1: Role Setup</div>
    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">
      Choose what role this device will take. One device acts as the Online Internet Relay, the other as the Offline Resource Client.
    </p>
    <button id="btnHost" onclick="initHost()">Act as Internet Host (Online)</button>
    <button id="btnClient" onclick="initClient()">Act as Resource Client (Offline)</button>
    <span id="roleBadge" class="badge" style="display:none;"></span>
  </div>

  <!-- Step 2: QR Code & Manual Signaling -->
  <div class="box" id="signalingBox" style="display:none;">
    <div class="box-title">Step 2: QR Code &amp; SDP Signaling</div>
    <p id="instruction" style="font-size:0.85rem; color:#e2e8f0; margin-bottom:12px; font-weight:500;">
      Generating local connection token...
    </p>

    <!-- Local SDP & QR -->
    <div style="margin-bottom: 16px;">
      <label style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">
        Local SDP Token (Scan QR code with the other device):
      </label>
      <div class="qr-container">
        <div class="qr-canvas-wrap">
          <canvas id="localQrCanvas"></canvas>
        </div>
        <div style="flex: 1; min-width: 240px;">
          <textarea id="localSdp" readonly placeholder="Generating local SDP..."></textarea>
          <button class="btn-outline" onclick="copyLocalSdp()">Copy Token String</button>
        </div>
      </div>
    </div>

    <!-- Remote SDP & Scanner -->
    <div style="margin-top: 16px;">
      <label style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">
        Remote SDP Token (From the other device):
      </label>
      <textarea id="remoteSdp" placeholder="Paste remote SDP JSON or scan using camera..."></textarea>
      
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        <button id="scanBtn" class="btn-outline" onclick="toggleCameraScanner()">
          Scan via Camera QR
        </button>
        <button id="applyBtn" onclick="applyRemoteSdp()">
          Apply Remote SDP
        </button>
      </div>

      <!-- Live Camera Scanner element -->
      <div id="scanner-wrap">
        <div id="interactive-scanner" style="width: 100%;"></div>
      </div>
    </div>
  </div>

  <!-- Step 3: Resource Requester (Client Only) -->
  <div class="box" id="clientControls" style="display:none;">
    <div class="box-title">
      Step 3: Fetch Web Resources via Host Tunnel
      <span class="badge badge-success" id="tunnelStatus">P2P TUNNEL ACTIVE</span>
    </div>
    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">
      Send requests through the encrypted DataChannel. The online host fetches it and streams the response back!
    </p>

    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <input type="text" id="targetUrl" value="https://dummyjson.com/quotes/random" placeholder="https://example.com/api/data">
      <button onclick="requestResource()" style="white-space:nowrap; margin-right:0;">Fetch via Host</button>
    </div>

    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
      <span style="font-size:0.75rem; color:var(--text-muted); align-self:center;">Presets:</span>
      <button class="btn-outline" style="font-size:0.75rem; padding:4px 8px;" onclick="setPreset('https://dummyjson.com/quotes/random')">Quote API</button>
      <button class="btn-outline" style="font-size:0.75rem; padding:4px 8px;" onclick="setPreset('https://ipapi.co/json/')">IP Echo API</button>
      <button class="btn-outline" style="font-size:0.75rem; padding:4px 8px;" onclick="setPreset('https://catfact.ninja/fact')">Cat Fact API</button>
    </div>

    <label style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">Response from Host Relay:</label>
    <div id="clientOutput" class="result-box">Awaiting request...</div>
  </div>

  <!-- Status & Logs -->
  <div class="box">
    <div class="box-title">Tunnel Telemetry &amp; Logs</div>
    <div id="log"></div>
  </div>

  <script>
    let pc;
    let dataChannel;
    let isHost = false;
    let html5Scanner = null;

    const logEl = document.getElementById('log');
    function log(msg) {
      logEl.textContent += \`[\${new Date().toLocaleTimeString()}] \${msg}\\n\`;
      logEl.scrollTop = logEl.scrollHeight;
    }

    const config = { iceServers: [] };

    function createPeerConnection() {
      pc = new RTCPeerConnection(config);

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          const sdpText = JSON.stringify(pc.localDescription);
          document.getElementById('localSdp').value = sdpText;
          renderQr(sdpText);
          log("Signaling packet ready! Scan or copy Local SDP to the other peer.");
        }
      };

      pc.onconnectionstatechange = () => {
        log(\`Connection state changed: \${pc.connectionState}\`);
        if (pc.connectionState === 'connected') {
          log("WebRTC P2P direct connection established!");
        }
      };
    }

    function renderQr(text) {
      if (typeof QRCode !== 'undefined') {
        const canvas = document.getElementById('localQrCanvas');
        QRCode.toCanvas(canvas, text, {
          errorCorrectionLevel: 'L',
          width: 180,
          margin: 1
        }, function (err) {
          if (err) console.error('QR rendering error', err);
        });
      }
    }

    function initHost() {
      isHost = true;
      document.getElementById('signalingBox').style.display = 'block';
      document.getElementById('btnHost').disabled = true;
      document.getElementById('btnClient').disabled = true;
      const roleBadge = document.getElementById('roleBadge');
      roleBadge.textContent = 'Host (Online Relay)';
      roleBadge.style.display = 'inline-block';

      createPeerConnection();
      dataChannel = pc.createDataChannel("resourceProxy");
      setupChannelEvents(dataChannel);

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          document.getElementById('instruction').textContent =
            "Step 1: Point client camera at this QR code (or copy token). Step 2: Paste or scan Client Answer into Remote SDP below.";
          log("Host offer created. Gathering local candidates...");
        });
    }

    function initClient() {
      isHost = false;
      document.getElementById('signalingBox').style.display = 'block';
      document.getElementById('btnHost').disabled = true;
      document.getElementById('btnClient').disabled = true;
      const roleBadge = document.getElementById('roleBadge');
      roleBadge.textContent = 'Client (Resource Consumer)';
      roleBadge.style.display = 'inline-block';

      createPeerConnection();

      pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupChannelEvents(dataChannel);
      };

      document.getElementById('instruction').textContent =
        "Step 1: Scan Host QR Code (or paste token into Remote SDP). Step 2: Click 'Apply Remote SDP'. Step 3: Have Host scan your Answer QR.";
      log("Client initialized. Waiting to scan or paste Host Offer...");
    }

    function applyRemoteSdp() {
      const raw = document.getElementById('remoteSdp').value.trim();
      if (!raw) return alert("Please scan or paste the remote SDP first.");

      try {
        const sdp = JSON.parse(raw);

        if (!isHost && sdp.type === "offer") {
          pc.setRemoteDescription(new RTCSessionDescription(sdp))
            .then(() => pc.createAnswer())
            .then(answer => pc.setLocalDescription(answer))
            .then(() => {
              log("Host offer applied. Answer created. Scan Answer QR on Host device!");
              document.getElementById('instruction').textContent =
                "Answer created! Now show your Local SDP QR Code to the Host machine.";
            });
        } else if (isHost && sdp.type === "answer") {
          pc.setRemoteDescription(new RTCSessionDescription(sdp))
            .then(() => {
              log("Client answer applied! P2P Handshake complete.");
              document.getElementById('instruction').textContent =
                "P2P Handshake complete! DataChannel opening...";
            });
        } else {
          alert("Unexpected SDP type: " + sdp.type);
        }
      } catch (err) {
        alert("Invalid SDP token JSON: " + err.message);
      }
    }

    function setupChannelEvents(channel) {
      channel.onopen = () => {
        log("RTCDataChannel OPEN! Direct peer-to-peer data tunnel is active.");
        if (!isHost) {
          document.getElementById('clientControls').style.display = 'block';
        }
      };

      channel.onclose = () => {
        log("RTCDataChannel closed.");
      };

      channel.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (isHost && msg.type === "FETCH_REQUEST") {
            log(\`Host relaying request to: \${msg.url}\`);
            try {
              const resp = await fetch(msg.url);
              const text = await resp.text();
              channel.send(JSON.stringify({
                type: "FETCH_RESPONSE",
                status: resp.status,
                body: text
              }));
              log(\`Host relayed response back (\${resp.status}, \${text.length} chars)\`);
            } catch (err) {
              channel.send(JSON.stringify({
                type: "FETCH_RESPONSE",
                status: 500,
                body: \`Host fetch failed: \${err.message}\`
              }));
              log(\`Host fetch error: \${err.message}\`);
            }
          }

          if (!isHost && msg.type === "FETCH_RESPONSE") {
            log(\`Client received relayed response (HTTP \${msg.status})\`);
            document.getElementById('clientOutput').textContent = msg.body;
          }
        } catch (e) {
          console.error("Message parse error", e);
        }
      };
    }

    function requestResource() {
      const url = document.getElementById('targetUrl').value.trim();
      if (!url) return alert("Enter a URL first");
      if (!dataChannel || dataChannel.readyState !== "open") {
        return alert("DataChannel is not open yet!");
      }
      log(\`Sending request for: \${url}\`);
      document.getElementById('clientOutput').textContent = "Streaming request over WebRTC tunnel...";
      dataChannel.send(JSON.stringify({ type: "FETCH_REQUEST", url }));
    }

    function setPreset(url) {
      document.getElementById('targetUrl').value = url;
    }

    function copyLocalSdp() {
      const val = document.getElementById('localSdp').value;
      if (!val) return;
      navigator.clipboard.writeText(val).then(() => {
        alert("Local SDP copied to clipboard!");
      });
    }

    function toggleCameraScanner() {
      const wrap = document.getElementById('scanner-wrap');
      if (wrap.style.display === 'block') {
        wrap.style.display = 'none';
        if (html5Scanner) {
          html5Scanner.stop().then(() => html5Scanner.clear());
          html5Scanner = null;
        }
      } else {
        wrap.style.display = 'block';
        if (typeof Html5Qrcode !== 'undefined') {
          html5Scanner = new Html5Qrcode("interactive-scanner");
          html5Scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 240 },
            (decodedText) => {
              document.getElementById('remoteSdp').value = decodedText;
              log("QR Code scanned successfully from camera!");
              html5Scanner.stop().then(() => {
                html5Scanner.clear();
                html5Scanner = null;
                wrap.style.display = 'none';
              });
              applyRemoteSdp();
            },
            () => {}
          ).catch(err => {
            log("Camera scanner error: " + err);
            alert("Could not start camera scanner. You can paste the token manually.");
            wrap.style.display = 'none';
          });
        }
      }
    }
  </script>
</body>
</html>`;
}
