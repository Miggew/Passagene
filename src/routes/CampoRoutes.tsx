import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

// Lazy loading das páginas do Campo
const Protocolos = lazy(() => import('../pages/Protocolos'));
const ProtocoloDetail = lazy(() => import('../pages/ProtocoloDetail'));
const ProtocoloRelatorioFechado = lazy(() => import('../pages/ProtocoloRelatorioFechado'));
const TransferenciaEmbrioes = lazy(() => import('../pages/TransferenciaEmbrioes'));
const TESessaoDetail = lazy(() => import('../pages/TESessaoDetail'));
const DiagnosticoGestacao = lazy(() => import('../pages/DiagnosticoGestacao'));
const DiagnosticoSessaoDetail = lazy(() => import('../pages/DiagnosticoSessaoDetail'));
const ReceptoraHistorico = lazy(() => import('../pages/ReceptoraHistorico'));

export default function CampoRoutes() {
  return (
    <Routes>
      <Route path="protocolos" element={<Protocolos />} />
      <Route path="protocolos/:id" element={<ProtocoloDetail />} />
      <Route path="protocolos/:id/relatorio" element={<ProtocoloRelatorioFechado />} />
      <Route path="protocolos/fechados/:id/relatorio" element={<ProtocoloRelatorioFechado />} />
      
      <Route path="transferencia" element={<TransferenciaEmbrioes />} />
      <Route path="transferencia/sessao" element={<TESessaoDetail />} />
      
      <Route path="dg" element={<DiagnosticoGestacao />} />
      <Route path="dg/sessao" element={<DiagnosticoSessaoDetail />} />
      
      <Route path="receptoras/:id/historico" element={<ReceptoraHistorico />} />
    </Routes>
  );
}
