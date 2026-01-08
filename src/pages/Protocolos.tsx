import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Fazenda } from '@/lib/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Plus, Eye, PlayCircle } from 'lucide-react';

interface ProtocoloWithFazenda extends ProtocoloSincronizacao {
  fazenda_nome: string;
  receptoras_count: number;
}

export default function Protocolos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [protocolosPasso1, setProtocolosPasso1] = useState<ProtocoloWithFazenda[]>([]);
  const [protocolosPasso2, setProtocolosPasso2] = useState<ProtocoloWithFazenda[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [fazendaFilterPasso2, setFazendaFilterPasso2] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadFazendas(),
        loadProtocolosPasso1(),
        loadProtocolosPasso2(),
      ]);
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

  const loadFazendas = async () => {
    const { data, error } = await supabase
      .from('fazendas')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    setFazendas(data || []);
  };

  const loadProtocolosPasso1 = async () => {
    try {
      // Load protocols with status PASSO1_ABERTO or ABERTO (1st step in progress)
      const { data: protocolos, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('*')
        .in('status', ['PASSO1_ABERTO', 'ABERTO'])
        .order('data_inicio', { ascending: false });

      if (protocolosError) throw protocolosError;

      const protocolosWithDetails: ProtocoloWithFazenda[] = [];

      for (const protocolo of protocolos || []) {
        // Get fazenda name
        const { data: fazendaData } = await supabase
          .from('fazendas')
          .select('nome')
          .eq('id', protocolo.fazenda_id)
          .single();

        // Count receptoras
        const { count } = await supabase
          .from('protocolo_receptoras')
          .select('*', { count: 'exact', head: true })
          .eq('protocolo_id', protocolo.id);

        protocolosWithDetails.push({
          ...protocolo,
          fazenda_nome: fazendaData?.nome || 'N/A',
          receptoras_count: count || 0,
        });
      }

      setProtocolosPasso1(protocolosWithDetails);
    } catch (error) {
      console.error('Error loading protocolos passo 1:', error);
    }
  };

  const loadProtocolosPasso2 = async () => {
    try {
      // Load protocols with status PASSO1_FECHADO or PRIMEIRO_PASSO_FECHADO (waiting for 2nd step)
      const { data: protocolos, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('*')
        .in('status', ['PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO'])
        .order('data_inicio', { ascending: false });

      if (protocolosError) throw protocolosError;

      const protocolosWithDetails: ProtocoloWithFazenda[] = [];

      for (const protocolo of protocolos || []) {
        // Get fazenda name
        const { data: fazendaData } = await supabase
          .from('fazendas')
          .select('nome')
          .eq('id', protocolo.fazenda_id)
          .single();

        // Count receptoras with status INICIADA (EM SINCRONIZAÇÃO)
        const { count } = await supabase
          .from('protocolo_receptoras')
          .select('*', { count: 'exact', head: true })
          .eq('protocolo_id', protocolo.id)
          .eq('status', 'INICIADA');

        protocolosWithDetails.push({
          ...protocolo,
          fazenda_nome: fazendaData?.nome || 'N/A',
          receptoras_count: count || 0,
        });
      }

      setProtocolosPasso2(protocolosWithDetails);
    } catch (error) {
      console.error('Error loading protocolos passo 2:', error);
    }
  };

  const filteredProtocolosPasso2 = fazendaFilterPasso2
    ? protocolosPasso2.filter((p) => p.fazenda_id === fazendaFilterPasso2)
    : protocolosPasso2;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Protocolos de Sincronização</h1>
          <p className="text-slate-600 mt-1">Gerenciar protocolos em 2 passos</p>
        </div>
        <Button
          onClick={() => navigate('/protocolos/novo')}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Protocolo (1º Passo)
        </Button>
      </div>

      <Tabs defaultValue="passo1" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="passo1">
            1º Passo (em andamento) - {protocolosPasso1.length}
          </TabsTrigger>
          <TabsTrigger value="passo2">
            2º Passo (para confirmar) - {protocolosPasso2.length}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="passo1" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Protocolos em Andamento (1º Passo)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fazenda</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Receptoras</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {protocolosPasso1.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        Nenhum protocolo em andamento no 1º passo
                      </TableCell>
                    </TableRow>
                  ) : (
                    protocolosPasso1.map((protocolo) => (
                      <TableRow key={protocolo.id}>
                        <TableCell className="font-medium">{protocolo.fazenda_nome}</TableCell>
                        <TableCell>
                          {new Date(protocolo.data_inicio).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{protocolo.responsavel_inicio}</TableCell>
                        <TableCell>{protocolo.receptoras_count}</TableCell>
                        <TableCell>
                          <Badge variant="default">1º Passo</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/protocolos/${protocolo.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Gerenciar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passo2" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtrar por Fazenda</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={fazendaFilterPasso2} onValueChange={setFazendaFilterPasso2}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Todas as fazendas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fazendas</SelectItem>
                  {fazendas.map((fazenda) => (
                    <SelectItem key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Protocolos Aguardando 2º Passo</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fazenda</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Receptoras Pendentes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProtocolosPasso2.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        {fazendaFilterPasso2
                          ? 'Nenhum protocolo aguardando 2º passo nesta fazenda'
                          : 'Nenhum protocolo aguardando 2º passo'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProtocolosPasso2.map((protocolo) => (
                      <TableRow key={protocolo.id}>
                        <TableCell className="font-medium">{protocolo.fazenda_nome}</TableCell>
                        <TableCell>
                          {new Date(protocolo.data_inicio).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{protocolo.responsavel_inicio}</TableCell>
                        <TableCell>{protocolo.receptoras_count}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Aguardando 2º Passo</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => navigate(`/protocolos/${protocolo.id}/passo2`)}
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            INICIAR 2º PASSO
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}