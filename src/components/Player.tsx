// Plays an artist: Spotify embed when there's a Spotify link, otherwise a
// 30-second Deezer preview fetched through our API.
import { useEffect, useRef, useState } from 'react';
import type { Preview } from '../../shared/types';
import { api } from '../api';
import { spotifyEmbed } from '../lib/format';

interface Props {
  artistId: number;
  spotifyUrl: string;
  deezerId: number | null;
  autoPlay?: boolean;
}

export function Player({ artistId, spotifyUrl, deezerId, autoPlay = false }: Props) {
  const embed = spotifyEmbed(spotifyUrl);
  if (embed) {
    return (
      <iframe className="spotify" src={embed} title="Spotify player" loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
    );
  }
  if (deezerId) return <PreviewPlayer artistId={artistId} autoPlay={autoPlay} />;
  return <div className="no-audio">No music linked yet. <a href="/artists">Add a Spotify link on the Artists page</a>.</div>;
}

// Remember that the person already pressed play once, so the next cards can start on their own
// (browsers only allow audio after a user gesture).
let userStartedAudio = false;

function PreviewPlayer({ artistId, autoPlay }: { artistId: number; autoPlay: boolean }) {
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let alive = true;
    setPreview(undefined);
    setPlaying(false);
    setProgress(0);
    api<Preview | null>(`/artists/${artistId}/preview`).then((p) => alive && setPreview(p)).catch(() => alive && setPreview(null));
    return () => { alive = false; };
  }, [artistId]);

  useEffect(() => {
    if (preview && autoPlay && userStartedAudio) audio.current?.play().catch(() => {});
  }, [preview, autoPlay]);

  if (preview === undefined) return <div className="preview loading" aria-busy="true">Loading preview…</div>;
  if (!preview) return <div className="no-audio">No preview available for this artist.</div>;

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    userStartedAudio = true;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  return (
    <div className="preview">
      <button type="button" className="play" onClick={toggle} aria-label={playing ? 'Pause preview' : 'Play preview'}>
        {playing
          ? <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>
          : <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
      </button>
      <div className="preview-info">
        <span className="small preview-title">{preview.title}</span>
        <div className="bar thin"><div style={{ width: `${progress * 100}%` }} /></div>
        <a className="small muted" href={preview.link} target="_blank" rel="noreferrer">30-second preview · Deezer</a>
      </div>
      <audio
        ref={audio}
        src={preview.preview}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 30))}
      />
    </div>
  );
}
