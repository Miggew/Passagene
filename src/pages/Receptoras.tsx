import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Receptora, Fazenda, ReceptoraComStatus } from '@/lib/types';
import { calcularStatusReceptoras } from '@/lib/receptoraStatus';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StatusBadge from '@/components/shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Search, History, ArrowRight } from 'lucide-react';
import ReceptoraHistorico from './ReceptoraHistorico';
import { formatStatusLabel } from '@/lib/statusLabels';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Receptoras() {
  const [receptoras, setReceptoras] = useState<ReceptoraComStatus[]>([]);
  const [filteredReceptoras, setFilteredReceptoras] = useState<ReceptoraComStatus[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [selectedFazendaId, setSelectedFazendaId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('all');
  const [statusDisponiveis, setStatusDisponiveis] = useState<string[]>([]);
  const [loadingFazendas, setLoadingFazendas] = useState(true);
  const [loadingReceptoras, setLoadingReceptoras] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMoverFazendaDialog, setShowMoverFazendaDialog] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [selectedReceptoraId, setSelectedReceptoraId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittingMover, setSubmittingMover] = useState(false);
  const [editingReceptora, setEditingReceptora] = useState<Receptora | null>(null);
  const [novaFazendaId, setNovaFazendaId] = useState<string>('');
  const [novoBrincoProposto, setNovoBrincoProposto] = useState<string>('');
  const [temConflitoBrinco, setTemConflitoBrinco] = useState(false);
  const [temConflitoNome, setTemConflitoNome] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    identificacao: '',
    nome: '',
  });

  const [editFormData, setEditFormData] = useState({
    identificacao: '',
    nome: '',
  });

  useEffect(() => {
    loadFazendas();
  }, []);

  useEffect(() => {
    if (selectedFazendaId) {
      loadReceptoras();
    } else {
      setReceptoras([]);
      setFilteredReceptoras([]);
    }
  }, [selectedFazendaId]);

  useEffect(() => {
    filterReceptoras();
  }, [searchTerm, filtroStatus, receptoras]);

  const filterReceptoras = () => {
    let filtered = receptoras;

    // Aplicar filtro de status
    if (filtroStatus !== 'all') {
      filtered = filtered.filter((r) => r.status_calculado === filtroStatus);
    }

    // Aplicar busca por nome/brinco
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.identificacao.toLowerCase().includes(term) ||
          r.nome?.toLowerCase().includes(term)
      );
    }

    setFilteredReceptoras(filtered);
  };

  const formatarDataBR = (iso?: string | null) => {
    if (!iso) return '';
    try {
      // data_provavel_parto normalmente vem como YYYY-MM-DD
      const d = parseISO(iso);
      if (Number.isNaN(d.getTime())) return '';
      return format(d, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '';
    }
  };

  const loadFazendas = async () => {
    try {
      setLoadingFazendas(true);
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingFazendas(false);
    }
  };

  const loadReceptoras = async () => {
    try {
      setLoadingReceptoras(true);

      // Usar view vw_receptoras_fazenda_atual para filtrar por fazenda atual
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_nome_atual')
        .eq('fazenda_id_atual', selectedFazendaId);

      if (viewError) throw viewError;

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIds.length === 0) {
        setReceptoras([]);
        setFilteredReceptoras([]);
        setStatusDisponiveis([]);
        return;
      }

      // Buscar dados completos das receptoras usando os IDs da view
      const { data, error } = await supabase
        .from('receptoras')
        .select('*')
        .in('id', receptoraIds)
        .order('identificacao', { ascending: true });
      
      if (error) throw error;
      
      const fazendaMap = new Map(viewData?.map(v => [v.receptora_id, v.fazenda_nome_atual]) || []);
      
      // Combinar dados
      const receptorasData = (data || []).map(r => ({
        ...r,
        fazenda_nome_atual: fazendaMap.get(r.id),
      }));

      // Calculate status for all receptoras
      const receptoraIdsForStatus = receptorasData.map(r => r.id);
      const statusMap = await calcularStatusReceptoras(receptoraIdsForStatus);

      const receptorasComStatus: ReceptoraComStatus[] = receptorasData.map(r => ({
        ...r,
        status_calculado: statusMap.get(r.id) || 'VAZIA',
      }));

      // Buscar número de gestações e recalcular data de parto para receptoras prenhes
      const statusPrenhes = ['PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS'];
      const receptorasPrenhes = receptorasComStatus.filter(r => 
        statusPrenhes.includes(r.status_calculado) || 
        r.status_calculado.includes('PRENHE')
      );

      if (receptorasPrenhes.length > 0) {
        const prenhesIds = receptorasPrenhes.map(r => r.id);
        
        // Buscar diagnósticos de gestação com número de gestações
        const { data: diagnosticosData, error: diagnosticosError } = await supabase
          .from('diagnosticos_gestacao')
          .select('receptora_id, numero_gestacoes')
          .in('receptora_id', prenhesIds)
          .in('resultado', ['PRENHE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS'])
          .not('numero_gestacoes', 'is', null);

        if (!diagnosticosError && diagnosticosData) {
          // Criar mapa de número de gestações por receptora
          const gestacoesMap = new Map<string, number>();
          
          diagnosticosData.forEach(dg => {
            if (dg.numero_gestacoes && dg.numero_gestacoes > 1) {
              // Se já existe um valor, usar o maior
              const atual = gestacoesMap.get(dg.receptora_id) || 0;
              if (dg.numero_gestacoes > atual) {
                gestacoesMap.set(dg.receptora_id, dg.numero_gestacoes);
              }
            }
          });

          // Adicionar número de gestações às receptoras
          receptorasComStatus.forEach(r => {
            const numGestacoes = gestacoesMap.get(r.id);
            if (numGestacoes && numGestacoes > 1) {
              r.numero_gestacoes = numGestacoes;
            }
          });
        }

        // Recalcular data de parto baseado no D0 do embrião + 275 dias
        const { data: teData, error: teError } = await supabase
          .from('transferencias_embrioes')
          .select('receptora_id, embriao_id, data_te')
          .in('receptora_id', prenhesIds)
          .eq('status_te', 'REALIZADA')
          .order('data_te', { ascending: false });

        if (!teError && teData) {
          // Buscar embriões e lotes FIV para obter D0
          const embriaoIds = [...new Set(teData.map(te => te.embriao_id))];
          
          if (embriaoIds.length > 0) {
            const { data: embrioesData, error: embrioesError } = await supabase
              .from('embrioes')
              .select('id, lote_fiv_id')
              .in('id', embriaoIds);

            if (!embrioesError && embrioesData) {
              const loteFivIds = [...new Set(embrioesData.map(e => e.lote_fiv_id))];
              
              if (loteFivIds.length > 0) {
                const { data: lotesData, error: lotesError } = await supabase
                  .from('lotes_fiv')
                  .select('id, data_abertura')
                  .in('id', loteFivIds);

                if (!lotesError && lotesData) {
                  // Criar mapas para facilitar busca
                  const embriaoToLoteMap = new Map(embrioesData.map(e => [e.id, e.lote_fiv_id]));
                  const loteToD0Map = new Map(lotesData.map(l => [l.id, l.data_abertura]));
                  const receptoraToTeMap = new Map<string, typeof teData[0]>();
                  
                  // Pegar a TE mais recente de cada receptora
                  teData.forEach(te => {
                    if (!receptoraToTeMap.has(te.receptora_id)) {
                      receptoraToTeMap.set(te.receptora_id, te);
                    }
                  });

                  // Recalcular data de parto para cada receptora prenhe
                  receptorasComStatus.forEach(r => {
                    if (statusPrenhes.includes(r.status_calculado) || r.status_calculado.includes('PRENHE')) {
                      const te = receptoraToTeMap.get(r.id);
                      if (te) {
                        const loteFivId = embriaoToLoteMap.get(te.embriao_id);
                        if (loteFivId) {
                          const d0 = loteToD0Map.get(loteFivId);
                          if (d0) {
                            // Calcular data de parto: D0 + 275 dias
                            const d0Date = new Date(d0);
                            const dataPartoDate = new Date(d0Date);
                            dataPartoDate.setDate(dataPartoDate.getDate() + 275);
                            r.data_provavel_parto = dataPartoDate.toISOString().split('T')[0];
                          }
                        }
                      }
                    }
                  });
                }
              }
            }
          }
        }
      }

      // Extrair status únicos para o filtro
      const statusUnicos = Array.from(new Set(receptorasComStatus.map(r => r.status_calculado)))
        .filter(s => s) // Remove valores vazios
        .sort();

      setStatusDisponiveis(statusUnicos);
      setReceptoras(receptorasComStatus);
      setFilteredReceptoras(receptorasComStatus);
      setFiltroStatus('all'); // Reset filtro ao carregar nova fazenda
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingReceptoras(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFazendaId) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma fazenda primeiro',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Validar se já existe receptora com mesmo brinco na fazenda
      // Usar view para obter receptoras da fazenda atual diretamente
      const { data: receptorasView, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', selectedFazendaId);

      if (viewError) {
        console.error('Erro ao buscar receptoras da fazenda:', viewError);
        throw viewError;
      }

      const receptoraIds = receptorasView?.map(r => r.receptora_id) || [];
      
      // Verificar brinco duplicado - sempre verificar, mesmo se não houver receptoras ainda
      if (receptoraIds.length > 0) {
        const { data: receptorasComBrinco, error: brincoError } = await supabase
          .from('receptoras')
          .select('id, identificacao, nome')
          .in('id', receptoraIds)
          .ilike('identificacao', formData.identificacao.trim());

        if (brincoError) {
          console.error('Erro ao verificar brinco duplicado:', brincoError);
          throw brincoError;
        }

        if (receptorasComBrinco && receptorasComBrinco.length > 0) {
          const nomeReceptora = receptorasComBrinco[0].nome 
            ? `"${receptorasComBrinco[0].nome}"` 
            : 'sem nome';
          const erroMsg = `Já existe uma receptora com o brinco "${formData.identificacao.trim()}" nesta fazenda (Nome: ${nomeReceptora}).`;
          console.error('Brinco duplicado detectado:', erroMsg, receptorasComBrinco);
          throw new Error(erroMsg);
        }
      }

      // Validar se já existe receptora com mesmo nome na fazenda
      if (formData.nome.trim() && receptoraIds.length > 0) {
        const { data: receptorasComNome, error: nomeError } = await supabase
          .from('receptoras')
          .select('id, identificacao')
          .in('id', receptoraIds)
          .ilike('nome', formData.nome.trim());

        if (nomeError) {
          console.error('Erro ao verificar nome duplicado:', nomeError);
          throw nomeError;
        }

        if (receptorasComNome && receptorasComNome.length > 0) {
          throw new Error(`Já existe uma receptora com o nome "${formData.nome.trim()}" nesta fazenda (Brinco: ${receptorasComNome[0].identificacao}).`);
        }
      }

      const insertData: Record<string, string> = {
        identificacao: formData.identificacao,
      };

      if (formData.nome.trim()) {
        insertData.nome = formData.nome;
      }

      const { data: novaReceptora, error } = await supabase
        .from('receptoras')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
        }
        throw error;
      }

      // Inserir no histórico de fazendas (fonte oficial da fazenda atual)
      const { error: historicoError } = await supabase
        .from('receptora_fazenda_historico')
        .insert([{
          receptora_id: novaReceptora.id,
          fazenda_id: selectedFazendaId,
          data_inicio: new Date().toISOString().split('T')[0],
          data_fim: null, // vínculo ativo
        }]);

      if (historicoError) {
        console.error('Erro ao criar histórico de fazenda:', historicoError);
        // Não falhar - a migration SQL também migra automaticamente
      }

      toast({
        title: 'Receptora criada',
        description: 'Receptora criada com sucesso',
      });

      setShowDialog(false);
      setFormData({
        identificacao: '',
        nome: '',
      });
      loadReceptoras();
    } catch (error) {
      toast({
        title: 'Erro ao criar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (receptora: Receptora) => {
    setEditingReceptora(receptora);
    setEditFormData({
      identificacao: receptora.identificacao,
      nome: receptora.nome || '',
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingReceptora) return;

    if (!editFormData.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const brincoAnterior = editingReceptora.identificacao;
      const brincoNovo = editFormData.identificacao.trim();
      const brincoAlterado = brincoAnterior !== brincoNovo;

      const updateData: Record<string, string | null> = {
        identificacao: brincoNovo,
        nome: editFormData.nome.trim() || null,
      };

      const { error } = await supabase
        .from('receptoras')
        .update(updateData)
        .eq('id', editingReceptora.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
        }
        throw error;
      }

      // Registrar renomeação no histórico se o brinco foi alterado
      if (brincoAlterado) {
        try {
          const { error: historicoError } = await supabase
            .from('receptora_renomeacoes_historico')
            .insert([{
              receptora_id: editingReceptora.id,
              brinco_anterior: brincoAnterior,
              brinco_novo: brincoNovo,
              data_renomeacao: new Date().toISOString(),
              motivo: 'EDICAO_MANUAL',
              observacoes: null,
            }]);

          if (historicoError) {
            // Se a tabela não existir (erro 42P01), apenas logar
            if (historicoError.code === '42P01') {
              console.warn('Tabela receptora_renomeacoes_historico não existe. Execute o script criar_tabela_historico_renomeacoes.sql');
            } else {
              console.error('Erro ao registrar renomeação no histórico:', historicoError);
            }
            // Não falhar a operação se o histórico falhar
          }
        } catch (error) {
          console.error('Erro ao registrar renomeação no histórico:', error);
          // Não falhar a operação se o histórico falhar
        }
      }

      toast({
        title: 'Receptora atualizada',
        description: brincoAlterado 
          ? `Receptora atualizada. Brinco alterado de "${brincoAnterior}" para "${brincoNovo}".`
          : 'Receptora atualizada com sucesso',
      });

      setShowEditDialog(false);
      setEditingReceptora(null);
      loadReceptoras();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Verificar conflito de brinco e nome quando a fazenda destino é selecionada
  useEffect(() => {
    const verificarConflitos = async () => {
      if (!editingReceptora || !novaFazendaId) {
        setTemConflitoBrinco(false);
        setNovoBrincoProposto('');
        setTemConflitoNome(false);
        return;
      }

      try {
        // Buscar receptoras na fazenda destino com o mesmo brinco
        const { data: viewData, error: viewError } = await supabase
          .from('vw_receptoras_fazenda_atual')
          .select('receptora_id')
          .eq('fazenda_id_atual', novaFazendaId);

        if (viewError) {
          console.error('Erro ao verificar receptoras na fazenda destino:', viewError);
          return;
        }

        const receptoraIdsNaFazendaDestino = viewData?.map(v => v.receptora_id) || [];

        if (receptoraIdsNaFazendaDestino.length === 0) {
          setTemConflitoBrinco(false);
          setNovoBrincoProposto('');
          setTemConflitoNome(false);
          return;
        }

        // Verificar conflito de NOME (se a receptora tem nome)
        if (editingReceptora.nome && editingReceptora.nome.trim()) {
          const { data: receptorasComNome, error: nomeError } = await supabase
            .from('receptoras')
            .select('id, nome, identificacao')
            .in('id', receptoraIdsNaFazendaDestino)
            .ilike('nome', editingReceptora.nome.trim());

          if (nomeError) {
            console.error('Erro ao verificar nome:', nomeError);
          } else if (receptorasComNome && receptorasComNome.length > 0) {
            // Há conflito de nome
            setTemConflitoNome(true);
          } else {
            setTemConflitoNome(false);
          }
        } else {
          setTemConflitoNome(false);
        }

        // Buscar receptoras com o mesmo brinco (case-insensitive)
        const { data: receptorasComBrinco, error: brincoError } = await supabase
          .from('receptoras')
          .select('id, identificacao')
          .in('id', receptoraIdsNaFazendaDestino)
          .ilike('identificacao', editingReceptora.identificacao);

        if (brincoError) {
          console.error('Erro ao verificar brinco:', brincoError);
          return;
        }

        if (receptorasComBrinco && receptorasComBrinco.length > 0) {
          // Há conflito - gerar novo brinco disponível
          setTemConflitoBrinco(true);
          
          // Função para gerar brinco disponível
          const gerarBrincoDisponivel = async (brincoBase: string, tentativa: number = 0): Promise<string> => {
            // Limitar tentativas para evitar loop infinito
            if (tentativa > 10) {
              throw new Error('Não foi possível gerar um brinco disponível após várias tentativas');
            }

            // Gerar novo brinco: brinco original + "-MOV" + data (DDMM) + contador se necessário
            const dataAtual = new Date();
            const dia = String(dataAtual.getDate()).padStart(2, '0');
            const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
            const sufixo = tentativa === 0 ? `-MOV${dia}${mes}` : `-MOV${dia}${mes}-${tentativa}`;
            const novoBrinco = `${brincoBase}${sufixo}`;
            
            // Verificar se o novo brinco já existe na fazenda destino
            const { data: receptorasComNovoBrinco, error: novoBrincoError } = await supabase
              .from('receptoras')
              .select('id, identificacao')
              .in('id', receptoraIdsNaFazendaDestino)
              .ilike('identificacao', novoBrinco);

            if (novoBrincoError) {
              console.error('Erro ao verificar novo brinco:', novoBrincoError);
              return novoBrinco; // Retornar mesmo com erro para não bloquear
            }

            // Se o brinco já existe, tentar outro
            if (receptorasComNovoBrinco && receptorasComNovoBrinco.length > 0) {
              return gerarBrincoDisponivel(brincoBase, tentativa + 1);
            }

            // Brinco disponível encontrado
            return novoBrinco;
          };

          try {
            const brincoDisponivel = await gerarBrincoDisponivel(editingReceptora.identificacao);
            setNovoBrincoProposto(brincoDisponivel);
          } catch (error) {
            console.error('Erro ao gerar brinco disponível:', error);
            // Fallback: usar o padrão básico mesmo com possível conflito
            const dataAtual = new Date();
            const dia = String(dataAtual.getDate()).padStart(2, '0');
            const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
            const sufixo = `-MOV${dia}${mes}`;
            setNovoBrincoProposto(`${editingReceptora.identificacao}${sufixo}`);
          }
        } else {
          setTemConflitoBrinco(false);
          setNovoBrincoProposto('');
        }
      } catch (error) {
        console.error('Erro ao verificar conflitos:', error);
      }
    };

    verificarConflitos();
  }, [editingReceptora, novaFazendaId]);

  const handleMoverFazenda = async () => {
    if (!editingReceptora || !novaFazendaId) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma fazenda de destino',
        variant: 'destructive',
      });
      return;
    }

    // Validar conflito de nome antes de mover
    if (temConflitoNome && editingReceptora.nome && editingReceptora.nome.trim()) {
      toast({
        title: 'Conflito de nome',
        description: `Já existe uma receptora com o nome "${editingReceptora.nome.trim()}" na fazenda destino. Não é possível mover esta receptora.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmittingMover(true);

      // Verificar conflito de brinco ANTES de mover (validação adicional de segurança)
      const { data: viewDataValidacao, error: viewErrorValidacao } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', novaFazendaId);

      if (!viewErrorValidacao && viewDataValidacao) {
        const receptoraIdsValidacao = viewDataValidacao.map(v => v.receptora_id);
        
        if (receptoraIdsValidacao.length > 0) {
          const { data: receptorasComBrincoValidacao, error: brincoErrorValidacao } = await supabase
            .from('receptoras')
            .select('id, identificacao')
            .in('id', receptoraIdsValidacao)
            .ilike('identificacao', editingReceptora.identificacao);

          if (!brincoErrorValidacao && receptorasComBrincoValidacao && receptorasComBrincoValidacao.length > 0) {
            // Há conflito de brinco - verificar se temos um novo brinco proposto
            if (!temConflitoBrinco || !novoBrincoProposto) {
              // Não temos um novo brinco proposto, bloquear movimentação
              setSubmittingMover(false);
              toast({
                title: 'Conflito de brinco',
                description: `Já existe uma receptora com o brinco "${editingReceptora.identificacao}" na fazenda destino. Aguarde enquanto o sistema gera um novo brinco...`,
                variant: 'destructive',
              });
              // Forçar verificação novamente
              setTemConflitoBrinco(true);
              return;
            }
          }
        }
      }

      // Se há conflito de brinco, verificar novamente e atualizar o brinco da receptora
      const brincoAnterior = editingReceptora.identificacao;
      let brincoFinal = brincoAnterior;
      
      if (temConflitoBrinco && novoBrincoProposto) {
        // Verificar uma última vez se o brinco proposto está disponível na fazenda destino
        const { data: viewDataFinal, error: viewErrorFinal } = await supabase
          .from('vw_receptoras_fazenda_atual')
          .select('receptora_id')
          .eq('fazenda_id_atual', novaFazendaId);

        if (!viewErrorFinal && viewDataFinal) {
          const receptoraIdsNaFazendaDestinoFinal = viewDataFinal.map(v => v.receptora_id);
          
          if (receptoraIdsNaFazendaDestinoFinal.length > 0) {
            const { data: receptorasComBrincoFinal, error: brincoErrorFinal } = await supabase
              .from('receptoras')
              .select('id, identificacao')
              .in('id', receptoraIdsNaFazendaDestinoFinal)
              .ilike('identificacao', novoBrincoProposto);

            if (!brincoErrorFinal && receptorasComBrincoFinal && receptorasComBrincoFinal.length > 0) {
              // O brinco proposto também tem conflito - gerar um novo
              let tentativa = 1;
              let brincoDisponivel = novoBrincoProposto;
              
              while (tentativa <= 10) {
                const dataAtual = new Date();
                const dia = String(dataAtual.getDate()).padStart(2, '0');
                const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
                const sufixo = `-MOV${dia}${mes}-${tentativa}`;
                brincoDisponivel = `${brincoAnterior}${sufixo}`;
                
                const { data: verificarBrinco, error: verificarError } = await supabase
                  .from('receptoras')
                  .select('id')
                  .in('id', receptoraIdsNaFazendaDestinoFinal)
                  .ilike('identificacao', brincoDisponivel);

                if (!verificarError && (!verificarBrinco || verificarBrinco.length === 0)) {
                  // Brinco disponível encontrado
                  break;
                }
                
                tentativa++;
              }
              
              brincoFinal = brincoDisponivel;
            } else {
              brincoFinal = novoBrincoProposto;
            }
          } else {
            brincoFinal = novoBrincoProposto;
          }
        } else {
          brincoFinal = novoBrincoProposto;
        }

        // Atualizar o brinco da receptora
        const { error: updateError } = await supabase
          .from('receptoras')
          .update({ identificacao: brincoFinal })
          .eq('id', editingReceptora.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar brinco: ${updateError.message}`);
        }

        // Registrar renomeação no histórico
        try {
          const { error: historicoError } = await supabase
            .from('receptora_renomeacoes_historico')
            .insert([{
              receptora_id: editingReceptora.id,
              brinco_anterior: brincoAnterior,
              brinco_novo: brincoFinal,
              data_renomeacao: new Date().toISOString(),
              motivo: 'MUDANCA_FAZENDA',
              observacoes: `Renomeação automática devido a conflito de brinco na fazenda destino`,
            }]);

          if (historicoError) {
            // Se a tabela não existir (erro 42P01), apenas logar
            if (historicoError.code === '42P01') {
              console.warn('Tabela receptora_renomeacoes_historico não existe. Execute o script criar_tabela_historico_renomeacoes.sql');
            } else {
              console.error('Erro ao registrar renomeação no histórico:', historicoError);
            }
            // Não falhar a operação se o histórico falhar
          }
        } catch (error) {
          console.error('Erro ao registrar renomeação no histórico:', error);
          // Não falhar a operação se o histórico falhar
        }

        // Atualizar o objeto editingReceptora com o novo brinco
        editingReceptora.identificacao = brincoFinal;
      }

      // Chamar RPC mover_receptora_fazenda
      const { data, error } = await supabase.rpc('mover_receptora_fazenda', {
        p_receptora_id: editingReceptora.id,
        p_nova_fazenda_id: novaFazendaId,
        p_data_mudanca: new Date().toISOString().split('T')[0],
        p_observacoes: null,
      });

      if (error) {
        console.error('Erro ao mover receptora:', error);
        console.error('Receptora ID:', editingReceptora.id);
        console.error('Nova Fazenda ID:', novaFazendaId);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        
        // Extrair mensagem de erro do PostgreSQL
        // P0001 = exceção customizada (RAISE EXCEPTION)
        let errorMessage = 'Erro ao mover receptora';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = error.details;
        }
        
        // Exibir toast imediatamente
        toast({
          title: 'Erro ao mover receptora',
          description: errorMessage,
          variant: 'destructive',
        });
        
        setSubmittingMover(false);
        return; // Retornar sem fazer mais nada
      }

      toast({
        title: 'Receptora movida',
        description: temConflitoBrinco 
          ? `Receptora movida com sucesso. Brinco atualizado de "${brincoAnterior}" para "${editingReceptora.identificacao}" devido a conflito na fazenda destino.`
          : 'Receptora movida para a nova fazenda com sucesso. Protocolos e histórico não foram afetados.',
      });

      setShowMoverFazendaDialog(false);
      setShowEditDialog(false);
      setEditingReceptora(null);
      setNovaFazendaId('');
      setTemConflitoBrinco(false);
      setNovoBrincoProposto('');
      setTemConflitoNome(false);
      
      // Recarregar receptoras (a receptora pode ter saído da lista atual)
      loadReceptoras();
    } catch (error) {
      console.error('Erro catch ao mover receptora:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao mover receptora';
      toast({
        title: 'Erro ao mover receptora',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmittingMover(false);
    }
  };


  // StatusBadge + formatStatusLabel deixam a UI consistente com o resto do app.

  if (loadingFazendas) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Receptoras</h1>
          <p className="text-slate-600 mt-1">Gerenciar receptoras por fazenda</p>
        </div>
      </div>

      <div className="space-y-6">

      {/* Fazenda Selection - OBRIGATÓRIO */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione a Fazenda *</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma fazenda para listar receptoras" />
            </SelectTrigger>
            <SelectContent>
              {fazendas.map((fazenda) => (
                <SelectItem key={fazenda.id} value={fazenda.id}>
                  {fazenda.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!selectedFazendaId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 text-lg">Selecione uma fazenda para listar receptoras</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filtros: Status e Busca */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 max-w-md">
                  <Label htmlFor="filtro-status">Status</Label>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger id="filtro-status">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {statusDisponiveis.map((status) => (
                        <SelectItem key={status} value={status}>
                          {formatStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 max-w-md">
                  <Label htmlFor="busca">Buscar por brinco ou nome</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      id="busca"
                      placeholder="Buscar por brinco ou nome..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end">
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Receptora
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Nova Receptora</DialogTitle>
                  <DialogDescription>
                    Criar receptora na fazenda selecionada
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="identificacao">Identificação (Brinco) *</Label>
                    <Input
                      id="identificacao"
                      value={formData.identificacao}
                      onChange={(e) => setFormData({ ...formData, identificacao: e.target.value })}
                      placeholder="Número do brinco"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Nome da receptora (opcional)"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={submitting}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDialog(false)}
                      disabled={submitting}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Receptoras ({filteredReceptoras.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReceptoras ? (
                <div className="py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status Atual</TableHead>
                      <TableHead>Data de parto</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceptoras.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500">
                          {searchTerm ? 'Nenhuma receptora encontrada' : 'Nenhuma receptora cadastrada nesta fazenda'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReceptoras.map((receptora) => (
                        <TableRow key={receptora.id}>
                          <TableCell className="font-medium">{receptora.identificacao}</TableCell>
                          <TableCell>{receptora.nome || '-'}</TableCell>
                          <TableCell>
                            <StatusBadge status={receptora.status_calculado} count={receptora.numero_gestacoes} />
                          </TableCell>
                          <TableCell>
                            {receptora.status_calculado.includes('PRENHE') && receptora.data_provavel_parto
                              ? formatarDataBR(receptora.data_provavel_parto)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(receptora)}
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedReceptoraId(receptora.id);
                                  setShowHistorico(true);
                                }}
                                title="Ver histórico"
                              >
                                <History className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Receptora</DialogTitle>
            <DialogDescription>
              Atualizar dados da receptora
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_identificacao">Identificação (Brinco) *</Label>
              <Input
                id="edit_identificacao"
                value={editFormData.identificacao}
                onChange={(e) => setEditFormData({ ...editFormData, identificacao: e.target.value })}
                placeholder="Número do brinco"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_nome">Nome</Label>
              <Input
                id="edit_nome"
                value={editFormData.nome}
                onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                placeholder="Nome da receptora (opcional)"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </form>

          {/* Separador e botão para mover fazenda */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setShowMoverFazendaDialog(true);
              setNovaFazendaId('');
            }}
            disabled={submitting}
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Mover para outra fazenda
          </Button>
        </DialogContent>
      </Dialog>

      {/* Dialog Mover Fazenda */}
      <Dialog open={showMoverFazendaDialog} onOpenChange={(open) => {
        setShowMoverFazendaDialog(open);
        if (!open) {
          // Resetar estados ao fechar
          setTemConflitoBrinco(false);
          setNovoBrincoProposto('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover Receptora</DialogTitle>
            <DialogDescription>
              Mover {editingReceptora?.identificacao} para outra fazenda. 
              Protocolos e histórico reprodutivo não serão afetados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova_fazenda">Nova Fazenda *</Label>
              <Select value={novaFazendaId} onValueChange={setNovaFazendaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fazenda de destino" />
                </SelectTrigger>
                <SelectContent>
                  {fazendas
                    .filter((f) => f.id !== selectedFazendaId) // Filtrar fazenda atual
                    .map((fazenda) => (
                      <SelectItem key={fazenda.id} value={fazenda.id}>
                        {fazenda.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {temConflitoNome && editingReceptora?.nome && (
              <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start gap-2">
                  <div className="text-red-800 text-sm font-medium">
                    ❌ Conflito de Nome Detectado
                  </div>
                </div>
                <div className="text-red-700 text-sm">
                  Já existe uma receptora com o nome "{editingReceptora.nome.trim()}" na fazenda destino.
                </div>
                <div className="text-red-600 text-xs">
                  Não é possível mover esta receptora. Edite o nome da receptora antes de movê-la.
                </div>
              </div>
            )}

            {temConflitoBrinco && novoBrincoProposto && (
              <div className="space-y-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start gap-2">
                  <div className="text-yellow-800 text-sm font-medium">
                    ⚠️ Conflito de Brinco Detectado
                  </div>
                </div>
                <div className="text-yellow-700 text-sm">
                  Já existe uma receptora com o brinco "{editingReceptora?.identificacao}" na fazenda destino.
                </div>
                <div className="space-y-1">
                  <Label className="text-yellow-800 text-sm font-medium">
                    Novo Brinco Proposto:
                  </Label>
                  <div className="p-2 bg-white border border-yellow-300 rounded text-sm font-mono text-yellow-900">
                    {novoBrincoProposto}
                  </div>
                  <div className="text-yellow-600 text-xs">
                    O brinco será automaticamente atualizado para permitir a movimentação.
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleMoverFazenda}
                disabled={submittingMover || !novaFazendaId || temConflitoNome || (temConflitoBrinco && !novoBrincoProposto)}
              >
                {submittingMover ? 'Movendo...' : 'Confirmar Movimentação'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowMoverFazendaDialog(false);
                  setTemConflitoBrinco(false);
                  setNovoBrincoProposto('');
                  setTemConflitoNome(false);
                }}
                disabled={submittingMover}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Historico Sheet */}
      <ReceptoraHistorico
        receptoraId={selectedReceptoraId}
        open={showHistorico}
        onClose={() => setShowHistorico(false)}
      />
      </div>
    </div>
  );
}