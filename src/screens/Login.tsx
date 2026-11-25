// Sign in. On demo day the app opens with a username-only sign-in (no email or
// password) so an audience can try it fast; the classic email + password form
// is one tap away. Music-service sign-ins are shown as "coming soon".
import { useState, type FormEvent, type ReactNode } from 'react';
import type { User } from '../../shared/types';
import { api } from '../api';
import { Logo } from '../components/Logo';
import { useSecretMenu } from '../components/SecretMenu';
import { useT } from '../i18n';
import { useLoad } from '../lib/useLoad';

type Mode = 'demo' | 'login' | 'signup';

export function Login({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const t = useT();
  const { data: mode_, error: modeError } = useLoad(() => api<{ demo: boolean }>('/auth/mode'));
  // An older API without /auth/mode means no demo sign-in.
  const auth = mode_ ?? (modeError ? { demo: false } : undefined);
  const [picked, setPicked] = useState<Mode | null>(null);
  const mode: Mode = picked ?? (auth?.demo === false ? 'login' : 'demo');
  const [f, setF] = useState({ name: '', handle: '', email: '', login: '', password: '', username: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const secret = useSecretMenu();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = mode === 'demo'
        ? await api<User>('/auth/demo', 'POST', { username: f.username })
        : mode === 'login'
          ? await api<User>('/auth/login', 'POST', { login: f.login, password: f.password })
          : await api<User>('/auth/signup', 'POST', { name: f.name, handle: f.handle, email: f.email, password: f.password });
      onSignedIn(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Never carry a typed password from one form to the other.
  const switchTo = (m: Mode) => { setPicked(m); setError(null); setF((x) => ({ ...x, password: '' })); };

  const hero = (
    <div className="auth-hero">
      <button type="button" className="brand-btn" aria-label="gem.fm" {...secret}><Logo size={44} /></button>
      <p className="auth-tagline">{t('From first listen to front row.')}</p>
    </div>
  );

  if (!auth) return <div className="auth">{hero}</div>;

  if (mode === 'demo') {
    return (
      <div className="auth">
        {hero}
        <div className="demo-note" role="note">
          <span className="demo-pill">{t('Demo')}</span>
          <p className="m0"><b>{t('Demo day: just pick a username.')}</b></p>
          <p className="small m0">{t('No email or password, only for today’s demo. Demo accounts are temporary and anyone who types the same username gets into the same account.')}</p>
        </div>
        <form className="stack" onSubmit={submit} noValidate>
          <Field id="demo-user" label={t('Username')} hint={t('At least 3 letters or numbers.')}>
            <div className="input-prefix"><span aria-hidden="true">@</span>
              <input id="demo-user" autoComplete="nickname" autoCapitalize="none" spellCheck={false} placeholder={t('yourname')}
                value={f.username} onChange={set('username')} maxLength={30} required autoFocus />
            </div>
          </Field>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary big" disabled={busy || f.username.trim().length < 3}>
            {busy ? t('One moment…') : t('Try gem.fm')}
          </button>
        </form>
        <p className="small muted center m0">
          {t('Have a real account?')} <button className="linkish accent" onClick={() => switchTo('login')}>{t('Sign in with email')}</button>
        </p>
      </div>
    );
  }

  return (
    <div className="auth">
      {hero}

      <div className="seg" role="tablist" aria-label={t('Account')}>
        <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchTo('login')}>{t('Sign in')}</button>
        <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchTo('signup')}>{t('Create account')}</button>
      </div>

      <form className="stack" onSubmit={submit} noValidate>
        {mode === 'signup' ? (
          <>
            <Field id="su-name" label={t('Name')}><input id="su-name" autoComplete="name" value={f.name} onChange={set('name')} required /></Field>
            <Field id="su-handle" label={t('Username')}>
              <div className="input-prefix"><span aria-hidden="true">@</span>
                <input id="su-handle" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={t('yourname')}
                  value={f.handle} onChange={set('handle')} required />
              </div>
            </Field>
            <Field id="su-email" label={t('Email')}><input id="su-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></Field>
            <Field id="su-pass" label={t('Password')} hint={t('At least 8 characters.')}>
              <input id="su-pass" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={8} />
            </Field>
          </>
        ) : (
          <>
            <Field id="li-login" label={t('Email or username')}>
              <input id="li-login" autoComplete="username" autoCapitalize="none" spellCheck={false} value={f.login} onChange={set('login')} required />
            </Field>
            <Field id="li-pass" label={t('Password')}>
              <input id="li-pass" type="password" autoComplete="current-password" value={f.password} onChange={set('password')} required />
            </Field>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary big" disabled={busy}>
          {busy ? t('One moment…') : mode === 'login' ? t('Sign in') : t('Create account')}
        </button>
      </form>

      <div className="divider"><span>{t('or')}</span></div>

      <div className="stack">
        <SoonButton label={t('Continue with Spotify')} icon={<SpotifyIcon />} />
        <SoonButton label={t('Continue with Apple Music')} icon={<NoteIcon />} />
        <SoonButton label={t('Continue with Deezer')} icon={<BarsIcon />} />
      </div>

      <p className="small muted center m0">
        {mode === 'login'
          ? <>{t('New here?')} <button className="linkish accent" onClick={() => switchTo('signup')}>{t('Create an account')}</button></>
          : <>{t('Already have an account?')} <button className="linkish accent" onClick={() => switchTo('login')}>{t('Sign in')}</button></>}
      </p>
      {auth.demo && (
        <p className="small muted center m0">
          <button className="linkish accent" onClick={() => switchTo('demo')}>{t('Back to the demo sign-in')}</button>
        </p>
      )}
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="small muted">{hint}</span>}
    </div>
  );
}

function SoonButton({ label, icon }: { label: string; icon: ReactNode }) {
  const t = useT();
  return (
    <button type="button" className="btn social" disabled aria-label={`${label} (${t('coming soon')})`}>
      <span className="social-icon" aria-hidden="true">{icon}</span>
      <span className="grow">{label}</span>
      <span className="soon">{t('Soon')}</span>
    </button>
  );
}

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="11" fill="currentColor" />
    <path d="M6.5 9.2c3.8-1.1 7.8-.8 11 1M7 12.4c3.1-.9 6.3-.6 9 .9M7.6 15.4c2.4-.6 4.8-.4 6.9.7" stroke="var(--surface-2)" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
);
const NoteIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 18.5a2.5 2.5 0 1 1-1.5-2.3V5.5l11-2.2v12.2a2.5 2.5 0 1 1-1.5-2.3V7.1l-8 1.6z" fill="currentColor" /></svg>
);
const BarsIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <rect x="2" y="15" width="3.5" height="5" rx="1" /><rect x="7" y="11" width="3.5" height="9" rx="1" />
    <rect x="12" y="7" width="3.5" height="13" rx="1" /><rect x="17" y="3" width="3.5" height="17" rx="1" /></svg>
);
