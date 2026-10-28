import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './store/AppContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="Lodhi AI Startup Error">
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
