import { useEffect } from 'react';

const DEFAULT_TRANSVEC_BASE_URL = 'https://transvec.vercel.app';

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function normalizeStatus(status?: string) {
  if (!status) return 'IN_TRANSIT';
  return status.toUpperCase().replace(/\s+/g, '_');
}

export function useIncomingDeepLink(setSearchQuery: (value: string) => void) {
  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(window.location.search);
      const trackingId =
        params.get('trackingId') ||
        params.get('trackingCode') ||
        params.get('track') ||
        params.get('q') ||
        params.get('search') ||
        '';
      if (!trackingId) return;
      setSearchQuery(trackingId);
    };

    apply();
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, [setSearchQuery]);
}

export function TrackShipmentButton({
  trackingId,
  status,
  className = '',
}: {
  trackingId: string;
  status?: string;
  className?: string;
}) {
  const baseUrl = stripTrailingSlash(import.meta.env.VITE_TRANSVEC_BASE_URL || DEFAULT_TRANSVEC_BASE_URL);
  const href = `${baseUrl}/?${new URLSearchParams({
    trackingId,
    status: normalizeStatus(status),
    source: 'yieldops',
  }).toString()}`;

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

