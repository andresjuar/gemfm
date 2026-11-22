// Sign in / create account. Music-service sign-ins are shown as "coming soon".
import { useState, type FormEvent, type ReactNode } from 'react';
import type { User } from '../../shared/types';
import { api } from '../api';
import { Logo } from '../components/Logo';
import { useSecretMenu } from '../components/SecretMenu';

type Mode = 'login' | 'signup';

export function Login({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [f, setF] = useState({ name: '', handle: '', email: '', login: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const secret = useSecretMenu();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = mode === 'login'
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
  const switchTo = (m: Mode) => { setMode(m); setError(null); setF((x) => ({ ...x, password: '' })); };

  return (
    <div className="auth">
      <div className="auth-hero">
        <button type="button" className="brand-btn" aria-label="gem.fm" {...secret}><Logo size={44} /></button>
        <p className="auth-tagline">From first listen to front row.</p>
      </div>

      <div className="seg" role="tablist" aria-label="Account">
        <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchTo('login')}>Sign in</button>
        <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchTo('signup')}>Create account</button>
      </div>

      <form className="stack" onSubmit={submit} noValidate>
        {mode === 'signup' ? (
          <>
            <Field id="su-name" label="Name"><input id="su-name" autoComplete="name" value={f.name} onChange={set('name')} required /></Field>
            <Field id="su-handle" label="Username">
              <div className="input-prefix"><span aria-hidden="true">@</span>
                <input id="su-handle" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="yourname"
                  value={f.handle} onChange={set('handle')} required />
              </div>
            </Field>
            <Field id="su-email" label="Email"><input id="su-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></Field>
            <Field id="su-pass" label="Password" hint="At least 8 characters.">
              <input id="su-pass" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={8} />
            </Field>
          </>
        ) : (
          <>
            <Field id="li-login" label="Email or username">
              <input id="li-login" autoComplete="username" autoCapitalize="none" spellCheck={false} value={f.login} onChange={set('login')} required />
            </Field>
            <Field id="li-pass" label="Password">
              <input id="li-pass" type="password" autoComplete="current-password" value={f.password} onChange={set('password')} required />
            </Field>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary big" disabled={busy}>
          {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="divider"><span>or</span></div>

      <div className="stack">
        <SoonButton label="Continue with Spotify" icon={<SpotifyIcon />} />
        <SoonButton label="Continue with Apple Music" icon={<NoteIcon />} />
        <SoonButton label="Continue with Deezer" icon={<BarsIcon />} />
      </div>

      <p className="small muted center m0">
        {mode === 'login'
          ? <>New here? <button className="linkish accent" onClick={() => switchTo('signup')}>Create an account</button></>
          : <>Already have an account? <button className="linkish accent" onClick={() => switchTo('login')}>Sign in</button></>}
      </p>
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
  return (
    <button type="button" className="btn social" disabled aria-label={`${label} (coming soon)`}>
      <span className="social-icon" aria-hidden="true">{icon}</span>
      <span className="grow">{label}</span>
      <span className="soon">Soon</span>
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
