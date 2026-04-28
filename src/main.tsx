import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Service worker registration is now handled by the UpdateNotifier component in App.tsx


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

