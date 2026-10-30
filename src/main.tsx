import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AuthProvider} from './auth/AuthContext';
import './index.css';
import { registerServiceWorker } from './pwa';

registerServiceWorker();

// Aperto dall'icona "Wallet Seul" (?app=wallet): nome e manifest propri, così "Aggiungi a Home" crea un'icona dedicata
try {
  if (new URLSearchParams(window.location.search).get('app') === 'wallet') {
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute('href', './manifest-wallet.webmanifest');
    document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'Wallet Seul');
    document.title = 'Wallet Seul 2027';
  }
} catch {
  /* non essenziale */
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);

// Appena l'app è dipinta si chiude la schermata di avvio (vedi index.html)
requestAnimationFrame(() => requestAnimationFrame(() => (window as unknown as { __hideSplash?: () => void }).__hideSplash?.()));
