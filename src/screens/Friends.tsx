import { useState, type FormEvent } from 'react';
import type { FeedItem, Person, Profile } from '../../shared/types';
import type { AppActions } from '../App';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { Player } from '../components/Player';
import { ago } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { SheetCloseButton, useUi } from '../ui';

export function Friends({ me, refreshMe, showProfile }: AppActions) {
  const { toast, openSheet } = useUi();
  const { data, error, reload } = useLoad(
    () => Promise.all([api<FeedItem[]>('/feed'), api<Profile>('/users/' + me.id)]),
    [me.id],
  );
  const [artistId, setArtistId] = useState('');
  const [note, setNote] = useState('');

  if (error) return <div className="panel empty">{error}</div>;
  if (!data) return <div className="panel empty" aria-busy="true">Loading your feed…</div>;
  const [feed, profile] = data;

  const share = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/recommendations', 'POST', { artistId: Number(artistId || profile.saved[0]?.id), note });
      await refreshMe();
      toast('Shared with your friends · +5 pts');
      setNote('');
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <div className="row between">
        <h2>Friends</h2>
        <button className="btn small" onClick={() => openSheet(<FindPeople onChange={reload} />)}>Add friends</button>
      </div>
      <form className="panel stack" onSubmit={share}>
        <span className="eyebrow">Share a recommendation</span>
        {profile.saved.length ? (
          <>
            <select aria-label="Artist" value={artistId} onChange={(e) => setArtistId(e.target.value)}>
              {profile.saved.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input maxLength={200} placeholder="Why should your friends listen?" aria-label="Note"
              value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn primary">Share</button>
          </>
        ) : <p className="muted small m0">Save an artist in Discover to recommend them here.</p>}
      </form>
      {feed.length ? feed.map((f, i) => (
        <article key={`${f.type}-${f.user_id}-${f.artist_id}-${i}`} className="panel feed-item">
          <Avatar name={f.user} color={f.user_color} size={40} />
          <div className="feed-text">
            <span>
              <button className="linkish" onClick={() => showProfile(f.user_id)}>{f.user_id === me.id ? 'You' : f.user}</button>{' '}
              {f.type === 'rec' && <>recommends <b>{f.artist}</b></>}
              {f.type === 'save' && <>saved <b>{f.artist}</b></>}
              {f.type === 'checkin' && <>got an early-fan stamp for <b>{f.artist}</b> at {f.venue}</>}
            </span>
            {f.note && <span className="note">“{f.note}”</span>}
            {f.type === 'rec' && <Player artistId={f.artist_id} spotifyUrl={f.spotify_url} deezerId={f.deezer_id} />}
            <span className="small muted">{ago(f.at)}</span>
          </div>
        </article>
      )) : <div className="panel empty">Your feed is empty. Add friends to see what they’re discovering.</div>}
    </>
  );
}

function FindPeople({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState('');
  const { data: people, reload } = useLoad(() => api<Person[]>('/people?q=' + encodeURIComponent(q)), [q]);

  const toggle = async (p: Person) => {
    await api('/follows/' + p.id, p.following ? 'DELETE' : 'POST');
    await reload();
    onChange();
  };

  return (
    <>
      <h2>Add friends</h2>
      <input placeholder="Search by name or @handle" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="stack">
        {people?.length === 0 && <p className="muted">No one matches that name.</p>}
        {people?.map((p) => (
          <div key={p.id} className="person">
            <span className="row">
              <Avatar name={p.name} color={p.color} />
              <span>{p.name}<br /><span className="small muted">@{p.handle}</span></span>
            </span>
            <button className={`btn small ${p.following ? '' : 'primary'}`} onClick={() => toggle(p)}>
              {p.following ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
      </div>
      <SheetCloseButton />
    </>
  );
}
