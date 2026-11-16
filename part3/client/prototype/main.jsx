// Clickable prototype of the v2 "Matchday Line" redesign. Same styles as the
// app (fonts and src/index.css imported exactly as src/main.jsx does), hash
// routes, and data from a snapshot of the dev API (prototype/data).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/public-sans/wght.css';
import '@fontsource-variable/schibsted-grotesk/wght.css';
import '../src/index.css';
import App from './shell.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
