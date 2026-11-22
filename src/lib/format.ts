export const initial = (name?: string) => (name || '?').trim()[0]?.toUpperCase() ?? '?';

const dayStart = (d: Date) => new Date(d).setHours(0, 0, 0, 0);

export function when(iso: string) {
  const d = new Date(iso);
  const days = Math.round((dayStart(d) - dayStart(new Date())) / 864e5);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return `Tonight, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

export function ago(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** Spotify share link -> embeddable player URL. */
export function spotifyEmbed(url?: string) {
  const m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|artist|playlist)\/([A-Za-z0-9]+)/.exec(url || '');
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` : null;
}

export const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n);
