import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { EmbriaoQuery, DiagnosticoGestacaoInsert, DiagnosticoGestacaoUpdate } from '@/lib/types';
import { buscarDadosGenealogia, extrairAcasalamentoIds } from '@/lib/dataEnrichment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { validarTransicaoStatus } from '@/lib/receptoraStatus';
import DatePickerBR from '@/components/shared/DatePickerBR';
import {
  type LoteTEDiagnostico,
  type EmbriaoTransferido,
  type LoteFormDataBase,
  calcularDiasGestacao,
  calcularDataProvavelParto,
  getHoje,
  validarResponsaveis,
  DIAS_MINIMOS,
} from '@/lib/gestacao';
import { useFazendasComLotes, useLotesTE } from '@/hooks/loteTE';
import {
  Stethoscope,
  UserCheck,
  Clock,
  Search,
  Filter,
  Building2,
  CalendarDays,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  Save,
  AlertTriangle,
} from 'lucide-react';

interface ReceptoraServida {
  receptora_id: string;
  brinco: string;
  nome?: string;
  status_reprodutivo?: string | null;
  data_te: string;
  embrioes: EmbriaoTransferido[];
  data_abertura_lote: string;
  dias_gestacao: number;
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

interface HistoricoDG {
  id: string;
  receptora_id: string;
  receptora_brinco: string;
  receptora_nome?: string;
  fazenda_nome: string;
  data_te: string;
  data_diagnostico: string;
  resultado: string;
  numero_gestacoes?: number;
  observacoes?: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  data_provavel_parto?: string;
}

export default function DiagnosticoGestacao() {
  const { toast } = useToast();
  const hoje = getHoje();

  // State - Nova Sessão
  const [fazendaSelecionada, setFazendaSelecionada] = useState<string>('');
  const [loteSelecionado, setLoteSelecionado] = useState<LoteTEDiagnostico | null>(null);
  const [receptoras, setReceptoras] = useState<ReceptoraServida[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<DiagnosticoFormData>({});
  const [loteFormData, setLoteFormData] = useState<LoteFormDataBase>({
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // State - Histórico
  const [historico, setHistorico] = useState<HistoricoDG[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [filtroFazenda, setFiltroFazenda] = useState<string>('todos');
  const [filtroResultado, setFiltroResultado] = useState<string>('todos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroDataPartoDe, setFiltroDataPartoDe] = useState('');
  const [filtroDataPartoAte, setFiltroDataPartoAte] = useState('');
  const [todasFazendas, setTodasFazendas] = useState<{id: string; nome: string}[]>([]);

  // Hooks compartilhados
  const { fazendas, loadFazendas } = useFazendasComLotes({
    statusReceptoraFiltro: 'SERVIDA',
  });

  const transformLote = useCallback((
    loteBase: { id: string; fazenda_id: string; fazenda_nome: string; data_te: string; quantidade_receptoras: number; status: 'ABERTO' | 'FECHADO' },
    diagnosticoLote: { veterinario_responsavel?: string; tecnico_responsavel?: string } | undefined
  ): LoteTEDiagnostico => ({
    ...loteBase,
    veterinario_dg: diagnosticoLote?.veterinario_responsavel,
    tecnico_dg: diagnosticoLote?.tecnico_responsavel,
  }), []);

  const { lotesTE, loading: loadingLotes, loadLotesTE } = useLotesTE<LoteTEDiagnostico>({
    statusReceptoraFiltro: 'SERVIDA',
    transformLote,
  });

  // Effects
  useEffect(() => {
    loadFazendas();
    loadTodasFazendas();
  }, [loadFazendas]);

  useEffect(() => {
    if (fazendaSelecionada) {
      const fazendaNome = fazendas.find(f => f.id === fazendaSelecionada)?.nome;
      loadLotesTE(fazendaSelecionada, fazendaNome);
    } else {
      setLoteSelecionado(null);
      setReceptoras([]);
      setFormData({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fazendaSelecionada]);

  useEffect(() => {
    if (loteSelecionado) {
      // Se o lote tem vet/tec salvos, usa esses valores
      if (loteSelecionado.veterinario_dg || loteSelecionado.tecnico_dg) {
        setLoteFormData({
          veterinario_responsavel: loteSelecionado.veterinario_dg || loteFormData.veterinario_responsavel,
          tecnico_responsavel: loteSelecionado.tecnico_dg || loteFormData.tecnico_responsavel,
        });
      }
      // Se não tem, mantém os valores que o usuário já digitou (não reseta)

      // Sempre carrega as receptoras quando seleciona um lote
      loadReceptorasLote(loteSelecionado);
    } else {
      setReceptoras([]);
      setFormData({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteSelecionado]);

  const loadTodasFazendas = async () => {
    const { data } = await supabase
      .from('fazendas')
      .select('id, nome')
      .order('nome');
    setTodasFazendas(data || []);
  };

  const loadHistorico = async () => {
    try {
      setLoadingHistorico(true);

      // 1. Buscar diagnósticos de DG
      let query = supabase
        .from('diagnosticos_gestacao')
        .select('*')
        .eq('tipo_diagnostico', 'DG')
        .order('data_diagnostico', { ascending: false })
        .limit(500);

      if (filtroDataInicio) {
        query = query.gte('data_diagnostico', filtroDataInicio);
      }
      if (filtroDataFim) {
        query = query.lte('data_diagnostico', filtroDataFim);
      }
      if (filtroResultado && filtroResultado !== 'todos') {
        query = query.eq('resultado', filtroResultado);
      }

      const { data: diagnosticosData, error: diagnosticosError } = await query;

      if (diagnosticosError) {
        console.error('Erro ao buscar diagnósticos:', diagnosticosError);
        throw new Error(diagnosticosError.message || 'Erro ao buscar diagnósticos');
      }

      if (!diagnosticosData || diagnosticosData.length === 0) {
        setHistorico([]);
        return;
      }

      // 2. Buscar receptoras relacionadas (incluindo data_provavel_parto)
      const receptoraIds = [...new Set(diagnosticosData.map(dg => dg.receptora_id).filter(Boolean))];

      const { data: receptorasData, error: receptorasError } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome, data_provavel_parto')
        .in('id', receptoraIds);

      if (receptorasError) {
        console.error('Erro ao buscar receptoras:', receptorasError);
        throw new Error(receptorasError.message || 'Erro ao buscar receptoras');
      }

      const receptorasMap = new Map(
        (receptorasData || []).map(r => [r.id, r])
      );

      // Mapa de data_provavel_parto por receptora
      const dataPartoMap = new Map(
        (receptorasData || []).map(r => [r.id, r.data_provavel_parto])
      );

      // 3. Buscar fazenda atual das receptoras via view
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_id_atual, fazenda_nome_atual')
        .in('receptora_id', receptoraIds);

      if (viewError) {
        console.error('Erro ao buscar view receptoras:', viewError);
      }

      const fazendaMap = new Map(
        (viewData || []).map(v => [v.receptora_id, v.fazenda_nome_atual])
      );

      // 4. Montar histórico formatado
      const historicoFormatado: HistoricoDG[] = diagnosticosData
        .map(dg => {
          const receptora = receptorasMap.get(dg.receptora_id);
          return {
            id: dg.id,
            receptora_id: dg.receptora_id,
            receptora_brinco: receptora?.identificacao || '-',
            receptora_nome: receptora?.nome,
            fazenda_nome: fazendaMap.get(dg.receptora_id) || '-',
            data_te: dg.data_te,
            data_diagnostico: dg.data_diagnostico,
            resultado: dg.resultado,
            numero_gestacoes: dg.numero_gestacoes,
            observacoes: dg.observacoes,
            veterinario_responsavel: dg.veterinario_responsavel,
            tecnico_responsavel: dg.tecnico_responsavel,
            data_provavel_parto: dataPartoMap.get(dg.receptora_id) || undefined,
          };
        });

      setHistorico(historicoFormatado);
    } catch (error) {
      console.error('Erro no loadHistorico:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Erro desconhecido';
      toast({
        title: 'Erro ao carregar histórico',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoadingHistorico(false);
    }
  };

  const loadReceptorasLote = async (lote: LoteTEDiagnostico) => {
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

      // 2. Buscar receptoras SERVIDAS e TEs em paralelo
      const [receptorasResult, teResult] = await Promise.all([
        supabase
          .from('receptoras')
          .select('id, identificacao, nome, status_reprodutivo')
          .in('id', receptoraIds)
          .eq('status_reprodutivo', 'SERVIDA'),
        supabase
          .from('transferencias_embrioes')
          .select('id, receptora_id, embriao_id, data_te')
          .in('receptora_id', receptoraIds)
          .eq('data_te', lote.data_te)
          .eq('status_te', 'REALIZADA'),
      ]);

      if (receptorasResult.error) throw receptorasResult.error;
      if (teResult.error) throw teResult.error;

      const receptorasData = receptorasResult.data;
      const teData = teResult.data;

      if (!teData || teData.length === 0) {
        setReceptoras([]);
        return;
      }

      const servidasIds = receptorasData?.map(r => r.id) || [];

      // 3. Buscar embriões
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

      // 4. Buscar lotes FIV e genealogia em paralelo
      const loteIds = [...new Set(Array.from(embrioesMap.values()).map((e: EmbriaoQuery) => e.lote_fiv_id).filter(Boolean))];
      const acasalamentoIds = extrairAcasalamentoIds(Array.from(embrioesMap.values()));

      const [lotesResult, genealogiaResult, diagnosticosResult] = await Promise.all([
        loteIds.length > 0
          ? supabase.from('lotes_fiv').select('id, data_abertura').in('id', loteIds)
          : Promise.resolve({ data: [], error: null }),
        buscarDadosGenealogia(acasalamentoIds),
        supabase
          .from('diagnosticos_gestacao')
          .select('*')
          .in('receptora_id', servidasIds)
          .eq('tipo_diagnostico', 'DG')
          .eq('data_te', lote.data_te)
          .order('data_diagnostico', { ascending: false }),
      ]);

      if (lotesResult.error) throw lotesResult.error;
      const lotesMap = new Map(lotesResult.data?.map(l => [l.id, l]) || []);
      const { doadorasMap, tourosMap } = genealogiaResult;

      const diagnosticosPorReceptora = new Map<string, typeof diagnosticosResult.data[0]>();
      diagnosticosResult.data?.forEach(dg => {
        if (!diagnosticosPorReceptora.has(dg.receptora_id)) {
          diagnosticosPorReceptora.set(dg.receptora_id, dg);
        }
      });

      // 5. Agrupar TEs por receptora
      const tesPorReceptora = new Map<string, typeof teData>();
      teData.forEach(te => {
        const chave = `${te.receptora_id}-${te.data_te}`;
        if (!tesPorReceptora.has(chave)) {
          tesPorReceptora.set(chave, []);
        }
        tesPorReceptora.get(chave)!.push(te);
      });

      // 6. Montar lista de receptoras
      const receptorasCompletas: ReceptoraServida[] = [];

      tesPorReceptora.forEach((tes) => {
        const primeiraTE = tes[0];
        const receptora = receptorasData?.find(r => r.id === primeiraTE.receptora_id);
        if (!receptora) return;

        const embrioesDoGrupo: EmbriaoTransferido[] = [];
        let dataAberturalote: string | null = null;
        let diasGestacao: number | null = null;

        tes.forEach(te => {
          const embriao = embrioesMap.get(te.embriao_id);
          if (!embriao) return;

          const loteFiv = lotesMap.get(embriao.lote_fiv_id);
          if (!loteFiv) return;

          if (!dataAberturalote) {
            dataAberturalote = loteFiv.data_abertura;
            diasGestacao = calcularDiasGestacao(loteFiv.data_abertura);
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

        const diagnosticoExistente = diagnosticosPorReceptora.get(primeiraTE.receptora_id);

        receptorasCompletas.push({
          receptora_id: primeiraTE.receptora_id,
          brinco: receptora.identificacao,
          nome: receptora.nome,
          status_reprodutivo: receptora.status_reprodutivo,
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

    if (!validarResponsaveis(loteFormData)) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário responsável é obrigatório',
        variant: 'destructive',
      });
      return;
    }

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

      // Validar transições de status
      for (const receptora of receptoras) {
        const statusAtual = receptora.status_reprodutivo || 'VAZIA';
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

      // Preparar dados
      const diagnosticosParaInserir: DiagnosticoGestacaoInsert[] = [];
      const diagnosticosParaAtualizar: DiagnosticoGestacaoUpdate[] = [];
      const atualizacoesStatus: Array<{ receptora_id: string; status: string; dataParto: string | null }> = [];

      receptoras.forEach(receptora => {
        const dados = formData[receptora.receptora_id];
        if (!dados || !dados.resultado || !dados.data_diagnostico) return;

        const insertData: DiagnosticoGestacaoInsert = {
          receptora_id: receptora.receptora_id,
          data_te: receptora.data_te,
          tipo_diagnostico: 'DG',
          data_diagnostico: dados.data_diagnostico,
          resultado: dados.resultado,
          observacoes: dados.observacoes?.trim() || undefined,
        };

        if (dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE') {
          insertData.numero_gestacoes = dados.numero_gestacoes ? parseInt(dados.numero_gestacoes) : 1;
        } else {
          insertData.numero_gestacoes = 0;
        }

        if (loteFormData.veterinario_responsavel?.trim()) {
          insertData.veterinario_responsavel = loteFormData.veterinario_responsavel.trim();
        }
        if (loteFormData.tecnico_responsavel?.trim()) {
          insertData.tecnico_responsavel = loteFormData.tecnico_responsavel.trim();
        }

        if (receptora.diagnostico_existente) {
          diagnosticosParaAtualizar.push({ id: receptora.diagnostico_existente.id, ...insertData });
        } else {
          diagnosticosParaInserir.push(insertData);
        }

        // Status e data de parto
        let novoStatus: 'PRENHE' | 'PRENHE_RETOQUE' | 'VAZIA';
        let dataParto: string | null = null;

        if (dados.resultado === 'PRENHE') {
          novoStatus = 'PRENHE';
          dataParto = calcularDataProvavelParto(receptora.data_abertura_lote);
        } else if (dados.resultado === 'RETOQUE') {
          novoStatus = 'PRENHE_RETOQUE';
          dataParto = calcularDataProvavelParto(receptora.data_abertura_lote);
        } else {
          novoStatus = 'VAZIA';
        }

        atualizacoesStatus.push({
          receptora_id: receptora.receptora_id,
          status: novoStatus,
          dataParto,
        });
      });

      // Inserir novos diagnósticos
      if (diagnosticosParaInserir.length > 0) {
        const { data: existentes } = await supabase
          .from('diagnosticos_gestacao')
          .select('id, receptora_id, data_te, tipo_diagnostico')
          .in('receptora_id', [...new Set(diagnosticosParaInserir.map(dg => dg.receptora_id))])
          .eq('tipo_diagnostico', 'DG');

        const existentesMap = new Map<string, string>();
        existentes?.forEach(dg => {
          const chave = `${dg.receptora_id}-${dg.data_te}-${dg.tipo_diagnostico}`;
          existentesMap.set(chave, dg.id);
        });

        const diagnosticosParaInserirFinal: DiagnosticoGestacaoInsert[] = [];

        diagnosticosParaInserir.forEach(dg => {
          const chave = `${dg.receptora_id}-${dg.data_te}-${dg.tipo_diagnostico}`;
          const existingId = existentesMap.get(chave);

          if (existingId) {
            diagnosticosParaAtualizar.push({ id: existingId, ...dg });
          } else {
            diagnosticosParaInserirFinal.push(dg);
          }
        });

        if (diagnosticosParaInserirFinal.length > 0) {
          const { error: insertError } = await supabase
            .from('diagnosticos_gestacao')
            .insert(diagnosticosParaInserirFinal);

          if (insertError) {
            if (insertError.message?.includes('column') || insertError.code === '42703') {
              const insertDataSemCampos = diagnosticosParaInserirFinal.map(({ veterinario_responsavel, tecnico_responsavel, ...rest }) => rest);
              const { error: retryError } = await supabase.from('diagnosticos_gestacao').insert(insertDataSemCampos);
              if (retryError) throw new Error(`Erro ao inserir diagnósticos: ${retryError.message}`);
            } else {
              throw new Error(`Erro ao inserir diagnósticos: ${insertError.message}`);
            }
          }
        }
      }

      // Atualizar diagnósticos existentes (em paralelo)
      const updatePromises = diagnosticosParaAtualizar.map(async (dg) => {
        const { id, ...updateData } = dg;
        let { error: updateError } = await supabase.from('diagnosticos_gestacao').update(updateData).eq('id', id);

        if (updateError && (updateError.message?.includes('column') || updateError.code === '42703')) {
          const { veterinario_responsavel, tecnico_responsavel, ...updateDataSemCampos } = updateData;
          const { error: retryError } = await supabase.from('diagnosticos_gestacao').update(updateDataSemCampos).eq('id', id);
          if (retryError) throw new Error(`Erro ao atualizar diagnóstico: ${retryError.message}`);
        } else if (updateError) {
          throw new Error(`Erro ao atualizar diagnóstico: ${updateError.message}`);
        }
      });

      await Promise.all(updatePromises);

      // Agrupar atualizações de status por combinação status+dataParto para fazer em batch
      const statusGroups = new Map<string, { ids: string[]; dataParto: string | null }>();
      atualizacoesStatus.forEach(({ receptora_id, status, dataParto }) => {
        const key = `${status}|${dataParto || 'null'}`;
        if (!statusGroups.has(key)) {
          statusGroups.set(key, { ids: [], dataParto: dataParto || null });
        }
        statusGroups.get(key)!.ids.push(receptora_id);
      });

      // Atualizar status em batch por grupo (em paralelo)
      const statusPromises = Array.from(statusGroups.entries()).map(async ([key, { ids, dataParto }]) => {
        const status = key.split('|')[0];
        const updateData: Record<string, string | null> = { status_reprodutivo: status };
        if (dataParto) {
          updateData.data_provavel_parto = dataParto;
        } else if (status === 'VAZIA') {
          updateData.data_provavel_parto = null;
        }

        const { error: statusError } = await supabase
          .from('receptoras')
          .update(updateData)
          .in('id', ids);

        if (statusError) throw new Error(`Erro ao atualizar status das receptoras`);
      });

      await Promise.all(statusPromises);

      const todasComDiagnostico = receptoras.every(r => {
        const dados = formData[r.receptora_id];
        return dados && dados.resultado && dados.data_diagnostico;
      });

      toast({
        title: 'Lote salvo com sucesso',
        description: todasComDiagnostico
          ? `${receptoras.length} diagnóstico(s) registrado(s). Lote fechado.`
          : `${receptoras.length} diagnóstico(s) registrado(s)`,
      });

      if (todasComDiagnostico) {
        // Se fechou o lote, limpa a seleção para permitir novo trabalho
        setLoteSelecionado(null);
        setReceptoras([]);
        setFormData({});
      } else {
        // Se não fechou, atualiza o lote atual localmente (sem reload)
        setLoteSelecionado({
          ...loteSelecionado,
          veterinario_dg: loteFormData.veterinario_responsavel.trim(),
          tecnico_dg: loteFormData.tecnico_responsavel.trim(),
          status: 'ABERTO',
        });
      }

      // Recarrega fazendas e lotes em background (sem await)
      const fazendaNome = fazendas.find(f => f.id === fazendaSelecionada)?.nome;
      loadFazendas();
      if (fazendaSelecionada) {
        loadLotesTE(fazendaSelecionada, fazendaNome);
      }
    } catch (error) {
      toast({
        title: 'Erro ao salvar lote',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
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

  const formatarData = (data: string) => {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const historicoFiltrado = historico.filter(h => {
    const matchesBusca = !filtroBusca ||
      h.receptora_brinco.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      h.receptora_nome?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      h.fazenda_nome.toLowerCase().includes(filtroBusca.toLowerCase());
    const matchesFazenda = filtroFazenda === 'todos' || h.fazenda_nome === filtroFazenda;
    const matchesDataPartoDe = !filtroDataPartoDe || (h.data_provavel_parto && h.data_provavel_parto >= filtroDataPartoDe);
    const matchesDataPartoAte = !filtroDataPartoAte || (h.data_provavel_parto && h.data_provavel_parto <= filtroDataPartoAte);
    return matchesBusca && matchesFazenda && matchesDataPartoDe && matchesDataPartoAte;
  });

  const estatisticasHistorico = {
    total: historicoFiltrado.length,
    prenhes: historicoFiltrado.filter(h => h.resultado === 'PRENHE').length,
    vazias: historicoFiltrado.filter(h => h.resultado === 'VAZIA').length,
    retoques: historicoFiltrado.filter(h => h.resultado === 'RETOQUE').length,
  };

  const taxaPrenhez = estatisticasHistorico.total > 0
    ? Math.round(((estatisticasHistorico.prenhes + estatisticasHistorico.retoques) / estatisticasHistorico.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnóstico de Gestação (DG)"
        description="Registrar diagnósticos de gestação por lote de TE"
      />

      <Tabs defaultValue="nova-sessao" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="nova-sessao" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Nova Sessão
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2" onClick={() => loadHistorico()}>
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nova-sessao" className="mt-4">
          {/* Barra de controles compacta */}
          <Card className="mb-4">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-end gap-3">
                {/* Veterinário */}
                <div className="flex-1 min-w-[180px] max-w-[220px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Veterinário
                  </label>
                  <Input
                    placeholder="Nome do veterinário"
                    value={loteFormData.veterinario_responsavel}
                    onChange={(e) => setLoteFormData(prev => ({ ...prev, veterinario_responsavel: e.target.value }))}
                    className="h-9"
                  />
                </div>

                {/* Técnico */}
                <div className="flex-1 min-w-[180px] max-w-[220px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Técnico
                  </label>
                  <Input
                    placeholder="Nome do técnico"
                    value={loteFormData.tecnico_responsavel}
                    onChange={(e) => setLoteFormData(prev => ({ ...prev, tecnico_responsavel: e.target.value }))}
                    className="h-9"
                  />
                </div>

                {/* Fazenda */}
                <div className="flex-1 min-w-[180px] max-w-[220px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Fazenda
                  </label>
                  <Select
                    value={fazendaSelecionada}
                    onValueChange={setFazendaSelecionada}
                    disabled={!loteFormData.veterinario_responsavel}
                  >
                    <SelectTrigger className="h-9">
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

                {/* Lote TE */}
                <div className="flex-1 min-w-[200px] max-w-[280px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Lote TE
                  </label>
                  <Select
                    value={loteSelecionado?.id || ''}
                    onValueChange={(value) => {
                      const lote = lotesTE.find(l => l.id === value);
                      setLoteSelecionado(lote || null);
                    }}
                    disabled={!fazendaSelecionada || loadingLotes}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={loadingLotes ? 'Carregando...' : 'Selecione o lote'} />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesTE.map((lote) => {
                        const diasInsuficientes = lote.dias_gestacao !== undefined && lote.dias_gestacao < DIAS_MINIMOS.DG;
                        return (
                          <SelectItem key={lote.id} value={lote.id}>
                            <span className={diasInsuficientes ? 'text-amber-600' : ''}>
                              {formatarData(lote.data_te)} • {lote.dias_gestacao ?? '?'}d • {lote.quantidade_receptoras} rec.
                              {diasInsuficientes && ' ⚠️'}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Botão Salvar */}
                <Button
                  onClick={handleSalvarLote}
                  disabled={
                    !loteSelecionado ||
                    !todasReceptorasComResultado ||
                    submitting ||
                    loteSelecionado?.status === 'FECHADO' ||
                    (loteSelecionado?.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.DG)
                  }
                  className="h-9 bg-primary hover:bg-primary-dark"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>

              {/* Mensagem de ajuda */}
              {!loteFormData.veterinario_responsavel ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Preencha o veterinário para selecionar a fazenda
                </p>
              ) : !fazendaSelecionada ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Selecione uma fazenda para ver os lotes disponíveis
                </p>
              ) : lotesTE.length === 0 && !loadingLotes ? (
                <p className="text-xs text-amber-600 mt-2">
                  Nenhum lote de TE pendente nesta fazenda
                </p>
              ) : loteSelecionado && loteSelecionado.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.DG ? (
                <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    <strong>Atenção:</strong> Este lote está com {loteSelecionado.dias_gestacao} dias de gestação.
                    O DG só pode ser realizado a partir de <strong>{DIAS_MINIMOS.DG} dias</strong>.
                    Faltam <strong>{DIAS_MINIMOS.DG - loteSelecionado.dias_gestacao} dias</strong>.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Tabela de Receptoras */}
          {loading ? (
            <Card>
              <CardContent className="py-8">
                <LoadingSpinner />
              </CardContent>
            </Card>
          ) : loteSelecionado && receptoras.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <CardTitle className="text-base">
                        Receptoras do Lote
                      </CardTitle>
                      <CardDescription>
                        {receptoras.length} receptora(s) • TE em {formatarData(loteSelecionado.data_te)}
                      </CardDescription>
                    </div>
                    {loteSelecionado.status === 'FECHADO' && (
                      <Badge variant="secondary">Lote Fechado</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receptora</TableHead>
                        <TableHead>Dias Gest.</TableHead>
                        <TableHead>Embrião</TableHead>
                        <TableHead>Doadora × Touro</TableHead>
                        <TableHead>Data DG</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Nº Gest.</TableHead>
                        <TableHead>Obs.</TableHead>
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
                        const isDisabled = loteSelecionado.status === 'FECHADO';

                        return (
                          <TableRow key={receptora.receptora_id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {receptora.brinco}
                                {receptora.nome && (
                                  <span className="text-muted-foreground text-xs">({receptora.nome})</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {receptora.dias_gestacao}d
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                {receptora.embrioes.map((embriao, idx) => (
                                  <div key={embriao.te_id} className="text-sm">
                                    {embriao.embriao_identificacao || `#${idx + 1}`}
                                    {embriao.embriao_classificacao && (
                                      <span className="text-muted-foreground text-xs ml-1">
                                        ({embriao.embriao_classificacao})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5 text-sm">
                                {receptora.embrioes.map((embriao) => (
                                  <div key={embriao.te_id}>
                                    {embriao.doadora_registro || '-'}
                                    {embriao.touro_nome && ` × ${embriao.touro_nome}`}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DatePickerBR
                                value={dados.data_diagnostico}
                                onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_diagnostico', value || '')}
                                className="w-32"
                                disabled={isDisabled}
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={dados.resultado}
                                onValueChange={(value) => handleResultadoChange(receptora.receptora_id, value as 'PRENHE' | 'VAZIA' | 'RETOQUE' | '')}
                                disabled={isDisabled}
                              >
                                <SelectTrigger className="w-28 h-9">
                                  <SelectValue placeholder="--" />
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
                                  className="w-16 h-9"
                                  disabled={isDisabled}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={dados.observacoes}
                                onChange={(e) => handleFieldChange(receptora.receptora_id, 'observacoes', e.target.value)}
                                placeholder="Obs."
                                className="w-32 h-9"
                                disabled={isDisabled}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : loteSelecionado && receptoras.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma receptora encontrada neste lote
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="historico" className="space-y-6 mt-6">
          {/* Cards de estatísticas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de DGs</p>
                    <p className="text-2xl font-bold">{estatisticasHistorico.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Prenhes</p>
                    <p className="text-2xl font-bold text-green-600">{estatisticasHistorico.prenhes}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Vazias</p>
                    <p className="text-2xl font-bold text-red-600">{estatisticasHistorico.vazias}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Taxa Prenhez</p>
                    <p className="text-2xl font-bold text-primary">{taxaPrenhez}%</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Brinco, nome, fazenda..."
                      value={filtroBusca}
                      onChange={(e) => setFiltroBusca(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fazenda</label>
                  <Select value={filtroFazenda} onValueChange={setFiltroFazenda}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as fazendas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as fazendas</SelectItem>
                      {todasFazendas.map(f => (
                        <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Resultado</label>
                  <Select value={filtroResultado} onValueChange={setFiltroResultado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="PRENHE">Prenhe</SelectItem>
                      <SelectItem value="VAZIA">Vazia</SelectItem>
                      <SelectItem value="RETOQUE">Retoque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Início</label>
                  <DatePickerBR
                    value={filtroDataInicio}
                    onChange={(value) => setFiltroDataInicio(value || '')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Fim</label>
                  <DatePickerBR
                    value={filtroDataFim}
                    onChange={(value) => setFiltroDataFim(value || '')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Parto De</label>
                  <DatePickerBR
                    value={filtroDataPartoDe}
                    onChange={(value) => setFiltroDataPartoDe(value || '')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Parto Até</label>
                  <DatePickerBR
                    value={filtroDataPartoAte}
                    onChange={(value) => setFiltroDataPartoAte(value || '')}
                  />
                </div>
              </div>
              <Button
                onClick={loadHistorico}
                className="mt-4 bg-primary hover:bg-primary-dark"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </CardContent>
          </Card>

          {/* Tabela de histórico */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Diagnósticos</CardTitle>
              <CardDescription>
                {historicoFiltrado.length} registro(s) encontrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistorico ? (
                <LoadingSpinner />
              ) : historicoFiltrado.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum diagnóstico encontrado. Clique em "Atualizar" para carregar os dados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receptora</TableHead>
                        <TableHead>Fazenda</TableHead>
                        <TableHead>Data TE</TableHead>
                        <TableHead>Data DG</TableHead>
                        <TableHead>Data Parto</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Nº Gest.</TableHead>
                        <TableHead>Veterinário</TableHead>
                        <TableHead>Técnico</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicoFiltrado.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium">
                            {h.receptora_brinco}
                            {h.receptora_nome && (
                              <span className="text-muted-foreground text-sm ml-2">({h.receptora_nome})</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {h.fazenda_nome}
                            </div>
                          </TableCell>
                          <TableCell>{formatarData(h.data_te)}</TableCell>
                          <TableCell>{formatarData(h.data_diagnostico)}</TableCell>
                          <TableCell>{h.data_provavel_parto ? formatarData(h.data_provavel_parto) : '-'}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                h.resultado === 'PRENHE'
                                  ? 'bg-green-500/10 text-green-600 border-green-500/30'
                                  : h.resultado === 'VAZIA'
                                  ? 'bg-red-500/10 text-red-600 border-red-500/30'
                                  : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                              }
                            >
                              {h.resultado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{h.numero_gestacoes || '-'}</TableCell>
                          <TableCell>{h.veterinario_responsavel || '-'}</TableCell>
                          <TableCell>{h.tecnico_responsavel || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{h.observacoes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
