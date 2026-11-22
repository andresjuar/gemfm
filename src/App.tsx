import { useCallback, useEffect, useState } from 'react';
import type { Me } from '../shared/types';
import { api, session } from './api';
import { Avatar } from './components/Avatar';
import { Discover } from './screens/Discover';
import { Friends } from './screens/Friends';
import { Live } from './screens/Live';
import { PickUser } from './screens/PickUser';
import { Profile } from './screens/Profile';
import { useUi } from './ui';

type Tab = 'discover' | 'live' | 'friends' | 'profile';
const TABS: { id: Tab; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'live', label: 'Live' },
  { id: 'friends', label: 'Friends' },
];

export interface AppActions {
  me: Me;
  refreshMe: () => Promise<void>;
  showProfile: (userId: number) => void;
  switchUser: () => void;
}

export function App() {
  const { openSheet, closeSheet } = useUi();
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>('discover');
  const [profileId, setProfileId] = useState<number | null>(null);
  // Bumped on user switch so every screen reloads its data.
  const [generation, setGeneration] = useState(0);

  const refreshMe = useCallback(async () => setMe(await api<Me>('/me')), []);

  const switchUser = useCallback(() => {
    openSheet(
      <PickUser
        onPick={async (id) => {
          session.setUser(id);
          closeSheet();
          await refreshMe();
          setGeneration((g) => g + 1);
          setTab('discover');
        }}
      />,
    );
  }, [openSheet, closeSheet, refreshMe]);

  useEffect(() => {
    if (!session.userId) return switchUser();
    refreshMe().catch(() => {
      session.setUser(null);
      switchUser();
    });
  }, [refreshMe, switchUser]);

  const go = (next: Tab, userId: number | null = null) => {
    setTab(next);
    setProfileId(userId);
    window.scrollTo(0, 0);
  };

  const actions: AppActions | null = me && {
    me,
    refreshMe,
    showProfile: (id) => go('profile', id),
    switchUser,
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">gem<span>.</span>fm</div>
        <div className="top-right">
          <span className="points" aria-label="Your points">{me ? me.stats.points : 0} pts</span>
          <button className="avatar-btn" aria-label="My profile" onClick={() => (me ? go('profile', me.id) : switchUser())}>
            {me ? <Avatar name={me.name} color={me.color} /> : <span className="avatar" />}
          </button>
        </div>
      </header>

      <main className="view" key={`${generation}-${tab}-${profileId ?? ''}`}>
        {actions && tab === 'discover' && <Discover {...actions} />}
        {actions && tab === 'live' && <Live {...actions} />}
        {actions && tab === 'friends' && <Friends {...actions} />}
        {actions && tab === 'profile' && <Profile {...actions} userId={profileId ?? actions.me.id} />}
      </main>

      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
