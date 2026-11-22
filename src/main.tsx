import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ArtistLanding } from './landing/ArtistLanding';
import { VenueLanding } from './landing/VenueLanding';
import { AdminPage } from './screens/AdminPage';
import { UiProvider } from './ui';
import './styles.css';
import './landing/landing.css';

// Pages: the listener app (/), admin (/admin) and the two business landings
// (/artist, /venues). The landings are linked only from the hidden menu.
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const pages: Record<string, () => ReactElement> = {
  '/admin': () => <AdminPage />,
  '/artist': () => <ArtistLanding />,
  '/venues': () => <VenueLanding />,
};
const page = (pages[path] ?? (() => <App />))();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProvider>{page}</UiProvider>
  </StrictMode>,
);
