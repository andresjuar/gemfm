import type { User } from '../../shared/types';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { useLoad } from '../lib/useLoad';

export function PickUser({ onPick }: { onPick: (id: number) => void }) {
  const { data: users, error } = useLoad(() => api<User[]>('/users'));
  return (
    <>
      <p className="eyebrow">Demo mode</p>
      <h2>Who’s listening?</h2>
      <p className="muted small">Pick a demo account. Each one has its own saves, friends and stamps.</p>
      {error && <p className="error">{error}</p>}
      <div className="stack">
        {users?.map((u) => (
          <button key={u.id} className="btn person" onClick={() => onPick(u.id)}>
            <span className="row"><Avatar name={u.name} color={u.color} />{u.name}</span>
            <span className="muted small">@{u.handle}</span>
          </button>
        ))}
      </div>
    </>
  );
}
