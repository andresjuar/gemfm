// Admin (/admin): add artists, gigs and venues, review the emerging-artist
// radar, sponsorships and applications from /artist and /venues.
import { useState, type FormEvent } from 'react';
import type { Application, Artist, RadarResult, Venue } from '../../shared/types';
import { api, session } from '../api';
import { ArtistImage } from '../components/ArtistImage';
import { Logo } from '../components/Logo';
import { Player } from '../components/Player';
import { ago, compact, plural } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { useUi } from '../ui';

export function AdminPage() {
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
        <div className="row"><Logo size={22} /><span className="small muted brand-sub">admin</span></div>
        <a className="btn small" href="/">Back to app</a>
      </header>
      <main className="view">
        <AdminKey />
        <Applications run={run} />
        <Radar onDone={pending.reload} />

        <section className="stack">
          <div className="row between">
            <span className="eyebrow">Waiting for review</span>
            <span className="small muted">{pending.data ? plural(pending.data.length, 'artist') : ''}</span>
          </div>
          {pending.data?.length === 0 && <p className="small muted m0">Nothing pending. Run the radar to find new artists.</p>}
          {pending.data && <FillMissing artists={pending.data} status="pending" run={run} onDone={pending.reload} />}
          {pending.data?.map((a) => (
            <article key={`${a.id}-${a.genre}-${a.city}-${a.language}`} className="panel stack">
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
        <Venues venues={venues.data ?? []} run={run} onChange={venues.reload} />

        <section className="stack">
          <span className="eyebrow">Artists, Spotify links, details and photos</span>
          <p className="small muted m0">
            In Spotify, open the artist (or a song), tap Share › Copy link and paste it here. An artist link also brings their photo.
            Without a link, cards play a Deezer preview when available.
          </p>
          {approved.data && <FillMissing artists={approved.data} status="approved" run={run} onDone={approved.reload} />}
          {approved.data && <MissingPhotos artists={approved.data} run={run} onDone={approved.reload} />}
          {approved.data?.map((a) => <ArtistRow key={`${a.id}-${a.image_url}`} artist={a} run={run} onChange={approved.reload} />)}
        </section>
      </main>
      <datalist id="languages">
        {['Spanish', 'English', 'Portuguese', 'French', 'Instrumental'].map((l) => <option key={l} value={l} />)}
      </datalist>
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

type Details = { genre: string; city: string; language: string };

/** Genre / hometown / language inputs with an "Auto-fill" button (Deezer + MusicBrainz). */
function useDetails(artist: Artist) {
  const [d, setD] = useState<Details>({ genre: artist.genre, city: artist.city, language: artist.language ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Details) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  return { d, setD, busy, setBusy, set };
}

function DetailsFields({ artist, state, run }: { artist: Artist; state: ReturnType<typeof useDetails>; run: Run }) {
  const { d, setD, busy, setBusy, set } = state;
  const autoFill = async () => {
    setBusy(true);
    await run(async () => {
      const r = await api<Details & { filled: string[] }>(`/artists/${artist.id}/details`, 'POST', { overwrite: false });
      setD({ genre: d.genre || r.genre, city: d.city || r.city, language: d.language || r.language });
      if (!r.filled.length) throw new Error('Nothing new found. Fill in the rest by hand.');
    }, 'Details filled in');
    setBusy(false);
  };
  return (
    <div className="stack details-fields">
      <div className="details-grid">
        <input value={d.genre} onChange={set('genre')} placeholder="Genre" aria-label={`Genre for ${artist.name}`} />
        <input value={d.city} onChange={set('city')} placeholder="From (city, country)" aria-label={`Hometown of ${artist.name}`} />
        <input value={d.language} onChange={set('language')} placeholder="Language" aria-label={`Language of ${artist.name}`} list="languages" />
        <button type="button" className="btn small" onClick={autoFill} disabled={busy}>{busy ? 'Looking…' : 'Auto-fill'}</button>
      </div>
    </div>
  );
}

function PendingActions({ artist, onDone, run }: { artist: Artist; onDone: () => void; run: Run }) {
  const state = useDetails(artist);
  const decide = async (status: 'approved' | 'rejected') => {
    const ok = await run(() => api(`/artists/${artist.id}`, 'PATCH', { status, ...state.d }),
      status === 'approved' ? `${artist.name} is now in Discover` : `${artist.name} rejected`);
    if (ok) onDone();
  };
  return (
    <>
      <DetailsFields artist={artist} state={state} run={run} />
      <div className="row">
        <button className="btn small grow" onClick={() => decide('rejected')}>Reject</button>
        <button className="btn small primary grow" onClick={() => decide('approved')}>Approve</button>
      </div>
    </>
  );
}

/** Fills in missing genre / language / hometown for many artists, a few per request. */
function FillMissing({ artists, status, run, onDone }: { artists: Artist[]; status: 'approved' | 'pending'; run: Run; onDone: () => void }) {
  const [progress, setProgress] = useState<string | null>(null);
  const missing = artists.filter((a) => !a.genre || !a.language || !a.city).length;
  if (!missing) return null;
  const fill = async () => {
    let updated = 0;
    setProgress('Starting…');
    await run(async () => {
      let after = 0;
      for (let round = 0; round < 40; round++) {
        const r = await api<{ checked: number; updated: number; remaining: number; lastId: number }>('/artists/details', 'POST', { status, after });
        updated += r.updated;
        after = r.lastId;
        setProgress(`${r.remaining} left…`);
        if (!r.remaining || !r.checked) break;
      }
    }, 'Details filled in where found');
    setProgress(null);
    onDone();
    if (!updated) run(async () => { throw new Error('Nothing new found. Fill in the rest by hand.'); }, '');
  };
  return (
    <div className="panel row between">
      <span className="small">{plural(missing, 'artist')} missing genre, hometown or language</span>
      <button type="button" className="btn small primary" onClick={fill} disabled={!!progress}>{progress ?? 'Auto-fill all'}</button>
    </div>
  );
}

function NewArtist({ onDone, run }: { onDone: () => void; run: Run }) {
  const empty = { name: '', genre: '', city: '', language: '', bio: '', spotify_url: '' };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    let added: { genre: string; city: string; language: string } | null = null;
    const ok = await run(async () => { added = await api('/artists', 'POST', f); }, 'Artist added');
    setBusy(false);
    if (ok) {
      const a = added as { genre: string; city: string; language: string } | null;
      if (a) run(async () => {}, `Added: ${[a.genre, a.city, a.language].filter(Boolean).join(' · ') || 'no details found'}`);
      setF(empty);
      onDone();
    }
  };
  return (
    <form className="panel stack" onSubmit={submit}>
      <span className="eyebrow">Join as an artist</span>
      <div className="field"><label htmlFor="a-name">Artist name</label><input id="a-name" required value={f.name} onChange={set('name')} /></div>
      <div className="field"><label htmlFor="a-spotify">Spotify link (artist or song)</label><input id="a-spotify" placeholder="https://open.spotify.com/track/…" value={f.spotify_url} onChange={set('spotify_url')} /></div>
      <div className="field"><label htmlFor="a-genre">Genre</label><input id="a-genre" placeholder="Leave empty to detect it" value={f.genre} onChange={set('genre')} /></div>
      <div className="field"><label htmlFor="a-city">From</label><input id="a-city" placeholder="City, country (leave empty to look it up)" value={f.city} onChange={set('city')} /></div>
      <div className="field"><label htmlFor="a-lang">Language</label><input id="a-lang" list="languages" placeholder="Leave empty to detect it" value={f.language} onChange={set('language')} /></div>
      <div className="field"><label htmlFor="a-bio">Short bio</label><input id="a-bio" maxLength={140} value={f.bio} onChange={set('bio')} /></div>
      <p className="small muted m0">
        Leave genre, hometown or language empty and gem.fm fills them in: genre and language from Deezer (via their songs),
        hometown from MusicBrainz when it knows the artist. The photo and a preview come too.
      </p>
      <button className="btn primary" disabled={busy}>{busy ? 'Looking them up…' : 'Add artist'}</button>
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
  const details = useDetails(artist);
  const saveDetails = async () => {
    if (await run(() => api(`/artists/${artist.id}`, 'PATCH', details.d), 'Details saved')) onChange();
  };

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
            {artist.city && <span className="chip">{artist.city}</span>}
            {artist.language && <span className="chip">{artist.language}</span>}
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
        <summary className="small muted">Genre, hometown and language</summary>
        <div className="stack mt4">
          <DetailsFields artist={artist} state={details} run={run} />
          <button type="button" className="btn small primary" onClick={saveDetails}>Save details</button>
        </div>
      </details>
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

// ---------- Applications from /artist and /venues ----------
const FIELD_LABELS: Record<string, string> = {
  project: 'Project', venue: 'Venue', genre: 'Genre', city: 'City', area: 'Area', address: 'Address', capacity: 'Capacity',
  type: 'Type', phone: 'Phone', spotify: 'Spotify', instagram: 'Instagram', goals: 'Interested in', message: 'Message',
};

function Applications({ run }: { run: Run }) {
  const apps = useLoad(() => api<Application[]>('/applications'));
  const setStatus = async (a: Application, status: Application['status']) => {
    if (await run(() => api(`/applications/${a.id}`, 'PATCH', { status }), status === 'archived' ? 'Archived' : 'Marked as contacted')) apps.reload();
  };
  return (
    <section className="stack">
      <div className="row between">
        <span className="eyebrow">Applications</span>
        <span className="small muted">{apps.data ? `${apps.data.filter((a) => a.status === 'new').length} new` : ''}</span>
      </div>
      <p className="small muted m0">Sent from <a href="/artist">/artist</a> and <a href="/venues">/venues</a>.</p>
      {apps.error && <p className="error">{apps.error}</p>}
      {apps.data?.length === 0 && <p className="small muted m0">No applications yet.</p>}
      {apps.data?.map((a) => (
        <article key={a.id} className={`panel stack app-card ${a.status}`}>
          <div className="row between">
            <span className={`chip ${a.kind === 'venue' ? 'sponsor' : 'hot'}`}>{a.kind === 'venue' ? 'Venue' : 'Artist'}</span>
            <span className="small muted">{ago(a.created_at)}{a.status === 'contacted' ? ' · contacted' : ''}</span>
          </div>
          <div>
            <b>{String(a.details.project ?? a.details.venue ?? a.name)}</b>
            <div className="small muted">{a.name} · <a href={`mailto:${a.email}`}>{a.email}</a></div>
          </div>
          <dl className="app-details">
            {Object.entries(a.details).filter(([k]) => k !== 'project' && k !== 'venue').map(([k, v]) => (
              <div key={k}><dt>{FIELD_LABELS[k] ?? k}</dt><dd>{Array.isArray(v) ? v.join(', ') : v}</dd></div>
            ))}
          </dl>
          <div className="row">
            {a.status === 'new' && <button className="btn small grow" onClick={() => setStatus(a, 'contacted')}>Mark contacted</button>}
            <button className="btn small grow" onClick={() => setStatus(a, 'archived')}>Archive</button>
          </div>
        </article>
      ))}
    </section>
  );
}

// ---------- Venues and sponsorship ----------
function Venues({ venues, run, onChange }: { venues: Venue[]; run: Run; onChange: () => void }) {
  return (
    <section className="stack">
      <span className="eyebrow">Venues and sponsorship</span>
      <p className="small muted m0">Sponsored venues get a featured night at the top of Live, always labelled “Sponsored”.</p>
      {venues.map((v) => <VenueRow key={`${v.id}-${v.sponsored}-${v.tagline}`} venue={v} run={run} onChange={onChange} />)}
    </section>
  );
}

function VenueRow({ venue: v, run, onChange }: { venue: Venue; run: Run; onChange: () => void }) {
  const [tagline, setTagline] = useState(v.tagline);
  const save = async (sponsored: boolean) => {
    if (await run(() => api(`/venues/${v.id}`, 'PATCH', { sponsored, tagline }), sponsored ? `${v.name} is sponsored` : `${v.name} is no longer sponsored`)) onChange();
  };
  return (
    <div className={`panel stack ${v.sponsored ? 'venue-sponsored' : ''}`}>
      <div className="row between">
        <span><b>{v.name}</b>{v.area ? <span className="small muted"> · {v.area}</span> : null}</span>
        {v.sponsored && <span className="chip sponsor">Sponsored</span>}
      </div>
      <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120}
        placeholder="Perk shown on featured nights, e.g. 2x1 drinks with your stamp" aria-label={`Perk for ${v.name}`} />
      <div className="row">
        {v.sponsored
          ? <><button className="btn small grow" onClick={() => save(true)}>Save perk</button><button className="btn small grow" onClick={() => save(false)}>Stop sponsoring</button></>
          : <button className="btn small primary grow" onClick={() => save(true)}>Make sponsored</button>}
      </div>
    </div>
  );
}
