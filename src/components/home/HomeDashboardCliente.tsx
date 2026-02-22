/**
 * Dashboard do Cliente - Home
 * Receptoras + Próximos Serviços (semáforo) + Últimos Serviços (compacto)
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import LoadingScreen from '@/components/shared/LoadingScreen';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, addDays } from 'date-fns';
import {
  Beef, Syringe, Stethoscope, ScanSearch, TestTube,
  Baby, ChevronRight, Clock, CalendarCheck
} from 'lucide-react';
import { DG, SEXAGEM, PASSO2, TE as TE_RULES } from '@/lib/fivFlowRules';

// ============ TIPOS ============

interface Props {
  clienteId: string;
  clienteNome?: string;
}

interface ReceptorasData {
  total: number;
  prenhes: number;
  servidas: number;
  protocoladas: number;
  vazias: number;
}

interface UltimaTEData {
  totalSincronizadas: number;
  receberamEmbriao: number;
}

interface UltimoDGData {
  total: number;
  prenhes: number;
}

interface UltimaSexagemData {
  total: number;
  femeas: number;
  machos: number;
  perdas: number;
}

interface UltimaAspiracaoData {
  totalDoadoras: number;
  totalOocitos: number;
}

interface TEDetalhe {
  protocoloId: string;
  fazendaNome: string;
  data?: string;
  sincronizadas: number;
  servidas: number;
}

type SemaforoCor = 'blue' | 'green' | 'amber' | 'red';

interface ProximoServico {
  tipo: 'passo2' | 'te' | 'dg' | 'sexagem' | 'parto';
  label: string;
  total: number;
  prontas: number;
  diasMaisUrgente: number;
  corSemaforo: SemaforoCor;
  protocoloIds: string[];
}

// ============ CONSTANTES DE TIMING ============

/** Da data_te até o mínimo de DG: (DG.MIN_DIAS - TE.DIA_EMBRIAO) = 20 */
const DG_DIAS_APOS_TE = DG.MIN_DIAS - TE_RULES.DIA_EMBRIAO;
/** Da data_te até o mínimo de Sexagem: (SEXAGEM.MIN_DIAS - TE.DIA_EMBRIAO) = 47 */
const SEXAGEM_DIAS_APOS_TE = SEXAGEM.MIN_DIAS - TE_RULES.DIA_EMBRIAO;

function getSemaforo(dias: number, tipo: string): SemaforoCor {
  if (tipo === 'parto') {
    if (dias <= 0) return 'red';
    if (dias <= 3) return 'amber';
    return 'blue';
  }
  if (dias > 5) return 'blue';
  if (dias >= 0) return 'green';
  if (dias >= -5) return 'amber';
  return 'red';
}

