import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import { reportWebVitals } from './utils/webVitals';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Capture Core Web Vitals (LCP, FID, CLS, TTFB, FCP)
// Logs to console in dev; wire to analytics API in production.
reportWebVitals();