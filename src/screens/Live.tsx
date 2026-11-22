import { useState } from 'react';
import type { Gig } from '../../shared/types';
import type { AppActions } from '../App';
import { api } from '../api';
import { plural, when } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { SheetCloseButton, useUi } from '../ui';

export function Live({ refreshMe }: AppActions) {
  const { toast, openSheet } = useUi();
  const [filter, setFilter] = useState<'saved' | 'all'>('saved');
  const { data: gigs, error, reload } = useLoad(() => api<Gig[]>('/gigs' + (filter === 'saved' ? '?saved=1' : '')), [filter]);

  const checkIn = async (g: Gig) => {
    try {
      const r = await api<{ fanNumber: number }>(`/gigs/${g.id}/checkin`, 'POST');
      await refreshMe();
      openSheet(
        <>
          <div className="big-stamp"><span className="eyebrow">Early fan</span><b>#{r.fanNumber}</b><span>{g.artist}</span></div>
          <p className="center m0">You were here before they got big. +25 pts</p>
          <SheetCloseButton primary>Nice</SheetCloseButton>
        </>,
      );
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  // One sponsored night is featured at the top; it's always labelled as sponsored.
  const featured = gigs?.find((g) => g.sponsored && !g.checked_in) ?? gigs?.find((g) => g.sponsored);
  const rest = gigs?.filter((g) => g !== featured);

  return (
    <>
      <div><p className="eyebrow">Guadalajara</p><h2>Gigs near you</h2></div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={filter === 'saved'} className={filter === 'saved' ? 'on' : ''} onClick={() => setFilter('saved')}>From my saves</button>
        <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All gigs</button>
      </div>
      {error && <div className="panel empty">{error}</div>}
      {!gigs && !error && <div className="panel empty" aria-busy="true">Loading gigs…</div>}
      {gigs?.length === 0 && (
        <div className="panel empty">
          {filter === 'saved'
            ? 'None of your saved artists have upcoming gigs. Save more in Discover or see all gigs.'
            : 'No upcoming gigs yet.'}
        </div>
      )}
      {featured && <FeaturedNight gig={featured} onCheckIn={() => checkIn(featured)} />}
      {rest?.map((g) => {
        const d = new Date(g.starts_at);
        return (
          <article key={g.id} className={`panel gig ${g.sponsored ? 'sponsored' : ''}`}>
            <div className="date" style={g.image_url
              ? { backgroundImage: `linear-gradient(rgba(18,14,26,.45), rgba(18,14,26,.45)), url("${g.image_url}")` }
              : { background: g.color }}>
              <b>{d.getDate()}</b><span>{d.toLocaleDateString([], { month: 'short' })}</span>
            </div>
            <div className="gig-info">
              <h3>{g.artist}</h3>
              <span className="small muted">{g.venue}{g.area ? ` · ${g.area}` : ''}</span>
              <span className="small">{when(g.starts_at)} · {g.price_mxn ? `$${g.price_mxn} MXN` : 'Free entry'}</span>
              <div className="row wrap">
                {g.sponsored && <span className="chip sponsor">Sponsored</span>}
                {g.saved ? <span className="chip hot">You saved them</span> : g.genre && <span className="chip">{g.genre}</span>}
                {g.friends_there && <span className="chip">{g.friends_there} checked in</span>}
              </div>
              <div className="row mt4">
                {g.checked_in
                  ? <button className="btn small" disabled>Stamp collected</button>
                  : <button className="btn small primary" onClick={() => checkIn(g)}>Check in</button>}
                <span className="small muted">{plural(g.attendees, 'fan')} there</span>
              </div>
            </div>
          </article>
        );
      })}
      <p className="small muted center m0">Demo: check-in works anytime. The real app would confirm you’re at the venue.</p>
    </>
  );
}

function FeaturedNight({ gig: g, onCheckIn }: { gig: Gig; onCheckIn: () => void }) {
  return (
    <article className="featured-night" aria-label={`Sponsored: ${g.artist} at ${g.venue}`}>
      <div className="featured-media" style={g.image_url ? { backgroundImage: `url("${g.image_url}")` } : { background: g.color }}>
        <span className="sponsored-tag">Sponsored</span>
        <span className="featured-kicker">Featured night</span>
      </div>
      <div className="featured-body">
        <div className="row between">
          <div>
            <h3>{g.venue}</h3>
            <span className="small muted">{g.area}</span>
          </div>
          <span className="featured-price">{g.price_mxn ? `$${g.price_mxn}` : 'Free'}</span>
        </div>
        <p className="m0"><b>{g.artist}</b> · {when(g.starts_at)}</p>
        {g.tagline && <p className="featured-perk m0">{g.tagline}</p>}
        <div className="row">
          {g.checked_in
            ? <button className="btn small" disabled>Stamp collected</button>
            : <button className="btn small primary" onClick={onCheckIn}>Check in</button>}
          <span className="small muted">{plural(g.attendees, 'fan')} there</span>
        </div>
        <p className="tiny muted m0">Sponsored by {g.venue}. Promoted nights are always labelled.</p>
      </div>
    </article>
  );
}
