import React, { useState } from 'react';
import {
  Globe,
  ArrowRight,
  RotateCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Bookmark,
  AlertCircle,
  Clock,
  Database,
  Code,
  Eye,
} from 'lucide-react';
import { HostStatus } from '../types';

interface WebRelayBrowserProps {
  status: HostStatus | null;
}

const PRESET_BOOKMARKS = [
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Internet_access' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com' },
  { name: 'DuckDuckGo Search', url: 'https://html.duckduckgo.com/html/' },
  { name: 'W3C Standards', url: 'https://www.w3.org' },
  { name: 'HTTPBin Test', url: 'https://httpbin.org/get' },
];

export const WebRelayBrowser: React.FC<WebRelayBrowserProps> = ({ status }) => {
  const [urlInput, setUrlInput] = useState<string>('https://en.wikipedia.org/wiki/Internet_access');
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [responseHtml, setResponseHtml] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [requestStats, setRequestStats] = useState<{
    status: number;
    durationMs: number;
    byteSize: number;
    contentType: string;
  } | null>(null);

  const handleFetch = async (targetUrlOverride?: string) => {
    const rawTarget = targetUrlOverride || urlInput.trim();
    if (!rawTarget) return;

    let normalized = rawTarget;
    if (!/^https?:\/\//i.test(normalized)) {
      // If looks like search query
      if (normalized.includes(' ') || !normalized.includes('.')) {
        normalized = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(normalized)}`;
      } else {
        normalized = `https://${normalized}`;
      }
    }

    setUrlInput(normalized);
    setActiveUrl(normalized);
    setLoading(true);
    setErrorMsg(null);
    const startTime = Date.now();

    try {
      const proxyApi = `/api/proxy?url=${encodeURIComponent(normalized)}`;
      const resp = await fetch(proxyApi);
      const duration = Date.now() - startTime;
      const contentType = resp.headers.get('content-type') || 'text/html';

      if (!resp.ok && resp.status >= 500) {
        const errorJson = await resp.json().catch(() => ({}));
        throw new Error(errorJson.message || `Upstream gateway error (Status: ${resp.status})`);
      }

      const text = await resp.text();
      setRequestStats({
        status: resp.status,
        durationMs: duration,
        byteSize: text.length,
        contentType,
      });

      // Inject base tag so relative links/images inside iframe resolve correctly
      const parsedUrl = new URL(normalized);
      const baseTag = `<base href="${parsedUrl.origin}/" target="_blank" />`;
      let injectedHtml = text;
      if (text.includes('<head>')) {
        injectedHtml = text.replace('<head>', `<head>${baseTag}`);
      } else {
        injectedHtml = `${baseTag}${text}`;
      }

      setResponseHtml(injectedHtml);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch through host relay.');
      setResponseHtml('');
      setRequestStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmarkClick = (bmUrl: string) => {
    setUrlInput(bmUrl);
    handleFetch(bmUrl);
  };

  return (
    <div className="space-y-4">
      {/* Header explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Instant Web Relay Browser</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-medium">
              Zero Configuration
            </span>
          </div>
          <p className="text-xs text-slate-400">
            For users on this local network who cannot configure system proxies: enter any URL or
            search below to fetch and view external websites routed through this computer.
          </p>
        </div>

        {/* Bookmarks */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Bookmark className="w-3 h-3 text-blue-400" />
            Quick:
          </span>
          {PRESET_BOOKMARKS.map((bm) => (
            <button
              key={bm.name}
              onClick={() => handleBookmarkClick(bm.url)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700/60 transition-colors"
            >
              {bm.name}
            </button>
          ))}
        </div>
      </div>

      {/* Browser Chrome / URL Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFetch();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1 flex items-center">
            <div className="absolute left-3 text-slate-400">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <input
              id="browser-url-input"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter URL (e.g. https://en.wikipedia.org or search keywords)..."
              className="w-full pl-9 pr-24 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setUrlInput('')}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
            </div>
          </div>

          <button
            id="browser-fetch-btn"
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Relaying...</span>
              </>
            ) : (
              <>
                <span>Fetch Web</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Telemetry bar for current request */}
        {requestStats && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                HTTP {requestStats.status} OK
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                {requestStats.durationMs} ms latency
              </span>
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                {(requestStats.byteSize / 1024).toFixed(1)} KB transferred
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded bg-slate-950 border border-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 ${
                    viewMode === 'preview'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Rendered
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('source')}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 ${
                    viewMode === 'source'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code className="w-3 h-3" />
                  HTML Source
                </button>
              </div>

              {activeUrl && (
                <a
                  href={`/api/proxy?url=${encodeURIComponent(activeUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Direct</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Browser Viewport */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[500px] flex flex-col">
        {errorMsg ? (
          <div className="p-8 text-center m-auto max-w-md space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-white">Relay Request Blocked or Failed</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{errorMsg}</p>
            <div className="pt-2">
              <button
                onClick={() => handleFetch()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white border border-slate-700"
              >
                Retry Request
              </button>
            </div>
          </div>
        ) : !responseHtml ? (
          <div className="p-12 text-center m-auto max-w-md space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Globe className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-white">Ready to Browse Through Host</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter any URL in the bar above or click one of the quick bookmarks to test routing web
              traffic through this computer&apos;s active Internet connection.
            </p>
            <button
              onClick={() => handleFetch('https://en.wikipedia.org/wiki/Internet_access')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Load Sample Wikipedia Page</span>
            </button>
          </div>
        ) : viewMode === 'preview' ? (
          <iframe
            title="Web Relay Viewport"
            srcDoc={responseHtml}
            sandbox="allow-same-origin allow-scripts allow-forms"
            className="w-full flex-1 bg-white border-0 min-h-[550px]"
          />
        ) : (
          <pre className="p-4 flex-1 bg-slate-950 text-slate-300 font-mono text-xs overflow-auto max-h-[600px] select-all">
            {responseHtml}
          </pre>
        )}
      </div>
    </div>
  );
};
