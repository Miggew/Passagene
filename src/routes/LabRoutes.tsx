import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy loading das páginas do Laboratório
const Aspiracoes = lazy(() => import('../pages/Aspiracoes'));
const PacoteAspiracaoDetail = lazy(() => import('../pages/PacoteAspiracaoDetail'));
const LotesFIV = lazy(() => import('../pages/LotesFIV'));
const Embrioes = lazy(() => import('../pages/Embrioes'));
const EmbrioesCongelados = lazy(() => import('../pages/EmbrioesCongelados'));
const EmbryoScore = lazy(() => import('../pages/EmbryoScore'));
const Sexagem = lazy(() => import('../pages/Sexagem'));
const SexagemSessaoDetail = lazy(() => import('../pages/SexagemSessaoDetail'));

export default function LabRoutes() {
  return (
    <Routes>
      <Route path="aspiracoes" element={<Aspiracoes />} />
      <Route path="aspiracoes/:id" element={<PacoteAspiracaoDetail />} />
      <Route path="lotes-fiv" element={<LotesFIV />} />
      <Route path="lotes-fiv/:id" element={<LotesFIV />} />
      <Route path="embrioes" element={<Embrioes />} />
      <Route path="embrioes-congelados" element={<EmbrioesCongelados />} />
      <Route path="embryoscore" element={<EmbryoScore />} />
      <Route path="sexagem" element={<Sexagem />} />
      <Route path="sexagem/sessao" element={<SexagemSessaoDetail />} />
    </Routes>
  );
}