const semaforoClasses: Record<SemaforoCor, { border: string; bg: string; text: string; dot: string; iconBg: string }> = {
  blue: { border: 'border-blue-500/40', bg: 'bg-blue-500/5', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', iconBg: 'bg-blue-500/15' },
  green: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', iconBg: 'bg-emerald-500/15' },
  amber: { border: 'border-amber-500/40', bg: 'bg-amber-500/5', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', iconBg: 'bg-amber-500/15' },
  red: { border: 'border-red-500/40', bg: 'bg-red-500/5', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500', iconBg: 'bg-red-500/15' },
};

const servicoConfig: Record<string, { icon: React.ElementType; label: string }> = {
  passo2: { icon: CalendarCheck, label: '2º Passo' },
  te: { icon: Syringe, label: 'TE' },
  dg: { icon: Stethoscope, label: 'DG' },
  sexagem: { icon: ScanSearch, label: 'Sexagem' },
  parto: { icon: Baby, label: 'Parto' },
};

// ============ COMPONENTE ============

export default function HomeDashboardCliente({ clienteId }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  const [receptoras, setReceptoras] = useState<ReceptorasData>({
    total: 0, prenhes: 0, servidas: 0, protocoladas: 0, vazias: 0,
  });
  const [ultimaTE, setUltimaTE] = useState<UltimaTEData>({ totalSincronizadas: 0, receberamEmbriao: 0 });
  const [ultimoDG, setUltimoDG] = useState<UltimoDGData>({ total: 0, prenhes: 0 });
  const [ultimaSexagem, setUltimaSexagem] = useState<UltimaSexagemData>({ total: 0, femeas: 0, machos: 0, perdas: 0 });
  const [ultimaAspiracao, setUltimaAspiracao] = useState<UltimaAspiracaoData>({ totalDoadoras: 0, totalOocitos: 0 });
  const [teDetalhes, setTeDetalhes] = useState<TEDetalhe[]>([]);
  const [proximosServicos, setProximosServicos] = useState<ProximoServico[]>([]);

  useEffect(() => {
    let stale = false;
    if (clienteId) loadData(() => stale);
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  // ===== LOAD DATA =====

  const loadData = async (isStale: () => boolean) => {
    try {
      setLoading(true);

      const { data: fazendas } = await supabase
        .from('fazendas')
        .select('id, nome')
        .eq('cliente_id', clienteId);

      if (isStale()) return;

      const fazendaIds = fazendas?.map(f => f.id) || [];
      const fazendaNomeMap = new Map<string, string>();
      fazendas?.forEach(f => fazendaNomeMap.set(f.id, f.nome));

      if (fazendaIds.length === 0) { setLoading(false); return; }

      const { data: receptorasView } = await supabase
        .from('receptoras')
        .select('id, fazenda_atual_id')
        .in('fazenda_atual_id', fazendaIds);

      if (isStale()) return;

      const receptoraIds = receptorasView?.map(r => r.id) || [];
      if (receptoraIds.length === 0) { setLoading(false); return; }

      const { data: receptorasData } = await supabase
        .from('receptoras')
        .select('id, status_reprodutivo, data_provavel_parto')
        .in('id', receptoraIds);

      if (isStale()) return;

      const totais: ReceptorasData = { total: 0, prenhes: 0, servidas: 0, protocoladas: 0, vazias: 0 };
      receptorasData?.forEach(r => {
        totais.total++;
        const status = r.status_reprodutivo || '';
        if (status.includes('PRENHE')) totais.prenhes++;
        else if (status === 'SERVIDA') totais.servidas++;
        else if (status === 'SINCRONIZADA' || status === 'EM_SINCRONIZACAO') totais.protocoladas++;
        else totais.vazias++;
      });
      setReceptoras(totais);

      const receptoraFazendaMap = new Map<string, string>();
      receptorasView?.forEach(r => {
        if (r.fazenda_atual_id) receptoraFazendaMap.set(r.id, r.fazenda_atual_id);
      });

      await Promise.all([
        loadUltimaTE(receptoraFazendaMap, fazendaNomeMap, isStale),
        loadUltimoDG(receptoraIds, receptoraFazendaMap, isStale),
        loadUltimaSexagem(receptoraIds, receptoraFazendaMap, isStale),
        loadUltimaAspiracao(fazendaIds, isStale),
        loadProximosServicos(receptorasData || [], isStale),
      ]);

    } catch (error) {
      if (isStale()) return;
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  // ===== PRÓXIMOS SERVIÇOS (semáforo) =====

  const loadProximosServicos = async (
    receptorasData: Array<{ id: string; status_reprodutivo: string | null; data_provavel_parto: string | null }>,
    isStale: () => boolean
  ) => {
    try {
      const hoje = new Date();
      const servicos: ProximoServico[] = [];

      const emSinc = receptorasData.filter(r => r.status_reprodutivo === 'EM_SINCRONIZACAO');
      const sincronizadas = receptorasData.filter(r => r.status_reprodutivo === 'SINCRONIZADA');
      const servidas = receptorasData.filter(r => r.status_reprodutivo === 'SERVIDA');
      const prenhesBase = receptorasData.filter(r =>
        r.status_reprodutivo === 'PRENHE' || r.status_reprodutivo === 'PRENHE_RETOQUE'
      );
      const prenhesComParto = receptorasData.filter(r =>
        r.status_reprodutivo?.includes('PRENHE') && r.data_provavel_parto
      );

      // Batch: TE dates para SERVIDA/PRENHE (timing DG/Sexagem)
      const needTE = [...servidas.map(r => r.id), ...prenhesBase.map(r => r.id)];
      const teDateMap = new Map<string, string>();
      if (needTE.length > 0) {
        const { data: tes } = await supabase
          .from('transferencias_embrioes')
          .select('receptora_id, data_te')
          .in('receptora_id', needTE)
          .order('data_te', { ascending: false });
        if (isStale()) return;
        tes?.forEach(te => {
          if (!teDateMap.has(te.receptora_id)) teDateMap.set(te.receptora_id, te.data_te);
        });
      }

      // Batch: Protocol dates para EM_SINCRONIZACAO/SINCRONIZADA (timing Passo2/TE)
      const needProt = [...emSinc.map(r => r.id), ...sincronizadas.map(r => r.id)];
      const protDateMap = new Map<string, { data_inicio: string; passo2_data?: string }>();
      // Mapa receptora → protocolo_id (para links de navegação)
      const receptoraProtMap = new Map<string, string>();
      if (needProt.length > 0) {
        const { data: links } = await supabase
          .from('protocolo_receptoras')
          .select('receptora_id, protocolo_id')
          .in('receptora_id', needProt);

        if (isStale()) return;

        if (links && links.length > 0) {
          const protIds = [...new Set(links.map(l => l.protocolo_id))];
          const { data: prots } = await supabase
            .from('protocolos_sincronizacao')
            .select('id, data_inicio, passo2_data')
            .in('id', protIds);

          if (isStale()) return;

          if (prots) {
            const pm = new Map(prots.map(p => [p.id, p]));
            links.forEach(l => {
              if (!protDateMap.has(l.receptora_id)) {
                const p = pm.get(l.protocolo_id);
                if (p) protDateMap.set(l.receptora_id, { data_inicio: p.data_inicio, passo2_data: p.passo2_data });
              }
              if (!receptoraProtMap.has(l.receptora_id)) {
                receptoraProtMap.set(l.receptora_id, l.protocolo_id);
              }
            });
          }
        }
      }

      // Batch: Protocol IDs para SERVIDA/PRENHE/PARTO (navegação para relatório de origem)
      const needProtIds = [...new Set([
        ...servidas.map(r => r.id),
        ...prenhesBase.map(r => r.id),
        ...prenhesComParto.map(r => r.id),
      ])];
      if (needProtIds.length > 0) {
        const { data: protLinks } = await supabase
          .from('protocolo_receptoras')
          .select('receptora_id, protocolo_id')
          .in('receptora_id', needProtIds)
          .eq('status', 'UTILIZADA');
        if (isStale()) return;
        protLinks?.forEach(l => {
          if (!receptoraProtMap.has(l.receptora_id)) {
            receptoraProtMap.set(l.receptora_id, l.protocolo_id);
          }
        });
      }

      // --- PASSO2: EM_SINCRONIZACAO → janela ideal passo1 + 8-10 dias ---
      if (emSinc.length > 0) {
        let minDias = Infinity;
        let prontas = 0;
        emSinc.forEach(r => {
          const info = protDateMap.get(r.id);
          if (info?.data_inicio) {
            const d = differenceInDays(addDays(new Date(info.data_inicio), PASSO2.IDEAL_MIN), hoje);
            minDias = Math.min(minDias, d);
            if (d <= 0) prontas++;
          }
        });
        if (minDias !== Infinity) {
          const pIds = [...new Set(emSinc.map(r => receptoraProtMap.get(r.id)).filter(Boolean))] as string[];
          servicos.push({
            tipo: 'passo2', label: '2º Passo', total: emSinc.length,
            prontas, diasMaisUrgente: minDias,
            corSemaforo: getSemaforo(minDias, 'protocolo'),
            protocoloIds: pIds,
          });
        }
      }

      // --- TE: SINCRONIZADA → ideal passo2 + 9 dias ---
      if (sincronizadas.length > 0) {
        let minDias = Infinity;
        let prontas = 0;
        sincronizadas.forEach(r => {
          const info = protDateMap.get(r.id);
          if (info?.passo2_data) {
            const d = differenceInDays(addDays(new Date(info.passo2_data), TE_RULES.DIAS_APOS_PASSO2), hoje);
            minDias = Math.min(minDias, d);
            if (d <= 0) prontas++;
          }
        });
        if (minDias !== Infinity) {
          const pIds = [...new Set(sincronizadas.map(r => receptoraProtMap.get(r.id)).filter(Boolean))] as string[];
          servicos.push({
            tipo: 'te', label: 'TE', total: sincronizadas.length,
            prontas, diasMaisUrgente: minDias,
            corSemaforo: getSemaforo(minDias, 'protocolo'),
            protocoloIds: pIds,
          });
        }
      }

      // --- DG: SERVIDA → mínimo D0+27 = data_te + 20 ---
      if (servidas.length > 0) {
        let minDias = Infinity;
        let prontas = 0;
        servidas.forEach(r => {
          const dataTE = teDateMap.get(r.id);
          if (dataTE) {
            const d = differenceInDays(addDays(new Date(dataTE), DG_DIAS_APOS_TE), hoje);
            minDias = Math.min(minDias, d);
            if (d <= 0) prontas++;
          }
        });
        const dgPIds = [...new Set(servidas.map(r => receptoraProtMap.get(r.id)).filter(Boolean))] as string[];
        servicos.push({
          tipo: 'dg', label: 'DG', total: servidas.length,
          prontas, diasMaisUrgente: minDias === Infinity ? 99 : minDias,
          corSemaforo: getSemaforo(minDias === Infinity ? 99 : minDias, 'dg'),
          protocoloIds: dgPIds,
        });
      }

      // --- SEXAGEM: PRENHE/PRENHE_RETOQUE → mínimo D0+54 = data_te + 47 ---
      if (prenhesBase.length > 0) {
        let minDias = Infinity;
        let prontas = 0;
        prenhesBase.forEach(r => {
          const dataTE = teDateMap.get(r.id);
          if (dataTE) {
            const d = differenceInDays(addDays(new Date(dataTE), SEXAGEM_DIAS_APOS_TE), hoje);
            minDias = Math.min(minDias, d);
            if (d <= 0) prontas++;
          }
        });
        const sexPIds = [...new Set(prenhesBase.map(r => receptoraProtMap.get(r.id)).filter(Boolean))] as string[];
        servicos.push({
          tipo: 'sexagem', label: 'Sexagem', total: prenhesBase.length,
          prontas, diasMaisUrgente: minDias === Infinity ? 99 : minDias,
          corSemaforo: getSemaforo(minDias === Infinity ? 99 : minDias, 'sexagem'),
          protocoloIds: sexPIds,
        });
      }

      // --- PARTO: prenhes com data_provavel_parto nos próximos 30 dias ---
      const partosProximos = prenhesComParto.filter(r => {
        const d = differenceInDays(new Date(r.data_provavel_parto!), hoje);
        return d <= 30;
      });
      if (partosProximos.length > 0) {
        let minDias = Infinity;
        let urgentes = 0;
        partosProximos.forEach(r => {
          const d = differenceInDays(new Date(r.data_provavel_parto!), hoje);
          minDias = Math.min(minDias, d);
          if (d <= 3) urgentes++;
        });
        const partoPIds = [...new Set(partosProximos.map(r => receptoraProtMap.get(r.id)).filter(Boolean))] as string[];
        servicos.push({
          tipo: 'parto', label: 'Parto', total: partosProximos.length,
          prontas: urgentes, diasMaisUrgente: minDias,
          corSemaforo: getSemaforo(minDias, 'parto'),
          protocoloIds: partoPIds,
        });
      }

      // Ordenar por urgência (menor diasMaisUrgente = mais urgente)
      servicos.sort((a, b) => a.diasMaisUrgente - b.diasMaisUrgente);
      if (isStale()) return;
      setProximosServicos(servicos);
    } catch (error) {
      console.error('Erro ao carregar próximos serviços:', error);
    }
  };

  // ===== ÚLTIMOS SERVIÇOS =====

  const loadUltimaTE = async (receptoraFazendaMap: Map<string, string>, fazendaNomeMap: Map<string, string>, isStale: () => boolean) => {
    try {
      const fazendaIds = [...new Set(receptoraFazendaMap.values())];
      if (fazendaIds.length === 0) return;

      const { data: protocolos } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, fazenda_id, data_inicio')
        .in('fazenda_id', fazendaIds)
        .order('data_inicio', { ascending: false });

      if (isStale()) return;
      if (!protocolos || protocolos.length === 0) return;

      const ultimoProtocoloPorFazenda = new Map<string, { id: string; data: string }>();
      protocolos.forEach(p => {
        if (!ultimoProtocoloPorFazenda.has(p.fazenda_id)) {
          ultimoProtocoloPorFazenda.set(p.fazenda_id, { id: p.id, data: p.data_inicio });
        }
      });

      const protocoloIds = Array.from(ultimoProtocoloPorFazenda.values()).map(v => v.id);
      const protocoloFazendaMap = new Map<string, string>();
      for (const [fazId, info] of ultimoProtocoloPorFazenda) {
        protocoloFazendaMap.set(info.id, fazId);
      }

      const { data: prData } = await supabase
        .from('protocolo_receptoras')
        .select('receptora_id, status, protocolo_id')
        .in('protocolo_id', protocoloIds);

      if (isStale()) return;
      if (!prData || prData.length === 0) return;

      const totalSincronizadas = prData.length;
      const receberamEmbriao = prData.filter(pr => pr.status === 'UTILIZADA').length;
      setUltimaTE({ totalSincronizadas, receberamEmbriao });

      // Detalhes por fazenda (necessário para IDs da rota)
      const porFaz = new Map<string, { sinc: number; serv: number }>();
      prData.forEach(pr => {
        const fazId = protocoloFazendaMap.get(pr.protocolo_id);
        if (!fazId) return;
        if (!porFaz.has(fazId)) porFaz.set(fazId, { sinc: 0, serv: 0 });
        const g = porFaz.get(fazId)!;
        g.sinc++;
        if (pr.status === 'UTILIZADA') g.serv++;
      });

      const detalhes: TEDetalhe[] = [];
      for (const [fazId, d] of porFaz) {
        detalhes.push({
          protocoloId: ultimoProtocoloPorFazenda.get(fazId)!.id,
          fazendaNome: fazendaNomeMap.get(fazId) || 'Fazenda',
          data: ultimoProtocoloPorFazenda.get(fazId)?.data,
          sincronizadas: d.sinc,
          servidas: d.serv,
        });
      }
      if (isStale()) return;
      setTeDetalhes(detalhes);
    } catch (error) {
      console.error('Erro ao carregar última TE:', error);
    }
  };

  const loadUltimoDG = async (receptoraIds: string[], receptoraFazendaMap: Map<string, string>, isStale: () => boolean) => {
    try {
      const { data: dgs } = await supabase
        .from('diagnosticos_gestacao')
        .select('receptora_id, data_diagnostico, resultado')
        .in('receptora_id', receptoraIds)
        .eq('tipo_diagnostico', 'DG')
        .order('data_diagnostico', { ascending: false });

      if (isStale()) return;
      if (!dgs || dgs.length === 0) return;

      const grupos = new Map<string, typeof dgs>();
      dgs.forEach(dg => {
        const fazendaId = receptoraFazendaMap.get(dg.receptora_id);
        if (!fazendaId) return;
        const key = `${fazendaId}::${dg.data_diagnostico}`;
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key)!.push(dg);
      });

      const ultimaPorFazenda = new Map<string, { items: typeof dgs }>();
      for (const [key, grupo] of grupos) {
        const fazendaId = key.split('::')[0];
        if (!ultimaPorFazenda.has(fazendaId)) {
          ultimaPorFazenda.set(fazendaId, { items: grupo });
        }
      }

      let total = 0;
      let prenhes = 0;
      for (const [, info] of ultimaPorFazenda) {
        const p = info.items.filter(dg =>
          dg.resultado === 'PRENHE' || dg.resultado?.startsWith('PRENHE_')
        ).length;
        total += info.items.length;
        prenhes += p;
      }

      if (isStale()) return;
      setUltimoDG({ total, prenhes });
    } catch (error) {
      console.error('Erro ao carregar último DG:', error);
    }
  };

  const loadUltimaSexagem = async (receptoraIds: string[], receptoraFazendaMap: Map<string, string>, isStale: () => boolean) => {
    try {
      const { data: sexagens } = await supabase
        .from('diagnosticos_gestacao')
        .select('receptora_id, data_diagnostico, resultado, sexagem')
        .in('receptora_id', receptoraIds)
        .eq('tipo_diagnostico', 'SEXAGEM')
        .order('data_diagnostico', { ascending: false });

      if (isStale()) return;
      if (!sexagens || sexagens.length === 0) return;

      const grupos = new Map<string, typeof sexagens>();
      sexagens.forEach(s => {
        const fazendaId = receptoraFazendaMap.get(s.receptora_id);
        if (!fazendaId) return;
        const key = `${fazendaId}::${s.data_diagnostico}`;
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key)!.push(s);
      });

      const ultimaPorFazenda = new Map<string, { items: typeof sexagens }>();
      for (const [key, grupo] of grupos) {
        const fazendaId = key.split('::')[0];
        if (!ultimaPorFazenda.has(fazendaId)) {
          ultimaPorFazenda.set(fazendaId, { items: grupo });
        }
      }

      let total = 0;
      let femeas = 0;
      let machos = 0;
      let perdas = 0;
      for (const [, info] of ultimaPorFazenda) {
        total += info.items.length;
        femeas += info.items.filter(s => s.sexagem === 'FEMEA').length;
        machos += info.items.filter(s => s.sexagem === 'MACHO').length;
        perdas += info.items.filter(s => s.resultado === 'VAZIA' || s.sexagem === 'VAZIA').length;
      }

      if (isStale()) return;
      setUltimaSexagem({ total, femeas, machos, perdas });
    } catch (error) {
      console.error('Erro ao carregar última sexagem:', error);
    }
  };

  const loadUltimaAspiracao = async (fazendaIds: string[], isStale: () => boolean) => {
    try {
      if (fazendaIds.length === 0) return;

      const { data: pacotes } = await supabase
        .from('pacotes_aspiracao')
        .select('id, fazenda_id, data_aspiracao')
        .in('fazenda_id', fazendaIds)
        .order('data_aspiracao', { ascending: false });

      if (isStale()) return;
      if (!pacotes || pacotes.length === 0) return;

      const ultimoPorFazenda = new Map<string, { id: string }>();
      pacotes.forEach(p => {
        if (!ultimoPorFazenda.has(p.fazenda_id)) {
          ultimoPorFazenda.set(p.fazenda_id, { id: p.id });
        }
      });

      const pacoteIds = Array.from(ultimoPorFazenda.values()).map(v => v.id);

      const { data: aspDoadoras } = await supabase
        .from('aspiracoes_doadoras')
        .select('doadora_id, viaveis, pacote_aspiracao_id')
        .in('pacote_aspiracao_id', pacoteIds);

      if (isStale()) return;
      if (!aspDoadoras || aspDoadoras.length === 0) return;

      const totalDoadoras = new Set(aspDoadoras.map(a => a.doadora_id)).size;
      const totalOocitos = aspDoadoras.reduce((sum, a) => sum + (a.viaveis || 0), 0);
      setUltimaAspiracao({ totalDoadoras, totalOocitos });
    } catch (error) {
      console.error('Erro ao carregar última aspiração:', error);
    }
  };

  // ===== RENDER =====

  if (loading) return <LoadingScreen />;

  const taxaPrenhez = receptoras.total > 0
    ? Math.round((receptoras.prenhes / receptoras.total) * 100) : 0;
  const taxaAprovTE = ultimaTE.totalSincronizadas > 0
    ? Math.round((ultimaTE.receberamEmbriao / ultimaTE.totalSincronizadas) * 100) : 0;
  const taxaPrenhezDG = ultimoDG.total > 0
    ? Math.round((ultimoDG.prenhes / ultimoDG.total) * 100) : 0;

  const destaque = proximosServicos[0] || null;

  const quadrosServico = [
    ultimaTE.totalSincronizadas > 0 && {
      key: 'te', icon: Syringe, titulo: 'TE', color: 'violet',
      rota: `/cliente/relatorios?expandir=ultimo&tipo=protocolo&ids=${teDetalhes.map(d => d.protocoloId).join(',')}`,
      linha: `${ultimaTE.totalSincronizadas} sinc · ${ultimaTE.receberamEmbriao} serv · ${taxaAprovTE}%`,
    },
    ultimoDG.total > 0 && {
      key: 'dg', icon: Stethoscope, titulo: 'DG', color: 'emerald',
      rota: '/cliente/relatorios?expandir=ultimo&tipo=dg',
      linha: `${ultimoDG.total} recept · ${ultimoDG.prenhes} prenhes · ${taxaPrenhezDG}%`,
    },
    ultimaSexagem.total > 0 && {
      key: 'sexagem', icon: ScanSearch, titulo: 'Sexagem', color: 'pink',
      rota: '/cliente/relatorios?expandir=ultimo&tipo=sexagem',
      linha: `${ultimaSexagem.total} recept · ${ultimaSexagem.femeas}♀ · ${ultimaSexagem.machos}♂${ultimaSexagem.perdas > 0 ? ` · ${ultimaSexagem.perdas} perdas` : ''}`,
    },
    ultimaAspiracao.totalDoadoras > 0 && {
      key: 'aspiracao', icon: TestTube, titulo: 'Aspiração', color: 'amber',
      rota: '/cliente/relatorios?expandir=ultimo&tipo=aspiracao',
      linha: `${ultimaAspiracao.totalDoadoras} doadoras · ${ultimaAspiracao.totalOocitos} oócitos · ${Math.round(ultimaAspiracao.totalOocitos / ultimaAspiracao.totalDoadoras)} média`,
    },
  ].filter(Boolean) as Array<{
    key: string; icon: React.ElementType; titulo: string;
    color: string; rota: string; linha: string;
  }>;

  // Rota do serviço pendente → relatório do protocolo de origem
  const getServicoRota = (s: ProximoServico) => {
    const ids = s.protocoloIds.join(',');
    return `/cliente/relatorios?expandir=ultimo&tipo=protocolo${ids ? `&ids=${ids}` : ''}`;
  };

  const colorMap: Record<string, { icon: string; borderL: string }> = {
    violet: { icon: 'text-violet-500', borderL: 'border-l-violet-500' },
    emerald: { icon: 'text-emerald-500', borderL: 'border-l-emerald-500' },
    pink: { icon: 'text-pink-500', borderL: 'border-l-pink-500' },
    amber: { icon: 'text-amber-500', borderL: 'border-l-amber-500' },
  };

  // Timing text para o card de destaque
  const getTimingText = (s: ProximoServico) => {
    const dias = s.diasMaisUrgente;
    if (s.tipo === 'parto') {
      if (dias <= 0) return { valor: 'Agora!', detalhe: 'Parto previsto' };
      if (dias === 1) return { valor: 'Amanhã', detalhe: 'Parto previsto' };
      return { valor: `${dias}d`, detalhe: 'para o parto' };
    }
    if (dias > 0) return { valor: `${dias}d`, detalhe: 'para janela ideal' };
    if (dias === 0) return { valor: 'Hoje', detalhe: 'Janela ideal' };
    return { valor: `${Math.abs(dias)}d`, detalhe: 'desde a janela' };
  };

  return (
    <div className="flex flex-col gap-3 flex-1">

      {/* ── A: PRÓXIMO SERVIÇO (destaque com semáforo) ── */}
      {destaque && (() => {
        const cor = semaforoClasses[destaque.corSemaforo];
        const config = servicoConfig[destaque.tipo];
        const Icon = config.icon;
        const timing = getTimingText(destaque);

        return (
          <div
            onClick={() => navigate(getServicoRota(destaque))}
            className={`rounded-xl border-l-4 ${cor.border.replace('border-', 'border-l-')} border border-border ${cor.bg} px-4 py-4 shadow-sm cursor-pointer group hover:shadow-md transition-all`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className={`w-4 h-4 ${cor.text}`} />
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Próximo Serviço</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-lg ${cor.iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${cor.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold leading-tight">{config.label}</p>
                <p className="text-base text-muted-foreground">
                  {destaque.total} receptora{destaque.total !== 1 ? 's' : ''}
                  {destaque.prontas > 0 && ` · ${destaque.prontas} pronta${destaque.prontas !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-3xl font-bold ${cor.text}`}>{timing.valor}</span>
                <p className="text-sm text-muted-foreground">{timing.detalhe}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── B: MEU REBANHO ── */}
      <div className="rounded-xl border border-border glass-panel px-4 py-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center">
            <Beef className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold">Meu Rebanho</span>
          <span className="ml-auto text-lg font-semibold text-primary">{taxaPrenhez}%</span>
          <span className="text-sm text-muted-foreground -ml-1">prenhez</span>
        </div>

        {/* Número hero */}
        <div className="flex justify-center mb-3">
          <div className="text-center">
            <span className="text-4xl font-bold text-foreground">{receptoras.total}</span>
            <p className="text-sm text-muted-foreground">receptoras</p>
          </div>
        </div>

        {/* Grid 2×2 de status */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { v: receptoras.prenhes, l: 'prenhes', c: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
            { v: receptoras.servidas, l: 'servidas', c: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
            { v: receptoras.protocoladas, l: 'protocoladas', c: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
            { v: receptoras.vazias, l: 'vazias', c: 'text-red-500 dark:text-red-400', dot: 'bg-red-500' },
          ] as const).map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2">
              <div className={`w-2.5 h-2.5 rounded-full ${s.dot} shrink-0`} />
              <span className={`text-2xl font-bold leading-none ${s.c}`}>{s.v}</span>
              <span className="text-sm text-muted-foreground">{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── C: ÚLTIMOS RESULTADOS (linhas tappable 56px, flex-1 para preencher) ── */}
      {quadrosServico.length > 0 && (
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center gap-2 px-0.5">
            <div className="w-1 h-5 rounded-full bg-primary/50" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Últimos Resultados</span>
          </div>
          <div className="rounded-xl border border-border glass-panel overflow-hidden shadow-sm flex-1">
            {quadrosServico.map((q, idx) => {
              const cores = colorMap[q.color];
              const Icon = q.icon;
              return (
                <div
                  key={q.key}
                  onClick={() => navigate(q.rota)}
                  className={`flex items-center gap-3 px-4 min-h-[56px] cursor-pointer group hover:bg-muted/40 transition-colors border-l-[3px] ${cores.borderL} ${idx > 0 ? 'border-t border-border/50' : ''}`}
                >
                  <Icon className={`w-5 h-5 ${cores.icon} shrink-0`} />
                  <span className="text-base font-bold">{q.titulo}</span>
                  <span className="text-sm text-muted-foreground truncate">{q.linha}</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary ml-auto shrink-0 transition-colors" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
