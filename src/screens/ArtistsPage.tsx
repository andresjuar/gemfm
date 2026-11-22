// Artist side: add artists and gigs, paste Spotify links, and review what the
// emerging-artist radar found.
import { useState, type FormEvent } from 'react';
import type { Artist, RadarResult, Venue } from '../../shared/types';
import { api, session } from '../api';
import { ArtistImage } from '../components/ArtistImage';
import { Logo } from '../components/Logo';
import { Player } from '../components/Player';
import { compact, plural } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { useUi } from '../ui';

export function ArtistsPage() {
  const { toast } = useUi();
  const approved = useLoad(() => api<Artist[]>('/artists'));
  const pending = useLoad(() => api<Artist[]>('/artists?status=pending'));
  const venues = useLoad(() => api<Venue[]>('/venues'));
  const reloadAll = () => { approved.reload(); pending.reload(); };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      return true;
    } catch (err) {
      toast((err as Error).message);
      return false;
    }
  };

  return (
    <div className="app wide-bottom">
      <header className="top">
        <div className="row"><Logo size={22} /><span className="small muted brand-sub">for artists</span></div>
        <a className="btn small" href="/">Back to app</a>
      </header>
      <main className="view">
        <AdminKey />
        <Radar onDone={pending.reload} />

        <section className="stack">
          <div className="row between">
            <span className="eyebrow">Waiting for review</span>
            <span className="small muted">{pending.data ? plural(pending.data.length, 'artist') : ''}</span>
          </div>
          {pending.data?.length === 0 && <p className="small muted m0">Nothing pending. Run the radar to find new artists.</p>}
          {pending.data?.map((a) => (
            <article key={a.id} className="panel stack">
              <div className="row">
                {a.image_url ? <img className="thumb" src={a.image_url} alt="" /> : null}
                <div className="grow">
                  <b>{a.name}</b>
                  <div className="small muted">{a.external_fans != null ? `${compact(a.external_fans)} fans on Deezer · ` : ''}{a.bio}</div>
                </div>
              </div>
              <Player artistId={a.id} spotifyUrl={a.spotify_url} deezerId={a.deezer_id} />
              <PendingActions artist={a} onDone={reloadAll} run={run} />
            </article>
          ))}
        </section>

        <NewArtist onDone={reloadAll} run={run} />
        <NewGig artists={approved.data ?? []} venues={venues.data ?? []} run={run} onNewVenue={venues.reload} />

        <section className="stack">
          <span className="eyebrow">Artists, Spotify links and photos</span>
          <p className="small muted m0">
            In Spotify, open the artist (or a song), tap Share › Copy link and paste it here. An artist link also brings their photo.
            Without a link, cards play a Deezer preview when available.
          </p>
          {approved.data && <MissingPhotos artists={approved.data} run={run} onDone={approved.reload} />}
          {approved.data?.map((a) => <ArtistRow key={`${a.id}-${a.image_url}`} artist={a} run={run} onChange={approved.reload} />)}
        </section>
      </main>
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, ok: string) => Promise<boolean>;

function AdminKey() {
  const [key, setKey] = useState(session.adminKey);
  return (
    <form className="panel stack" onSubmit={(e) => { e.preventDefault(); session.setAdminKey(key.trim()); }}>
      <span className="eyebrow">Admin key</span>
      <p className="small muted m0">Needed to make changes on the deployed site (the ADMIN_KEY you set in Netlify). Saved in this browser only.</p>
      <div className="row">
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key" aria-label="Admin key" autoComplete="off" />
        <button className="btn small">Save</button>
      </div>
    </form>
  );
}

