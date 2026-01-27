import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { DiagnosticoGestacaoInsert, DiagnosticoGestacaoUpdate } from '@/lib/types';
import { buscarDadosGenealogia, buscarLotesFIV, extrairAcasalamentoIds, extrairLoteIds } from '@/lib/dataEnrichment';
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
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { atualizarStatusReceptora, type StatusReceptora } from '@/lib/receptoraStatus';
import DatePickerBR from '@/components/shared/DatePickerBR';
import {
  type LoteTESexagem,
  type EmbriaoTransferido,
  type LoteFormDataBase,
  calcularDiasGestacao,
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

// Status de receptoras prenhes para sexagem
const STATUS_PRENHE = ['PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS'] as const;

interface ReceptoraPrenhe {
  receptora_id: string;
  brinco: string;
  nome?: string;
  data_te: string;
  embrioes: EmbriaoTransferido[];
  data_abertura_lote: string;
  dias_gestacao: number;
  numero_gestacoes: number;
  diagnostico_existente?: {
    id: string;
    data_diagnostico: string;
    resultado: string;
    numero_gestacoes?: number;
    observacoes?: string;
  };
}

interface SexagemFormData {
  [receptora_id: string]: {
    data_sexagem: string;
    sexagens: string[];
    observacoes: string;
  };
}

type ResultadoSexagem = 'FEMEA' | 'MACHO' | 'SEM_SEXO' | 'VAZIA';

export default function Sexagem() {
  const { toast } = useToast();
  const hoje = getHoje();

  // State
  const [fazendaSelecionada, setFazendaSelecionada] = useState<string>('');
  const [loteSelecionado, setLoteSelecionado] = useState<LoteTESexagem | null>(null);
  const [receptoras, setReceptoras] = useState<ReceptoraPrenhe[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [abrirLote, setAbrirLote] = useState(false);
  const [formData, setFormData] = useState<SexagemFormData>({});
  const [loteFormData, setLoteFormData] = useState<LoteFormDataBase>({
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Hooks compartilhados
  const { fazendas, loadFazendas } = useFazendasComLotes({
    statusReceptoraFiltro: ['PRENHE', 'PRENHE_RETOQUE'],
    tipoDiagnosticoFiltro: 'SEXAGEM',
  });

  const transformLote = useCallback((
    loteBase: { id: string; fazenda_id: string; fazenda_nome: string; data_te: string; quantidade_receptoras: number; status: 'ABERTO' | 'FECHADO' },
    diagnosticoLote: { veterinario_responsavel?: string; tecnico_responsavel?: string } | undefined
  ): LoteTESexagem => ({
    ...loteBase,
    veterinario_sexagem: diagnosticoLote?.veterinario_responsavel,
    tecnico_sexagem: diagnosticoLote?.tecnico_responsavel,
  }), []);

  const { lotesTE, loading: loadingLotes, loadLotesTE } = useLotesTE<LoteTESexagem>({
    statusReceptoraFiltro: STATUS_PRENHE as unknown as ('SERVIDA' | 'PRENHE' | 'PRENHE_RETOQUE' | 'PRENHE_FEMEA' | 'PRENHE_MACHO' | 'PRENHE_SEM_SEXO' | 'PRENHE_2_SEXOS')[],
    tipoDiagnosticoFiltro: 'SEXAGEM',
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
          veterinario_responsavel: loteSelecionado.veterinario_sexagem || '',
          tecnico_responsavel: loteSelecionado.tecnico_sexagem || '',
        });
        setAbrirLote(false);
        loadReceptorasLote(loteSelecionado);
      } else if (loteSelecionado.veterinario_sexagem && loteSelecionado.tecnico_sexagem) {
        setLoteFormData({
          veterinario_responsavel: loteSelecionado.veterinario_sexagem,
          tecnico_responsavel: loteSelecionado.tecnico_sexagem,
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

    const loteAtualizado: LoteTESexagem = {
      ...loteSelecionado,
      veterinario_sexagem: loteFormData.veterinario_responsavel.trim(),
      tecnico_sexagem: loteFormData.tecnico_responsavel.trim(),
      status: 'ABERTO',
    };

    setLoteSelecionado(loteAtualizado);
    setAbrirLote(false);
    await loadReceptorasLote(loteAtualizado);
  };

  const loadReceptorasLote = async (lote: LoteTESexagem) => {
    try {
      setLoading(true);

      const { data: viewData } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', lote.fazenda_id);

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      const { data: receptorasData } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome, status_reprodutivo')
        .in('id', receptoraIds)
        .in('status_reprodutivo', STATUS_PRENHE);

      const prenhesIds = receptorasData?.map(r => r.id) || [];

      if (prenhesIds.length === 0) {
        setReceptoras([]);
        return;
      }

      // Executar queries em paralelo
      const [teResult, diagnosticosResult, sexagensResult] = await Promise.all([
        supabase
          .from('transferencias_embrioes')
          .select('id, receptora_id, embriao_id, data_te')
          .in('receptora_id', prenhesIds)
          .eq('data_te', lote.data_te)
          .eq('status_te', 'REALIZADA'),
        supabase
          .from('diagnosticos_gestacao')
          .select('*')
          .in('receptora_id', prenhesIds)
          .eq('tipo_diagnostico', 'DG')
          .eq('data_te', lote.data_te)
          .order('data_diagnostico', { ascending: false }),
        supabase
          .from('diagnosticos_gestacao')
          .select('*')
          .in('receptora_id', prenhesIds)
          .eq('tipo_diagnostico', 'SEXAGEM')
          .eq('data_te', lote.data_te)
          .order('data_diagnostico', { ascending: false }),
      ]);

      const teData = teResult.data;
      const diagnosticosData = diagnosticosResult.data;
      const sexagensData = sexagensResult.data;

      if (!teData || teData.length === 0) {
        setReceptoras([]);
        return;
      }

      const embriaoIds = teData.map(t => t.embriao_id).filter(Boolean);
      let embrioesMap = new Map();

      if (embriaoIds.length > 0) {
        const { data: embrioesData } = await supabase
          .from('embrioes')
          .select('id, identificacao, classificacao, lote_fiv_id, lote_fiv_acasalamento_id')
          .in('id', embriaoIds);

        if (embrioesData) {
          embrioesMap = new Map(embrioesData.map(e => [e.id, e]));
        }
      }

      // Buscar lotes FIV e dados de genealogia em paralelo
      const embrioesList = Array.from(embrioesMap.values());
      const loteIds = extrairLoteIds(embrioesList);
      const acasalamentoIds = extrairAcasalamentoIds(embrioesList);

      const [lotesMap, genealogiaResult] = await Promise.all([
        buscarLotesFIV(loteIds),
        buscarDadosGenealogia(acasalamentoIds),
      ]);

      const { doadorasMap, tourosMap } = genealogiaResult;

      const diagnosticosPorReceptora = new Map<string, typeof diagnosticosData[0]>();
      diagnosticosData?.forEach(dg => {
        if (!diagnosticosPorReceptora.has(dg.receptora_id)) {
          diagnosticosPorReceptora.set(dg.receptora_id, dg);
        }
      });

      const sexagensPorReceptora = new Map<string, typeof sexagensData[0]>();
      sexagensData?.forEach(s => {
        if (!sexagensPorReceptora.has(s.receptora_id)) {
          sexagensPorReceptora.set(s.receptora_id, s);
        }
      });

      // Agrupar TEs por receptora
      const tesPorReceptora = new Map<string, typeof teData>();

      teData.forEach(te => {
        const chave = `${te.receptora_id}-${te.data_te}`;
        if (!tesPorReceptora.has(chave)) {
          tesPorReceptora.set(chave, []);
        }
        tesPorReceptora.get(chave)!.push(te);
      });

      const receptorasCompletas: ReceptoraPrenhe[] = [];

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

        const diagnostico = diagnosticosPorReceptora.get(primeiraTE.receptora_id);
        if (!diagnostico || diagnostico.resultado === 'VAZIA') return;

        receptorasCompletas.push({
          receptora_id: primeiraTE.receptora_id,
          brinco: receptora.identificacao,
          nome: receptora.nome,
          data_te: primeiraTE.data_te,
          embrioes: embrioesDoGrupo,
          data_abertura_lote: dataAberturalote,
          dias_gestacao: diasGestacao,
          numero_gestacoes: diagnostico.numero_gestacoes || 1,
          diagnostico_existente: sexagensPorReceptora.get(primeiraTE.receptora_id) ? {
            id: sexagensPorReceptora.get(primeiraTE.receptora_id)!.id,
            data_diagnostico: sexagensPorReceptora.get(primeiraTE.receptora_id)!.data_diagnostico,
            resultado: sexagensPorReceptora.get(primeiraTE.receptora_id)!.resultado,
            numero_gestacoes: sexagensPorReceptora.get(primeiraTE.receptora_id)!.numero_gestacoes,
            observacoes: sexagensPorReceptora.get(primeiraTE.receptora_id)!.observacoes,
          } : undefined,
        });
      });

      receptorasCompletas.sort((a, b) => a.brinco.localeCompare(b.brinco));
      setReceptoras(receptorasCompletas);

      // Inicializar formData
      const initialFormData: SexagemFormData = {};
      receptorasCompletas.forEach(r => {
        if (r.diagnostico_existente) {
          const sexagemCompleta = sexagensPorReceptora.get(r.receptora_id);
          let sexagensParsed: string[] = new Array(r.numero_gestacoes).fill('').map(() => '');
          let observacoesLimpa = r.diagnostico_existente.observacoes || '';

          if (sexagemCompleta?.observacoes) {
            const matchSexagens = sexagemCompleta.observacoes.match(/SEXAGENS:([^|]+)/);
            if (matchSexagens) {
              const sexagensArray = matchSexagens[1].split(',').map(s => s.trim());
              sexagensParsed = sexagensArray;
              while (sexagensParsed.length < r.numero_gestacoes) {
                sexagensParsed.push('');
              }
              sexagensParsed = sexagensParsed.slice(0, r.numero_gestacoes);
              observacoesLimpa = sexagemCompleta.observacoes.replace(/SEXAGENS:[^|]+\|?/, '').trim();
            }
          }

          if (sexagensParsed.every(s => !s) && sexagemCompleta?.sexagem) {
            sexagensParsed[0] = sexagemCompleta.sexagem;
          }

          initialFormData[r.receptora_id] = {
            data_sexagem: r.diagnostico_existente.data_diagnostico,
            sexagens: sexagensParsed,
            observacoes: observacoesLimpa,
          };
        } else {
          initialFormData[r.receptora_id] = {
            data_sexagem: hoje,
            sexagens: new Array(r.numero_gestacoes).fill('').map(() => ''),
            observacoes: '',
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

  const handleSexagemChange = (receptoraId: string, index: number, value: ResultadoSexagem | '') => {
    setFormData(prev => {
      const dados = prev[receptoraId] || { data_sexagem: hoje, sexagens: [], observacoes: '' };
      const novasSexagens = [...dados.sexagens];
      novasSexagens[index] = value;
      return {
        ...prev,
        [receptoraId]: { ...dados, sexagens: novasSexagens },
      };
    });
  };

  const handleFieldChange = (receptoraId: string, field: 'data_sexagem' | 'observacoes', value: string) => {
    setFormData(prev => ({
      ...prev,
      [receptoraId]: { ...prev[receptoraId], [field]: value },
    }));
  };

  const calcularStatusFinal = (sexagens: string[]): 'PRENHE_FEMEA' | 'PRENHE_MACHO' | 'PRENHE_SEM_SEXO' | 'PRENHE_2_SEXOS' | 'VAZIA' => {
    const sexagensValidas = sexagens.filter(s => s && s !== 'VAZIA');

    if (sexagensValidas.length === 0) return 'VAZIA';

    const temFemea = sexagensValidas.includes('FEMEA');
    const temMacho = sexagensValidas.includes('MACHO');
    const temSemSexo = sexagensValidas.includes('SEM_SEXO');

    if (temFemea && !temMacho && !temSemSexo) return 'PRENHE_FEMEA';
    if (temMacho && !temFemea && !temSemSexo) return 'PRENHE_MACHO';
    if (temFemea && temMacho) return 'PRENHE_2_SEXOS';
    return 'PRENHE_SEM_SEXO';
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
      return !dados || !dados.data_sexagem || !dados.sexagens || dados.sexagens.every(s => !s);
    });

    if (receptorasSemResultado.length > 0) {
      toast({
        title: 'Erro de validação',
        description: `Há ${receptorasSemResultado.length} receptora(s) sem sexagem definida`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const diagnosticosParaInserir: DiagnosticoGestacaoInsert[] = [];
      const diagnosticosParaAtualizar: DiagnosticoGestacaoUpdate[] = [];
      const atualizacoesStatus: Array<{ receptora_id: string; status: string }> = [];

      receptoras.forEach(receptora => {
        const dados = formData[receptora.receptora_id];
        if (!dados || !dados.data_sexagem) return;

        const sexagensValidas = dados.sexagens.filter(s => s && s !== 'VAZIA');
        const statusFinal = calcularStatusFinal(dados.sexagens);
        const resultadoFinal = statusFinal === 'VAZIA' ? 'VAZIA' : 'PRENHE';

        let sexagemValue: string | null = null;
        if (resultadoFinal === 'PRENHE') {
          const temApenasFemeas = sexagensValidas.every(s => s === 'FEMEA') && sexagensValidas.length > 0;
          const temApenasMachos = sexagensValidas.every(s => s === 'MACHO') && sexagensValidas.length > 0;

          if (temApenasFemeas) {
            sexagemValue = 'FEMEA';
          } else if (temApenasMachos) {
            sexagemValue = 'MACHO';
          } else {
            sexagemValue = sexagensValidas.find(s => s === 'FEMEA' || s === 'MACHO') || null;
          }
        }

        if (sexagemValue === 'PRENHE' || sexagemValue === 'SEM_SEXO') {
          const primeiraFemeaOuMacho = sexagensValidas.find(s => s === 'FEMEA' || s === 'MACHO');
          sexagemValue = primeiraFemeaOuMacho || null;
        }

        const numeroGestacoes = resultadoFinal === 'VAZIA' ? 0 : sexagensValidas.length;

        let observacoesComSexagens = dados.observacoes?.trim() || '';
        const todasSexagens = dados.sexagens.filter(s => s);
        const sexagensDetalhadas = todasSexagens.length > 0 ? todasSexagens.join(',') : '';

        if (sexagensDetalhadas) {
          if (!observacoesComSexagens.includes('SEXAGENS:')) {
            observacoesComSexagens = observacoesComSexagens
              ? `SEXAGENS:${sexagensDetalhadas}|${observacoesComSexagens}`
              : `SEXAGENS:${sexagensDetalhadas}`;
          } else {
            observacoesComSexagens = observacoesComSexagens.replace(
              /SEXAGENS:[^|]+/,
              `SEXAGENS:${sexagensDetalhadas}`
            );
          }
        }

        const insertData: DiagnosticoGestacaoInsert = {
          receptora_id: receptora.receptora_id,
          data_te: receptora.data_te,
          tipo_diagnostico: 'SEXAGEM',
          data_diagnostico: dados.data_sexagem,
          resultado: resultadoFinal,
          sexagem: sexagemValue,
          numero_gestacoes: numeroGestacoes,
          observacoes: observacoesComSexagens || undefined,
          veterinario_responsavel: loteFormData.veterinario_responsavel?.trim() || undefined,
          tecnico_responsavel: loteFormData.tecnico_responsavel?.trim() || undefined,
        };

        if (receptora.diagnostico_existente) {
          diagnosticosParaAtualizar.push({ id: receptora.diagnostico_existente.id, ...insertData });
        } else {
          diagnosticosParaInserir.push(insertData);
        }

        atualizacoesStatus.push({
          receptora_id: receptora.receptora_id,
          status: statusFinal,
        });
      });

      if (diagnosticosParaInserir.length > 0) {
        const { error: insertError } = await supabase
          .from('diagnosticos_gestacao')
          .insert(diagnosticosParaInserir);

        if (insertError) {
          throw new Error(`Erro ao inserir sexagens: ${insertError.message}`);
        }
      }

      for (const dg of diagnosticosParaAtualizar) {
        const { id, ...updateData } = dg;
        const { error: updateError } = await supabase
          .from('diagnosticos_gestacao')
          .update(updateData)
          .eq('id', id);

        if (updateError) {
          throw new Error(`Erro ao atualizar sexagem: ${updateError.message}`);
        }
      }

      for (const atualizacao of atualizacoesStatus) {
        const { error: statusError } = await atualizarStatusReceptora(
          atualizacao.receptora_id,
          atualizacao.status as StatusReceptora
        );
        if (statusError) {
          throw new Error(`Erro ao atualizar status da receptora`);
        }
        if (atualizacao.status === 'VAZIA') {
          await supabase
            .from('receptoras')
            .update({ data_provavel_parto: null })
            .eq('id', atualizacao.receptora_id);
        }
      }

      const todasComSexagem = receptoras.every(r => {
        const dados = formData[r.receptora_id];
        return dados && dados.data_sexagem && dados.sexagens && dados.sexagens.some(s => s);
      });

      setLoteSelecionado({
        ...loteSelecionado,
        veterinario_sexagem: loteFormData.veterinario_responsavel.trim(),
        tecnico_sexagem: loteFormData.tecnico_responsavel.trim(),
        status: todasComSexagem ? 'FECHADO' : 'ABERTO',
      });

      toast({
        title: 'Lote salvo com sucesso',
        description: `${receptoras.length} sexagem(ns) registrada(s)`,
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

  const todasReceptorasComSexagem = receptoras.every(r => {
    const dados = formData[r.receptora_id];
    return dados && dados.data_sexagem && dados.sexagens && dados.sexagens.some(s => s);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sexagem"
        description="Registrar sexagem fetal por lote de receptoras prenhes"
      />

      <FazendaSelector
        fazendas={fazendas}
        fazendaSelecionada={fazendaSelecionada}
        onFazendaChange={setFazendaSelecionada}
      />

      {fazendaSelecionada && (
        <LotesTable
          title="Lotes de Receptoras Prenhes"
          emptyTitle="Nenhum lote de receptoras prenhes encontrado"
          emptyDescription="Selecione outra fazenda ou verifique se há receptoras prenhes registradas."
          lotesTE={lotesTE}
          loteSelecionado={loteSelecionado}
          loading={loadingLotes}
          veterinarioLabel="Vet. Sexagem"
          tecnicoLabel="Téc. Sexagem"
          getVeterinario={(l) => l.veterinario_sexagem}
          getTecnico={(l) => l.tecnico_sexagem}
          onSelectLote={setLoteSelecionado}
        />
      )}

      {loteSelecionado && abrirLote && (
        <AbrirLoteForm
          title="Abrir Lote de Sexagem"
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
              veterinarioLabel="Veterinário Responsável (Sexagem)"
              tecnicoLabel="Técnico Responsável (Sexagem)"
              onSalvarLote={handleSalvarLote}
              submitting={submitting}
              canSave={todasReceptorasComSexagem}
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
                      <TableHead>Nº Gest.</TableHead>
                      <TableHead>Data Sexagem</TableHead>
                      <TableHead>Sexagens</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receptoras.map((receptora) => {
                      const dados = formData[receptora.receptora_id] || {
                        data_sexagem: hoje,
                        sexagens: new Array(receptora.numero_gestacoes).fill('').map(() => ''),
                        observacoes: '',
                      };
                      const temSexagem = !!receptora.diagnostico_existente;

                      return (
                        <TableRow key={receptora.receptora_id}>
                          <TableCell className="font-medium">
                            {receptora.brinco}
                            {receptora.nome && (
                              <span className="text-slate-500 text-sm ml-2">({receptora.nome})</span>
                            )}
                            {temSexagem && (
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
                          <TableCell className="font-medium text-center">
                            {receptora.numero_gestacoes}
                          </TableCell>
                          <TableCell>
                            <DatePickerBR
                              value={dados.data_sexagem}
                              onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_sexagem', value || '')}
                              className="w-36"
                              disabled={loteSelecionado.status === 'FECHADO'}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {Array.from({ length: receptora.numero_gestacoes }, (_, index) => {
                                const valorAtual = dados.sexagens[index] || '';
                                const placeholder = receptora.numero_gestacoes > 1 ? `Gest. ${index + 1}` : 'Selecione';

                                return (
                                  <Select
                                    key={index}
                                    value={valorAtual}
                                    onValueChange={(value) => handleSexagemChange(receptora.receptora_id, index, value as ResultadoSexagem | '')}
                                    disabled={loteSelecionado.status === 'FECHADO'}
                                  >
                                    <SelectTrigger className="w-28">
                                      <SelectValue placeholder={placeholder} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="FEMEA">Fêmea</SelectItem>
                                      <SelectItem value="MACHO">Macho</SelectItem>
                                      <SelectItem value="SEM_SEXO">Sem sexo</SelectItem>
                                      <SelectItem value="VAZIA">Vazia</SelectItem>
                                    </SelectContent>
                                  </Select>
                                );
                              })}
                            </div>
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
