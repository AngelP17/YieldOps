import { useEffect } from 'react';

const DEFAULT_TRANSVEC_BASE_URL = 'https://transvec.vercel.app';

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function normalizeStatus(status?: string) {
  if (!status) return 'IN_TRANSIT';
  return status.toUpperCase().replace(/\s+/g, '_');
}

function normalizeAssetId(value?: string | null) {
  if (!value) return '';
  return value.trim().replace(/^YO[-_]/i, '');
}

export function useIncomingDeepLink(setSearchQuery: (value: string) => void) {
  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(window.location.search);
      const trackingQuery =
        params.get('trackingId') ||
        params.get('trackingCode') ||
        params.get('track') ||
        '';
      const jobQueryRaw =
        params.get('jobId') ||
        params.get('linkedJobId') ||
        '';
      const jobQuery = normalizeAssetId(jobQueryRaw);
      const source = params.get('source') || '';
      const genericQuery =
        params.get('q') ||
        params.get('search') ||
        '';

      // Transvec deep links should resolve by tracking first; legacy YO-* job ids are normalized.
      const query = source === 'transvec'
        ? (trackingQuery || jobQuery || genericQuery)
        : (trackingQuery || jobQuery || genericQuery);

      if (!query) return;
      setSearchQuery(query);
    };

    apply();
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, [setSearchQuery]);
}

export function TrackShipmentButton({
  trackingId,
  jobId,
  query,
  status,
  className = '',
}: {
  trackingId?: string;
  jobId?: string;
  query?: string;
  status?: string;
  className?: string;
}) {
  const baseUrl = stripTrailingSlash(import.meta.env.VITE_TRANSVEC_BASE_URL || DEFAULT_TRANSVEC_BASE_URL);
  const params = new URLSearchParams({ source: 'yieldops' });
  if (trackingId) params.set('trackingId', trackingId);
  if (jobId) params.set('jobId', jobId);
  if (query) params.set('q', query);
  if (status) params.set('status', normalizeStatus(status));
  const href = `${baseUrl}/?${params.toString()}`;

  return (
    <button
      type="button"
      onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
      className={className || 'mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors'}
    >
      Track Asset
    </button>
  );
}
