// Lets a listener pick the styles they like. Shown on first sign-in and from the profile.
import { useState } from 'react';
import type { Tag, User } from '../../shared/types';
import { api } from '../api';
import { useT } from '../i18n';
import { useLoad } from '../lib/useLoad';
import { useUi } from '../ui';

interface Props {
  initial: string[];
  onboarding?: boolean;
  onSaved: (user: User) => void | Promise<void>;
}

export function TagPicker({ initial, onboarding = false, onSaved }: Props) {
  const t = useT();
  const { toast, closeSheet } = useUi();
  const { data: tags, error } = useLoad(() => api<Tag[]>('/tags'));
  const [picked, setPicked] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);

  const toggle = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  const save = async () => {
    setSaving(true);
    try {
      const user = await api<User>('/me/tags', 'PUT', { tags: picked });
      closeSheet();
      await onSaved(user);
      toast(onboarding ? t('Got it. Here are artists for you') : t('Tastes updated'));
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {onboarding && <p className="eyebrow">{t('Welcome')}</p>}
      <h2>{onboarding ? t('What do you like to listen to?') : t('Your tastes')}</h2>
      <p className="muted small m0">
        {t('Pick the styles you’re into. Discover shows you emerging artists from these first. You can change them anytime from your profile.')}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="tag-grid" role="group" aria-label={t('Music styles')}>
        {tags?.map((tag) => {
          const on = picked.includes(tag.slug);
          return (
            <button key={tag.slug} type="button" className={`tag-option ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(tag.slug)}>
              <span>{t(tag.label)}</span>
              <span className="small">{tag.artists ? t(tag.artists === 1 ? '{n} artist' : '{n} artists', { n: tag.artists }) : t('coming soon')}</span>
            </button>
          );
        })}
      </div>
      <button className="btn primary" disabled={!picked.length || saving} onClick={save}>
        {picked.length ? (saving ? t('Saving…') : onboarding ? t('Start discovering ({n})', { n: picked.length }) : t('Save')) : t('Pick at least one')}
      </button>
      {!onboarding && <button className="btn" onClick={closeSheet}>{t('Cancel')}</button>}
    </>
  );
}
