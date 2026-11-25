import { locale, t } from '../i18n';

export const initial = (name?: string) => (name || '?').trim()[0]?.toUpperCase() ?? '?';

const dayStart = (d: Date) => new Date(d).setHours(0, 0, 0, 0);

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });

export function when(iso: string) {
  const d = new Date(iso);
  const days = Math.round((dayStart(d) - dayStart(new Date())) / 864e5);
  const time = timeOf(iso);
  if (days <= 0) return t('Tonight, {time}', { time });
  if (days === 1) return t('Tomorrow, {time}', { time });
  return `${d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

export function ago(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
  if (mins < 60) return t('{n} min ago', { n: mins });
  if (mins < 1440) return t('{n} h ago', { n: Math.round(mins / 60) });
  return t('{n} d ago', { n: Math.round(mins / 1440) });
}

/** "1 fan" / "3 fans", translated. Pass the English singular and plural with {n}. */
export const plural = (n: number, one: string, many: string) => t(n === 1 ? one : many, { n });

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Spotify share link -> embeddable player URL. */
export function spotifyEmbed(url?: string) {
  const m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|artist|playlist)\/([A-Za-z0-9]+)/.exec(url || '');
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` : null;
}

export const compact = (n: number) => new Intl.NumberFormat(locale(), { notation: 'compact' }).format(n);

/** English-only count for the admin page: "1 artist" / "3 artists". */
export const count = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
