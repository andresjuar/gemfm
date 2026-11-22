// Finds a photo for an artist without any API key:
// 1. Spotify oEmbed for their Spotify link (artist photo, or the cover for a track/album link).
// 2. Deezer, by Deezer id or exact name match.
import { findArtistByName, getArtist, pictureOf } from './deezer';

export async function spotifyThumbnail(url: string) {
  if (!/^https:\/\/open\.spotify\.com\//.test(url)) return null;
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { thumbnail_url?: string };
    return body.thumbnail_url || null;
  } catch {
    return null;
  }
}

export interface PhotoResult {
  image_url: string;
  source: 'spotify' | 'deezer';
  deezer?: { id: number; fans: number | null };
}

export async function findPhoto(a: { name: string; spotify_url: string; deezer_id: number | string | null }): Promise<PhotoResult | null> {
  // An artist link is the most reliable: it's the exact artist someone chose.
  if (/open\.spotify\.com\/(intl-[a-z]+\/)?artist\//.test(a.spotify_url)) {
    const img = await spotifyThumbnail(a.spotify_url);
    if (img) return { image_url: img, source: 'spotify' };
  }
  const dz = await (a.deezer_id ? getArtist(Number(a.deezer_id)) : findArtistByName(a.name)).catch(() => null);
  if (dz && pictureOf(dz) && !/\/artist\/\/|images\/artist\/\//.test(pictureOf(dz))) {
    return { image_url: pictureOf(dz), source: 'deezer', deezer: { id: dz.id, fans: dz.nb_fan ?? null } };
  }
  // A track or album link gives the cover art, which is better than nothing.
  if (a.spotify_url) {
    const img = await spotifyThumbnail(a.spotify_url);
    if (img) return { image_url: img, source: 'spotify' };
  }
  return null;
}
