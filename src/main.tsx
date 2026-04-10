import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const CHECK_INTERVAL = 1000 * 60 * 5; // Check every 5 minutes

async function checkForUpdates() {
  try {
    const response = await fetch('/version.json?t=' + Date.now(), { 
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    const data = await response.json();
    const serverVersion = data.timestamp;
    const localVersion = localStorage.getItem('app_version');

    if (!localVersion) {
      localStorage.setItem('app_version', serverVersion.toString());
      return;
    }

    if (localVersion !== serverVersion.toString()) {
      console.log('Update detected!');
      localStorage.setItem('app_version', serverVersion.toString());
      
      // Update service worker if exists
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }
      
      // Dispatch custom event for UI to show notification
      window.dispatchEvent(new CustomEvent('app-update-found'));
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('SW Registered');
        
        // Check for updates periodically
        setInterval(() => {
          reg.update();
          checkForUpdates();
        }, CHECK_INTERVAL);

        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New SW update found!');
                window.dispatchEvent(new CustomEvent('app-update-found'));
              }
            };
          }
        };
      })
      .catch(err => console.log('SW Registration Failed', err));
  });

  // Check for updates when the page is focused/visited
  window.addEventListener('focus', () => {
    checkForUpdates();
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update();
    });
  });
}

// Initial check
checkForUpdates();
