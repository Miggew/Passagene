import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Fazenda, Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { handleError } from '@/lib/error-handler';
import { Search, Building2, Users, MapPin } from 'lucide-react';

interface FazendaWithCliente extends Fazenda {
  cliente_nome?: string;
}

export default function Fazendas() {
  const [fazendas, setFazendas] = useState<FazendaWithCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCliente, setFiltroCliente] = useState<string>('todos');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load clientes first
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (clientesError) throw clientesError;
      setClientes(clientesData || []);

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;

      const clientesMap = new Map((clientesData || []).map((c) => [c.id, c.nome]));

      const fazendasWithCliente = fazendasData?.map((f) => ({
        ...f,
        cliente_nome: clientesMap.get(f.cliente_id),
      }));

      setFazendas(fazendasWithCliente || []);
    } catch (error) {
      handleError(error, 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const filteredFazendas = fazendas.filter(fazenda => {
    const matchesSearch = !searchTerm ||
      fazenda.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fazenda.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fazenda.responsavel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fazenda.localizacao?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCliente = filtroCliente === 'todos' || fazenda.cliente_id === filtroCliente;

    return matchesSearch && matchesCliente;
  });

  // Stats
  const totalFazendas = fazendas.length;
  const totalClientes = new Set(fazendas.map(f => f.cliente_id)).size;
  const comResponsavel = fazendas.filter(f => f.responsavel).length;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fazendas" description="Gerenciar fazendas do sistema" />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total de Fazendas</p>
                <p className="text-2xl font-bold">{totalFazendas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold">{totalClientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Com Responsável</p>
                <p className="text-2xl font-bold">{comResponsavel}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cliente, responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filtroCliente} onValueChange={setFiltroCliente}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clientes.map((cliente) => (
              <SelectItem key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchTerm || filtroCliente !== 'todos') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setFiltroCliente('todos');
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Fazendas ({filteredFazendas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFazendas.length === 0 ? (
            <EmptyState
              title="Nenhuma fazenda encontrada"
              description={searchTerm || filtroCliente !== 'todos'
                ? "Tente ajustar os filtros de busca"
                : "Cadastre uma fazenda para começar."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Localização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFazendas.map((fazenda) => (
                  <TableRow
                    key={fazenda.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => navigate(`/fazendas/${fazenda.id}`)}
                  >
                    <TableCell className="font-medium text-primary">
                      {fazenda.nome}
                    </TableCell>
                    <TableCell>{fazenda.cliente_nome || '-'}</TableCell>
                    <TableCell>{fazenda.responsavel || '-'}</TableCell>
                    <TableCell>{fazenda.contato_responsavel || '-'}</TableCell>
                    <TableCell>{fazenda.localizacao || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
