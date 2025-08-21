import React from 'react';
import ReactDOM from 'react-dom/client';
import AppWithWebGPU from './AppWithWebGPU';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithWebGPU />
  </React.StrictMode>,
);