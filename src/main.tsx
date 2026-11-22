import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ArtistsPage } from './screens/ArtistsPage';
import { UiProvider } from './ui';
import './styles.css';

// Two pages: the listener app and the artist side (/artists).
const page = window.location.pathname.replace(/\/+$/, '') === '/artists' ? <ArtistsPage /> : <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProvider>{page}</UiProvider>
  </StrictMode>,
);
