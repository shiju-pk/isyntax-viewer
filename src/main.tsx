import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './presentation/App';
import { loadConfig } from './core/config/ConfigProvider';
import './index.css';

// Load config.json before rendering so adapterType etc. are honoured
loadConfig().then((config) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App config={config} />
    </React.StrictMode>,
  );
});
