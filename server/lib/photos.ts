// Finds a photo for an artist without any API key:
// 1. Spotify oEmbed for their Spotify link (artist photo, or the cover for a track/album link).
// 2. Deezer, by Deezer id or exact name match.
import { findArtistByName, findArtistBySong, getArtist, pictureOf, type DeezerArtist } from './deezer';

/** Title (song, album or artist name) and picture behind a Spotify link. */
export async function spotifyOembed(url: string): Promise<{ title: string; thumbnail: string } | null> {
  if (!/^https:\/\/open\.spotify\.com\//.test(url)) return null;
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: string; thumbnail_url?: string };
    return { title: body.title ?? '', thumbnail: body.thumbnail_url ?? '' };
  } catch {
    return null;
  }
}

export async function spotifyThumbnail(url: string) {
  return (await spotifyOembed(url))?.thumbnail || null;
}

export const isSpotifyArtistLink = (url: string) => /open\.spotify\.com\/(intl-[a-z]+\/)?artist\//.test(url);
export const isSpotifyTrackLink = (url: string) => /open\.spotify\.com\/(intl-[a-z]+\/)?track\//.test(url);

export interface PhotoResult {
  image_url: string;
  source: 'spotify' | 'deezer';
  deezer?: { id: number; fans: number | null };
}

/** Deezer artist for an artist row, without guessing between namesakes when a Spotify link tells us more. */
export async function matchDeezer(a: { name: string; spotify_url: string; deezer_id: number | string | null }) {
  try {
    if (a.deezer_id) return await getArtist(Number(a.deezer_id));
    if (isSpotifyTrackLink(a.spotify_url)) {
      // Find the same song on Deezer: that pins down the right artist.
      const song = (await spotifyOembed(a.spotify_url))?.title;
      return song ? await findArtistBySong(a.name, song) : null;
    }
    // Other Spotify links (artist, album): the link already identifies them; don't guess on Deezer.
    if (a.spotify_url) return null;
    return await findArtistByName(a.name);
  } catch {
    return null;
  }
}

export const hasRealPicture = (dz: DeezerArtist) => !!pictureOf(dz) && !/images\/artist\/\//.test(pictureOf(dz));

export async function findPhoto(a: { name: string; spotify_url: string; deezer_id: number | string | null }): Promise<PhotoResult | null> {
  // An artist link is the most reliable: it's the exact artist someone chose.
  if (isSpotifyArtistLink(a.spotify_url)) {
    const img = await spotifyThumbnail(a.spotify_url);
    if (img) return { image_url: img, source: 'spotify' };
  }
  const dz = await matchDeezer(a);
  if (dz && hasRealPicture(dz)) {
    return { image_url: pictureOf(dz), source: 'deezer', deezer: { id: dz.id, fans: dz.nb_fan ?? null } };
  }
  // A track or album link gives the cover art, which is better than nothing.
  if (a.spotify_url) {
    const img = await spotifyThumbnail(a.spotify_url);
    if (img) return { image_url: img, source: 'spotify' };
  }
  return null;
}
