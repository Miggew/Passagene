/**
 * P├ígina de Protocolos de Sincroniza├º├úo
 *
 * Estrutura:
 * - Sub-abas:
 *   - "1┬║ Passo" - Criar novo protocolo -> ProtocoloPasso1
 *   - "2┬║ Passo" - Continuar protocolo pendente -> ProtocoloPasso2
 *
 * O hist├│rico de protocolos est├í dispon├¡vel em /relatorios/servicos
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import {
  Syringe,
  ClipboardCheck,
} from 'lucide-react';

// Components
import { ProtocoloPasso1 } from '@/components/protocolos/ProtocoloPasso1';
import { ProtocoloPasso2 } from '@/components/protocolos/ProtocoloPasso2';

import { useProtocolosData } from '@/hooks/protocolos';

export default function Protocolos() {
  const [activeSubTab, setActiveSubTab] = useState<'passo1' | 'passo2'>('passo1');

  // ========== DADOS DE PROTOCOLOS ==========
  const {
    loading: loadingHistorico,
    loadData: loadDataHistorico,
    loadProtocolos,
  } = useProtocolosData();

  // ========== DADOS PARA PASSO 2 (Lista) ==========
  const [protocolosPasso2Lista, setProtocolosPasso2Lista] = useState<Array<{
    id: string;
    fazenda_id: string;
    fazenda_nome: string;
    data_inicio: string;
    receptoras_count: number;
  }>>([]);
  const [loadingProtocolosPasso2, setLoadingProtocolosPasso2] = useState(false);

  // ========== CARREGAR PROTOCOLOS PASSO 2 ==========
  const loadProtocolosPasso2Lista = useCallback(async () => {
    try {
      setLoadingProtocolosPasso2(true);

      // Buscar todos os protocolos com status PASSO1_FECHADO (independente de outros filtros)
      const { data: protocolosData, error } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, fazenda_id, data_inicio, status')
        .eq('status', 'PASSO1_FECHADO')
        .order('data_inicio', { ascending: false });

      if (error) throw error;

      if (!protocolosData || protocolosData.length === 0) {
        setProtocolosPasso2Lista([]);
        return;
      }

      // Buscar contagem de receptoras e nomes das fazendas
      const protocoloIds = protocolosData.map(p => p.id);
      const fazendaIds = [...new Set(protocolosData.map(p => p.fazenda_id))];

      const [receptorasResult, fazendasResult] = await Promise.all([
        supabase
          .from('protocolo_receptoras')
          .select('protocolo_id')
          .in('protocolo_id', protocoloIds),
        supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', fazendaIds),
      ]);

      // Criar mapa de contagem por protocolo
      const contagemMap: Record<string, number> = {};
      (receptorasResult.data || []).forEach(pr => {
        contagemMap[pr.protocolo_id] = (contagemMap[pr.protocolo_id] || 0) + 1;
      });

      // Criar mapa de nomes de fazenda
      const fazendaMap: Record<string, string> = {};
      (fazendasResult.data || []).forEach(f => {
        fazendaMap[f.id] = f.nome;
      });

      // Filtrar protocolos sem receptoras (zumbis) e montar lista
      const listaFinal = protocolosData
        .filter(p => (contagemMap[p.id] || 0) > 0)
        .map(p => ({
          id: p.id,
          fazenda_id: p.fazenda_id,
          fazenda_nome: fazendaMap[p.fazenda_id] || 'N/A',
          data_inicio: p.data_inicio,
          receptoras_count: contagemMap[p.id] || 0,
        }));

      setProtocolosPasso2Lista(listaFinal);
    } catch (error) {
      console.error('Erro ao carregar protocolos passo 2:', error);
      setProtocolosPasso2Lista([]);
    } finally {
      setLoadingProtocolosPasso2(false);
    }
  }, []);

  // ========== EFFECTS ==========
  useEffect(() => {
    loadDataHistorico();
    loadProtocolosPasso2Lista();
  }, [loadDataHistorico, loadProtocolosPasso2Lista]);

  // ========== RENDER ==========
  if (loadingHistorico) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Protocolos de Sincroniza├º├úo"
        description="Gerenciar protocolos em 2 passos"
      />

      {/* ==================== SESS├âO DE PROTOCOLOS ==================== */}
      <div className="mt-4">
        <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'passo1' | 'passo2')} className="w-full">
          {/* Premium Tabs */}
          <div className="rounded-xl border border-border glass-panel p-1.5 mb-4">
            <div className="flex gap-1">
              {[
                { value: 'passo1', label: '1┬║ Passo', icon: Syringe, count: 0 },
                { value: 'passo2', label: '2┬║ Passo', icon: ClipboardCheck, count: protocolosPasso2Lista.length },
              ].map(({ value, label, icon: Icon, count }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveSubTab(value as 'passo1' | 'passo2')}
                  className={`
                      relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                      text-sm font-medium transition-all duration-200
                      ${activeSubTab === value
                      ? 'bg-muted/80 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }
                    `}
                >
                  {activeSubTab === value && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
                  )}
                  <div className={`
                      flex items-center justify-center w-7 h-7 rounded-md transition-colors
                      ${activeSubTab === value ? 'bg-primary/15' : 'bg-muted/50'}
                    `}>
                    <Icon className={`w-4 h-4 ${activeSubTab === value ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <span>{label}</span>
                  {count > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold rounded-full ${activeSubTab === value
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ========== SUB-ABA 1┬║ PASSO ========== */}
          <TabsContent value="passo1">
            <ProtocoloPasso1
              onSuccess={() => {
                loadProtocolos(1);
                loadProtocolosPasso2Lista();
              }}
            />
          </TabsContent>

          {/* ========== SUB-ABA 2┬║ PASSO ========== */}
          <TabsContent value="passo2">
            <ProtocoloPasso2
              onSuccess={() => {
                loadProtocolos(1);
                loadProtocolosPasso2Lista();
              }}
              protocolosPasso2Lista={protocolosPasso2Lista}
              loadingProtocolosPasso2={loadingProtocolosPasso2}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
