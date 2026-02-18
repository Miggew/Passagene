import PageHeader from '@/components/shared/PageHeader';
import { DiagnosticoSessao } from '@/components/diagnostico/DiagnosticoSessao';

export default function DiagnosticoGestacao() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnóstico de Gestação (DG)"
        description="Registrar diagnósticos de gestação por lote de TE"
      />

      <DiagnosticoSessao />
    </div>
  );
}
