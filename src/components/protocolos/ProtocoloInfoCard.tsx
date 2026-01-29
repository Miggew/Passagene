/**
 * Card de informações do protocolo (usado em ambos os passos)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

interface ProtocoloInfoCardProps {
  fazendaNome: string;
  dataInicio: string;
  veterinario?: string;
  tecnico?: string;
  passo2Data?: string;
  passo2Tecnico?: string;
  showPasso2?: boolean;
}

export function ProtocoloInfoCard({
  fazendaNome,
  dataInicio,
  veterinario,
  tecnico,
  passo2Data,
  passo2Tecnico,
  showPasso2 = false,
}: ProtocoloInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Informações do Protocolo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoItem label="Fazenda" value={fazendaNome} />
          <InfoItem label="Data Início" value={formatDate(dataInicio)} />
          {veterinario && <InfoItem label="Veterinário" value={veterinario} />}
          {tecnico && <InfoItem label="Técnico" value={tecnico} />}
          {showPasso2 && (
            <>
              <InfoItem
                label="Data 2º Passo"
                value={passo2Data ? formatDate(passo2Data) : '-'}
              />
              <InfoItem
                label="Técnico 2º Passo"
                value={passo2Tecnico || '-'}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface InfoItemProps {
  label: string;
  value: string;
}

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-base text-foreground">{value}</p>
    </div>
  );
}
