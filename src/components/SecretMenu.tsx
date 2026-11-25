// Hidden "gem.fm for business" menu: tap the logo 5 times quickly, or press and
// hold it. It links to the artist and venue landings and the admin page, which
// aren't linked anywhere else in the app.
import { useRef, type PointerEvent } from 'react';
import { SheetCloseButton, useUi } from '../ui';
import { GemMark } from './Logo';
import { useT } from '../i18n';

const TAPS = 5;
const TAP_WINDOW_MS = 2500;
const HOLD_MS = 700;

export function useSecretMenu(onSingleTap?: () => void) {
  const { openSheet } = useUi();
  const taps = useRef<number[]>([]);
  const hold = useRef<number | undefined>(undefined);
  const held = useRef(false);

  const open = () => openSheet(<BusinessMenu />);

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      held.current = false;
      hold.current = window.setTimeout(() => { held.current = true; open(); }, HOLD_MS);
    },
    onPointerUp: () => window.clearTimeout(hold.current),
    onPointerLeave: () => window.clearTimeout(hold.current),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onClick: () => {
      if (held.current) { held.current = false; return; }
      const now = Date.now();
      taps.current = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now];
      if (taps.current.length >= TAPS) {
        taps.current = [];
        open();
      } else {
        onSingleTap?.();
      }
    },
  };
}

function BusinessMenu() {
  const t = useT();
  return (
    <>
      <div className="row"><GemMark size={36} /><p className="eyebrow m0">{t('gem.fm for business')}</p></div>
      <h2>{t('Behind the scenes')}</h2>
      <nav className="stack" aria-label={t('Business pages')}>
        <a className="biz-link" href="/artist">
          <b>{t('For artists')}</b><span className="small muted">{t('Promotion landing and application form')}</span>
        </a>
        <a className="biz-link" href="/venues">
          <b>{t('For venues')}</b><span className="small muted">{t('Sign up a venue for the Live tab')}</span>
        </a>
        <a className="biz-link" href="/admin">
          <b>Admin</b><span className="small muted">{t('Artists, radar, gigs, venues and applications')}</span>
        </a>
      </nav>
      <SheetCloseButton>{t('Close')}</SheetCloseButton>
    </>
  );
}
