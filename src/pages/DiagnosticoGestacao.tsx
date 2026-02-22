import PageHeader from '@/components/shared/PageHeader';
import { DiagnosticoSessao } from '@/components/diagnostico/DiagnosticoSessao';

export default function DiagnosticoGestacao() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagn├│stico de Gesta├º├úo (DG)"
        description="Registrar diagn├│sticos de gesta├º├úo por lote de TE"
      />

      <DiagnosticoSessao />
    </div>
  );
}