function Radar({ onDone }: { onDone: () => void }) {
  const { toast } = useUi();
  const [seeds, setSeeds] = useState('');
  const [maxFans, setMaxFans] = useState(60000);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<RadarResult | null>(null);

  const scan = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<RadarResult>('/radar', 'POST', { seeds, maxFans });
      setLast(r);
      toast(r.added.length ? `Found ${plural(r.added.length, 'new artist')}` : 'No new artists this time');
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel stack" onSubmit={scan}>
      <span className="eyebrow">Emerging-artist radar</span>
      <p className="small muted m0">
        Looks at artists related to the ones you name (or, if you leave it empty, the ones gem.fm users save most)
        and keeps those with few fans. It also runs every Monday on its own.
      </p>
      <div className="field">
        <label htmlFor="r-seeds">Start from (comma-separated, optional)</label>
        <input id="r-seeds" value={seeds} onChange={(e) => setSeeds(e.target.value)} placeholder="Ed Maverick, Silvana Estrada" />
      </div>
      <div className="field">
        <label htmlFor="r-max">At most this many Deezer fans: {compact(maxFans)}</label>
        <input id="r-max" type="range" min={2000} max={200000} step={2000} value={maxFans} onChange={(e) => setMaxFans(Number(e.target.value))} />
      </div>
      <button className="btn primary" disabled={busy}>{busy ? 'Scanning…' : 'Find emerging artists'}</button>
      {last && (
        <p className="small muted m0">
          Started from {last.seeds.join(', ') || 'nothing'} · looked at {last.scanned} related artists · added {last.added.length}.
        </p>
      )}
    </form>
  );
}

function PendingActions({ artist, onDone, run }: { artist: Artist; onDone: () => void; run: Run }) {
  const [genre, setGenre] = useState(artist.genre);
  const [city, setCity] = useState(artist.city);
  const decide = async (status: 'approved' | 'rejected') => {
    const ok = await run(() => api(`/artists/${artist.id}`, 'PATCH', { status, genre, city }),
      status === 'approved' ? `${artist.name} is now in Discover` : `${artist.name} rejected`);
    if (ok) onDone();
  };
  return (
    <>
      <div className="row">
        <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre" aria-label={`Genre for ${artist.name}`} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" aria-label={`City for ${artist.name}`} />
      </div>
      <div className="row">
        <button className="btn small grow" onClick={() => decide('rejected')}>Reject</button>
        <button className="btn small primary grow" onClick={() => decide('approved')}>Approve</button>
      </div>
    </>
  );
}

function NewArtist({ onDone, run }: { onDone: () => void; run: Run }) {
  const empty = { name: '', genre: '', city: 'Guadalajara', bio: '', spotify_url: '' };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api('/artists', 'POST', f), 'Artist added')) {
      setF(empty);
      onDone();
    }
  };
  return (
    <form className="panel stack" onSubmit={submit}>
      <span className="eyebrow">Join as an artist</span>
      <div className="field"><label htmlFor="a-name">Artist name</label><input id="a-name" required value={f.name} onChange={set('name')} /></div>
      <div className="field"><label htmlFor="a-genre">Genre</label><input id="a-genre" required placeholder="Indie rock" value={f.genre} onChange={set('genre')} /></div>
      <div className="field"><label htmlFor="a-city">City</label><input id="a-city" value={f.city} onChange={set('city')} /></div>
      <div className="field"><label htmlFor="a-bio">Short bio</label><input id="a-bio" maxLength={140} value={f.bio} onChange={set('bio')} /></div>
      <div className="field"><label htmlFor="a-spotify">Spotify link</label><input id="a-spotify" placeholder="https://open.spotify.com/track/…" value={f.spotify_url} onChange={set('spotify_url')} /></div>
      <p className="small muted m0">If the name matches an artist on Deezer, their photo and a preview are added automatically.</p>
      <button className="btn primary">Add artist</button>
    </form>
  );
}

