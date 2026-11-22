// App-wide UI helpers: toast messages and the bottom sheet.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface Ui {
  toast: (msg: string) => void;
  openSheet: (content: ReactNode) => void;
  closeSheet: () => void;
}

const UiContext = createContext<Ui | null>(null);

export function useUi() {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('useUi must be used inside <UiProvider>');
  return ui;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ReactNode>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2200);
  }, []);
  const openSheet = useCallback((content: ReactNode) => setSheet(content), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  return (
    <UiContext.Provider value={{ toast, openSheet, closeSheet }}>
      {children}
      {sheet && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && closeSheet()}>
          <div className="sheet-card" role="dialog" aria-modal="true">{sheet}</div>
        </div>
      )}
      {message && <div className="toast" role="status">{message}</div>}
    </UiContext.Provider>
  );
}

/** Sheets are rendered outside the screen that opened them; this lets them use the UI helpers too. */
export function SheetCloseButton({ children = 'Done', primary = false }: { children?: ReactNode; primary?: boolean }) {
  const { closeSheet } = useUi();
  return <button className={`btn ${primary ? 'primary' : ''}`} onClick={closeSheet}>{children}</button>;
}
