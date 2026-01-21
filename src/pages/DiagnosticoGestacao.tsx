import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Fazenda } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { Stethoscope, Save, Lock, CheckCircle } from 'lucide-react';
import { atualizarStatusReceptora, validarTransicaoStatus, calcularStatusReceptora } from '@/lib/receptoraStatus';
import DatePickerBR from '@/components/shared/DatePickerBR';

interface LoteTE {
  id: string; // chave: fazenda_id-data_te
  fazenda_id: string;
  fazenda_nome: string;
  data_te: string;
  quantidade_receptoras: number;
  veterinario_dg?: string; // Veterinário responsável pelo DG
  tecnico_dg?: string; // Técnico responsável pelo DG
  status: 'ABERTO' | 'FECHADO'; // Status do lote de DG (não da TE)
}

interface EmbriaoTransferido {
  te_id: string;
  embriao_id: string;
  embriao_identificacao?: string;
  embriao_classificacao?: string;
  lote_fiv_id: string;
  lote_fiv_acasalamento_id?: string;
  doadora_registro?: string;
  touro_nome?: string;
}

interface ReceptoraServida {
  receptora_id: string;
  brinco: string;
  nome?: string;
  data_te: string;
  embrioes: EmbriaoTransferido[]; // Array de embriões (1 ou 2)
  data_abertura_lote: string; // d0 (sempre o mesmo para todos os embriões do grupo)
  dias_gestacao: number; // d0 até hoje
  diagnostico_existente?: {
    id: string;
    data_diagnostico: string;
    resultado: string;
    numero_gestacoes?: number;
    observacoes?: string;
  };
}

interface DiagnosticoFormData {
  [receptora_id: string]: {
    resultado: 'PRENHE' | 'VAZIA' | 'RETOQUE' | '';
    numero_gestacoes: string;
    observacoes: string;
    data_diagnostico: string;
  };
}

