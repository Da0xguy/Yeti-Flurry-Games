import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { dAppKit } from './dapp-kit';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <DAppKitProvider dAppKit={dAppKit}>
    <App />
  </DAppKitProvider>
);
