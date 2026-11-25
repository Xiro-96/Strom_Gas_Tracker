import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { App } from '@/app/App';
import { applyLaunchAction } from '@/app/launch';

applyLaunchAction(window);

const container = document.getElementById('root');
if (!container) throw new Error('Root-Element #root fehlt');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
