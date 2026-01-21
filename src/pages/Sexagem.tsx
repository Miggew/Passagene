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
import { Baby, Lock, CheckCircle } from 'lucide-react';
import { atualizarStatusReceptora, validarTransicaoStatus, calcularStatusReceptora } from '@/lib/receptoraStatus';
import DatePickerBR from '@/components/shared/DatePickerBR';

interface LoteTE {
  id: string;
  fazenda_id: string;
  fazenda_nome: string;
  data_te: string;
  quantidade_receptoras: number;
  veterinario_sexagem?: string;
  tecnico_sexagem?: string;
  status: 'ABERTO' | 'FECHADO';
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

interface ReceptoraPrenhe {
  receptora_id: string;
  brinco: string;
  nome?: string;
  data_te: string;
  embrioes: EmbriaoTransferido[];
  data_abertura_lote: string;
  dias_gestacao: number;
  numero_gestacoes: number; // Do diagnóstico de gestação
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
    sexagens: string[]; // Array de resultados: ['FEMEA', 'MACHO'], ['FEMEA', 'SEM_SEXO'], etc.
    observacoes: string;
  };
}

type ResultadoSexagem = 'FEMEA' | 'MACHO' | 'SEM_SEXO' | 'VAZIA';

export default function Sexagem() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [fazendaSelecionada, setFazendaSelecionada] = useState<string>('');
  const [lotesTE, setLotesTE] = useState<LoteTE[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState<LoteTE | null>(null);
  const [receptoras, setReceptoras] = useState<ReceptoraPrenhe[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [abrirLote, setAbrirLote] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<SexagemFormData>({});
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
        .order('nome');

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

      // 1. Buscar receptoras PRENHES da fazenda
      const { data: viewData } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      const { data: receptorasData } = await supabase
        .from('receptoras')
        .select('id')
        .in('id', receptoraIds)
        .in('status_reprodutivo', ['PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS']);

      const prenhesIds = receptorasData?.map(r => r.id) || [];

      // 2. Buscar TEs dessas receptoras prenhes
      const { data: teData } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, data_te')
        .in('receptora_id', prenhesIds)
        .eq('status_te', 'REALIZADA')
        .order('data_te', { ascending: false });

      // 3. Buscar sexagens existentes
      const { data: sexagensData } = await supabase
        .from('diagnosticos_gestacao')
        .select('receptora_id, data_te, veterinario_responsavel, tecnico_responsavel, data_diagnostico')
        .in('receptora_id', prenhesIds)
        .eq('tipo_diagnostico', 'SEXAGEM')
        .order('data_diagnostico', { ascending: false });

      // 4. Agrupar por fazenda + data_te
      const lotesMap = new Map<string, LoteTE>();
      const receptorasPorData = new Map<string, Set<string>>();

      teData?.forEach(te => {
        const chave = `${fazendaId}-${te.data_te}`;
        const chaveReceptora = `${te.data_te}-${te.receptora_id}`;

        if (!receptorasPorData.has(te.data_te)) {
          receptorasPorData.set(te.data_te, new Set());
        }
        receptorasPorData.get(te.data_te)!.add(te.receptora_id);

        if (!lotesMap.has(chave)) {
          const sexagemLote = sexagensData?.find(s => s.data_te === te.data_te);
          lotesMap.set(chave, {
            id: chave,
            fazenda_id: fazendaId,
            fazenda_nome: fazendas.find(f => f.id === fazendaId)?.nome || '',
            data_te: te.data_te,
            quantidade_receptoras: 0,
            veterinario_sexagem: sexagemLote?.veterinario_responsavel || undefined,
            tecnico_sexagem: sexagemLote?.tecnico_responsavel || undefined,
            status: 'ABERTO',
          });
        }
      });

      lotesMap.forEach((lote) => {
        const receptorasUnicas = receptorasPorData.get(lote.data_te)?.size || 0;
        lote.quantidade_receptoras = receptorasUnicas;

        const sexagensDoLote = sexagensData?.filter(s => s.data_te === lote.data_te) || [];
        if (sexagensDoLote.length > 0 && sexagensDoLote.length >= receptorasUnicas) {
          lote.status = 'FECHADO';
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

    const loteAtualizado: LoteTE = {
      ...loteSelecionado,
      veterinario_sexagem: loteFormData.veterinario_responsavel.trim(),
      tecnico_sexagem: loteFormData.tecnico_responsavel.trim(),
      status: 'ABERTO',
    };

    setLoteSelecionado(loteAtualizado);
    setAbrirLote(false);
    await loadReceptorasLote(loteAtualizado);
  };

  const loadReceptorasLote = async (lote: LoteTE) => {
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
        .in('status_reprodutivo', ['PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS']);

      const prenhesIds = receptorasData?.map(r => r.id) || [];

      if (prenhesIds.length === 0) {
        setReceptoras([]);
        return;
      }

      // Executar queries independentes em paralelo
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

      const loteIds = [...new Set(Array.from(embrioesMap.values()).map((e: any) => e.lote_fiv_id).filter(Boolean))];
      const acasalamentoIds = [...new Set(
        Array.from(embrioesMap.values())
          .map((e: any) => e.lote_fiv_acasalamento_id)
          .filter(Boolean)
      )];

      // Executar queries de lotes e acasalamentos em paralelo
      const [lotesResult, acasalamentosResult] = await Promise.all([
        loteIds.length > 0 
          ? supabase
              .from('lotes_fiv')
              .select('id, data_abertura')
              .in('id', loteIds)
          : Promise.resolve({ data: null }),
        acasalamentoIds.length > 0
          ? supabase
              .from('lote_fiv_acasalamentos')
              .select('id, aspiracao_doadora_id, dose_semen_id')
              .in('id', acasalamentoIds)
          : Promise.resolve({ data: null }),
      ]);

      const lotesData = lotesResult.data || [];
      const acasalamentosData = acasalamentosResult.data || [];

      const lotesMap = new Map(lotesData.map((l: any) => [l.id, l]));

      let doadorasMap = new Map<string, string>();
      let tourosMap = new Map<string, string>();

      if (acasalamentosData.length > 0) {
        const aspiracaoIds = [...new Set(acasalamentosData.map((a: any) => a.aspiracao_doadora_id).filter(Boolean))];
        const doseIds = [...new Set(acasalamentosData.map((a: any) => a.dose_semen_id).filter(Boolean))];

        // Executar queries de aspirações e doses em paralelo
        const [aspiracoesResult, dosesResult] = await Promise.all([
          aspiracaoIds.length > 0
            ? supabase
                .from('aspiracoes_doadoras')
                .select('id, doadora_id')
                .in('id', aspiracaoIds)
            : Promise.resolve({ data: null }),
          doseIds.length > 0
            ? supabase
                .from('doses_semen')
                .select(`
                  id,
                  touro_id,
                  touro:touros(id, nome, registro, raca)
                `)
                .in('id', doseIds)
            : Promise.resolve({ data: null }),
        ]);

        const aspiracoesData = aspiracoesResult.data || [];
        const dosesData = dosesResult.data || [];

        if (aspiracoesData.length > 0) {
          const doadoraIds = [...new Set(aspiracoesData.map((a: any) => a.doadora_id))];
          if (doadoraIds.length > 0) {
            const { data: doadorasData } = await supabase
              .from('doadoras')
              .select('id, registro')
              .in('id', doadoraIds);

            if (doadorasData) {
              const doadoraMap = new Map(doadorasData.map(d => [d.id, d.registro]));
              const aspiracaoDoadoraMap = new Map(aspiracoesData.map((a: any) => [a.id, a.doadora_id]));
              
              // Criar mapa de doses para touros (extrair nome do touro relacionado)
              const tourosMap = new Map<string, string>();
              if (dosesData) {
                (dosesData as any[]).forEach((d: any) => {
                  const touro = d.touro;
                  tourosMap.set(d.id, touro?.nome || 'Touro desconhecido');
                });
              }

              acasalamentosData.forEach((ac: any) => {
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

        if (dosesData && dosesData.length > 0) {
          // Extrair nome do touro relacionado
          (dosesData as any[]).forEach((d: any) => {
            const touro = d.touro;
            tourosMap.set(d.id, touro?.nome || 'Touro desconhecido');
          });

          acasalamentosData.forEach((ac: any) => {
            if (ac.dose_semen_id) {
              const touroNome = tourosMap.get(ac.dose_semen_id);
              if (touroNome) {
                tourosMap.set(ac.id, touroNome);
              }
            }
          });
        }
      }

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

      tesPorReceptora.forEach((tes, chave) => {
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

        const diagnostico = diagnosticosPorReceptora.get(primeiraTE.receptora_id);
        if (!diagnostico || diagnostico.resultado === 'VAZIA') return; // Só receptoras prenhes

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
          // Se já tem sexagem, buscar os dados completos da sexagem para parsear
          const sexagemCompleta = sexagensPorReceptora.get(r.receptora_id);
          
          // Tentar recuperar as sexagens individuais
          // As sexagens detalhadas estão salvas nas observações no formato: "SEXAGENS:FEMEA,MACHO|observações normais"
          let sexagensParsed: string[] = new Array(r.numero_gestacoes).fill('').map(() => '');
          let observacoesLimpa = r.diagnostico_existente.observacoes || '';
          
          if (sexagemCompleta?.observacoes) {
            // Procurar padrão "SEXAGENS:..." nas observações
            const matchSexagens = sexagemCompleta.observacoes.match(/SEXAGENS:([^|]+)/);
            if (matchSexagens) {
              // Parsear sexagens separadas por vírgula
              const sexagensArray = matchSexagens[1].split(',').map(s => s.trim());
              sexagensParsed = sexagensArray;
              
              // Garantir que o array tenha o tamanho correto
              while (sexagensParsed.length < r.numero_gestacoes) {
                sexagensParsed.push('');
              }
              sexagensParsed = sexagensParsed.slice(0, r.numero_gestacoes);
              
              // Remover "SEXAGENS:..." das observações para mostrar apenas observações normais
              observacoesLimpa = sexagemCompleta.observacoes.replace(/SEXAGENS:[^|]+\|?/, '').trim();
            }
          }
          
          // Se não encontrou nas observações, tentar usar a coluna sexagem (valor único)
          if (sexagensParsed.every(s => !s) && sexagemCompleta?.sexagem) {
            // Se é um valor único, usar para todas as gestações
            // Mas isso não é ideal, apenas como fallback
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
        [receptoraId]: {
          ...dados,
          sexagens: novasSexagens,
        },
      };
    });
  };

  const handleFieldChange = (receptoraId: string, field: 'data_sexagem' | 'observacoes', value: string) => {
    setFormData(prev => ({
      ...prev,
      [receptoraId]: {
        ...prev[receptoraId],
        [field]: value,
      },
    }));
  };

  // Calcular status final baseado nas sexagens
  const calcularStatusFinal = (sexagens: string[], numeroGestacoes: number): 'PRENHE_FEMEA' | 'PRENHE_MACHO' | 'PRENHE_SEM_SEXO' | 'PRENHE_2_SEXOS' | 'VAZIA' => {
    const sexagensValidas = sexagens.filter(s => s && s !== 'VAZIA');
    
    if (sexagensValidas.length === 0) {
      return 'VAZIA';
    }

    const temFemea = sexagensValidas.includes('FEMEA');
    const temMacho = sexagensValidas.includes('MACHO');
    const temSemSexo = sexagensValidas.includes('SEM_SEXO');

    // Se tem apenas fêmeas
    if (temFemea && !temMacho && !temSemSexo) {
      return 'PRENHE_FEMEA';
    }

    // Se tem apenas machos
    if (temMacho && !temFemea && !temSemSexo) {
      return 'PRENHE_MACHO';
    }

    // Se tem fêmea + macho (2 sexos diferentes)
    if (temFemea && temMacho) {
      return 'PRENHE_2_SEXOS';
    }

    // Se tem sem sexo (não foi possível visualizar)
    return 'PRENHE_SEM_SEXO';
  };

  const handleSalvarLote = async () => {
    if (!loteSelecionado) return;

    if (!loteFormData.veterinario_responsavel.trim() || !loteFormData.tecnico_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário e técnico responsáveis são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const receptorasSemResultado = receptoras.filter(r => {
      const dados = formData[r.receptora_id];
      return !dados || !dados.data_sexagem || !dados.sexagens || dados.sexagens.length === 0 || dados.sexagens.every(s => !s);
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

      const diagnosticosParaInserir: any[] = [];
      const diagnosticosParaAtualizar: any[] = [];
      const atualizacoesStatus: Array<{ receptora_id: string; status: string }> = [];

      receptoras.forEach(receptora => {
        const dados = formData[receptora.receptora_id];
        if (!dados || !dados.data_sexagem) return;

        // Filtrar sexagens válidas (não vazias)
        const sexagensValidas = dados.sexagens.filter(s => s && s !== 'VAZIA');
        const todasVazias = dados.sexagens.every(s => !s || s === 'VAZIA');
        
        const statusFinal = calcularStatusFinal(dados.sexagens, receptora.numero_gestacoes);
        // Status pode ser VAZIA, PRENHE_FEMEA, PRENHE_MACHO, PRENHE_SEM_SEXO ou PRENHE_2_SEXOS
        const resultadoFinal = statusFinal === 'VAZIA' ? 'VAZIA' : 'PRENHE';

        // O campo sexagem aceita apenas um valor: 'FEMEA', 'MACHO', ou 'PRENHE' (sem sexo)
        // A constraint provavelmente exige que se numero_gestacoes > 1 e sexagem = 'PRENHE', 
        // isso não é permitido. Então quando há múltiplas gestações com sexagens diferentes,
        // precisamos escolher o valor mais representativo ou usar null.
        let sexagemValue: string | null = null;
        if (resultadoFinal === 'PRENHE') {
          const temApenasFemeas = sexagensValidas.every(s => s === 'FEMEA') && sexagensValidas.length > 0;
          const temApenasMachos = sexagensValidas.every(s => s === 'MACHO') && sexagensValidas.length > 0;
          const temFemeaEMacho = sexagensValidas.includes('FEMEA') && sexagensValidas.includes('MACHO');
          const temSemSexo = sexagensValidas.includes('SEM_SEXO');
          
          if (temApenasFemeas) {
            sexagemValue = 'FEMEA';
          } else if (temApenasMachos) {
            sexagemValue = 'MACHO';
          } else if (temFemeaEMacho) {
            // Tem fêmea + macho: quando há 2 gestações de sexos diferentes,
            // usar a primeira sexagem válida (FEMEA geralmente vem primeiro)
            // A constraint pode exigir que sexagem não seja null quando resultado = 'PRENHE'
            sexagemValue = sexagensValidas[0] || 'FEMEA';
          } else if (temSemSexo) {
            // Tem sem sexo: a constraint pode não permitir 'PRENHE' no campo sexagem
            // quando tipo_diagnostico = 'SEXAGEM'. Vamos usar null ou o primeiro valor não-SEM_SEXO
            // Se todas são SEM_SEXO, usar null (pode não ser permitido, então usar FEMEA como fallback)
            const primeiraNaoSemSexo = sexagensValidas.find(s => s !== 'SEM_SEXO');
            sexagemValue = primeiraNaoSemSexo || null;
            // Se null e constraint não permitir, usar 'FEMEA' como fallback genérico
          } else if (sexagensValidas.length > 0) {
            // Outra combinação: usar primeira sexagem válida que seja FEMEA ou MACHO
            // NÃO usar valores que possam violar constraint ('SEM_SEXO', 'PRENHE')
            sexagemValue = sexagensValidas.find(s => s === 'FEMEA' || s === 'MACHO') || null;
          } else {
            // Sem sexagens válidas: usar null
            sexagemValue = null;
          }
        }

        // Numero de gestações: usar número de sexagens válidas (sem contar VAZIA)
        // Se VAZIA, usar 0; se PRENHE, usar número de sexagens válidas
        const numeroGestacoes = resultadoFinal === 'VAZIA' ? 0 : sexagensValidas.length;
        
        // AJUSTE CRÍTICO: A constraint diagnosticos_regras_chk NÃO permite 'PRENHE' ou 'SEM_SEXO'
        // no campo sexagem quando tipo_diagnostico = 'SEXAGEM'
        // O campo sexagem só aceita 'FEMEA', 'MACHO', ou null
        // Garantir que nunca usamos valores inválidos
        if (sexagemValue === 'PRENHE' || sexagemValue === 'SEM_SEXO') {
          // Converter valores inválidos para primeiro valor válido ou null
          const primeiraFemeaOuMacho = sexagensValidas.find(s => s === 'FEMEA' || s === 'MACHO');
          sexagemValue = primeiraFemeaOuMacho || null;
        }
        
        // Se resultado é PRENHE mas sexagem ainda é null (caso de apenas SEM_SEXO),
        // a constraint pode exigir um valor. Nesse caso, não podemos usar 'PRENHE'.
        // Vamos deixar null e ver se a constraint aceita, mas se não aceitar,
        // pode ser necessário usar 'FEMEA' como fallback genérico

        // Salvar sexagens detalhadas nas observações (formato: "SEXAGENS:FEMEA,MACHO|observações normais")
        // Isso permite recuperar todas as sexagens individuais ao carregar depois
        let observacoesComSexagens = dados.observacoes ? dados.observacoes.trim() : '';
        
        // Criar string com TODAS as sexagens (incluindo VAZIA e SEM_SEXO) para salvar
        const todasSexagens = dados.sexagens.map(s => s || '').filter(s => s); // Remove vazios mas mantém valores
        const sexagensDetalhadas = todasSexagens.length > 0 ? todasSexagens.join(',') : '';
        
        if (sexagensDetalhadas) {
          // Adicionar sexagens detalhadas nas observações se não estiverem lá
          // Formato: "SEXAGENS:FEMEA,MACHO|observações normais"
          if (!observacoesComSexagens.includes('SEXAGENS:')) {
            observacoesComSexagens = observacoesComSexagens 
              ? `SEXAGENS:${sexagensDetalhadas}|${observacoesComSexagens}`
              : `SEXAGENS:${sexagensDetalhadas}`;
          } else {
            // Se já tem SEXAGENS:, atualizar
            observacoesComSexagens = observacoesComSexagens.replace(
              /SEXAGENS:[^|]+/,
              `SEXAGENS:${sexagensDetalhadas}`
            );
          }
        }

        const insertData: any = {
          receptora_id: receptora.receptora_id,
          data_te: receptora.data_te,
          tipo_diagnostico: 'SEXAGEM',
          data_diagnostico: dados.data_sexagem,
          resultado: resultadoFinal,
          sexagem: sexagemValue, // Valor único para constraint (FEMEA, MACHO ou null)
          numero_gestacoes: numeroGestacoes,
          observacoes: observacoesComSexagens || null,
        };

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

        atualizacoesStatus.push({
          receptora_id: receptora.receptora_id,
          status: statusFinal,
        });
      });

      // Inserir/atualizar diagnósticos (lógica similar ao DG)
      if (diagnosticosParaInserir.length > 0) {
        const { error: insertError } = await supabase
          .from('diagnosticos_gestacao')
          .insert(diagnosticosParaInserir);

        if (insertError) {
          console.error('Erro ao inserir sexagens:', insertError);
          throw new Error(`Erro ao inserir sexagens: ${insertError.message}`);
        }
      }

      if (diagnosticosParaAtualizar.length > 0) {
        for (const dg of diagnosticosParaAtualizar) {
          const { id, ...updateData } = dg;
          const { error: updateError } = await supabase
            .from('diagnosticos_gestacao')
            .update(updateData)
            .eq('id', id);

          if (updateError) {
            console.error('Erro ao atualizar sexagem:', updateError);
            throw new Error(`Erro ao atualizar sexagem: ${updateError.message}`);
          }
        }
      }

      // Atualizar status das receptoras
      for (const atualizacao of atualizacoesStatus) {
        await atualizarStatusReceptora(atualizacao.receptora_id, atualizacao.status as any);
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

      await loadLotesTE(fazendaSelecionada);
      if (loteSelecionado) {
        await loadReceptorasLote(loteSelecionado);
      }
    } catch (error) {
      console.error('Erro detalhado ao salvar lote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao salvar lote',
        description: errorMessage,
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
            <CardTitle>Lotes de Receptoras Prenhes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSpinner />
            ) : lotesTE.length === 0 ? (
              <EmptyState
                title="Nenhum lote de receptoras prenhes encontrado"
                description="Selecione outra fazenda ou verifique se há receptoras prenhes registradas."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data TE</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Vet. Sexagem</TableHead>
                    <TableHead>Téc. Sexagem</TableHead>
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
                      <TableCell>{lote.veterinario_sexagem || '-'}</TableCell>
                      <TableCell>{lote.tecnico_sexagem || '-'}</TableCell>
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
            <CardTitle>Abrir Lote de Sexagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              Lote de TE em {new Date(loteSelecionado.data_te).toLocaleDateString('pt-BR')} - {loteSelecionado.quantidade_receptoras} receptoras prenhes
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
                  Receptoras Prenhes do Lote - {receptoras.length} {receptoras.length === 1 ? 'receptora' : 'receptoras'}
                  {loteSelecionado.status === 'FECHADO' && (
                    <span className="ml-2 text-sm text-slate-500">(Lote Fechado - Somente Leitura)</span>
                  )}
                </CardTitle>
                {loteSelecionado.status === 'ABERTO' && (
                  <Button
                    onClick={handleSalvarLote}
                    disabled={!todasReceptorasComSexagem || submitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {submitting ? 'Salvando...' : 'Salvar Lote Completo'}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="veterinario_sexagem">Veterinário Responsável (Sexagem) *</Label>
                  <Input
                    id="veterinario_sexagem"
                    value={loteFormData.veterinario_responsavel}
                    onChange={(e) => setLoteFormData({ ...loteFormData, veterinario_responsavel: e.target.value })}
                    placeholder="Nome do veterinário"
                    disabled={loteSelecionado.status === 'FECHADO'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tecnico_sexagem">Técnico Responsável (Sexagem) *</Label>
                  <Input
                    id="tecnico_sexagem"
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
                                const temValor = valorAtual !== '';
                                // Só mostrar número se houver mais de uma gestação
                                const placeholder = temValor 
                                  ? undefined 
                                  : receptora.numero_gestacoes > 1 
                                    ? `Gest. ${index + 1}` 
                                    : 'Selecione';
                                
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
