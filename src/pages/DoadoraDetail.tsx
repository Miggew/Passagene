import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Doadora, Fazenda } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Dna, Save, Star, Gem } from 'lucide-react';
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

  // Preparação para campos específicos por raça (será implementado depois)
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

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load doadora
      const { data: doadoraData, error: doadoraError } = await supabase
        .from('doadoras')
        .select('*')
        .eq('id', id)
        .single();

      if (doadoraError) throw doadoraError;
      setDoadora(doadoraData);

      // Load fazenda
      if (doadoraData.fazenda_id) {
        const { data: fazendaData, error: fazendaError } = await supabase
          .from('fazendas')
          .select('*')
          .eq('id', doadoraData.fazenda_id)
          .single();

        if (fazendaError) throw fazendaError;
        setFazenda(fazendaData);
      }

      // Preencher formulário
      const raca = doadoraData.raca || '';
      const isRacaPredefinida = racasPredefinidas.includes(raca);
      
      setRacaSelecionada(isRacaPredefinida ? raca : 'Outra');

      // Extrair genealogia do campo genealogia_texto (pode estar em JSON)
      let genealogiaExtraida: GenealogiaData = {
        pai: { nome: doadoraData.pai_nome || '', registro: doadoraData.pai_registro || '' },
        mae: { nome: doadoraData.mae_nome || '', registro: doadoraData.mae_registro || '' },
        pai_pai: { nome: '', registro: '' },
        pai_mae: { nome: '', registro: '' },
        mae_pai: { nome: '', registro: '' },
        mae_mae: { nome: '', registro: '' },
      };
      
      let genealogiaTexto = doadoraData.genealogia_texto || '';
      
      // Tentar extrair JSON da genealogia se existir
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
            // Remover JSON do texto de observações
            genealogiaTexto = genealogiaTexto.replace(/\[GENEALOGIA_JSON\].*?\[\/GENEALOGIA_JSON\]/s, '').trim();
          }
        } catch (e) {
          console.warn('Erro ao parsear genealogia JSON:', e);
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

    // Validar raça: deve ter selecionado uma raça pré-definida ou digitado uma raça customizada
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

      // Determinar raça final (pré-definida ou customizada)
      const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
      
      // Converter genealogia para formato do banco (mantendo compatibilidade com campos antigos)
      const doadoraData: Record<string, string | number | null> = {
        registro: formData.registro.trim(),
        nome: formData.nome.trim() || null,
        raca: racaFinal,
        // Manter campos antigos para compatibilidade
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

      // Adicionar genealogia completa como JSON no campo genealogia_texto
      const genealogiaCompleta = {
        pai: genealogia.pai,
        mae: genealogia.mae,
        pai_pai: genealogia.pai_pai,
        pai_mae: genealogia.pai_mae,
        mae_pai: genealogia.mae_pai,
        mae_mae: genealogia.mae_mae,
      };
      
      // Verificar se há pelo menos um campo preenchido na genealogia
      const temGenealogia = Object.values(genealogiaCompleta).some(
        (pessoa) => pessoa.nome.trim() || pessoa.registro.trim()
      );
      
      if (temGenealogia) {
        // Armazenar JSON da genealogia completa junto com o texto de observações
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
        description: 'Doadora atualizada com sucesso',
      });

      // Recarregar dados
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

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!doadora) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-slate-500">Doadora não encontrada</p>
          <Button onClick={() => navigate('/doadoras')} className="mt-4" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Doadoras
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/doadoras')} variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Dna className="w-8 h-8" />
              {formData.nome || formData.registro}
            </h1>
            <p className="text-slate-600 mt-1">
              {formData.registro} {fazenda && `• ${fazenda.nome}`}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registro">Registro *</Label>
                <Input
                  id="registro"
                  value={formData.registro}
                  onChange={(e) => setFormData({ ...formData, registro: e.target.value })}
                  placeholder="Registro da doadora"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome da doadora"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="raca">Raça *</Label>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a raça" />
                  </SelectTrigger>
                  <SelectContent>
                    {racasPredefinidas.map((raca) => (
                      <SelectItem key={raca} value={raca}>
                        {raca}
                      </SelectItem>
                    ))}
                    <SelectItem value="Outra">Outra</SelectItem>
                  </SelectContent>
                </Select>
                {racaSelecionada === 'Outra' && (
                  <Input
                    id="raca_custom"
                    value={formData.racaCustom}
                    onChange={(e) => setFormData({ ...formData, racaCustom: e.target.value, raca: e.target.value })}
                    placeholder="Digite a raça"
                    className="mt-2"
                    required
                  />
                )}
                {/* Preparação para campos específicos por raça */}
                {racaSelecionada && racaSelecionada !== 'Outra' && (
                  <div className="mt-2 text-xs text-slate-500">
                    {/* Aqui serão adicionados campos específicos por raça no futuro */}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Genealogia */}
        <Card>
          <CardHeader>
            <CardTitle>Genealogia</CardTitle>
          </CardHeader>
          <CardContent>
            <GenealogiaTree
              value={genealogia}
              onChange={setGenealogia}
              doadoraNome={formData.nome || formData.registro}
              doadoraRegistro={formData.registro}
            />
            
            <div className="mt-4 space-y-2">
              <Label htmlFor="genealogia_texto">Observações sobre Genealogia</Label>
              <Textarea
                id="genealogia_texto"
                value={formData.genealogia_texto}
                onChange={(e) =>
                  setFormData({ ...formData, genealogia_texto: e.target.value })
                }
                placeholder="Informações adicionais sobre genealogia (opcional)"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Campos específicos da Raça Gir */}
        {racaSelecionada === 'Gir' && (
          <Card>
            <CardHeader>
              <CardTitle>Informações Específicas - Raça Gir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gpta">GPTA</Label>
                  <Input
                    id="gpta"
                    type="number"
                    value={formData.gpta}
                    onChange={(e) => setFormData({ ...formData, gpta: e.target.value })}
                    placeholder="GPTA"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="controle_leiteiro">Controle Leiteiro</Label>
                  <Input
                    id="controle_leiteiro"
                    type="number"
                    value={formData.controle_leiteiro}
                    onChange={(e) => setFormData({ ...formData, controle_leiteiro: e.target.value })}
                    placeholder="Controle Leiteiro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="beta_caseina">Beta Caseína</Label>
                  <Input
                    id="beta_caseina"
                    value={formData.beta_caseina}
                    onChange={(e) => setFormData({ ...formData, beta_caseina: e.target.value })}
                    placeholder="Beta Caseína"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="link_abcz">Link ABCZ</Label>
                <Input
                  id="link_abcz"
                  type="url"
                  value={formData.link_abcz}
                  onChange={(e) => setFormData({ ...formData, link_abcz: e.target.value })}
                  placeholder="URL do link ABCZ"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informações Adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Adicionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="disponivel_aspiracao">Disponível para Aspiração</Label>
                <p className="text-sm text-slate-500">Indica se a doadora está disponível para aspiração</p>
              </div>
              <Switch
                id="disponivel_aspiracao"
                checked={formData.disponivel_aspiracao}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, disponivel_aspiracao: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="classificacao_genetica">Classificação Genética</Label>
              <Select
                value={formData.classificacao_genetica}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    classificacao_genetica: value as '1_estrela' | '2_estrelas' | '3_estrelas' | 'diamante' | '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1_estrela">1 Estrela</SelectItem>
                  <SelectItem value="2_estrelas">2 Estrelas</SelectItem>
                  <SelectItem value="3_estrelas">3 Estrelas</SelectItem>
                  <SelectItem value="diamante">Diamante</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Classificação opcional do preço da genética</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="foto_url">Foto</Label>
              <Input
                id="foto_url"
                type="url"
                value={formData.foto_url}
                onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
                placeholder="URL da foto"
              />
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/doadoras')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-green-600 hover:bg-green-700"
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
