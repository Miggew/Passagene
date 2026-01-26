import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Touro, TouroInsert } from '@/lib/types';
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
import { Switch } from '@/components/ui/switch';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Beef } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import CamposDinamicosPorRaca from '@/components/touros/CamposDinamicosPorRaca';

const racasBovinas = ['Holandesa', 'Jersey', 'Gir', 'Girolando', 'Nelore', 'Angus', 'Brahman', 'Hereford', 'Simmental', 'Tabapuã', 'Sindi', 'Caracu', 'Canchim', 'Senepol', 'Brangus', 'Gir Leiteiro', 'Guzerá'];

export default function TouroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touro, setTouro] = useState<Touro | null>(null);

  const [formData, setFormData] = useState({
    registro: '',
    nome: '',
    raca: '',
    data_nascimento: '',
    proprietario: '',
    fazenda_nome: '',
    pai_registro: '',
    pai_nome: '',
    mae_registro: '',
    mae_nome: '',
    genealogia_texto: '',
    link_catalogo: '',
    foto_url: '',
    link_video: '',
    observacoes: '',
    disponivel: true,
  });

  // Campos dinâmicos em JSONB
  type ValorDinamico = string | number | boolean | null | undefined;
  const [dadosDinamicos, setDadosDinamicos] = useState({
    dados_geneticos: {} as Record<string, ValorDinamico>,
    dados_producao: {} as Record<string, ValorDinamico>,
    dados_conformacao: {} as Record<string, ValorDinamico>,
    medidas_fisicas: {} as Record<string, ValorDinamico>,
    dados_saude_reproducao: {} as Record<string, ValorDinamico>,
    caseinas: {} as Record<string, ValorDinamico>,
    outros_dados: {} as Record<string, ValorDinamico>,
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: touroData, error: touroError } = await supabase
        .from('touros')
        .select('*')
        .eq('id', id)
        .single();

      if (touroError) throw touroError;
      setTouro(touroData);

      setFormData({
        registro: touroData.registro || '',
        nome: touroData.nome || '',
        raca: touroData.raca || '',
        data_nascimento: touroData.data_nascimento || '',
        proprietario: touroData.proprietario || '',
        fazenda_nome: touroData.fazenda_nome || '',
        pai_registro: touroData.pai_registro || '',
        pai_nome: touroData.pai_nome || '',
        mae_registro: touroData.mae_registro || '',
        mae_nome: touroData.mae_nome || '',
        genealogia_texto: touroData.genealogia_texto || '',
        link_catalogo: touroData.link_catalogo || '',
        foto_url: touroData.foto_url || '',
        link_video: touroData.link_video || '',
        observacoes: touroData.observacoes || '',
        disponivel: touroData.disponivel ?? true,
      });

      // Carregar dados dinâmicos do JSONB
      setDadosDinamicos({
        dados_geneticos: touroData.dados_geneticos || {},
        dados_producao: touroData.dados_producao || {},
        dados_conformacao: touroData.dados_conformacao || {},
        medidas_fisicas: touroData.medidas_fisicas || {},
        dados_saude_reproducao: touroData.dados_saude_reproducao || {},
        caseinas: touroData.caseinas || {},
        outros_dados: touroData.outros_dados || {},
      });
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

    if (!formData.nome.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Nome é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      // Limpar campos vazios dos dados dinâmicos antes de salvar
      const limparCamposVazios = (obj: Record<string, ValorDinamico>): Record<string, ValorDinamico> | null => {
        const limpo: Record<string, ValorDinamico> = {};
        Object.entries(obj).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            limpo[key] = value;
          }
        });
        return Object.keys(limpo).length > 0 ? limpo : null;
      };

      const updateData: TouroInsert = {
        registro: formData.registro.trim(),
        nome: formData.nome.trim(),
        raca: formData.raca || undefined,
        data_nascimento: formData.data_nascimento || undefined,
        proprietario: formData.proprietario.trim() || undefined,
        fazenda_nome: formData.fazenda_nome.trim() || undefined,
        pai_registro: formData.pai_registro.trim() || undefined,
        pai_nome: formData.pai_nome.trim() || undefined,
        mae_registro: formData.mae_registro.trim() || undefined,
        mae_nome: formData.mae_nome.trim() || undefined,
        genealogia_texto: formData.genealogia_texto.trim() || undefined,
        link_catalogo: formData.link_catalogo.trim() || undefined,
        foto_url: formData.foto_url.trim() || undefined,
        link_video: formData.link_video.trim() || undefined,
        observacoes: formData.observacoes.trim() || undefined,
        disponivel: formData.disponivel,
        // Campos dinâmicos em JSONB
        dados_geneticos: limparCamposVazios(dadosDinamicos.dados_geneticos) || undefined,
        dados_producao: limparCamposVazios(dadosDinamicos.dados_producao) || undefined,
        dados_conformacao: limparCamposVazios(dadosDinamicos.dados_conformacao) || undefined,
        medidas_fisicas: limparCamposVazios(dadosDinamicos.medidas_fisicas) || undefined,
        dados_saude_reproducao: limparCamposVazios(dadosDinamicos.dados_saude_reproducao) || undefined,
        caseinas: limparCamposVazios(dadosDinamicos.caseinas) || undefined,
        outros_dados: limparCamposVazios(dadosDinamicos.outros_dados) || undefined,
      };

      const { error } = await supabase
        .from('touros')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Touro atualizado',
        description: 'Touro atualizado com sucesso',
      });

      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao atualizar touro',
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

  if (!touro) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Touro não encontrado"
          description="Volte para a lista e selecione outro touro."
          action={(
            <Button onClick={() => navigate('/touros')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Catálogo de Touros
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={(
          <span className="flex items-center gap-2">
            <Beef className="w-8 h-8" />
            {formData.nome || formData.registro}
          </span>
        )}
        description={`${formData.registro}${formData.raca ? ` • ${formData.raca}` : ''}`}
        actions={(
          <Button onClick={() => navigate('/touros')} variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
      />

      {/* Foto do Touro (se houver) */}
      {formData.foto_url && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <img
                src={formData.foto_url}
                alt={formData.nome}
                className="max-w-md w-full h-auto rounded-lg shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

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
                  placeholder="Registro do touro"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do touro"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="raca">Raça</Label>
                <Select
                  value={formData.raca}
                  onValueChange={(value) => setFormData({ ...formData, raca: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a raça" />
                  </SelectTrigger>
                  <SelectContent>
                    {racasBovinas.map((raca) => (
                      <SelectItem key={raca} value={raca}>
                        {raca}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input
                  id="data_nascimento"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proprietario">Proprietário</Label>
                <Input
                  id="proprietario"
                  value={formData.proprietario}
                  onChange={(e) => setFormData({ ...formData, proprietario: e.target.value })}
                  placeholder="Nome do proprietário"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fazenda_nome">Fazenda</Label>
                <Input
                  id="fazenda_nome"
                  value={formData.fazenda_nome}
                  onChange={(e) => setFormData({ ...formData, fazenda_nome: e.target.value })}
                  placeholder="Nome da fazenda"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campos Dinâmicos por Raça */}
        {formData.raca && (
          <CamposDinamicosPorRaca
            raca={formData.raca}
            valores={{
              ...dadosDinamicos.dados_geneticos,
              ...dadosDinamicos.dados_producao,
              ...dadosDinamicos.dados_conformacao,
              ...dadosDinamicos.medidas_fisicas,
              ...dadosDinamicos.dados_saude_reproducao,
              ...dadosDinamicos.caseinas,
              ...dadosDinamicos.outros_dados,
            }}
            onChange={(campo, valor, categoria) => {
              setDadosDinamicos((prev) => ({
                ...prev,
                [categoria]: {
                  ...prev[categoria as keyof typeof prev],
                  [campo]: valor === '' ? undefined : valor,
                },
              }));
            }}
          />
        )}

        {/* Pedigree */}
        <Card>
          <CardHeader>
            <CardTitle>Pedigree</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pai_registro">Registro do Pai</Label>
                <Input
                  id="pai_registro"
                  value={formData.pai_registro}
                  onChange={(e) => setFormData({ ...formData, pai_registro: e.target.value })}
                  placeholder="Registro do pai"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pai_nome">Nome do Pai</Label>
                <Input
                  id="pai_nome"
                  value={formData.pai_nome}
                  onChange={(e) => setFormData({ ...formData, pai_nome: e.target.value })}
                  placeholder="Nome do pai"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mae_registro">Registro da Mãe</Label>
                <Input
                  id="mae_registro"
                  value={formData.mae_registro}
                  onChange={(e) => setFormData({ ...formData, mae_registro: e.target.value })}
                  placeholder="Registro da mãe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mae_nome">Nome da Mãe</Label>
                <Input
                  id="mae_nome"
                  value={formData.mae_nome}
                  onChange={(e) => setFormData({ ...formData, mae_nome: e.target.value })}
                  placeholder="Nome da mãe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="genealogia_texto">Genealogia Completa (Texto)</Label>
              <Textarea
                id="genealogia_texto"
                value={formData.genealogia_texto}
                onChange={(e) => setFormData({ ...formData, genealogia_texto: e.target.value })}
                placeholder="Genealogia completa em formato texto"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Links e Mídia */}
        <Card>
          <CardHeader>
            <CardTitle>Links e Mídia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="link_catalogo">Link do Catálogo</Label>
                  <Input
                    id="link_catalogo"
                    type="url"
                    value={formData.link_catalogo}
                    onChange={(e) => setFormData({ ...formData, link_catalogo: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="foto_url">URL da Foto</Label>
                  <Input
                    id="foto_url"
                    type="url"
                    value={formData.foto_url}
                    onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link_video">Link do Vídeo (YouTube, etc.)</Label>
                  <Input
                    id="link_video"
                    type="url"
                    value={formData.link_video}
                    onChange={(e) => setFormData({ ...formData, link_video: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
          </CardContent>
        </Card>

        {/* Outros */}
        <Card>
          <CardHeader>
            <CardTitle>Outros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="disponivel">Disponível no Catálogo</Label>
                <p className="text-sm text-slate-500">Indica se o touro está disponível no catálogo</p>
              </div>
              <Switch
                id="disponivel"
                checked={formData.disponivel}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, disponivel: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais sobre o touro"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/touros')}
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
