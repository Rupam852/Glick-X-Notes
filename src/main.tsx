import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';

// If on Vercel redirect page, don't mount the app
if (!(window as unknown as { __IS_VERCEL_REDIRECT__?: boolean }).__IS_VERCEL_REDIRECT__) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
