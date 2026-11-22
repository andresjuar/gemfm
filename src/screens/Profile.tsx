import type { Profile as ProfileData } from '../../shared/types';
import type { AppActions } from '../App';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { ago } from '../lib/format';
import { useLoad } from '../lib/useLoad';

export function Profile({ me, userId, switchUser }: AppActions & { userId: number }) {
  const { data: p, error, reload } = useLoad(() => api<ProfileData>('/users/' + userId), [userId]);
  if (error) return <div className="panel empty">{error}</div>;
  if (!p) return <div className="panel empty" aria-busy="true">Loading profile…</div>;
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
          ? <button className="btn small" onClick={switchUser}>Switch user</button>
          : <button className={`btn small ${p.isFollowing ? '' : 'primary'}`} onClick={toggleFollow}>{p.isFollowing ? 'Following' : 'Follow'}</button>}
      </div>
      <div className="panel stats">
        <div><b>{p.stats.points}</b><span className="small muted">points</span></div>
        <div><b>{p.stats.saves}</b><span className="small muted">artists saved</span></div>
        <div><b>{p.stats.checkins}</b><span className="small muted">stamps</span></div>
      </div>
      <section className="stack">
        <span className="eyebrow">Badges</span>
        <div className="badges">
          {p.stats.badges.map((b) => (
            <div key={b.id} className={`badge ${b.earned ? 'earned' : ''}`}>
              <b>{b.name}</b><span className="small muted">{b.earned ? 'Earned' : b.hint}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="stack">
        <span className="eyebrow">Early-fan stamps</span>
        {p.stamps.length ? (
          <div className="stack">
            {p.stamps.map((s, i) => (
              <div key={i} className="stamp">
                <span><b>{s.artist}</b><br /><span className="small muted">{s.venue} · {ago(s.created_at)}</span></span>
                <span className="chip hot">Fan #{s.fan_number}</span>
              </div>
            ))}
          </div>
        ) : <p className="muted small m0">No stamps yet. Check in at a gig in the Live tab.</p>}
      </section>
      <section className="stack">
        <span className="eyebrow">Saved artists</span>
        {p.saved.length
          ? <div className="row wrap">{p.saved.map((a) => <span key={a.id} className="chip">{a.name}</span>)}</div>
          : <p className="muted small m0">Nothing saved yet.</p>}
      </section>
    </>
  );
}
