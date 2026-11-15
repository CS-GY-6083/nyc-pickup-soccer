import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './auth/AuthContext.jsx';
import App from './App.jsx';
// Fonts are bundled with the app (no CDN). Schibsted Grotesk for signs and
// headings, Public Sans for running text (both OFL).
import '@fontsource-variable/public-sans/wght.css';
import '@fontsource-variable/schibsted-grotesk/wght.css';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
