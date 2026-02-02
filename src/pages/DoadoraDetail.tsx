/**
 * Página de Detalhes da Doadora
 * Padrão visual do Hub Campo (DG, TE, Aspiração)
 * Inclui histórico de aspirações integrado
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Doadora, Fazenda, AspiracaoDoadora } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import CountBadge from '@/components/shared/CountBadge';
import { DataTable } from '@/components/shared/DataTable';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Save, Star, Gem, History, Edit, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import GenealogiaTree, { type GenealogiaData } from '@/components/shared/GenealogiaTree';

export default function DoadoraDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doadora, setDoadora] = useState<Doadora | null>(null);
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [aspiracoes, setAspiracoes] = useState<AspiracaoDoadora[]>([]);
  const [activeTab, setActiveTab] = useState('historico');
  const [genealogiaOpen, setGenealogiaOpen] = useState(false);

  const racasPredefinidas = ['Holandesa', 'Jersey', 'Gir', 'Girolando'];
  const [racaSelecionada, setRacaSelecionada] = useState<string>('');

  const [formData, setFormData] = useState({
    registro: '',
    nome: '',
    raca: '',
    racaCustom: '',
    genealogia_texto: '',
    foto_url: '',
    gpta: '',
    controle_leiteiro: '',
    beta_caseina: '',
    link_abcz: '',
    disponivel_aspiracao: true,
    classificacao_genetica: '' as '1_estrela' | '2_estrelas' | '3_estrelas' | 'diamante' | '',
  });

  const [genealogia, setGenealogia] = useState<GenealogiaData>({
    pai: { nome: '', registro: '' },
    mae: { nome: '', registro: '' },
    pai_pai: { nome: '', registro: '' },
    pai_mae: { nome: '', registro: '' },
    mae_pai: { nome: '', registro: '' },
    mae_mae: { nome: '', registro: '' },
  });

  // Calcular estatísticas das aspirações
  const stats = useMemo(() => {
    const total = aspiracoes.length;
    const totalOocitos = aspiracoes.reduce((sum, a) => sum + (a.total_oocitos || 0), 0);
    const totalViaveis = aspiracoes.reduce((sum, a) => sum + (a.viaveis || 0), 0);
    const mediaOocitos = total > 0 ? Math.round(totalOocitos / total) : 0;
    const mediaViaveis = total > 0 ? Math.round(totalViaveis / total) : 0;
    const ultimaAspiracao = aspiracoes[0]?.data_aspiracao;
    return { total, totalOocitos, totalViaveis, mediaOocitos, mediaViaveis, ultimaAspiracao };
  }, [aspiracoes]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar doadora
      const { data: doadoraData, error: doadoraError } = await supabase
        .from('doadoras')
        .select('*')
        .eq('id', id)
        .single();

      if (doadoraError) throw doadoraError;
      setDoadora(doadoraData);

      // Carregar fazenda
      if (doadoraData.fazenda_id) {
        const { data: fazendaData, error: fazendaError } = await supabase
          .from('fazendas')
          .select('*')
          .eq('id', doadoraData.fazenda_id)
          .single();

        if (fazendaError) throw fazendaError;
        setFazenda(fazendaData);
      }

      // Carregar histórico de aspirações
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('*')
        .eq('doadora_id', id)
        .order('data_aspiracao', { ascending: false });

      if (!aspiracoesError) {
        setAspiracoes(aspiracoesData || []);
      }

      // Processar raça
      const raca = doadoraData.raca || '';
      const isRacaPredefinida = racasPredefinidas.includes(raca);
      setRacaSelecionada(isRacaPredefinida ? raca : 'Outra');

      // Processar genealogia
      let genealogiaExtraida: GenealogiaData = {
        pai: { nome: doadoraData.pai_nome || '', registro: doadoraData.pai_registro || '' },
        mae: { nome: doadoraData.mae_nome || '', registro: doadoraData.mae_registro || '' },
        pai_pai: { nome: '', registro: '' },
        pai_mae: { nome: '', registro: '' },
        mae_pai: { nome: '', registro: '' },
        mae_mae: { nome: '', registro: '' },
      };

      let genealogiaTexto = doadoraData.genealogia_texto || '';

      if (genealogiaTexto.includes('[GENEALOGIA_JSON]')) {
        try {
          const match = genealogiaTexto.match(/\[GENEALOGIA_JSON\](.*?)\[\/GENEALOGIA_JSON\]/s);
          if (match) {
            const genealogiaJSON = JSON.parse(match[1]);
            genealogiaExtraida = {
              pai: genealogiaJSON.pai || genealogiaExtraida.pai,
              mae: genealogiaJSON.mae || genealogiaExtraida.mae,
              pai_pai: genealogiaJSON.pai_pai || genealogiaExtraida.pai_pai,
              pai_mae: genealogiaJSON.pai_mae || genealogiaExtraida.pai_mae,
              mae_pai: genealogiaJSON.mae_pai || genealogiaExtraida.mae_pai,
              mae_mae: genealogiaJSON.mae_mae || genealogiaExtraida.mae_mae,
            };
            genealogiaTexto = genealogiaTexto.replace(/\[GENEALOGIA_JSON\].*?\[\/GENEALOGIA_JSON\]/s, '').trim();
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      setFormData({
        registro: doadoraData.registro || '',
        nome: doadoraData.nome || '',
        raca: isRacaPredefinida ? raca : '',
        racaCustom: isRacaPredefinida ? '' : raca,
        genealogia_texto: genealogiaTexto,
        foto_url: doadoraData.foto_url || '',
        gpta: doadoraData.gpta?.toString() || '',
        controle_leiteiro: doadoraData.controle_leiteiro?.toString() || '',
        beta_caseina: doadoraData.beta_caseina || '',
        link_abcz: doadoraData.link_abcz || '',
        disponivel_aspiracao: doadoraData.disponivel_aspiracao ?? true,
        classificacao_genetica: (doadoraData.classificacao_genetica || '') as '1_estrela' | '2_estrelas' | '3_estrelas' | 'diamante' | '',
      });

      setGenealogia(genealogiaExtraida);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.registro.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Registro é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
    if (!racaFinal) {
      toast({
        title: 'Erro de validação',
        description: 'Raça é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const doadoraData: Record<string, string | number | null | boolean> = {
        registro: formData.registro.trim(),
        nome: formData.nome.trim() || null,
        raca: racaFinal,
        pai_registro: genealogia.pai.registro.trim() || null,
        pai_nome: genealogia.pai.nome.trim() || null,
        mae_registro: genealogia.mae.registro.trim() || null,
        mae_nome: genealogia.mae.nome.trim() || null,
        foto_url: formData.foto_url.trim() || null,
        gpta: formData.gpta ? parseFloat(formData.gpta) : null,
        controle_leiteiro: formData.controle_leiteiro ? parseFloat(formData.controle_leiteiro) : null,
        beta_caseina: formData.beta_caseina.trim() || null,
        link_abcz: formData.link_abcz.trim() || null,
        disponivel_aspiracao: formData.disponivel_aspiracao,
        classificacao_genetica: formData.classificacao_genetica || null,
      };

      const genealogiaCompleta = {
        pai: genealogia.pai,
        mae: genealogia.mae,
        pai_pai: genealogia.pai_pai,
        pai_mae: genealogia.pai_mae,
        mae_pai: genealogia.mae_pai,
        mae_mae: genealogia.mae_mae,
      };

      const temGenealogia = Object.values(genealogiaCompleta).some(
        (pessoa) => pessoa.nome.trim() || pessoa.registro.trim()
      );

      if (temGenealogia) {
        const genealogiaJSON = JSON.stringify(genealogiaCompleta);
        doadoraData.genealogia_texto = formData.genealogia_texto.trim()
          ? `${formData.genealogia_texto}\n\n[GENEALOGIA_JSON]${genealogiaJSON}[/GENEALOGIA_JSON]`
          : `[GENEALOGIA_JSON]${genealogiaJSON}[/GENEALOGIA_JSON]`;
      } else {
        doadoraData.genealogia_texto = formData.genealogia_texto.trim() || null;
      }

      const { error } = await supabase
        .from('doadoras')
        .update(doadoraData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Doadora atualizada',
        description: 'Dados salvos com sucesso',
      });

      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao atualizar doadora',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getClassificacaoIcon = () => {
    switch (formData.classificacao_genetica) {
      case 'diamante':
        return <Gem className="w-4 h-4 text-cyan-500" />;
      case '3_estrelas':
        return <><Star className="w-3 h-3 text-amber-500 fill-amber-500" /><Star className="w-3 h-3 text-amber-500 fill-amber-500" /><Star className="w-3 h-3 text-amber-500 fill-amber-500" /></>;
      case '2_estrelas':
        return <><Star className="w-3 h-3 text-amber-500 fill-amber-500" /><Star className="w-3 h-3 text-amber-500 fill-amber-500" /></>;
      case '1_estrela':
        return <Star className="w-3 h-3 text-amber-500 fill-amber-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!doadora) {
    return (
      <EmptyState
        title="Doadora não encontrada"
        description="Não foi possível carregar os dados da doadora."
        action={
          <Button onClick={() => navigate('/doadoras')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Doadoras
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Detalhes da Doadora</h1>
        </div>
      </div>

      {/* Card principal com informações + estatísticas */}
      <Card>
        <CardContent className="pt-4 pb-4">
          {/* Linha 1: Identificação + Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Registro</span>
                <p className="text-base font-semibold text-foreground">{doadora.registro}</p>
              </div>
              {doadora.nome && (
                <>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Nome</span>
                    <p className="text-sm text-foreground">{doadora.nome}</p>
                  </div>
                </>
              )}
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-xs font-medium text-muted-foreground">Raça</span>
                <p className="text-sm text-foreground">{doadora.raca || '—'}</p>
              </div>
              {fazenda && (
                <>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Fazenda</span>
                    <p className="text-sm text-foreground">{fazenda.nome}</p>
                  </div>
                </>
              )}
            </div>

            {/* Status e Classificação */}
            <div className="flex items-center gap-2">
              {formData.classificacao_genetica && (
                <div className="flex items-center gap-0.5">
                  {getClassificacaoIcon()}
                </div>
              )}
              <Badge
                variant={formData.disponivel_aspiracao ? 'default' : 'secondary'}
                className={formData.disponivel_aspiracao ? 'bg-primary text-xs' : 'text-xs'}
              >
                {formData.disponivel_aspiracao ? 'Disponível' : 'Indisponível'}
              </Badge>
            </div>
          </div>

          {/* Linha 2: Estatísticas de aspirações */}
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Aspirações:</span>
              <CountBadge value={stats.total} variant="default" />
            </div>
            <div className="h-4 w-px bg-border" />
            {/* Viáveis em destaque */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-xs font-medium text-primary">Viáveis:</span>
              <span className="text-sm font-bold text-primary">{stats.totalViaveis}</span>
              <span className="text-[10px] text-primary/70">(média {stats.mediaViaveis})</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Total Oócitos:</span>
              <CountBadge value={stats.totalOocitos} variant="default" />
              <span className="text-[10px] text-muted-foreground">(média {stats.mediaOocitos})</span>
            </div>
            {stats.ultimaAspiracao && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Última:</span>
                  <span className="text-xs font-medium text-foreground">{formatDate(stats.ultimaAspiracao)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Histórico e Edição */}
      <div className="rounded-xl border border-border bg-card p-1.5">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('historico')}
            className={`
              relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-200
              ${activeTab === 'historico'
                ? 'bg-muted/80 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }
            `}
          >
            {activeTab === 'historico' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
            )}
            <div className={`
              flex items-center justify-center w-7 h-7 rounded-md transition-colors
              ${activeTab === 'historico' ? 'bg-primary/15' : 'bg-muted/50'}
            `}>
              <History className={`w-4 h-4 ${activeTab === 'historico' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <span>Histórico</span>
            {stats.total > 0 && (
              <span className={`
                inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold rounded-full
                ${activeTab === 'historico' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}
              `}>
                {stats.total}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('editar')}
            className={`
              relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-200
              ${activeTab === 'editar'
                ? 'bg-muted/80 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }
            `}
          >
            {activeTab === 'editar' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
            )}
            <div className={`
              flex items-center justify-center w-7 h-7 rounded-md transition-colors
              ${activeTab === 'editar' ? 'bg-primary/15' : 'bg-muted/50'}
            `}>
              <Edit className={`w-4 h-4 ${activeTab === 'editar' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <span>Editar Dados</span>
          </button>
        </div>
      </div>

      {/* Conteúdo das Tabs */}
      {activeTab === 'historico' && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold">Histórico de Aspirações</CardTitle>
          </CardHeader>
          <CardContent>
            {aspiracoes.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma aspiração registrada para esta doadora
              </div>
            ) : (
              <div className="space-y-3">
                {/* Tabela customizada para mostrar todos os tipos de oócitos */}
                <div className="rounded-lg border border-border overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
                    <div className="grid grid-cols-[90px_50px_60px_45px_45px_45px_45px_1fr_1fr] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="px-3 py-2.5 flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-primary/40" />
                        Data
                      </div>
                      <div className="px-2 py-2.5 text-center">Total</div>
                      <div className="px-2 py-2.5 text-center text-primary font-bold">Viáveis</div>
                      <div className="px-1 py-2.5 text-center">Exp.</div>
                      <div className="px-1 py-2.5 text-center">Des.</div>
                      <div className="px-1 py-2.5 text-center">Deg.</div>
                      <div className="px-1 py-2.5 text-center">Atr.</div>
                      <div className="px-2 py-2.5">Veterinário</div>
                      <div className="px-2 py-2.5">Técnico</div>
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-border/50">
                    {aspiracoes.map((asp, index) => (
                      <div
                        key={asp.id}
                        className={`
                          group grid grid-cols-[90px_50px_60px_45px_45px_45px_45px_1fr_1fr] items-center transition-all duration-150
                          hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent
                          ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                        `}
                      >
                        {/* Data */}
                        <div className="px-3 py-2 flex items-center gap-2">
                          <div className="w-0.5 h-5 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                          <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                            {formatDate(asp.data_aspiracao)}
                          </span>
                        </div>

                        {/* Total */}
                        <div className="px-2 py-2 flex justify-center">
                          <CountBadge value={asp.total_oocitos ?? 0} variant="default" />
                        </div>

                        {/* Viáveis - destaque especial */}
                        <div className="px-2 py-2 flex justify-center">
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span className="text-xs font-bold text-primary">{asp.viaveis ?? 0}</span>
                          </div>
                        </div>

                        {/* Expandidos */}
                        <div className="px-1 py-2 text-center">
                          <span className="text-xs text-muted-foreground">{asp.expandidos ?? 0}</span>
                        </div>

                        {/* Desnudos */}
                        <div className="px-1 py-2 text-center">
                          <span className="text-xs text-muted-foreground">{asp.desnudos ?? 0}</span>
                        </div>

                        {/* Degenerados */}
                        <div className="px-1 py-2 text-center">
                          <span className="text-xs text-muted-foreground">{asp.degenerados ?? 0}</span>
                        </div>

                        {/* Atrésicos */}
                        <div className="px-1 py-2 text-center">
                          <span className="text-xs text-muted-foreground">{asp.atresicos ?? 0}</span>
                        </div>

                        {/* Veterinário */}
                        <div className="px-2 py-2">
                          <span className="text-xs text-muted-foreground truncate block" title={asp.veterinario_responsavel || ''}>
                            {asp.veterinario_responsavel || '—'}
                          </span>
                        </div>

                        {/* Técnico */}
                        <div className="px-2 py-2">
                          <span className="text-xs text-muted-foreground truncate block" title={asp.tecnico_responsavel || ''}>
                            {asp.tecnico_responsavel || '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legenda compacta */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span>Viáveis</span>
                  </div>
                  <span className="text-muted-foreground/30">|</span>
                  <span>Exp=Expandidos</span>
                  <span>Des=Desnudos</span>
                  <span>Deg=Degenerados</span>
                  <span>Atr=Atrésicos</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'editar' && (
        <form id="doadora-form" onSubmit={handleSubmit} className="space-y-3">
          {/* Informações Básicas - Compacto */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="registro" className="text-xs">Registro *</Label>
                  <Input
                    id="registro"
                    value={formData.registro}
                    onChange={(e) => setFormData({ ...formData, registro: e.target.value })}
                    className="h-8 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="nome" className="text-xs">Nome</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="raca" className="text-xs">Raça *</Label>
                  <Select
                    value={racaSelecionada}
                    onValueChange={(value) => {
                      setRacaSelecionada(value);
                      if (value === 'Outra') {
                        setFormData({ ...formData, raca: '', racaCustom: '' });
                      } else {
                        setFormData({ ...formData, raca: value, racaCustom: '' });
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {racasPredefinidas.map((raca) => (
                        <SelectItem key={raca} value={raca}>{raca}</SelectItem>
                      ))}
                      <SelectItem value="Outra">Outra</SelectItem>
                    </SelectContent>
                  </Select>
                  {racaSelecionada === 'Outra' && (
                    <Input
                      value={formData.racaCustom}
                      onChange={(e) => setFormData({ ...formData, racaCustom: e.target.value, raca: e.target.value })}
                      placeholder="Digite a raça"
                      className="h-8 text-sm mt-1"
                      required
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="classificacao_genetica" className="text-xs">Classificação</Label>
                  <Select
                    value={formData.classificacao_genetica}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        classificacao_genetica: value as '1_estrela' | '2_estrelas' | '3_estrelas' | 'diamante' | '',
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1_estrela">1 Estrela</SelectItem>
                      <SelectItem value="2_estrelas">2 Estrelas</SelectItem>
                      <SelectItem value="3_estrelas">3 Estrelas</SelectItem>
                      <SelectItem value="diamante">Diamante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Disponibilidade inline */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Switch
                    id="disponivel_aspiracao"
                    checked={formData.disponivel_aspiracao}
                    onCheckedChange={(checked) => setFormData({ ...formData, disponivel_aspiracao: checked })}
                  />
                  <Label htmlFor="disponivel_aspiracao" className="text-xs font-normal">
                    Disponível para aspiração
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="foto_url" className="text-xs">URL Foto:</Label>
                  <Input
                    id="foto_url"
                    type="url"
                    value={formData.foto_url}
                    onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
                    placeholder="https://..."
                    className="h-7 text-xs w-48"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campos específicos da Raça Gir - Compacto */}
          {racaSelecionada === 'Gir' && (
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold">Informações Gir</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="gpta" className="text-xs">GPTA</Label>
                    <Input
                      id="gpta"
                      type="number"
                      value={formData.gpta}
                      onChange={(e) => setFormData({ ...formData, gpta: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="controle_leiteiro" className="text-xs">Controle Leiteiro</Label>
                    <Input
                      id="controle_leiteiro"
                      type="number"
                      value={formData.controle_leiteiro}
                      onChange={(e) => setFormData({ ...formData, controle_leiteiro: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="beta_caseina" className="text-xs">Beta Caseína</Label>
                    <Input
                      id="beta_caseina"
                      value={formData.beta_caseina}
                      onChange={(e) => setFormData({ ...formData, beta_caseina: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="link_abcz" className="text-xs">Link ABCZ</Label>
                    <Input
                      id="link_abcz"
                      type="url"
                      value={formData.link_abcz}
                      onChange={(e) => setFormData({ ...formData, link_abcz: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Genealogia - Collapsible */}
          <Card>
            <Collapsible open={genealogiaOpen} onOpenChange={setGenealogiaOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 pt-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Genealogia</CardTitle>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${genealogiaOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <GenealogiaTree
                    value={genealogia}
                    onChange={setGenealogia}
                    doadoraNome={formData.nome || formData.registro}
                    doadoraRegistro={formData.registro}
                  />

                  <div className="mt-3 space-y-1">
                    <Label htmlFor="genealogia_texto" className="text-xs">Observações</Label>
                    <Textarea
                      id="genealogia_texto"
                      value={formData.genealogia_texto}
                      onChange={(e) => setFormData({ ...formData, genealogia_texto: e.target.value })}
                      placeholder="Informações adicionais (opcional)"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
