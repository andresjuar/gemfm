import { useCallback, useEffect, useState } from 'react';
import type { Me } from '../shared/types';
import { ApiError, api } from './api';
import { Avatar } from './components/Avatar';
import { Logo } from './components/Logo';
import { useSecretMenu } from './components/SecretMenu';
import { useT } from './i18n';
import { TagPicker } from './components/TagPicker';
import { Discover } from './screens/Discover';
import { Friends } from './screens/Friends';
import { Live } from './screens/Live';
import { Login } from './screens/Login';
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
  logOut: () => void;
  editTastes: () => void;
}

type Status = 'loading' | 'signed-out' | 'signed-in' | 'offline';

export function App() {
  const t = useT();
  const { openSheet, closeSheet, toast } = useUi();
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [tab, setTab] = useState<Tab>('discover');
  const [profileId, setProfileId] = useState<number | null>(null);
  // Bumped when the user or their tastes change so every screen reloads its data.
  const [generation, setGeneration] = useState(0);

  const refreshMe = useCallback(async () => {
    const next = await api<Me>('/me');
    setMe(next);
    return next;
  }, []);

  const tastesSaved = useCallback(async () => {
    await refreshMe();
    setGeneration((g) => g + 1);
  }, [refreshMe]);

  const editTastes = useCallback((current: Me, onboarding = false) => {
    openSheet(<TagPicker initial={current.tags} onboarding={onboarding} onSaved={tastesSaved} />, { dismissible: !onboarding });
  }, [openSheet, tastesSaved]);

  // After signing in: ask new listeners what they like before showing artists.
  const enter = useCallback((current: Me) => {
    setStatus('signed-in');
    setTab('discover');
    setProfileId(null);
    setGeneration((g) => g + 1);
    if (!current.tags.length) editTastes(current, true);
  }, [editTastes]);

  useEffect(() => {
    refreshMe().then(enter).catch((err) => {
      setStatus(err instanceof ApiError && err.status === 401 ? 'signed-out' : 'offline');
    });
  }, [refreshMe, enter]);

  const logOut = useCallback(async () => {
    await api('/auth/logout', 'POST').catch(() => {});
    closeSheet();
    setMe(null);
    setStatus('signed-out');
    toast(t('Signed out'));
  }, [closeSheet, toast, t]);

  const go = (next: Tab, userId: number | null = null) => {
    setTab(next);
    setProfileId(userId);
    window.scrollTo(0, 0);
  };

  // Tap the logo 5 times (or hold it) to open the hidden business menu.
  const secret = useSecretMenu(() => go('discover'));

  if (status === 'loading') {
    return <div className="splash" aria-busy="true"><Logo size={40} /></div>;
  }
  if (status === 'offline') {
    return (
      <div className="splash">
        <Logo size={40} />
        <p className="muted">{t('Can’t reach gem.fm right now.')}</p>
        <button className="btn" onClick={() => window.location.reload()}>{t('Try again')}</button>
      </div>
    );
  }
  if (status === 'signed-out' || !me) {
    return <Login onSignedIn={async () => enter(await refreshMe())} />;
  }

  const actions: AppActions = {
    me,
    refreshMe: async () => { await refreshMe(); },
    showProfile: (id) => go('profile', id),
    logOut,
    editTastes: () => editTastes(me),
  };

  return (
    <div className="app">
      <header className="top">
        <div className="row brand-row">
          <button className="brand-btn" aria-label={t('gem.fm home')} {...secret}><Logo size={24} /></button>
          {me.demo && <span className="demo-pill" title={t('Demo account, made for today’s demo.')}>{t('Demo')}</span>}
        </div>
        <div className="top-right">
          <span className="points" aria-label={t('Your points')}>{me.stats.points} pts</span>
          <button className="avatar-btn" aria-label={t('My profile')} onClick={() => go('profile', me.id)}>
            <Avatar name={me.name} color={me.color} />
          </button>
        </div>
      </header>

      <main className={`view ${tab === 'friends' ? 'view-feed' : ''}`} key={`${generation}-${tab}-${profileId ?? ''}`}>
        {tab === 'discover' && <Discover {...actions} />}
        {tab === 'live' && <Live {...actions} />}
        {tab === 'friends' && <Friends {...actions} />}
        {tab === 'profile' && <Profile {...actions} userId={profileId ?? me.id} />}
      </main>

      <nav className="tabs" aria-label={t('Main')}>
        {TABS.map((tb) => (
          <button key={tb.id} className={`tab ${tab === tb.id ? 'active' : ''}`} aria-current={tab === tb.id ? 'page' : undefined}
            onClick={() => go(tb.id)}>
            {t(tb.label)}
          </button>
        ))}
      </nav>
    </div>
  );
}
