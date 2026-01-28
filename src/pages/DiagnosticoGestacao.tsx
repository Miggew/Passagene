import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { EmbriaoQuery, DiagnosticoGestacaoInsert, DiagnosticoGestacaoUpdate } from '@/lib/types';
import { buscarDadosGenealogia, extrairAcasalamentoIds } from '@/lib/dataEnrichment';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
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
} from '@/lib/gestacao';
import { useFazendasComLotes, useLotesTE } from '@/hooks/loteTE';
import {
  FazendaSelector,
  LotesTable,
  AbrirLoteForm,
  LoteHeader,
} from '@/components/loteTE';

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

export default function DiagnosticoGestacao() {
  const { toast } = useToast();
  const hoje = getHoje();

  // State
  const [fazendaSelecionada, setFazendaSelecionada] = useState<string>('');
  const [loteSelecionado, setLoteSelecionado] = useState<LoteTEDiagnostico | null>(null);
  const [receptoras, setReceptoras] = useState<ReceptoraServida[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [abrirLote, setAbrirLote] = useState(false);
  const [formData, setFormData] = useState<DiagnosticoFormData>({});
  const [loteFormData, setLoteFormData] = useState<LoteFormDataBase>({
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Hooks compartilhados
  const { fazendas, loadFazendas } = useFazendasComLotes({
    statusReceptoraFiltro: 'SERVIDA',
    tipoDiagnosticoFiltro: 'DG',
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
    tipoDiagnosticoFiltro: 'DG',
    transformLote,
  });

  // Effects
  useEffect(() => {
    loadFazendas();
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
      if (loteSelecionado.status === 'FECHADO') {
        setLoteFormData({
          veterinario_responsavel: loteSelecionado.veterinario_dg || '',
          tecnico_responsavel: loteSelecionado.tecnico_dg || '',
        });
        setAbrirLote(false);
        loadReceptorasLote(loteSelecionado);
      } else if (loteSelecionado.veterinario_dg && loteSelecionado.tecnico_dg) {
        setLoteFormData({
          veterinario_responsavel: loteSelecionado.veterinario_dg,
          tecnico_responsavel: loteSelecionado.tecnico_dg,
        });
        setAbrirLote(false);
        loadReceptorasLote(loteSelecionado);
      } else {
        setLoteFormData({ veterinario_responsavel: '', tecnico_responsavel: '' });
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

  const handleAbrirLote = async () => {
    if (!validarResponsaveis(loteFormData)) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário e técnico responsáveis são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (!loteSelecionado) return;

    const loteAtualizado: LoteTEDiagnostico = {
      ...loteSelecionado,
      veterinario_dg: loteFormData.veterinario_responsavel.trim(),
      tecnico_dg: loteFormData.tecnico_responsavel.trim(),
      status: 'ABERTO',
    };

    setLoteSelecionado(loteAtualizado);
    setAbrirLote(false);
    await loadReceptorasLote(loteAtualizado);
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
        description: 'Veterinário e técnico responsáveis são obrigatórios',
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

      // Atualizar diagnósticos existentes
      for (const dg of diagnosticosParaAtualizar) {
        const { id, ...updateData } = dg;
        let { error: updateError } = await supabase.from('diagnosticos_gestacao').update(updateData).eq('id', id);

        if (updateError && (updateError.message?.includes('column') || updateError.code === '42703')) {
          const { veterinario_responsavel, tecnico_responsavel, ...updateDataSemCampos } = updateData;
          const { error: retryError } = await supabase.from('diagnosticos_gestacao').update(updateDataSemCampos).eq('id', id);
          if (retryError) throw new Error(`Erro ao atualizar diagnóstico: ${retryError.message}`);
        } else if (updateError) {
          throw new Error(`Erro ao atualizar diagnóstico: ${updateError.message}`);
        }
      }

      // Atualizar status das receptoras
      for (const atualizacao of atualizacoesStatus) {
        const updateData: Record<string, string | null> = { status_reprodutivo: atualizacao.status };
        if (atualizacao.dataParto) {
          updateData.data_provavel_parto = atualizacao.dataParto;
        } else if (atualizacao.status === 'VAZIA') {
          updateData.data_provavel_parto = null;
        }

        const { error: statusError } = await supabase
          .from('receptoras')
          .update(updateData)
          .eq('id', atualizacao.receptora_id);

        if (statusError) throw new Error(`Erro ao atualizar status da receptora`);
      }

      const todasComDiagnostico = receptoras.every(r => {
        const dados = formData[r.receptora_id];
        return dados && dados.resultado && dados.data_diagnostico;
      });

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

      const fazendaNome = fazendas.find(f => f.id === fazendaSelecionada)?.nome;
      await loadLotesTE(fazendaSelecionada, fazendaNome);
      if (loteSelecionado) {
        await loadReceptorasLote(loteSelecionado);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnóstico de Gestação (DG)"
        description="Registrar diagnósticos de gestação por lote de TE"
      />

      <FazendaSelector
        fazendas={fazendas}
        fazendaSelecionada={fazendaSelecionada}
        onFazendaChange={setFazendaSelecionada}
      />

      {fazendaSelecionada && (
        <LotesTable
          title="Lotes de Transferência de Embriões"
          emptyTitle="Nenhum lote de TE encontrado"
          emptyDescription="Selecione outra fazenda ou verifique se há transferências registradas."
          lotesTE={lotesTE}
          loteSelecionado={loteSelecionado}
          loading={loadingLotes}
          veterinarioLabel="Vet. DG"
          tecnicoLabel="Téc. DG"
          getVeterinario={(l) => l.veterinario_dg}
          getTecnico={(l) => l.tecnico_dg}
          onSelectLote={setLoteSelecionado}
        />
      )}

      {loteSelecionado && abrirLote && (
        <AbrirLoteForm
          title="Abrir Lote de DG"
          loteSelecionado={loteSelecionado}
          loteFormData={loteFormData}
          onFormChange={setLoteFormData}
          onAbrirLote={handleAbrirLote}
          onCancelar={() => {
            setAbrirLote(false);
            setLoteSelecionado(null);
          }}
        />
      )}

      {loteSelecionado && !abrirLote && receptoras.length > 0 && (
        <Card>
          <CardHeader>
            <LoteHeader
              loteSelecionado={loteSelecionado}
              receptorasCount={receptoras.length}
              loteFormData={loteFormData}
              onFormChange={setLoteFormData}
              veterinarioLabel="Veterinário Responsável (DG)"
              tecnicoLabel="Técnico Responsável (DG)"
              onSalvarLote={handleSalvarLote}
              submitting={submitting}
              canSave={todasReceptorasComResultado}
            />
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
                              <span className="text-muted-foreground text-sm ml-2">({receptora.nome})</span>
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
                                      <span className="text-muted-foreground ml-2">({embriao.embriao_classificacao})</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {receptora.embrioes.map((embriao) => (
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
                              onValueChange={(value) => handleResultadoChange(receptora.receptora_id, value as 'PRENHE' | 'VAZIA' | 'RETOQUE' | '')}
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
                              <span className="text-muted-foreground">-</span>
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
