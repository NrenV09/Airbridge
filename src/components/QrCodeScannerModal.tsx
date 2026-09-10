import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, Upload, RefreshCw, AlertCircle, CheckCircle2, SwitchCamera } from 'lucide-react';

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
  description?: string;
}

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan WebRTC SDP Token QR Code',
  description = 'Point your camera at the QR code displayed on the other device, or upload a screenshot image.',
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'camera' | 'upload'>('camera');
  const [fileScanning, setFileScanning] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'interactive-qr-reader';

  // Initialize camera list
  useEffect(() => {
    if (!isOpen) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          // Prefer back camera if available
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setScannerError('No cameras found on this device. You can upload an image file instead.');
          setActiveMode('upload');
        }
      })
      .catch((err) => {
        console.warn('Camera enumeration error:', err);
        setScannerError('Camera access not granted or unavailable. You can upload a QR image.');
        setActiveMode('upload');
      });
  }, [isOpen]);

  // Start/Stop Camera scanner
  useEffect(() => {
    if (!isOpen || activeMode !== 'camera' || !selectedCameraId) {
      stopScanner();
      return;
    }

    let isMounted = true;
    const scanner = new Html5Qrcode(scannerContainerId);
    html5QrCodeRef.current = scanner;

    const startCamera = async () => {
      try {
        setScannerError(null);
        setIsScanning(true);
        await scanner.start(
          selectedCameraId,
          {
            fps: 12,
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!isMounted) return;
            setScannedResult(decodedText);
            stopScanner();
            onScan(decodedText);
          },
          () => {
            // Frame parse error (normal when QR code is not in frame)
          }
        );
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error('Failed to start camera scanner:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setScannerError(
          `Camera failed to start: ${errMsg}. Check browser camera permissions or upload an image file.`
        );
        setIsScanning(false);
      }
    };

    // Small delay to ensure DOM element is mounted
    const timer = setTimeout(() => {
      startCamera();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, activeMode, selectedCameraId]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping QR scanner:', e);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].id);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileScanning(true);
    setScannerError(null);

    try {
      const scanner = new Html5Qrcode('file-qr-temp');
      const result = await scanner.scanFile(file, true);
      setScannedResult(result);
      onScan(result);
    } catch (err) {
      console.error('Failed to decode QR code from file:', err);
      setScannerError('Could not detect a valid QR code in this image. Please try another photo or paste directly.');
    } finally {
      setFileScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">{title}</h3>
              <p className="text-xs text-slate-400">WebRTC Peer-to-Peer Signaling</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveMode('camera')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
              activeMode === 'camera'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Live Camera Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              setActiveMode('upload');
            }}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
              activeMode === 'upload'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Image / Photo</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">{description}</p>

          {activeMode === 'camera' && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-square max-w-[340px] mx-auto flex items-center justify-center">
                <div id={scannerContainerId} className="w-full h-full" />

                {!isScanning && !scannerError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-400 p-4 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mb-2" />
                    <span className="text-xs">Initializing camera viewfinder...</span>
                  </div>
                )}
              </div>

              {/* Camera Switcher & Controls */}
              {cameras.length > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-400 px-2">
                  <span>Camera: {cameras.find((c) => c.id === selectedCameraId)?.label || 'Camera'}</span>
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span>Flip Camera</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeMode === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/70 rounded-xl p-8 text-center bg-slate-950/40 transition-colors">
                <input
                  type="file"
                  id="qr-file-input"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="qr-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white block">
                      Choose QR code screenshot or photo
                    </span>
                    <span className="text-xs text-slate-400">
                      Supports PNG, JPEG, WEBP, or phone screenshots
                    </span>
                  </div>
                </label>
              </div>

              {/* Hidden element for file scanning */}
              <div id="file-qr-temp" className="hidden" />

              {fileScanning && (
                <div className="flex items-center justify-center gap-2 text-xs text-blue-400 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing image for QR tokens...</span>
                </div>
              )}
            </div>
          )}

          {/* Manual Text Entering Box Below Scanner */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="manual-modal-text-input" className="font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Manual Token / Text Entry</span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setManualText(text.trim());
                  } catch (e) {
                    // ignore
                  }
                }}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline"
              >
                Paste from Clipboard
              </button>
            </div>
            <textarea
              id="manual-modal-text-input"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && manualText.trim()) {
                  e.preventDefault();
                  stopScanner();
                  onScan(manualText.trim());
                }
              }}
              placeholder="Paste or type peer token (AIR:O:... / AIR:A:...) or raw SDP JSON here..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg p-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              {manualText && (
                <button
                  type="button"
                  onClick={() => setManualText('')}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                disabled={!manualText.trim()}
                onClick={() => {
                  if (manualText.trim()) {
                    stopScanner();
                    onScan(manualText.trim());
                  }
                }}
                className="px-3.5 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
              >
                Apply Token
              </button>
            </div>
          </div>

          {/* Error Message */}
          {scannerError && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold block">Scan Notice</span>
                <span>{scannerError}</span>
              </div>
            </div>
          )}

          {/* Success Result */}
          {scannedResult && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold block">QR Code Decoded Successfully!</span>
                <span className="font-mono text-[11px] truncate block max-w-xs">
                  {scannedResult.slice(0, 70)}...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Serverless Zero-Cloud P2P Handshake</span>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
