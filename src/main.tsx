import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AuthProvider} from './auth/AuthContext';
import './index.css';
import { registerServiceWorker } from './pwa';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);

// Appena l'app è dipinta si chiude la schermata di avvio (vedi index.html)
requestAnimationFrame(() => requestAnimationFrame(() => (window as unknown as { __hideSplash?: () => void }).__hideSplash?.()));
