# AirBridge WebRTC Proxy

> **Zero-backend, serverless P2P HTTP gateway & file downloader enabling air-gapped or restricted devices to browse the web and download files via an online companion device.**

---

## 🌐 Overview

**AirBridge** is a peer-to-peer proxy solution that operates entirely inside modern web browsers with **zero backend server dependencies**. 

By establishing a direct WebRTC DataChannel between two devices (a connected **Host Gateway** and an offline or restricted **Client Browser**), AirBridge allows the client to tunnel arbitrary HTTP/HTTPS requests and stream downloads through the host's internet connection.

Signaling is accomplished out-of-band using **animated/compressed QR codes** or **copyable tokens**—meaning two devices can connect with no common network, no signaling server, and no third-party coordinator.

---

## ⚡ How It Works

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│         CLIENT DEVICE           │                 │           HOST DEVICE           │
│    (Offline / Restricted)       │                 │      (Connected to Internet)    │
│                                 │                 │                                 │
│  1. Scans Host Offer QR Code    │  ◄───────────   │  1. Generates WebRTC Offer      │
│  2. Generates WebRTC Answer     │   QR / Token    │                                 │
│  3. Displays Answer QR Code     │   ───────────►  │  2. Scans Client Answer QR Code │
│                                 │                 │                                 │
│  ─────────────────────────────  │                 │  ─────────────────────────────  │
│    WebRTC Direct DataChannel    │ ◄═════════════► │    WebRTC Direct DataChannel    │
│          (SCTP / DTLS)          │                 │          (SCTP / DTLS)          │
│                                 │                 │                                 │
│  • Tunnel Fetch (GET/POST/HEAD) │  ── Request ──► │  • Fetches target URL via Fetch │
│  • File Downloader Hub          │                 │  • Streams 16 KB frames with    │
│  • Live Progress & Throughput   │  ◄── Stream ──  │    SCTP backpressure control    │
│  • Auto-save Blob to Disk       │                 │  • Telemetry & relay inspector  │
└─────────────────────────────────┘                 └─────────────────────────────────┘
```

1. **Air-Gapped Signaling**:
   - The **Host** initializes a WebRTC `RTCPeerConnection`, creates an Offer, compresses the Session Description Protocol (SDP) via Pako (Deflate), and displays it as a QR code or compact token.
   - The **Client** scans the QR code using its camera (or pastes the token), creates an Answer, compresses it, and presents its Answer QR code.
   - The **Host** scans the Answer QR code (or pastes the token). The direct WebRTC DataChannel connects instantly.

2. **P2P HTTP & File Streaming**:
   - The Client sends a structured `FETCH_REQUEST` over the DataChannel.
   - The Host fetches the requested URL over its active network using the Fetch API.
   - The Host streams chunks (16 KB each) over the DataChannel with dynamic backpressure flow control (`dataChannel.bufferedAmount <= 64 KB`) to prevent buffer overflow.
   - The Client reassembles the incoming chunks into a binary `Blob`, calculates throughput and ETA, displays interactive previews, and offers instant disk download.

---

## ✨ Key Features

- **100% Serverless & Static**: Operates entirely client-side. Can be served from GitHub Pages, static CDNs, or an offline USB drive.
- **QR Code & Token Signaling**: No signaling server, STUN/TURN, or cloud coordinator required.
- **Web & API Browser**:
  - GET, POST, and HEAD methods.
  - Interactive formatted JSON viewer, sandboxed HTML preview, and image/audio rendering.
  - Response header inspector and latency measurement.
  - Quick-start presets (Cat Facts, Quote API, IP Geolocation, Wikipedia, JPEG images).
- **Dedicated P2P File Downloader Hub**:
  - Optimized streaming of large files (PDFs, media, archives, datasets).
  - Real-time speedometer (KB/s, MB/s) and estimated time remaining (ETA).
  - Smart filename extraction from `Content-Disposition` headers or URL paths.
  - Auto-save to Downloads folder upon completion.
  - Completed Downloads Shelf with format-specific icons and file inspection.
- **Host Relay Inspector**:
  - Live inbound request log with status code badges, chunk counts, byte counters, and latency stats.
- **Single-File Portable Export**: Export the entire application into a standalone `.html` file for portable emergency toolkits.

---

## 🚀 Deploying to GitHub Pages

This project is pre-configured for automated deployment to GitHub Pages via GitHub Actions.

### Setup Instructions

1. **Push your repository to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of AirBridge WebRTC Proxy"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Configure GitHub Pages settings**:
   - Navigate to your repository on GitHub.
   - Go to **Settings** > **Pages** (in the left sidebar).
   - Under **Build and deployment** > **Source**, select:
     > **GitHub Actions**

3. **Automatic Deployment**:
   - The included workflow file (`.github/workflows/deploy.yml`) will automatically trigger on any push to the `main` branch.
   - You can also manually trigger the build at any time under the **Actions** tab by selecting **Deploy to GitHub Pages** > **Run workflow**.

4. **Access your site**:
   - Once the deployment job finishes (typically within 1 minute), your site will be live at:
     ```text
     https://<your-username>.github.io/<your-repo>/
     ```

---

## 🛠️ Local Development & Building

### Prerequisites
- Node.js 18+
- npm (or yarn / bun / pnpm)

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
Open your browser to `http://localhost:3000`.

### Build for Static Hosting (GitHub Pages)
```bash
npm run build:pages
```
The static site will be compiled into the `dist/` directory, ready to deploy to any static host.

### Build Full Stack (Client + Node Server)
```bash
npm run build
```

---

## 🔒 Security & Privacy

- **Direct End-to-End Encryption**: All communication between Host and Client travels directly over WebRTC DataChannels secured by DTLS (Datagram Transport Layer Security) and SCTP.
- **No Third-Party Intermediaries**: Your requests, payloads, and transferred files never pass through a central proxy server or telemetry collector.
- **Origin Isolation**: CORS rules still apply to the Host's browser when querying external APIs; test presets are chosen from CORS-friendly open APIs.

---

## 📄 License

MIT License. Open source and free for personal and commercial use.
