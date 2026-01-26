/**
 * Componente para seleção de receptoras na transferência de embriões
 * Extraído de TransferenciaEmbrioes.tsx para melhor organização
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import { ReceptoraSincronizada } from '@/lib/types/transferenciaEmbrioes';

interface ReceptorasSelectionProps {
  receptoras: ReceptoraSincronizada[];
  selectedReceptoraId: string;
  contagemSessaoPorReceptora: Record<string, number>;
  submitting: boolean;
  onSelectReceptora: (receptoraId: string, protocoloReceptoraId: string) => void;
  onDescartarReceptora: () => void;
}

export default function ReceptorasSelection({
  receptoras,
  selectedReceptoraId,
  contagemSessaoPorReceptora,
  submitting,
  onSelectReceptora,
  onDescartarReceptora,
}: ReceptorasSelectionProps) {
  return (
    <div className="space-y-2">
      <Label>6. Selecionar Receptora *</Label>
      <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
        {receptoras.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma receptora sincronizada encontrada para esta fazenda.</p>
        ) : (
          <div className="space-y-2">
            {receptoras.map((r) => {
              const quantidadeSessao = contagemSessaoPorReceptora[r.receptora_id] || 0;
              const podeReceber = quantidadeSessao < 2;
              const isSelected = selectedReceptoraId === r.receptora_id;

              return (
                <div
                  key={r.receptora_id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                    isSelected ? 'bg-green-100 border-green-500 border' : podeReceber ? 'hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (podeReceber) {
                      onSelectReceptora(r.receptora_id, r.protocolo_receptora_id || '');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="receptora"
                      checked={isSelected}
                      onChange={() => {}}
                      disabled={!podeReceber}
                      className="w-4 h-4"
                    />
                    <span className="font-medium">{r.brinco}</span>
                    {r.origem === 'CIO_LIVRE' && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">CIO LIVRE</Badge>
                    )}
                    {r.ciclando_classificacao && <CiclandoBadge classificacao={r.ciclando_classificacao} />}
                    {r.qualidade_semaforo && <QualidadeSemaforo qualidade={r.qualidade_semaforo} />}
                  </div>
                  <div className="flex items-center gap-2">
                    {quantidadeSessao > 0 && (
                      <Badge variant="secondary">{quantidadeSessao}/2 embriões</Badge>
                    )}
                    {isSelected && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDescartarReceptora();
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={submitting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
