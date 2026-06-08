import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if ((import.meta as any).env.DEV) {
      // Unregister service workers during development to prevent stale caches producing blank pages
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().then((success) => {
            if (success) {
              console.log('Development: Unregistered stale service worker successfully.');
            }
          });
        }
      }).catch((err) => {
        console.warn('Development: Failed to unregister service workers:', err);
      });
    } else {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('FirstLook Service Worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.warn('FirstLook Service Worker registration failed:', err);
        });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
