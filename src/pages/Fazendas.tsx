import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Fazenda } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface FazendaWithCliente extends Fazenda {
  cliente_nome?: string;
}

export default function Fazendas() {
  const [fazendas, setFazendas] = useState<FazendaWithCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;

      // Load clientes
      const clienteIds = [...new Set(fazendasData?.map((f) => f.cliente_id))];
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .in('id', clienteIds);

      if (clientesError) throw clientesError;

      const clientesMap = new Map(clientesData?.map((c) => [c.id, c.nome]));

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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fazendas" description="Gerenciar fazendas do sistema" />

      <Card>
        <CardHeader>
          <CardTitle>Lista de Fazendas</CardTitle>
        </CardHeader>
        <CardContent>
          {fazendas.length === 0 ? (
            <EmptyState title="Nenhuma fazenda cadastrada" description="Cadastre uma fazenda para começar." />
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
                {fazendas.map((fazenda) => (
                  <TableRow
                    key={fazenda.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/fazendas/${fazenda.id}`)}
                  >
                    <TableCell className="font-medium text-green-600">
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