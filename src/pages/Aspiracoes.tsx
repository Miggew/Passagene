import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { PacoteAspiracao, Fazenda } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { Plus, Eye } from 'lucide-react';

interface PacoteComNomes extends PacoteAspiracao {
  fazenda_nome?: string;
  fazendas_destino_nomes?: string[];
  quantidade_doadoras?: number;
}

export default function Aspiracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pacotes, setPacotes] = useState<PacoteComNomes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load pacotes
      const { data: pacotesData, error: pacotesError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .order('data_aspiracao', { ascending: false })
        .order('created_at', { ascending: false });

      if (pacotesError) throw pacotesError;

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;

      const fazendasMap = new Map(fazendasData?.map((f) => [f.id, f.nome]) || []);

      // Load quantidade de doadoras por pacote
      const pacoteIds = pacotesData?.map((p) => p.id) || [];
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('pacote_aspiracao_id')
        .in('pacote_aspiracao_id', pacoteIds);

      if (aspiracoesError) throw aspiracoesError;

      // Contar doadoras por pacote
      const quantidadePorPacote = new Map<string, number>();
      aspiracoesData?.forEach((a) => {
        if (a.pacote_aspiracao_id) {
          quantidadePorPacote.set(
            a.pacote_aspiracao_id,
            (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1
          );
        }
      });

      // Load múltiplas fazendas destino
      const { data: fazendasDestinoData } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .select('pacote_aspiracao_id, fazenda_destino_id')
        .in('pacote_aspiracao_id', pacoteIds);

      // Agrupar fazendas destino por pacote
      const fazendasDestinoPorPacote = new Map<string, string[]>();
      fazendasDestinoData?.forEach((item) => {
        const nomes = fazendasDestinoPorPacote.get(item.pacote_aspiracao_id) || [];
        const nome = fazendasMap.get(item.fazenda_destino_id);
        if (nome && !nomes.includes(nome)) {
          nomes.push(nome);
        }
        fazendasDestinoPorPacote.set(item.pacote_aspiracao_id, nomes);
      });

      const pacotesComNomes: PacoteComNomes[] = (pacotesData || []).map((p) => {
        // Se não houver na tabela de relacionamento, usar a fazenda_destino_id legacy
        let fazendasDestinoNomes = fazendasDestinoPorPacote.get(p.id);
        if (!fazendasDestinoNomes || fazendasDestinoNomes.length === 0) {
          if (p.fazenda_destino_id) {
            const nomeLegacy = fazendasMap.get(p.fazenda_destino_id);
            fazendasDestinoNomes = nomeLegacy ? [nomeLegacy] : [];
          } else {
            fazendasDestinoNomes = [];
          }
        }

        return {
          ...p,
          fazenda_nome: fazendasMap.get(p.fazenda_id),
          fazendas_destino_nomes: fazendasDestinoNomes,
          quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
        };
      });

      setPacotes(pacotesComNomes);
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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pacotes de Aspiração</h1>
          <p className="text-slate-600 mt-1">Gerenciar pacotes de aspiração</p>
        </div>
        <Button
          onClick={() => navigate('/aspiracoes/novo')}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Pacote
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pacotes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fazenda</TableHead>
                <TableHead>Fazenda Destino</TableHead>
                <TableHead>Horário Início</TableHead>
                <TableHead>Doadoras</TableHead>
                <TableHead>Total Oócitos</TableHead>
                <TableHead>Veterinário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-500">
                    Nenhum pacote de aspiração cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                pacotes.map((pacote) => (
                  <TableRow
                    key={pacote.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/aspiracoes/${pacote.id}`)}
                  >
                    <TableCell>{formatDate(pacote.data_aspiracao)}</TableCell>
                    <TableCell className="font-medium">{pacote.fazenda_nome || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {pacote.fazendas_destino_nomes && pacote.fazendas_destino_nomes.length > 0 ? (
                          pacote.fazendas_destino_nomes.map((nome, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {nome}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{pacote.horario_inicio || '-'}</TableCell>
                    <TableCell>{pacote.quantidade_doadoras || 0}</TableCell>
                    <TableCell className="font-medium">{pacote.total_oocitos || 0}</TableCell>
                    <TableCell>{pacote.veterinario_responsavel || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={pacote.status === 'FINALIZADO' ? 'default' : 'secondary'}>
                        {pacote.status === 'FINALIZADO' ? 'FINALIZADO' : 'EM ANDAMENTO'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/aspiracoes/${pacote.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
