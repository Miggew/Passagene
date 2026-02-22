/**
 * Página "Meu Botijão" para clientes
 * Doses de sêmen agrupadas por touro + Embriões com tabs Doadora/Touro
 *
 * OTIMIZADO: Usa hook de cache compartilhado, queries em paralelo
 * REFATORADO: Sistema de badges e design premium do CLAUDE.md
 */

import { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/shared/PageHeader';
import LoadingScreen from '@/components/shared/LoadingScreen';
import EmptyState from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Snowflake, Search } from 'lucide-react';
import { SpermIcon } from '@/components/icons/SpermIcon';
import { DonorCowIcon } from '@/components/icons/DonorCowIcon';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TouroCard } from '@/components/cliente/TouroCard';
import { EmbrioCard } from '@/components/cliente/EmbrioCard';
import { useClienteHubData, useEmbrioesDetalhes } from '@/hooks/cliente';
import CountBadge from '@/components/shared/CountBadge';

interface Embriao {
  id: string;
  classificacao?: string;
  status_atual?: string;
  doadora_nome?: string;
  doadora_id?: string;
  touro_nome?: string;
  touro_id?: string;
}

interface EmbriaoAgrupado {
  id: string;
  nome: string;
  registro?: string;
  count: number;
}

export default function ClienteBotijao() {
  const { clienteId } = usePermissions();

  const [activeTab, setActiveTab] = useState('doses');
  const [embrioesSubTab, setEmbrioesSubTab] = useState<'doadora' | 'touro'>('doadora');
  const [searchTerm, setSearchTerm] = useState('');

  // Hook de cache compartilhado
  const { data: hubData, isLoading: hubLoading } = useClienteHubData(clienteId);

  // IDs de acasalamento para buscar detalhes dos embriões
  const acasalamentoIds = useMemo(() => {
    if (!hubData) return [];
    return [...new Set(
      hubData.embrioes
        .map(e => e.lote_fiv_acasalamento_id)
        .filter(Boolean) as string[]
    )];
  }, [hubData]);

  // Hook para detalhes dos embriões (doadora e touro)
  const { data: embrioesDetalhes } = useEmbrioesDetalhes(acasalamentoIds);

  // Embriões com detalhes de acasalamento
  const embrioes = useMemo((): Embriao[] => {
    if (!hubData) return [];

    return hubData.embrioes.map(e => {
      const acasId = e.lote_fiv_acasalamento_id;
      const doadoraInfo = acasId ? embrioesDetalhes?.doadoraMap.get(acasId) : undefined;
      const touroInfo = acasId ? embrioesDetalhes?.touroMap.get(acasId) : undefined;

      return {
        id: e.id,
        classificacao: e.classificacao,
        status_atual: e.status_atual,
        doadora_nome: doadoraInfo?.nome,
        doadora_id: doadoraInfo?.id,
        touro_nome: touroInfo?.nome,
        touro_id: touroInfo?.id,
      };
    });
  }, [hubData, embrioesDetalhes]);

  // Touros com doses (já vem do cache)
  const tourosDoses = hubData?.tourosDoses || [];
  const totalDoses = hubData?.totalDoses || 0;
  const totalEmbrioes = hubData?.totalEmbrioes || 0;

  // Filtrar touros por busca
  const filteredTouros = useMemo(() => {
    return tourosDoses.filter(t => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return t.nome?.toLowerCase().includes(search) ||
             t.registro?.toLowerCase().includes(search) ||
             t.raca?.toLowerCase().includes(search);
    });
  }, [tourosDoses, searchTerm]);

  // Agrupar embriões por doadora ou touro
  const embrioesAgrupados = useMemo((): EmbriaoAgrupado[] => {
    const map = new Map<string, { nome: string; count: number }>();

    embrioes.forEach(e => {
      const key = embrioesSubTab === 'doadora' ? e.doadora_id : e.touro_id;
      const nome = embrioesSubTab === 'doadora' ? e.doadora_nome : e.touro_nome;

      if (key && nome) {
        const current = map.get(key) || { nome, count: 0 };
        current.count++;
        map.set(key, current);
      }
    });

    const result: EmbriaoAgrupado[] = [];
    map.forEach((value, id) => {
      result.push({ id, nome: value.nome, count: value.count });
    });

    // Ordenar por quantidade (descendente)
    result.sort((a, b) => b.count - a.count);
    return result;
  }, [embrioes, embrioesSubTab]);

  // Filtrar embriões agrupados por busca
  const filteredEmbrioes = useMemo(() => {
    return embrioesAgrupados.filter(e => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return e.nome?.toLowerCase().includes(search);
    });
  }, [embrioesAgrupados, searchTerm]);

  if (hubLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-4 pb-20">
      <PageHeader title="Meu Botijão" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tabs premium com CountBadge */}
        <div className="rounded-xl border border-border/60 glass-panel p-1.5 shadow-sm">
          <TabsList className="grid grid-cols-2 h-auto p-0 bg-transparent gap-1.5">
            <TabsTrigger
              value="doses"
              className={cn(
                'relative h-12 gap-2 rounded-lg font-medium transition-all duration-200',
                'data-[state=active]:bg-muted/80 data-[state=active]:shadow-sm',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-colors border',
                activeTab === 'doses' ? 'bg-indigo-500/15 border-indigo-500/20' : 'bg-muted/50 border-transparent'
              )}>
                <SpermIcon className={cn('w-4 h-4', activeTab === 'doses' ? 'text-indigo-500' : 'text-muted-foreground')} />
              </div>
              <span className="hidden sm:inline">Doses</span>
              <CountBadge
                value={totalDoses}
                variant={activeTab === 'doses' ? 'violet' : 'default'}
              />
              {activeTab === 'doses' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="embrioes"
              className={cn(
                'relative h-12 gap-2 rounded-lg font-medium transition-all duration-200',
                'data-[state=active]:bg-muted/80 data-[state=active]:shadow-sm',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/40'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-colors border',
                activeTab === 'embrioes' ? 'bg-cyan-500/15 border-cyan-500/20' : 'bg-muted/50 border-transparent'
              )}>
                <Snowflake className={cn('w-4 h-4', activeTab === 'embrioes' ? 'text-cyan-500' : 'text-muted-foreground')} />
              </div>
              <span className="hidden sm:inline">Embriões</span>
              <CountBadge
                value={totalEmbrioes}
                variant={activeTab === 'embrioes' ? 'cyan' : 'default'}
              />
              {activeTab === 'embrioes' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-cyan-500 rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Busca premium com ícone destacado */}
        <div className="relative mt-4">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Search className="w-3.5 h-3.5 text-primary/70" />
          </div>
          <Input
            placeholder={activeTab === 'doses' ? 'Buscar touro...' : 'Buscar...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-11 text-base rounded-xl border-border/60 glass-panel shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
        </div>

        {/* Tab Doses */}
        <TabsContent value="doses" className="mt-4 space-y-2.5">
          {filteredTouros.length === 0 ? (
            <EmptyState
              title="Nenhuma dose"
              description={searchTerm ? 'Nenhum touro encontrado para a busca' : 'Você ainda não possui doses de sêmen'}
            />
          ) : (
            filteredTouros.map((touro) => (
              <TouroCard
                key={touro.id}
                data={touro}
              />
            ))
          )}
        </TabsContent>

        {/* Tab Embriões */}
        <TabsContent value="embrioes" className="mt-4 space-y-3">
          {/* Sub-tabs premium para agrupar - Refinado */}
          <div className="flex gap-1.5 p-1.5 bg-muted/40 rounded-xl border border-border/40">
            <button
              onClick={() => setEmbrioesSubTab('doadora')}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                embrioesSubTab === 'doadora'
                  ? 'glass-panel shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-md flex items-center justify-center border',
                embrioesSubTab === 'doadora' ? 'bg-amber-500/15 border-amber-500/20' : 'bg-muted/50 border-transparent'
              )}>
                <DonorCowIcon className={cn('w-3.5 h-3.5', embrioesSubTab === 'doadora' ? 'text-amber-500' : 'text-muted-foreground')} />
              </div>
              <span>Por Doadora</span>
              {embrioesSubTab === 'doadora' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setEmbrioesSubTab('touro')}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                embrioesSubTab === 'touro'
                  ? 'glass-panel shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-md flex items-center justify-center border',
                embrioesSubTab === 'touro' ? 'bg-indigo-500/15 border-indigo-500/20' : 'bg-muted/50 border-transparent'
              )}>
                <SpermIcon className={cn('w-3.5 h-3.5', embrioesSubTab === 'touro' ? 'text-indigo-500' : 'text-muted-foreground')} />
              </div>
              <span>Por Touro</span>
              {embrioesSubTab === 'touro' && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Lista */}
          {filteredEmbrioes.length === 0 ? (
            <EmptyState
              title="Nenhum embrião"
              description={searchTerm ? 'Nenhum resultado para a busca' : 'Você ainda não possui embriões congelados'}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredEmbrioes.map((item) => (
                <EmbrioCard
                  key={item.id}
                  data={item}
                  tipo={embrioesSubTab}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
