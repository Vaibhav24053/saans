import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SaansProvider } from './context/SaansContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SaansProvider>
      <App />
    </SaansProvider>
  </StrictMode>,
);
