// Building blocks shared by the /artist and /venues landing pages.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Artist } from '../../shared/types';
import { api } from '../api';
import { GemMark, Logo } from '../components/Logo';

export function LandingNav({ active }: { active: 'artist' | 'venues' }) {
  return (
    <header className="lp-nav">
      <a href="/" className="lp-brand" aria-label="gem.fm home"><Logo size={24} /></a>
      <nav className="lp-links" aria-label="For business">
        <a href="/artist" aria-current={active === 'artist' ? 'page' : undefined}>For artists</a>
        <a href="/venues" aria-current={active === 'venues' ? 'page' : undefined}>For venues</a>
      </nav>
      <a href="#apply" className="btn primary small">{active === 'artist' ? 'Apply' : 'List your venue'}</a>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-brand">
        <GemMark size={28} />
        <span>From first listen to front row.</span>
      </div>
      <nav className="lp-footer-links" aria-label="Footer">
        <a href="/">Open the app</a>
        <a href="/artist">For artists</a>
        <a href="/venues">For venues</a>
      </nav>
      <p className="small muted m0">gem.fm · Innovation project · Guadalajara, 2026</p>
    </footer>
  );
}

export function Section({ id, eyebrow, title, intro, children, tone }: {
  id?: string; eyebrow: string; title: ReactNode; intro?: ReactNode; children: ReactNode; tone?: 'raised';
}) {
  return (
    <section id={id} className={`lp-section ${tone === 'raised' ? 'raised' : ''}`}>
      <div className="lp-wrap">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="lp-h2">{title}</h2>
        {intro && <p className="lp-intro">{intro}</p>}
        {children}
      </div>
    </section>
  );
}

export function Steps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <ol className="lp-steps">
      {steps.map((s, i) => (
        <li key={s.title} className={i === steps.length - 1 ? 'dark' : ''}>
          <span className="lp-step-n">{String(i + 1).padStart(2, '0')}</span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="lp-faq">
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** A few real artists with photos, for the phone mock-ups. */
export function useShowcaseArtists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  useEffect(() => {
    api<Artist[]>('/artists').then((list) => setArtists(list.filter((a) => a.image_url).slice(0, 6))).catch(() => {});
  }, []);
  return artists;
}

export function Phone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="lp-phone" role="img" aria-label={label}>
      <div className="lp-phone-notch" aria-hidden="true" />
      <div className="lp-phone-screen" aria-hidden="true">{children}</div>
    </div>
  );
}

// ---------- Application form ----------
export type FieldDef =
  | { name: string; label: string; type?: 'text' | 'email' | 'url' | 'tel'; placeholder?: string; required?: boolean; half?: boolean; autoComplete?: string }
  | { name: string; label: string; type: 'select'; options: string[]; half?: boolean }
  | { name: string; label: string; type: 'textarea'; placeholder?: string }
  | { name: string; label: string; type: 'checks'; options: string[] };

export function ApplyForm({ kind, fields, submitLabel, done }: {
  kind: 'artist' | 'venue'; fields: FieldDef[]; submitLabel: string; done: { title: string; text: string };
}) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (name: string, value: string | string[]) => setValues((v) => ({ ...v, [name]: value }));
  const toggle = (name: string, option: string) => {
    const list = (values[name] as string[] | undefined) ?? [];
    set(name, list.includes(option) ? list.filter((o) => o !== option) : [...list, option]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/applications', 'POST', { kind, ...values });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="lp-form lp-sent" role="status">
        <GemMark size={56} />
        <h3>{done.title}</h3>
        <p>{done.text}</p>
        <a className="btn" href="/">Open the app</a>
      </div>
    );
  }

  return (
    <form className="lp-form" onSubmit={submit} noValidate>
      <div className="lp-fields">
        {fields.map((f) => {
          const id = `f-${kind}-${f.name}`;
          if (f.type === 'checks') {
            return (
              <fieldset key={f.name} className="lp-field full">
                <legend>{f.label}</legend>
                <div className="lp-checks">
                  {f.options.map((o) => {
                    const on = ((values[f.name] as string[] | undefined) ?? []).includes(o);
                    return (
                      <label key={o} className={`lp-check ${on ? 'on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(f.name, o)} />
                        {o}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          }
          const half = 'half' in f && f.half;
          return (
            <div key={f.name} className={`lp-field ${half ? '' : 'full'}`}>
              <label htmlFor={id}>{f.label}{'required' in f && f.required ? <span aria-hidden="true"> *</span> : null}</label>
              {f.type === 'textarea' ? (
                <textarea id={id} rows={4} placeholder={f.placeholder} value={(values[f.name] as string) ?? ''}
                  onChange={(e) => set(f.name, e.target.value)} maxLength={600} />
              ) : f.type === 'select' ? (
                <select id={id} value={(values[f.name] as string) ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">Choose…</option>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input id={id} type={f.type ?? 'text'} placeholder={f.placeholder} required={f.required} autoComplete={f.autoComplete}
                  value={(values[f.name] as string) ?? ''} onChange={(e) => set(f.name, e.target.value)} maxLength={300} />
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary big" disabled={busy}>{busy ? 'Sending…' : submitLabel}</button>
      <p className="small muted m0">We’ll only use this to get in touch about gem.fm.</p>
    </form>
  );
}
