import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clean console filters to completely stop harmless warnings from triggering sandbox/iframe reloads
if (typeof window !== 'undefined') {
  const ignoredWarnings = [
    'width',
    'height',
    'ResponsiveContainer',
    'defaultProps',
    'ResizeObserver',
    'deprecated',
  ];

  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const firstArg = args[0];
    if (typeof firstArg === 'string' && ignoredWarnings.some(pattern => firstArg.includes(pattern))) {
      return;
    }
    originalWarn(...args);
  };

  const originalError = console.error;
  console.error = (...args: any[]) => {
    const firstArg = args[0];
    if (typeof firstArg === 'string' && ignoredWarnings.some(pattern => firstArg.includes(pattern))) {
      return;
    }
    originalError(...args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
