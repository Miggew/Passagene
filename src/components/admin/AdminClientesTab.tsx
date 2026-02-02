import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { handleError } from '@/lib/error-handler';
import { Plus, Eye, Search, Filter, X, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClienteWithStats extends Cliente {
  fazendas_count?: number;
}

const ITENS_POR_PAGINA = 15;

export default function AdminClientesTab() {
  const { toast } = useToast();
  const [clientes, setClientes] = useState<ClienteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    endereco: '',
  });

  // Paginacao
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      setLoading(true);

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

  // Filtrar clientes
  const filteredClientes = useMemo(() => {
    if (!searchTerm) return clientes;
    const search = searchTerm.toLowerCase();
    return clientes.filter(cliente =>
      cliente.nome?.toLowerCase().includes(search) ||
      cliente.telefone?.toLowerCase().includes(search) ||
      cliente.endereco?.toLowerCase().includes(search)
    );
  }, [clientes, searchTerm]);

  // Paginacao
  const totalPaginas = Math.ceil(filteredClientes.length / ITENS_POR_PAGINA);
  const clientesPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return filteredClientes.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [filteredClientes, paginaAtual]);

  // Reset pagina quando filtrar
  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm]);

  const handleOpenDialog = (cliente?: Cliente) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        nome: cliente.nome || '',
        telefone: cliente.telefone || '',
        endereco: cliente.endereco || '',
      });
    } else {
      setEditingCliente(null);
      setFormData({
        nome: '',
        telefone: '',
        endereco: '',
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingCliente(null);
    setFormData({
      nome: '',
      telefone: '',
      endereco: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast({
        title: 'Erro de validacao',
        description: 'Nome e obrigatorio',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      if (editingCliente) {
        // Update
        const { error } = await supabase
          .from('clientes')
          .update({
            nome: formData.nome.trim(),
            telefone: formData.telefone.trim() || null,
            endereco: formData.endereco.trim() || null,
          })
          .eq('id', editingCliente.id);

        if (error) throw error;

        toast({
          title: 'Cliente atualizado',
          description: 'Cliente atualizado com sucesso',
        });
      } else {
        // Insert
        const { error } = await supabase
          .from('clientes')
          .insert([{
            nome: formData.nome.trim(),
            telefone: formData.telefone.trim() || null,
            endereco: formData.endereco.trim() || null,
          }]);

        if (error) throw error;

        toast({
          title: 'Cliente criado',
          description: 'Cliente criado com sucesso',
        });
      }

      handleCloseDialog();
      loadClientes();
    } catch (error) {
      handleError(error, 'Erro ao salvar cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const handleVerDetalhes = (cliente: Cliente) => {
    // Abre dialog de edicao ao clicar em ver detalhes
    handleOpenDialog(cliente);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <div className="flex flex-wrap items-end gap-6">
          {/* Grupo: Busca */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Filter className="w-3.5 h-3.5" />
              <span>Busca</span>
            </div>
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou endereco..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Botao Limpar */}
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="h-9"
            >
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          )}

          {/* Botao Novo Cliente */}
          <Button onClick={() => handleOpenDialog()} className="h-9 ml-auto">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Tabela Premium */}
      {filteredClientes.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description={searchTerm
            ? "Tente ajustar os filtros de busca"
            : "Cadastre o primeiro cliente para comecar."
          }
          action={!searchTerm && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          )}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header da tabela */}
          <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
            <div className="grid grid-cols-[2fr_1fr_1.5fr_0.8fr_1fr_0.6fr] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-primary/40" />
                Nome
              </div>
              <div className="px-3 py-3">Telefone</div>
              <div className="px-3 py-3">Endereco</div>
              <div className="px-3 py-3 text-center">Fazendas</div>
              <div className="px-3 py-3 text-center">Cadastro</div>
              <div className="px-2 py-3"></div>
            </div>
          </div>

          {/* Linhas */}
          <div className="divide-y divide-border/50">
            {clientesPaginados.map((cliente, index) => (
              <div
                key={cliente.id}
                className={`
                  group grid grid-cols-[2fr_1fr_1.5fr_0.8fr_1fr_0.6fr] items-center cursor-pointer transition-all duration-150
                  hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent
                  ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                `}
                onClick={() => handleVerDetalhes(cliente)}
              >
                {/* Nome */}
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-0.5 h-8 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                  <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {cliente.nome}
                  </span>
                </div>

                {/* Telefone */}
                <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                  {cliente.telefone || '-'}
                </div>

                {/* Endereco */}
                <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                  {cliente.endereco || '-'}
                </div>

                {/* Fazendas count */}
                <div className="px-3 py-3.5 flex justify-center">
                  <span className={`
                    inline-flex items-center justify-center min-w-7 h-7 px-2 text-xs font-semibold rounded-md
                    ${(cliente.fazendas_count || 0) > 0
                      ? 'bg-primary/10 text-primary group-hover:bg-primary/20'
                      : 'bg-muted text-muted-foreground'
                    } transition-colors
                  `}>
                    {cliente.fazendas_count || 0}
                  </span>
                </div>

                {/* Data cadastro */}
                <div className="px-3 py-3.5 text-sm text-center text-muted-foreground">
                  {cliente.created_at ? formatDate(cliente.created_at) : '-'}
                </div>

                {/* Acoes */}
                <div className="px-2 py-3.5 flex justify-center gap-1">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent group-hover:bg-primary/10 transition-colors">
                    <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginacao */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 border-t border-border">
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{((paginaAtual - 1) * ITENS_POR_PAGINA) + 1}-{Math.min(paginaAtual * ITENS_POR_PAGINA, filteredClientes.length)}</span>
                {' '}de{' '}
                <span className="font-medium text-foreground">{filteredClientes.length}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                  disabled={paginaAtual === 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-0.5 mx-2">
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    let pageNum;
                    if (totalPaginas <= 5) pageNum = i + 1;
                    else if (paginaAtual <= 3) pageNum = i + 1;
                    else if (paginaAtual >= totalPaginas - 2) pageNum = totalPaginas - 4 + i;
                    else pageNum = paginaAtual - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPaginaAtual(pageNum)}
                        className={`
                          w-8 h-8 text-xs font-medium rounded-md transition-all
                          ${paginaAtual === pageNum
                            ? 'bg-primary/15 text-primary shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }
                        `}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  Proximo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog de criacao/edicao */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription>
              {editingCliente
                ? `Editando ${editingCliente.nome}`
                : 'Preencha os dados do novo cliente'
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do cliente"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco">Endereco</Label>
              <Textarea
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Endereco completo"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : (editingCliente ? 'Salvar' : 'Criar Cliente')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
