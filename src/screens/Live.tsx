import { useMemo, useState } from 'react';
import type { Gig } from '../../shared/types';
import type { AppActions } from '../App';
import { api } from '../api';
import { locale, useT } from '../i18n';
import { dayKey, plural, timeOf, when } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { SheetCloseButton, useUi } from '../ui';

export function Live({ refreshMe }: AppActions) {
  const t = useT();
  const { toast, openSheet } = useUi();
  const [filter, setFilter] = useState<'saved' | 'all'>('saved');
  const { data: gigs, error, reload } = useLoad(() => api<Gig[]>('/gigs' + (filter === 'saved' ? '?saved=1' : '')), [filter]);

  const checkIn = async (g: Gig) => {
    try {
      const r = await api<{ fanNumber: number }>(`/gigs/${g.id}/checkin`, 'POST');
      await refreshMe();
      openSheet(<StampSheet artist={g.artist} fanNumber={r.fanNumber} />);
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const openCalendar = () => openSheet(<GigCalendar onCheckIn={checkIn} />);

  // One sponsored night is featured at the top; it's always labelled as sponsored.
  const featured = gigs?.find((g) => g.sponsored && !g.checked_in) ?? gigs?.find((g) => g.sponsored);
  const rest = gigs?.filter((g) => g !== featured);

  return (
    <>
      <div className="row between">
        <div><p className="eyebrow">Guadalajara</p><h2>{t('Gigs near you')}</h2></div>
        <button className="btn small cal-btn" onClick={openCalendar}><CalendarIcon />{t('Calendar')}</button>
      </div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={filter === 'saved'} className={filter === 'saved' ? 'on' : ''} onClick={() => setFilter('saved')}>{t('From my saves')}</button>
        <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>{t('All gigs')}</button>
      </div>
      {error && <div className="panel empty">{error}</div>}
      {!gigs && !error && <div className="panel empty" aria-busy="true">{t('Loading gigs…')}</div>}
      {gigs?.length === 0 && (
        <div className="panel empty">
          {filter === 'saved'
            ? t('None of your saved artists have upcoming gigs. Save more in Discover or see all gigs.')
            : t('No upcoming gigs yet.')}
        </div>
      )}
      {featured && <FeaturedNight gig={featured} onCheckIn={() => checkIn(featured)} />}
      {rest?.map((g) => <GigRow key={g.id} gig={g} onCheckIn={() => checkIn(g)} />)}
      <p className="small muted center m0">{t('Demo: check-in works anytime. The real app would confirm you’re at the venue.')}</p>
    </>
  );
}

function StampSheet({ artist, fanNumber }: { artist: string; fanNumber: number }) {
  const t = useT();
  return (
    <>
      <div className="big-stamp"><span className="eyebrow">{t('Early fan')}</span><b>#{fanNumber}</b><span>{artist}</span></div>
      <p className="center m0">{t('You were here before they got big. +25 pts')}</p>
      <SheetCloseButton primary>{t('Nice')}</SheetCloseButton>
    </>
  );
}

function GigRow({ gig: g, onCheckIn }: { gig: Gig; onCheckIn: () => void }) {
  const t = useT();
  const d = new Date(g.starts_at);
  return (
    <article className={`panel gig ${g.sponsored ? 'sponsored' : ''}`}>
      <div className="date" style={g.image_url
        ? { backgroundImage: `linear-gradient(rgba(18,14,26,.45), rgba(18,14,26,.45)), url("${g.image_url}")` }
        : { background: g.color }}>
        <b>{d.getDate()}</b><span>{d.toLocaleDateString(locale(), { month: 'short' })}</span>
      </div>
      <div className="gig-info">
        <h3>{g.artist}</h3>
        <span className="small muted">{g.venue}{g.area ? ` · ${g.area}` : ''}</span>
        <span className="small">{when(g.starts_at)} · {g.price_mxn ? `$${g.price_mxn} MXN` : t('Free entry')}</span>
        <div className="row wrap">
          {g.sponsored && <span className="chip sponsor">{t('Sponsored')}</span>}
          {g.saved ? <span className="chip hot">{t('You saved them')}</span> : g.genre && <span className="chip">{g.genre}</span>}
          {g.friends_there && <span className="chip">{t('{names} checked in', { names: g.friends_there })}</span>}
        </div>
        <div className="row mt4">
          {g.checked_in
            ? <button className="btn small" disabled>{t('Stamp collected')}</button>
            : <button className="btn small primary" onClick={onCheckIn}>{t('Check in')}</button>}
          <span className="small muted">{plural(g.attendees, '{n} fan there', '{n} fans there')}</span>
        </div>
      </div>
    </article>
  );
}

function FeaturedNight({ gig: g, onCheckIn }: { gig: Gig; onCheckIn: () => void }) {
  const t = useT();
  return (
    <article className="featured-night" aria-label={t('Sponsored: {artist} at {venue}', { artist: g.artist, venue: g.venue })}>
      <div className="featured-media" style={g.image_url ? { backgroundImage: `url("${g.image_url}")` } : { background: g.color }}>
        <span className="sponsored-tag">{t('Sponsored')}</span>
        <span className="featured-kicker">{t('Featured night')}</span>
      </div>
      <div className="featured-body">
        <div className="row between">
          <div>
            <h3>{g.venue}</h3>
            <span className="small muted">{g.area}</span>
          </div>
          <span className="featured-price">{g.price_mxn ? `$${g.price_mxn}` : t('Free')}</span>
        </div>
        <p className="m0"><b>{g.artist}</b> · {when(g.starts_at)}</p>
        {g.tagline && <p className="featured-perk m0">{t(g.tagline)}</p>}
        <div className="row">
          {g.checked_in
            ? <button className="btn small" disabled>{t('Stamp collected')}</button>
            : <button className="btn small primary" onClick={onCheckIn}>{t('Check in')}</button>}
          <span className="small muted">{plural(g.attendees, '{n} fan there', '{n} fans there')}</span>
        </div>
        <p className="tiny muted m0">{t('Sponsored by {venue}. Promoted nights are always labelled.', { venue: g.venue })}</p>
      </div>
    </article>
  );
}

// ---------- Calendar ----------
// Month view of every upcoming gig (not only saved artists). Days with gigs get
// a dot; tapping a day lists its gigs.
function GigCalendar({ onCheckIn }: { onCheckIn: (g: Gig) => void }) {
  const t = useT();
  const { closeSheet } = useUi();
  const { data: gigs, error } = useLoad(() => api<Gig[]>('/gigs'));
  const byDay = useMemo(() => {
    const m = new Map<string, Gig[]>();
    for (const g of gigs ?? []) {
      const k = dayKey(new Date(g.starts_at));
      m.set(k, [...(m.get(k) ?? []), g]);
    }
    return m;
  }, [gigs]);

  const today = dayKey(new Date());
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [picked, setPicked] = useState<string | null>(null);
  // Until a day is tapped, show today, or the first day with gigs.
  const firstDay = [...byDay.keys()].sort().find((k) => k >= today);
  const selected = picked ?? (byDay.has(today) ? today : firstDay ?? today);

  const cells = useMemo(() => {
    const first = new Date(month);
    const lead = (first.getDay() + 6) % 7; // weeks start on Monday
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'narrow' })); // 2024-01-01 is a Monday
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const list = byDay.get(selected) ?? [];
  const [y, m, d] = selected.split('-').map(Number);
  const selectedLabel = new Date(y, m - 1, d).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="row between">
        <h2>{t('Upcoming gigs')}</h2>
        <button className="btn small" onClick={closeSheet}>{t('Close')}</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="cal" aria-busy={!gigs}>
        <div className="cal-head">
          <button className="icon-btn" aria-label={t('Previous month')} onClick={() => shift(-1)} disabled={month <= thisMonth}>‹</button>
          <b className="cal-title">{month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</b>
          <button className="icon-btn" aria-label={t('Next month')} onClick={() => shift(1)}>›</button>
        </div>
        <div className="cal-grid" role="grid">
          {weekdays.map((w, i) => <span key={'w' + i} className="cal-wd" aria-hidden="true">{w}</span>)}
          {cells.map((date, i) => {
            if (!date) return <span key={i} />;
            const k = dayKey(date);
            const n = byDay.get(k)?.length ?? 0;
            const cls = ['cal-day', n ? 'has' : '', k === selected ? 'on' : '', k === today ? 'today' : '', k < today ? 'past' : ''].join(' ');
            return (
              <button key={k} className={cls} aria-pressed={k === selected} onClick={() => setPicked(k)}
                aria-label={`${date.toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}${n ? ` · ${plural(n, '{n} gig', '{n} gigs')}` : ''}`}>
                <span>{date.getDate()}</span>
                {n > 0 && <i aria-hidden="true">{n > 1 ? n : ''}</i>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="stack">
        <span className="eyebrow">{selected === today ? t('Today') : selectedLabel}</span>
        {gigs && list.length === 0 && <p className="muted small m0">{t('No gigs this day.')}</p>}
        {list.map((g) => (
          <div key={g.id} className="cal-gig">
            <span className="cal-time">{timeOf(g.starts_at)}</span>
            <span className="grow">
              <b>{g.artist}</b><br />
              <span className="small muted">{g.venue}{g.area ? ` · ${g.area}` : ''} · {g.price_mxn ? `$${g.price_mxn} MXN` : t('Free entry')}</span>
              <span className="row wrap mt4">
                {g.sponsored && <span className="chip sponsor">{t('Sponsored')}</span>}
                {g.saved && <span className="chip hot">{t('You saved them')}</span>}
                {g.checked_in
                  ? <span className="chip">{t('Stamp collected')}</span>
                  : <button className="btn small primary" onClick={() => onCheckIn(g)}>{t('Check in')}</button>}
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
    <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);
