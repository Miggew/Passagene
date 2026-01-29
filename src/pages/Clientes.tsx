import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Plus, Eye, Search, Users, Building2, MapPin } from 'lucide-react';
import { handleError } from '@/lib/error-handler';

interface ClienteWithStats extends Cliente {
  fazendas_count?: number;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      // Load clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (clientesError) throw clientesError;

      // Load fazendas count per cliente
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('cliente_id');

      if (fazendasError) throw fazendasError;

      // Count fazendas per cliente
      const fazendasCount = new Map<string, number>();
      (fazendasData || []).forEach(f => {
        const count = fazendasCount.get(f.cliente_id) || 0;
        fazendasCount.set(f.cliente_id, count + 1);
      });

      const clientesWithStats = (clientesData || []).map(c => ({
        ...c,
        fazendas_count: fazendasCount.get(c.id) || 0,
      }));

      setClientes(clientesWithStats);
    } catch (error) {
      handleError(error, 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const filteredClientes = clientes.filter(cliente => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cliente.nome?.toLowerCase().includes(search) ||
      cliente.telefone?.toLowerCase().includes(search) ||
      cliente.endereco?.toLowerCase().includes(search)
    );
  });

  // Stats
  const totalClientes = clientes.length;
  const totalFazendas = clientes.reduce((acc, c) => acc + (c.fazendas_count || 0), 0);
  const clientesComFazenda = clientes.filter(c => (c.fazendas_count || 0) > 0).length;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gerenciar clientes do sistema"
        actions={
          <Link to="/clientes/novo">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </Link>
        }
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total de Clientes</p>
                <p className="text-2xl font-bold">{totalClientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Com Fazendas</p>
                <p className="text-2xl font-bold">{clientesComFazenda}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Fazendas</p>
                <p className="text-2xl font-bold">{totalFazendas}</p>
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
            placeholder="Buscar por nome, telefone ou endereço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        {searchTerm && (
          <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
            Limpar filtro
          </Button>
        )}
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes ({filteredClientes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClientes.length === 0 ? (
            <EmptyState
              title="Nenhum cliente encontrado"
              description={searchTerm
                ? "Tente ajustar os filtros de busca"
                : "Cadastre o primeiro cliente para começar."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Fazendas</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">{cliente.nome}</TableCell>
                    <TableCell>{cliente.telefone || '-'}</TableCell>
                    <TableCell>{cliente.endereco || '-'}</TableCell>
                    <TableCell>
                      {cliente.fazendas_count ? (
                        <span className="text-primary font-medium">{cliente.fazendas_count}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cliente.created_at
                        ? new Date(cliente.created_at).toLocaleDateString('pt-BR')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/clientes/${cliente.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                      </Link>
                    </TableCell>
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
