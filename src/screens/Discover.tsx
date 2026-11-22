import { useEffect, useState, type PointerEvent } from 'react';
import type { DiscoverArtist, DiscoverResponse, SwipeResponse } from '../../shared/types';
import type { AppActions } from '../App';
import { api } from '../api';
import { Player } from '../components/Player';
import { compact, initial, plural, when } from '../lib/format';
import { useUi } from '../ui';

const SWIPE_DISTANCE = 100;

export function Discover({ me, refreshMe }: AppActions) {
  const { toast } = useUi();
  const [queue, setQueue] = useState<DiscoverArtist[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<null | 'save' | 'skip'>(null);

  const load = () =>
    api<DiscoverResponse>('/discover').then((d) => setQueue(d.artists)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const swipe = async (liked: boolean) => {
    const a = queue?.[0];
    if (!a || leaving) return;
    setLeaving(liked ? 'save' : 'skip');
    try {
      const r = await api<SwipeResponse>('/swipes', 'POST', { artistId: a.id, liked });
      await refreshMe();
      toast(r.completed ? 'Daily challenge done! +10 pts' : liked ? `Saved ${a.name} · +3 pts` : 'Skipped · +1 pt');
      window.setTimeout(() => {
        setLeaving(null);
        const rest = queue!.slice(1);
        if (rest.length) setQueue(rest);
        else load(); // bonus round: fetch more
      }, 220);
    } catch (err) {
      setLeaving(null);
      toast((err as Error).message);
    }
  };

  if (error) return <div className="panel empty">{error}</div>;
  if (!queue) return <div className="panel empty" aria-busy="true">Finding artists…</div>;

  const { today, goal } = me;
  const a = queue[0];
  return (
    <>
      <div className="progress">
        <div className="row between">
          <span className="eyebrow">{today >= goal ? 'Bonus round' : 'Daily challenge'}</span>
          <span className="small muted">{Math.min(today, goal)} / {goal} artists</span>
        </div>
        <div className="bar"><div style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} /></div>
      </div>
      {a ? (
        <>
          <SwipeCard key={a.id} artist={a} leaving={leaving} onSwipe={swipe} />
          <div className="actions">
            <button className="btn" onClick={() => swipe(false)} disabled={!!leaving}>Skip</button>
            <button className="btn primary" onClick={() => swipe(true)} disabled={!!leaving}>Save</button>
          </div>
          <p className="small muted center">Drag the card or use the buttons.</p>
        </>
      ) : (
        <div className="panel empty">
          <h2>You’ve heard everyone</h2>
          <p>New artists join every week. Check the Live tab for shows from the ones you saved.</p>
        </div>
      )}
    </>
  );
}

function SwipeCard({ artist: a, leaving, onSwipe }: { artist: DiscoverArtist; leaving: null | 'save' | 'skip'; onSwipe: (liked: boolean) => void }) {
  const [dx, setDx] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    setStartX(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startX !== null) setDx(e.clientX - startX);
  };
  const onUp = () => {
    if (startX === null) return;
    setStartX(null);
    if (Math.abs(dx) > SWIPE_DISTANCE) onSwipe(dx > 0);
    else setDx(0);
  };

  const offset = leaving ? (leaving === 'save' ? 480 : -480) : dx;
  const style = {
    transform: `translateX(${offset}px) rotate(${offset / 20}deg)`,
    opacity: leaving ? 0 : 1,
  };
  const art = a.image_url
    ? { backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(18,14,26,.85)), url("${a.image_url}")` }
    : { background: `linear-gradient(150deg, ${a.color}, #120E1A 140%)` };

  return (
    <article className={`card ${startX !== null ? 'dragging' : ''}`} style={style} aria-label={a.name}>
      <div className={`card-art ${a.image_url ? 'photo' : ''}`} style={art}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {!a.image_url && <span className="card-initial" aria-hidden="true">{initial(a.name)}</span>}
        <span className="stamp-label save" style={{ opacity: Math.max(0, Math.min(1, dx / SWIPE_DISTANCE)) }}>SAVE</span>
        <span className="stamp-label skip" style={{ opacity: Math.max(0, Math.min(1, -dx / SWIPE_DISTANCE)) }}>SKIP</span>
        {(a.genre || a.city) && <span className="chip">{[a.genre, a.city].filter(Boolean).join(' · ')}</span>}
        <h3>{a.name}</h3>
      </div>
      <div className="card-body">
        {a.bio && <p className="muted m0">{a.bio}</p>}
        <div className="row wrap">
          {a.matched?.length > 0 && <span className="chip taste">Because you like {a.matched.join(' & ')}</span>}
          {a.language && <span className="chip">{a.language === 'Instrumental' ? 'Instrumental' : `Sings in ${a.language}`}</span>}
          <span className="chip">{plural(a.saves, 'fan')} on gem.fm</span>
          {a.external_fans != null && <span className="chip">{compact(a.external_fans)} on Deezer</span>}
          {a.next_gig && <span className="chip hot">Live {when(a.next_gig)}</span>}
        </div>
        <Player artistId={a.id} spotifyUrl={a.spotify_url} deezerId={a.deezer_id} autoPlay />
      </div>
    </article>
  );
}
