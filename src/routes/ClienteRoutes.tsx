import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy loading do Hub Cliente
const ClienteRebanho = lazy(() => import('../pages/cliente/ClienteRebanho'));
const ClienteRelatorios = lazy(() => import('../pages/cliente/ClienteRelatorios'));
const ClienteBotijao = lazy(() => import('../pages/cliente/ClienteBotijao'));
const ClienteConfiguracoes = lazy(() => import('../pages/cliente/ClienteConfiguracoes'));

// Hub Genética (Vitrine)
const GeneticaHome = lazy(() => import('../pages/genetica/GeneticaHome'));
const GeneticaDoadoras = lazy(() => import('../pages/genetica/GeneticaDoadoras'));
const GeneticaDoadoraDetail = lazy(() => import('../pages/genetica/GeneticaDoadoraDetail'));
const GeneticaTouros = lazy(() => import('../pages/genetica/GeneticaTouros'));
const GeneticaTouroDetail = lazy(() => import('../pages/genetica/GeneticaTouroDetail'));

export default function ClienteRoutes() {
  return (
    <Routes>
      <Route path="rebanho" element={<ClienteRebanho />} />
      <Route path="relatorios" element={<ClienteRelatorios />} />
      <Route path="botijao" element={<ClienteBotijao />} />
      <Route path="configuracoes" element={<ClienteConfiguracoes />} />
      
      {/* Vitrine Genética */}
      <Route path="genetica" element={<GeneticaHome />} />
      <Route path="genetica/doadoras" element={<GeneticaDoadoras />} />
      <Route path="genetica/doadoras/:id" element={<GeneticaDoadoraDetail />} />
      <Route path="genetica/touros" element={<GeneticaTouros />} />
      <Route path="genetica/touros/:id" element={<GeneticaTouroDetail />} />
    </Routes>
  );
}