export default function DiagnosticoGestacao() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [fazendaSelecionada, setFazendaSelecionada] = useState<string>('');
  const [lotesTE, setLotesTE] = useState<LoteTE[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState<LoteTE | null>(null);
  const [receptoras, setReceptoras] = useState<ReceptoraServida[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [abrirLote, setAbrirLote] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<DiagnosticoFormData>({});
  const [loteFormData, setLoteFormData] = useState({
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  const hoje = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadFazendas();
  }, []);

  useEffect(() => {
    if (fazendaSelecionada) {
      loadLotesTE(fazendaSelecionada);
    } else {
      setLotesTE([]);
      setLoteSelecionado(null);
      setReceptoras([]);
      setFormData({});
    }
  }, [fazendaSelecionada]);

  useEffect(() => {
    if (loteSelecionado) {
      // Verificar se lote está FECHADO
      if (loteSelecionado.status === 'FECHADO') {
        // Lote fechado: apenas visualizar, não permitir edição
        setLoteFormData({
          veterinario_responsavel: loteSelecionado.veterinario_dg || '',
          tecnico_responsavel: loteSelecionado.tecnico_dg || '',
        });
        setAbrirLote(false);
        loadReceptorasLote(loteSelecionado);
      } else if (loteSelecionado.veterinario_dg && loteSelecionado.tecnico_dg) {
        // Lote aberto com veterinário/técnico já definidos
        setLoteFormData({
          veterinario_responsavel: loteSelecionado.veterinario_dg,
          tecnico_responsavel: loteSelecionado.tecnico_dg,
        });
        setAbrirLote(false);
        loadReceptorasLote(loteSelecionado);
      } else {
        // Lote aberto sem veterinário/técnico: precisa abrir o lote primeiro
        setLoteFormData({
          veterinario_responsavel: '',
          tecnico_responsavel: '',
        });
        setAbrirLote(true);
        setReceptoras([]);
        setFormData({});
      }
    } else {
      setReceptoras([]);
      setFormData({});
      setAbrirLote(false);
    }
  }, [loteSelecionado]);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const loadLotesTE = async (fazendaId: string) => {
    try {
      setLoading(true);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DiagnosticoGestacao.tsx:168',message:'dg:load:start',data:{fazendaId},timestamp:Date.now(),sessionId:'debug-session',runId:'debug1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion agent log

      // 1. Buscar receptoras SERVIDAS da fazenda
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) throw viewError;

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];
      
      if (receptoraIds.length === 0) {
        setLotesTE([]);
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DiagnosticoGestacao.tsx:185',message:'dg:receptoras_fazenda',data:{receptoraIds:receptoraIds.length,amostra:receptoraIds.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'debug1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion agent log

      // 2. Verificar quais estão SERVIDAS
      const { data: receptorasData } = await supabase
        .from('receptoras')
        .select('id, status_reprodutivo')
        .in('id', receptoraIds)
        .eq('status_reprodutivo', 'SERVIDA');

      const servidasIds = receptorasData?.map(r => r.id) || [];

      if (servidasIds.length === 0) {
        setLotesTE([]);
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DiagnosticoGestacao.tsx:195',message:'dg:status_reprodutivo',data:{total:receptorasData?.length||0,amostra:receptorasData?.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'debug1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion agent log
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DiagnosticoGestacao.tsx:199',message:'dg:servidas',data:{servidas:servidasIds.length,amostra:servidasIds.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'debug1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion agent log

      // 3. Buscar TEs realizadas agrupadas por data_te
      const { data: teData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, data_te')
        .in('receptora_id', servidasIds)
        .eq('status_te', 'REALIZADA')
        .order('data_te', { ascending: false });

      if (teError) throw teError;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d06514c8-d078-4b09-95be-4d993bc95f78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DiagnosticoGestacao.tsx:208',message:'dg:te_realizadas',data:{te_total:teData?.length||0,amostra:teData?.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'debug1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion agent log

      // 4. Buscar diagnósticos existentes para verificar status e veterinário/técnico do DG
      const { data: diagnosticosData } = await supabase
        .from('diagnosticos_gestacao')
        .select('receptora_id, data_te, veterinario_responsavel, tecnico_responsavel, data_diagnostico')
        .in('receptora_id', servidasIds)
        .eq('tipo_diagnostico', 'DG')
        .order('data_diagnostico', { ascending: false });

      // 5. Agrupar por fazenda + data_te
      const lotesMap = new Map<string, LoteTE>();
      
      // Agrupar TEs por receptora+data para contar receptoras únicas
      const receptorasPorData = new Map<string, Set<string>>();

      teData?.forEach(te => {
        const chave = `${fazendaId}-${te.data_te}`;
        const chaveReceptora = `${te.data_te}-${te.receptora_id}`;
        
        // Contar receptoras únicas por data
        if (!receptorasPorData.has(te.data_te)) {
          receptorasPorData.set(te.data_te, new Set());
        }
        receptorasPorData.get(te.data_te)!.add(te.receptora_id);
        
        if (!lotesMap.has(chave)) {
          // Buscar veterinário/técnico do DG do primeiro diagnóstico encontrado deste lote
          const dgLote = diagnosticosData?.find(dg => dg.data_te === te.data_te);
          
          lotesMap.set(chave, {
            id: chave,
            fazenda_id: fazendaId,
            fazenda_nome: fazendas.find(f => f.id === fazendaId)?.nome || '',
            data_te: te.data_te,
            quantidade_receptoras: 0, // Será calculado depois
            veterinario_dg: dgLote?.veterinario_responsavel || undefined,
            tecnico_dg: dgLote?.tecnico_responsavel || undefined,
            status: 'ABERTO', // Será calculado depois
          });
        }
      });

      // Calcular quantidade de receptoras únicas e status para cada lote
      lotesMap.forEach((lote, chave) => {
        // Contar receptoras únicas desta data
        const receptorasUnicas = receptorasPorData.get(lote.data_te)?.size || 0;
        lote.quantidade_receptoras = receptorasUnicas;
        
        // Buscar diagnósticos desta data
        const diagnosticosDoLote = diagnosticosData?.filter(dg => dg.data_te === lote.data_te) || [];
        
        // Se todas as receptoras têm diagnóstico, o lote está FECHADO
        if (diagnosticosDoLote.length > 0 && diagnosticosDoLote.length >= receptorasUnicas) {
          lote.status = 'FECHADO';
        } else {
          lote.status = 'ABERTO';
        }
      });

      const lotesArray = Array.from(lotesMap.values())
        .sort((a, b) => new Date(b.data_te).getTime() - new Date(a.data_te).getTime());

      setLotesTE(lotesArray);
    } catch (error) {
      toast({
        title: 'Erro ao carregar lotes',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setLotesTE([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirLote = async () => {
    if (!loteFormData.veterinario_responsavel.trim() || !loteFormData.tecnico_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário e técnico responsáveis são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (!loteSelecionado) return;

    // Apenas atualizar o lote local (veterinário/técnico do DG não são salvos em TEs)
    const loteAtualizado: LoteTE = {
      ...loteSelecionado,
      veterinario_dg: loteFormData.veterinario_responsavel.trim(),
      tecnico_dg: loteFormData.tecnico_responsavel.trim(),
      status: 'ABERTO',
    };

    setLoteSelecionado(loteAtualizado);
    setAbrirLote(false);

    // Carregar receptoras do lote
    await loadReceptorasLote(loteAtualizado);
  };

  const loadReceptorasLote = async (lote: LoteTE) => {
    try {
      setLoading(true);

      // 1. Buscar receptoras SERVIDAS da fazenda
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', lote.fazenda_id);

      if (viewError) throw viewError;

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];
      
      if (receptoraIds.length === 0) {
        setReceptoras([]);
        return;
      }

      // 2. Verificar quais estão SERVIDAS
      const { data: receptorasData, error: receptorasError } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome, status_reprodutivo')
        .in('id', receptoraIds)
        .eq('status_reprodutivo', 'SERVIDA');

      if (receptorasError) throw receptorasError;

      const servidasIds = receptorasData?.map(r => r.id) || [];

      // 3. Buscar TEs do lote (mesma data_te)
      const { data: teData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, embriao_id, data_te')
        .in('receptora_id', servidasIds)
        .eq('data_te', lote.data_te)
        .eq('status_te', 'REALIZADA');

      if (teError) throw teError;

      if (!teData || teData.length === 0) {
        setReceptoras([]);
        return;
      }

      // 4. Buscar embriões
      const embriaoIds = teData.map(t => t.embriao_id).filter(Boolean);
      
      let embrioesMap = new Map();
      if (embriaoIds.length > 0) {
        const { data: embrioesData, error: embrioesError } = await supabase
          .from('embrioes')
          .select('id, identificacao, classificacao, lote_fiv_id, lote_fiv_acasalamento_id')
          .in('id', embriaoIds);

        if (embrioesError) throw embrioesError;
        embrioesMap = new Map(embrioesData?.map(e => [e.id, e]) || []);
      }

      // 5. Buscar lotes FIV para obter d0
      const loteIds = [...new Set(Array.from(embrioesMap.values()).map((e: any) => e.lote_fiv_id).filter(Boolean))];
      
      let lotesMap = new Map();
      if (loteIds.length > 0) {
        const { data: lotesData, error: lotesError } = await supabase
          .from('lotes_fiv')
          .select('id, data_abertura')
          .in('id', loteIds);

        if (lotesError) throw lotesError;
        lotesMap = new Map(lotesData?.map(l => [l.id, l]) || []);
      }

      // 6. Buscar dados dos acasalamentos
      const acasalamentoIds = [...new Set(
        Array.from(embrioesMap.values())
          .map((e: any) => e.lote_fiv_acasalamento_id)
          .filter(Boolean)
      )];

      let doadorasMap = new Map<string, string>();
      let tourosMap = new Map<string, string>();

      if (acasalamentoIds.length > 0) {
        const { data: acasalamentosData } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds);

        if (acasalamentosData) {
          const aspiracaoIds = [...new Set(acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean))];
          const doseIds = [...new Set(acasalamentosData.map(a => a.dose_semen_id).filter(Boolean))];

          if (aspiracaoIds.length > 0) {
            const { data: aspiracoesData } = await supabase
              .from('aspiracoes_doadoras')
              .select('id, doadora_id')
              .in('id', aspiracaoIds);

            if (aspiracoesData) {
              const doadoraIds = [...new Set(aspiracoesData.map(a => a.doadora_id))];
              
              if (doadoraIds.length > 0) {
                const { data: doadorasData } = await supabase
                  .from('doadoras')
                  .select('id, registro')
                  .in('id', doadoraIds);

                if (doadorasData) {
                  const doadoraMap = new Map(doadorasData.map(d => [d.id, d.registro]));
                  const aspiracaoDoadoraMap = new Map(aspiracoesData.map(a => [a.id, a.doadora_id]));
                  
                  acasalamentosData.forEach(ac => {
                    if (ac.aspiracao_doadora_id) {
                      const doadoraId = aspiracaoDoadoraMap.get(ac.aspiracao_doadora_id);
                      if (doadoraId) {
                        const registro = doadoraMap.get(doadoraId);
                        if (registro) {
                          doadorasMap.set(ac.id, registro);
                        }
                      }
                    }
                  });
                }
              }
            }
          }

          if (doseIds.length > 0) {
            // Buscar doses com informações do touro relacionado
            const { data: dosesData } = await supabase
              .from('doses_semen')
              .select(`
                id,
                touro_id,
                touro:touros(id, nome, registro, raca)
              `)
              .in('id', doseIds);

            if (dosesData) {
              // Extrair nome do touro relacionado
              dosesData.forEach((d: any) => {
                const touro = d.touro;
                tourosMap.set(d.id, touro?.nome || 'Touro desconhecido');
              });

              acasalamentosData.forEach(ac => {
                if (ac.dose_semen_id) {
                  const touroNome = tourosMap.get(ac.dose_semen_id);
                  if (touroNome) {
                    tourosMap.set(ac.id, touroNome);
                  }
                }
              });
            }
          }
        }
      }

      // 7. Buscar diagnósticos existentes
      const { data: diagnosticosData } = await supabase
        .from('diagnosticos_gestacao')
        .select('*')
        .in('receptora_id', servidasIds)
        .eq('tipo_diagnostico', 'DG')
        .eq('data_te', lote.data_te)
        .order('data_diagnostico', { ascending: false });

      const diagnosticosPorReceptora = new Map<string, typeof diagnosticosData[0]>();
      diagnosticosData?.forEach(dg => {
        if (!diagnosticosPorReceptora.has(dg.receptora_id)) {
          diagnosticosPorReceptora.set(dg.receptora_id, dg);
        }
      });

      // 8. Agrupar TEs por receptora_id + data_te (mesma data sempre)
      const tesPorReceptora = new Map<string, typeof teData>();
      
      teData.forEach(te => {
        const chave = `${te.receptora_id}-${te.data_te}`;
        if (!tesPorReceptora.has(chave)) {
          tesPorReceptora.set(chave, []);
        }
        tesPorReceptora.get(chave)!.push(te);
      });

      // 9. Montar lista de receptoras agrupadas
      const receptorasCompletas: ReceptoraServida[] = [];

      tesPorReceptora.forEach((tes, chave) => {
        // Todas as TEs do grupo têm a mesma receptora_id e data_te
        const primeiraTE = tes[0];
        const receptora = receptorasData?.find(r => r.id === primeiraTE.receptora_id);
        if (!receptora) return;

        // Processar todos os embriões do grupo
        const embrioesDoGrupo: EmbriaoTransferido[] = [];
        let dataAberturalote: string | null = null;
        let diasGestacao: number | null = null;

        tes.forEach(te => {
          const embriao = embrioesMap.get(te.embriao_id);
          if (!embriao) return;

          const loteFiv = lotesMap.get(embriao.lote_fiv_id);
          if (!loteFiv) return;

          // Usar o primeiro D0 encontrado (todos devem ser iguais)
          if (!dataAberturalote) {
            dataAberturalote = loteFiv.data_abertura;
            const d0 = new Date(loteFiv.data_abertura);
            const hojeDate = new Date();
            diasGestacao = Math.floor((hojeDate.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24));
          }

          const doadoraRegistro = embriao.lote_fiv_acasalamento_id 
            ? doadorasMap.get(embriao.lote_fiv_acasalamento_id) 
            : undefined;
          const touroNome = embriao.lote_fiv_acasalamento_id 
            ? tourosMap.get(embriao.lote_fiv_acasalamento_id) 
            : undefined;

          embrioesDoGrupo.push({
            te_id: te.id,
            embriao_id: embriao.id,
            embriao_identificacao: embriao.identificacao,
            embriao_classificacao: embriao.classificacao,
            lote_fiv_id: embriao.lote_fiv_id,
            lote_fiv_acasalamento_id: embriao.lote_fiv_acasalamento_id,
            doadora_registro: doadoraRegistro,
            touro_nome: touroNome,
          });
        });

        if (embrioesDoGrupo.length === 0 || !dataAberturalote || diasGestacao === null) return;

        // Buscar diagnóstico existente (único por receptora + data_te)
        const diagnosticoExistente = diagnosticosPorReceptora.get(primeiraTE.receptora_id);

        receptorasCompletas.push({
          receptora_id: primeiraTE.receptora_id,
          brinco: receptora.identificacao,
          nome: receptora.nome,
          data_te: primeiraTE.data_te,
          embrioes: embrioesDoGrupo,
          data_abertura_lote: dataAberturalote,
          dias_gestacao: diasGestacao,
          diagnostico_existente: diagnosticoExistente ? {
            id: diagnosticoExistente.id,
            data_diagnostico: diagnosticoExistente.data_diagnostico,
            resultado: diagnosticoExistente.resultado,
            numero_gestacoes: diagnosticoExistente.numero_gestacoes || undefined,
            observacoes: diagnosticoExistente.observacoes || undefined,
          } : undefined,
        });
      });

      receptorasCompletas.sort((a, b) => a.brinco.localeCompare(b.brinco));

      setReceptoras(receptorasCompletas);

      // Inicializar formData
      const initialFormData: DiagnosticoFormData = {};
      receptorasCompletas.forEach(r => {
        if (r.diagnostico_existente) {
          const resultado = r.diagnostico_existente.resultado as 'PRENHE' | 'VAZIA' | 'RETOQUE';
          // Se já tem diagnóstico PRENHE ou RETOQUE mas não tem número de gestações, preencher com "1"
          const numeroGestacoes = r.diagnostico_existente.numero_gestacoes?.toString() || 
            ((resultado === 'PRENHE' || resultado === 'RETOQUE') ? '1' : '');
          
          initialFormData[r.receptora_id] = {
            resultado,
            numero_gestacoes: numeroGestacoes,
            observacoes: r.diagnostico_existente.observacoes || '',
            data_diagnostico: r.diagnostico_existente.data_diagnostico,
          };
        } else {
          initialFormData[r.receptora_id] = {
            resultado: '',
            numero_gestacoes: '',
            observacoes: '',
            data_diagnostico: hoje,
          };
        }
      });
      setFormData(initialFormData);
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setReceptoras([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultadoChange = (receptoraId: string, resultado: 'PRENHE' | 'VAZIA' | 'RETOQUE' | '') => {
    setFormData(prev => {
      const dadosAtuais = prev[receptoraId] || {};
      
      // Se resultado é PRENHE ou RETOQUE e não tem número de gestações definido, preencher com "1"
      // Se já tem valor, manter o valor existente
      let numeroGestacoes = dadosAtuais.numero_gestacoes || '';
      
      if ((resultado === 'PRENHE' || resultado === 'RETOQUE') && !numeroGestacoes) {
        numeroGestacoes = '1';
      } else if (resultado === 'VAZIA' || resultado === '') {
        numeroGestacoes = '';
      }
      
      return {
        ...prev,
        [receptoraId]: {
          ...dadosAtuais,
          resultado,
          numero_gestacoes: numeroGestacoes,
        },
      };
    });
  };

  const handleFieldChange = (receptoraId: string, field: keyof DiagnosticoFormData[string], value: string) => {
    setFormData(prev => ({
      ...prev,
      [receptoraId]: {
        ...prev[receptoraId],
        [field]: value,
      },
    }));
  };

  const handleSalvarLote = async () => {
    if (!loteSelecionado) return;

    // Validar veterinário e técnico
    if (!loteFormData.veterinario_responsavel.trim() || !loteFormData.tecnico_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário e técnico responsáveis são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Validar que todas as receptoras têm resultado
    const receptorasSemResultado = receptoras.filter(r => {
      const dados = formData[r.receptora_id];
      return !dados || !dados.resultado || !dados.data_diagnostico;
    });

    if (receptorasSemResultado.length > 0) {
      toast({
        title: 'Erro de validação',
        description: `Há ${receptorasSemResultado.length} receptora(s) sem resultado definido`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Validar todas as receptoras antes de salvar
      for (const receptora of receptoras) {
        const statusAtual = await calcularStatusReceptora(receptora.receptora_id);
        const validacao = validarTransicaoStatus(statusAtual, 'REALIZAR_DG');
        
        if (!validacao.valido) {
          toast({
            title: 'Erro de validação',
            description: `Receptora ${receptora.brinco}: ${validacao.mensagem}`,
            variant: 'destructive',
          });
          return;
        }
      }

      // Preparar dados para inserção/atualização em lote
      const diagnosticosParaInserir: any[] = [];
      const diagnosticosParaAtualizar: any[] = [];
      const atualizacoesStatus: Array<{ receptora_id: string; status: string; dataParto: string | null }> = [];

      receptoras.forEach(receptora => {
        const dados = formData[receptora.receptora_id];
        if (!dados || !dados.resultado) return;

        // Validar campos obrigatórios
        if (!dados.data_diagnostico) {
          console.warn(`Receptora ${receptora.brinco} sem data de diagnóstico`);
          return;
        }

        const insertData: any = {
          receptora_id: receptora.receptora_id,
          data_te: receptora.data_te,
          tipo_diagnostico: 'DG',
          data_diagnostico: dados.data_diagnostico,
          resultado: dados.resultado,
          observacoes: dados.observacoes ? dados.observacoes.trim() || null : null,
        };
        
        // Número de gestações só é adicionado se resultado for PRENHE ou RETOQUE
        // Se for VAZIA, não enviar o campo (ou enviar 0 se a coluna for NOT NULL)
        if (dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE') {
          if (dados.numero_gestacoes) {
            insertData.numero_gestacoes = parseInt(dados.numero_gestacoes);
          } else {
            // Se não tem número de gestações definido mas está prenhe, usar 1 como padrão
            insertData.numero_gestacoes = 1;
          }
        } else {
          // Para VAZIA, não enviar o campo ou enviar 0 se necessário
          // (dependendo da constraint do banco)
          insertData.numero_gestacoes = 0;
        }
        
        // Adicionar campos de veterinário/técnico apenas se não estiverem vazios
        // (esses campos podem não existir na tabela ainda - usuário precisa executar script SQL)
        if (loteFormData.veterinario_responsavel?.trim()) {
          insertData.veterinario_responsavel = loteFormData.veterinario_responsavel.trim();
        }
        if (loteFormData.tecnico_responsavel?.trim()) {
          insertData.tecnico_responsavel = loteFormData.tecnico_responsavel.trim();
        }

        if (receptora.diagnostico_existente) {
          diagnosticosParaAtualizar.push({
            id: receptora.diagnostico_existente.id,
            ...insertData,
          });
        } else {
          diagnosticosParaInserir.push(insertData);
        }

        // Preparar atualização de status
        let novoStatus: 'PRENHE' | 'PRENHE_RETOQUE' | 'VAZIA';
        let dataParto: string | null = null;

        if (dados.resultado === 'PRENHE') {
          novoStatus = 'PRENHE';
          const d0 = new Date(receptora.data_abertura_lote);
          const dataPartoDate = new Date(d0);
          dataPartoDate.setDate(dataPartoDate.getDate() + 275);
          dataParto = dataPartoDate.toISOString().split('T')[0];
        } else if (dados.resultado === 'RETOQUE') {
          novoStatus = 'PRENHE_RETOQUE';
          const d0 = new Date(receptora.data_abertura_lote);
          const dataPartoDate = new Date(d0);
          dataPartoDate.setDate(dataPartoDate.getDate() + 275);
          dataParto = dataPartoDate.toISOString().split('T')[0];
        } else {
          novoStatus = 'VAZIA';
          // Limpar número de gestações se resultado for VAZIA
          dados.numero_gestacoes = '';
        }

        atualizacoesStatus.push({
          receptora_id: receptora.receptora_id,
          status: novoStatus,
          dataParto,
        });
      });

      // Inserir novos diagnósticos (otimizado - uma query para verificar todos)
      if (diagnosticosParaInserir.length > 0) {
        // Buscar todos os diagnósticos existentes de uma vez (otimização)
        const chavesParaVerificar = diagnosticosParaInserir.map(dg => 
          `${dg.receptora_id}-${dg.data_te}-${dg.tipo_diagnostico}`
        );
        
        const { data: existentes, error: checkError } = await supabase
          .from('diagnosticos_gestacao')
          .select('id, receptora_id, data_te, tipo_diagnostico')
          .in('receptora_id', [...new Set(diagnosticosParaInserir.map(dg => dg.receptora_id))])
          .eq('tipo_diagnostico', 'DG');

        if (checkError) {
          console.warn('Erro ao verificar diagnósticos existentes:', checkError);
        }

        // Mapear diagnósticos existentes para facilitar busca
        const existentesMap = new Map<string, string>();
        existentes?.forEach(dg => {
          const chave = `${dg.receptora_id}-${dg.data_te}-${dg.tipo_diagnostico}`;
          existentesMap.set(chave, dg.id);
        });

        // Separar em inserir e atualizar
        const diagnosticosParaInserirFinal: any[] = [];
        
        diagnosticosParaInserir.forEach(dg => {
          const chave = `${dg.receptora_id}-${dg.data_te}-${dg.tipo_diagnostico}`;
          const existingId = existentesMap.get(chave);
          
          if (existingId) {
            // Se existe, adicionar à lista de atualização
            diagnosticosParaAtualizar.push({
              id: existingId,
              ...dg,
            });
          } else {
            // Se não existe, adicionar à lista de inserção
            diagnosticosParaInserirFinal.push(dg);
          }
        });

        // Inserir apenas os que realmente não existem
        if (diagnosticosParaInserirFinal.length > 0) {
          const { error: insertError } = await supabase
            .from('diagnosticos_gestacao')
            .insert(diagnosticosParaInserirFinal);

          if (insertError) {
            console.error('Erro ao inserir diagnósticos:', insertError);
            
            // Se erro relacionado a coluna não existir, tentar sem os campos veterinário/técnico
            if (insertError.message?.includes('column') || insertError.code === '42703') {
              console.warn('Campos veterinario_responsavel/tecnico_responsavel não existem, tentando sem eles...');
              
              // Remover campos veterinário/técnico de todos os registros
              const insertDataSemCampos = diagnosticosParaInserirFinal.map(({ veterinario_responsavel, tecnico_responsavel, ...rest }) => rest);
              
              const { error: retryError } = await supabase
                .from('diagnosticos_gestacao')
                .insert(insertDataSemCampos);
              
              if (retryError) {
                throw new Error(`Erro ao inserir diagnósticos: ${retryError.message}. Verifique se os campos estão corretos no banco de dados.`);
              }
            } else if (insertError.code === '23505' || insertError.message?.includes('unique')) {
              // Erro de unicidade - já deve ter sido tratado acima, mas se chegou aqui, buscar e atualizar
              throw new Error('Erro de duplicação: alguns diagnósticos já existem. Recarregue a página e tente novamente.');
            } else {
              throw new Error(`Erro ao inserir diagnósticos: ${insertError.message || insertError.code || 'Erro desconhecido'}`);
            }
          }
        }
      }

      // Atualizar diagnósticos existentes (otimizado - atualizar em lote se possível)
      if (diagnosticosParaAtualizar.length > 0) {
        // Tentar atualizar em lote primeiro (Supabase permite via RPC ou individual)
        for (const dg of diagnosticosParaAtualizar) {
          const { id, ...updateData } = dg;
          let { error: updateError } = await supabase
            .from('diagnosticos_gestacao')
            .update(updateData)
            .eq('id', id);

          // Se erro relacionado a coluna não existir, tentar sem os campos veterinário/técnico
          if (updateError && (updateError.message?.includes('column') || updateError.code === '42703')) {
            console.warn('Campos veterinario_responsavel/tecnico_responsavel não existem, atualizando sem eles...');
            
            const { veterinario_responsavel, tecnico_responsavel, ...updateDataSemCampos } = updateData;
            
            const { error: retryError } = await supabase
              .from('diagnosticos_gestacao')
              .update(updateDataSemCampos)
              .eq('id', id);
            
            if (retryError) {
              throw new Error(`Erro ao atualizar diagnóstico ${id}: ${retryError.message}`);
            }
          } else if (updateError) {
            throw new Error(`Erro ao atualizar diagnóstico ${id}: ${updateError.message || updateError.code || 'Erro desconhecido'}`);
          }
        }
      }

      // Atualizar status das receptoras
      for (const atualizacao of atualizacoesStatus) {
        const updateData: Record<string, string | null> = {
          status_reprodutivo: atualizacao.status,
        };

        if (atualizacao.dataParto) {
          updateData.data_provavel_parto = atualizacao.dataParto;
        } else if (atualizacao.status === 'VAZIA') {
          updateData.data_provavel_parto = null;
        }

        const { error: statusError } = await supabase
          .from('receptoras')
          .update(updateData)
          .eq('id', atualizacao.receptora_id);

        if (statusError) {
          console.error(`Erro ao atualizar status da receptora ${atualizacao.receptora_id}:`, statusError);
        }
      }

      // Verificar se todas as receptoras têm diagnóstico (lote deve ser fechado)
      const todasComDiagnostico = receptoras.every(r => {
        const dados = formData[r.receptora_id];
        return dados && dados.resultado && dados.data_diagnostico;
      });

      // Atualizar lote local
      setLoteSelecionado({
        ...loteSelecionado,
        veterinario_dg: loteFormData.veterinario_responsavel.trim(),
        tecnico_dg: loteFormData.tecnico_responsavel.trim(),
        status: todasComDiagnostico ? 'FECHADO' : 'ABERTO',
      });

      toast({
        title: 'Lote salvo com sucesso',
        description: todasComDiagnostico 
          ? `${receptoras.length} diagnóstico(s) registrado(s). Lote fechado.`
          : `${receptoras.length} diagnóstico(s) registrado(s)`,
      });

      // Recarregar dados
      await loadLotesTE(fazendaSelecionada);
      if (loteSelecionado) {
        await loadReceptorasLote(loteSelecionado);
      }
    } catch (error) {
      console.error('Erro detalhado ao salvar lote:', error);
      
      let errorMessage = 'Erro desconhecido';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Mensagens de erro mais amigáveis
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          errorMessage = 'Os campos veterinario_responsavel e tecnico_responsavel não existem na tabela. Execute o script SQL add_veterinario_tecnico_dg.sql primeiro.';
        } else if (error.message.includes('unique') || error.message.includes('duplicate')) {
          errorMessage = 'Já existe um diagnóstico para esta receptora nesta data. Tente recarregar a página.';
        } else if (error.message.includes('foreign key') || error.message.includes('constraint')) {
          errorMessage = 'Erro de integridade dos dados. Verifique se todas as informações estão corretas.';
        }
      }
      
      toast({
        title: 'Erro ao salvar lote',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const todasReceptorasComResultado = receptoras.every(r => {
    const dados = formData[r.receptora_id];
    return dados && dados.resultado && dados.data_diagnostico;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnóstico de Gestação (DG)"
        description="Registrar diagnósticos de gestação por lote de TE"
      />

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Fazenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="fazenda">Fazenda *</Label>
            <Select
              value={fazendaSelecionada}
              onValueChange={setFazendaSelecionada}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fazenda" />
              </SelectTrigger>
              <SelectContent>
                {fazendas.map((fazenda) => (
                  <SelectItem key={fazenda.id} value={fazenda.id}>
                    {fazenda.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {fazendaSelecionada && (
        <Card>
          <CardHeader>
            <CardTitle>Lotes de Transferência de Embriões</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSpinner />
            ) : lotesTE.length === 0 ? (
              <EmptyState
                title="Nenhum lote de TE encontrado"
                description="Selecione outra fazenda ou verifique se há transferências registradas."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data TE</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Vet. DG</TableHead>
                    <TableHead>Téc. DG</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotesTE.map((lote) => (
                    <TableRow 
                      key={lote.id}
                      className={loteSelecionado?.id === lote.id ? 'bg-blue-50' : ''}
                    >
                      <TableCell className="font-medium">
                        {new Date(lote.data_te).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>{lote.quantidade_receptoras} receptoras</TableCell>
                      <TableCell>{lote.veterinario_dg || '-'}</TableCell>
                      <TableCell>{lote.tecnico_dg || '-'}</TableCell>
                      <TableCell>
                        <StatusBadge 
                          status={lote.status === 'ABERTO' ? 'ABERTO' : 'FECHADO'} 
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => setLoteSelecionado(lote)}
                          variant={loteSelecionado?.id === lote.id ? 'default' : 'outline'}
                        >
                          {loteSelecionado?.id === lote.id ? 'Selecionado' : 'Selecionar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {loteSelecionado && abrirLote && (
        <Card>
          <CardHeader>
            <CardTitle>Abrir Lote de DG</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              Lote de TE em {new Date(loteSelecionado.data_te).toLocaleDateString('pt-BR')} - {loteSelecionado.quantidade_receptoras} receptoras
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="veterinario">Veterinário Responsável *</Label>
                <Input
                  id="veterinario"
                  value={loteFormData.veterinario_responsavel}
                  onChange={(e) => setLoteFormData({ ...loteFormData, veterinario_responsavel: e.target.value })}
                  placeholder="Nome do veterinário"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tecnico">Técnico Responsável *</Label>
                <Input
                  id="tecnico"
                  value={loteFormData.tecnico_responsavel}
                  onChange={(e) => setLoteFormData({ ...loteFormData, tecnico_responsavel: e.target.value })}
                  placeholder="Nome do técnico"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAbrirLote}
                className="bg-green-600 hover:bg-green-700"
                disabled={!loteFormData.veterinario_responsavel.trim() || !loteFormData.tecnico_responsavel.trim()}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Abrir Lote
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAbrirLote(false);
                  setLoteSelecionado(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loteSelecionado && !abrirLote && receptoras.length > 0 && (
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>
                  Receptoras do Lote - {receptoras.length} {receptoras.length === 1 ? 'receptora' : 'receptoras'}
                  {loteSelecionado.status === 'FECHADO' && (
                    <span className="ml-2 text-sm text-slate-500">(Lote Fechado - Somente Leitura)</span>
                  )}
                </CardTitle>
                {loteSelecionado.status === 'ABERTO' && (
                  <Button
                    onClick={handleSalvarLote}
                    disabled={!todasReceptorasComResultado || submitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {submitting ? 'Salvando...' : 'Salvar Lote Completo'}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="veterinario_dg">Veterinário Responsável (DG) *</Label>
                  <Input
                    id="veterinario_dg"
                    value={loteFormData.veterinario_responsavel}
                    onChange={(e) => setLoteFormData({ ...loteFormData, veterinario_responsavel: e.target.value })}
                    placeholder="Nome do veterinário"
                    disabled={loteSelecionado.status === 'FECHADO'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tecnico_dg">Técnico Responsável (DG) *</Label>
                  <Input
                    id="tecnico_dg"
                    value={loteFormData.tecnico_responsavel}
                    onChange={(e) => setLoteFormData({ ...loteFormData, tecnico_responsavel: e.target.value })}
                    placeholder="Nome do técnico"
                    disabled={loteSelecionado.status === 'FECHADO'}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receptora</TableHead>
                      <TableHead>Dias Gestação</TableHead>
                      <TableHead>Embrião(ões)</TableHead>
                      <TableHead>Doadora / Touro</TableHead>
                      <TableHead>Data DG</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Nº Gest.</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receptoras.map((receptora) => {
                      const dados = formData[receptora.receptora_id] || {
                        resultado: '',
                        numero_gestacoes: '',
                        observacoes: '',
                        data_diagnostico: hoje,
                      };
                      const temDiagnostico = !!receptora.diagnostico_existente;

                      return (
                        <TableRow key={receptora.receptora_id}>
                          <TableCell className="font-medium">
                            {receptora.brinco}
                            {receptora.nome && (
                              <span className="text-slate-500 text-sm ml-2">({receptora.nome})</span>
                            )}
                            {temDiagnostico && (
                              <StatusBadge 
                                status={receptora.diagnostico_existente?.resultado || ''} 
                                className="ml-2"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{receptora.dias_gestacao}</span> dias
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {receptora.embrioes.map((embriao, idx) => (
                                <div key={embriao.te_id} className="text-sm">
                                  <div className="font-medium">
                                    {embriao.embriao_identificacao || `Embrião ${idx + 1}`}
                                    {embriao.embriao_classificacao && (
                                      <span className="text-slate-500 ml-2">({embriao.embriao_classificacao})</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {receptora.embrioes.map((embriao, idx) => (
                                <div key={embriao.te_id} className="text-sm">
                                  <div>
                                    <span className="font-medium">{embriao.doadora_registro || '-'}</span>
                                    {embriao.doadora_registro && embriao.touro_nome && ' × '}
                                    <span className="font-medium">{embriao.touro_nome || ''}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DatePickerBR
                              value={dados.data_diagnostico}
                              onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_diagnostico', value || '')}
                              className="w-36"
                              disabled={loteSelecionado.status === 'FECHADO'}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={dados.resultado}
                              onValueChange={(value) => handleResultadoChange(receptora.receptora_id, value as any)}
                              disabled={loteSelecionado.status === 'FECHADO'}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Resultado" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PRENHE">PRENHE</SelectItem>
                                <SelectItem value="VAZIA">VAZIA</SelectItem>
                                <SelectItem value="RETOQUE">RETOQUE</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE' ? (
                              <Input
                                type="number"
                                min="1"
                                max="3"
                                value={dados.numero_gestacoes}
                                onChange={(e) => handleFieldChange(receptora.receptora_id, 'numero_gestacoes', e.target.value)}
                                placeholder="1-3"
                                className="w-20"
                                disabled={loteSelecionado.status === 'FECHADO'}
                              />
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Textarea
                              value={dados.observacoes}
                              onChange={(e) => handleFieldChange(receptora.receptora_id, 'observacoes', e.target.value)}
                              placeholder="Observações"
                              rows={2}
                              className="w-48"
                              disabled={loteSelecionado.status === 'FECHADO'}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
