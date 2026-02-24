import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
  } catch (error) {
    console.error('Falha ao renderizar a aplicação:', error);
    rootEl.innerHTML = '<div style="padding:2rem;text-align:center;font-family:sans-serif"><h1>Erro ao carregar</h1><p>Recarregue a página ou entre em contato com o suporte.</p></div>';
  }
}