function NewGig({ artists, venues, run, onNewVenue }: { artists: Artist[]; venues: Venue[]; run: Run; onNewVenue: () => void }) {
  const [artistId, setArtistId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [price, setPrice] = useState('0');
  const [venueName, setVenueName] = useState('');
  const [venueArea, setVenueArea] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => api('/gigs', 'POST', {
      artistId: Number(artistId || artists[0]?.id), venueId: Number(venueId || venues[0]?.id), startsAt, price: Number(price),
    }), 'Gig added');
    if (ok) setStartsAt('');
  };
  const addVenue = async () => {
    if (await run(() => api('/venues', 'POST', { name: venueName, area: venueArea }), 'Venue added')) {
      setVenueName(''); setVenueArea(''); onNewVenue();
    }
  };

  return (
    <form className="panel stack" onSubmit={submit}>
      <span className="eyebrow">Announce a gig</span>
      <div className="field"><label htmlFor="g-artist">Artist</label>
        <select id="g-artist" value={artistId} onChange={(e) => setArtistId(e.target.value)}>
          {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="g-venue">Venue</label>
        <select id="g-venue" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}{v.area ? ` · ${v.area}` : ''}</option>)}
        </select>
      </div>
      <details>
        <summary className="small muted">Venue not listed?</summary>
        <div className="row mt4">
          <input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Venue name" aria-label="New venue name" />
          <input value={venueArea} onChange={(e) => setVenueArea(e.target.value)} placeholder="Area" aria-label="New venue area" />
          <button type="button" className="btn small" onClick={addVenue}>Add</button>
        </div>
      </details>
      <div className="field"><label htmlFor="g-date">Date and time</label><input id="g-date" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
      <div className="field"><label htmlFor="g-price">Price (MXN, 0 = free)</label><input id="g-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      <button className="btn primary">Add gig</button>
    </form>
  );
}

function ArtistRow({ artist, run, onChange }: { artist: Artist; run: Run; onChange: () => void }) {
  const [url, setUrl] = useState(artist.spotify_url);
  const [image, setImage] = useState(artist.image_url);
  const [finding, setFinding] = useState(false);

  const saveSpotify = async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const r = await api<{ image_url: string }>(`/artists/${artist.id}`, 'PATCH', { spotify_url: url.trim() });
      setImage(r.image_url);
    }, 'Spotify link saved');
  };
  const saveImage = () => run(() => api(`/artists/${artist.id}`, 'PATCH', { image_url: image.trim() }), image.trim() ? 'Photo saved' : 'Photo removed');
  const findPhoto = async () => {
    setFinding(true);
    const ok = await run(async () => {
      const r = await api<{ image_url: string; source: string }>(`/artists/${artist.id}/photo`, 'POST');
      setImage(r.image_url);
    }, 'Photo found');
    setFinding(false);
    if (ok) onChange();
  };

  return (
    <form className="panel stack" onSubmit={saveSpotify}>
      <div className="row">
        <ArtistImage artist={{ ...artist, image_url: image }} size={56} />
        <div className="grow">
          <b>{artist.name}</b>
          <div className="row wrap mt4">
            {artist.genre && <span className="chip">{artist.genre}</span>}
            {artist.deezer_id ? <span className="chip">Deezer preview</span> : null}
            <span className="chip">{plural(artist.saves, 'fan')}</span>
          </div>
        </div>
      </div>
      <div className="row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste Spotify link" aria-label={`Spotify link for ${artist.name}`} />
        <button className="btn small">Save</button>
      </div>
      <details>
        <summary className="small muted">Photo</summary>
        <div className="stack mt4">
          <div className="row">
            <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://… image link" aria-label={`Photo link for ${artist.name}`} />
            <button type="button" className="btn small" onClick={saveImage}>Save</button>
          </div>
          <button type="button" className="btn small" onClick={findPhoto} disabled={finding}>
            {finding ? 'Looking…' : 'Find photo automatically'}
          </button>
          <p className="small muted m0">Uses the Spotify artist link if there is one, otherwise looks the name up on Deezer.</p>
        </div>
      </details>
    </form>
  );
}

function MissingPhotos({ artists, run, onDone }: { artists: Artist[]; run: Run; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const missing = artists.filter((a) => !a.image_url).length;
  if (!missing) return null;
  const fill = async () => {
    setBusy(true);
    await run(async () => {
      const r = await api<{ checked: number; found: number }>('/artists/photos', 'POST');
      if (!r.found) throw new Error(`No photos found for ${plural(r.checked, 'artist')}. Add their Spotify artist links.`);
    }, 'Photos updated');
    setBusy(false);
    onDone();
  };
  return (
    <div className="panel row between">
      <span className="small">{plural(missing, 'artist')} without a photo</span>
      <button type="button" className="btn small primary" onClick={fill} disabled={busy}>{busy ? 'Looking…' : 'Find photos'}</button>
    </div>
  );
}
