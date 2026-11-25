import type { Profile as ProfileData } from '../../shared/types';
import type { AppActions } from '../App';
import { api } from '../api';
import { ArtistImage } from '../components/ArtistImage';
import { Avatar } from '../components/Avatar';
import { useLang, useT, type Lang } from '../i18n';
import { useTagLabels } from '../lib/useTagLabels';
import { ago } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { useUi } from '../ui';

export function Profile({ me, userId, logOut, editTastes }: AppActions & { userId: number }) {
  const t = useT();
  const { openSheet } = useUi();
  const { data: p, error, reload } = useLoad(() => api<ProfileData>('/users/' + userId), [userId]);
  const labels = useTagLabels();
  if (error) return <div className="panel empty">{error}</div>;
  if (!p) return <div className="panel empty" aria-busy="true">{t('Loading profile…')}</div>;
  const mine = p.id === me.id;

  const toggleFollow = async () => {
    await api('/follows/' + p.id, p.isFollowing ? 'DELETE' : 'POST');
    reload();
  };

  return (
    <>
      <div className="row">
        <Avatar name={p.name} color={p.color} size={64} />
        <div className="grow"><h2>{p.name}</h2><span className="muted">@{p.handle}</span></div>
        {mine
          ? (
            <button className="icon-btn settings-btn" aria-label={t('Settings')}
              onClick={() => openSheet(<Settings demo={!!me.demo} logOut={logOut} editTastes={editTastes} />)}>
              <GearIcon />
            </button>
          )
          : <button className={`btn small ${p.isFollowing ? '' : 'primary'}`} onClick={toggleFollow}>{p.isFollowing ? t('Following') : t('Follow')}</button>}
      </div>
      {mine && me.demo && <p className="small muted m0"><span className="demo-pill">{t('Demo')}</span> {t('Demo account, made for today’s demo.')}</p>}
      <div className="panel stats">
        <div><b>{p.stats.points}</b><span className="small muted">{t('points')}</span></div>
        <div><b>{p.stats.saves}</b><span className="small muted">{t('artists saved')}</span></div>
        <div><b>{p.stats.checkins}</b><span className="small muted">{t('stamps')}</span></div>
      </div>
      <section className="stack">
        <div className="row between">
          <span className="eyebrow">{mine ? t('Your tastes') : t('Tastes')}</span>
          {mine && <button className="btn small" onClick={editTastes}>{t('Edit')}</button>}
        </div>
        {p.tags.length
          ? <div className="row wrap">{labels(p.tags).map((l) => <span key={l} className="chip taste">{t(l)}</span>)}</div>
          : <p className="muted small m0">{mine ? t('Pick the styles you like so Discover can show you artists for you.') : t('No tastes picked yet.')}</p>}
      </section>
      <section className="stack">
        <span className="eyebrow">{t('Badges')}</span>
        <div className="badges">
          {p.stats.badges.map((b) => (
            <div key={b.id} className={`badge ${b.earned ? 'earned' : ''}`}>
              <b>{t(b.name)}</b><span className="small muted">{b.earned ? t('Earned') : t(b.hint)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="stack">
        <span className="eyebrow">{t('Early-fan stamps')}</span>
        {p.stamps.length ? (
          <div className="stack">
            {p.stamps.map((s, i) => (
              <div key={i} className="stamp">
                <span><b>{s.artist}</b><br /><span className="small muted">{s.venue} · {ago(s.created_at)}</span></span>
                <span className="chip hot">{t('Fan #{n}', { n: s.fan_number })}</span>
              </div>
            ))}
          </div>
        ) : <p className="muted small m0">{t('No stamps yet. Check in at a gig in the Live tab.')}</p>}
      </section>
      <section className="stack">
        <span className="eyebrow">{t('Saved artists')}</span>
        {p.saved.length
          ? (
            <div className="saved-grid">
              {p.saved.map((a) => (
                <div key={a.id} className="saved-artist">
                  <ArtistImage artist={a} size={64} />
                  <span className="small">{a.name}</span>
                </div>
              ))}
            </div>
          )
          : <p className="muted small m0">{t('Nothing saved yet.')}</p>}
      </section>
    </>
  );
}

// Settings sheet: language, tastes and signing out.
function Settings({ demo, logOut, editTastes }: { demo: boolean; logOut: () => void; editTastes: () => void }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { closeSheet } = useUi();
  const langs: { id: Lang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }];

  return (
    <>
      <h2>{t('Settings')}</h2>
      <section className="stack">
        <span className="eyebrow" id="lang-label">{t('Language')}</span>
        <div className="seg" role="radiogroup" aria-labelledby="lang-label">
          {langs.map((l) => (
            <button key={l.id} role="radio" aria-checked={lang === l.id} className={lang === l.id ? 'on' : ''} lang={l.id}
              onClick={() => setLang(l.id)}>{l.label}</button>
          ))}
        </div>
      </section>
      <section className="stack">
        <span className="eyebrow">{t('Account')}</span>
        <button className="btn" onClick={editTastes}>{t('Edit your tastes')}</button>
        <button className="btn" onClick={logOut}>{t('Sign out')}</button>
        {demo && <p className="small muted m0">{t('This is a demo account. To get back in, type the same username on the sign-in screen.')}</p>}
      </section>
      <button className="btn primary" onClick={closeSheet}>{t('Done')}</button>
    </>
  );
}

const GearIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" fill="none" stroke="currentColor" strokeWidth="1.9" />
    <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
