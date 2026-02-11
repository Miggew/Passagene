import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Hub, UserProfile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Edit, Shield, Search, Filter, X, Users } from 'lucide-react';

interface UserWithPermissions extends UserProfile {
  hub_permissions: string[];
  clientes_vinculados: string[]; // IDs dos clientes para operacional
}

interface Cliente {
  id: string;
  nome: string;
}

const ITENS_POR_PAGINA = 15;

export default function AdminUsuariosTab() {
  const { toast } = useToast();
  const { permissions } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  // Dialog states
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithPermissions | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Paginacao
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    user_type: 'operacional' as 'admin' | 'cliente' | 'operacional',
    cliente_id: '',
    clientes_vinculados: [] as string[], // Para operacional - multiplos clientes
    active: true,
    hub_permissions: [] as string[],
  });

  const isAdmin = permissions?.isAdmin;

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load hubs
      const { data: hubsData, error: hubsError } = await supabase
        .from('hubs')
        .select('*')
        .order('display_order');

      if (hubsError) throw hubsError;
      setHubs(hubsData || []);

      // Load clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome');

      if (clientesError) throw clientesError;
      setClientes(clientesData || []);

      // Load users with permissions
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('nome');

      if (usersError) throw usersError;

      // Load permissions for all users
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_hub_permissions')
        .select('user_id, hub_code')
        .eq('can_access', true);

      if (permissionsError) throw permissionsError;

      // Load user_clientes (vinculos operacional-cliente)
      const { data: userClientesData, error: userClientesError } = await supabase
        .from('user_clientes')
        .select('user_id, cliente_id');

      if (userClientesError) throw userClientesError;

      // Map permissions to users
      const permissionsMap = new Map<string, string[]>();
      (permissionsData || []).forEach(p => {
        const current = permissionsMap.get(p.user_id) || [];
        current.push(p.hub_code);
        permissionsMap.set(p.user_id, current);
      });

      // Map clientes vinculados to users
      const clientesVinculadosMap = new Map<string, string[]>();
      (userClientesData || []).forEach(uc => {
        const current = clientesVinculadosMap.get(uc.user_id) || [];
        current.push(uc.cliente_id);
        clientesVinculadosMap.set(uc.user_id, current);
      });

      const usersWithPermissions: UserWithPermissions[] = (usersData || []).map(user => ({
        ...user,
        hub_permissions: permissionsMap.get(user.id) || [],
        clientes_vinculados: clientesVinculadosMap.get(user.id) || [],
      }));

      setUsers(usersWithPermissions);
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

  // Filtrar usuarios
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchTerm ||
        user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTipo = filtroTipo === 'todos' || user.user_type === filtroTipo;

      return matchesSearch && matchesTipo;
    });
  }, [users, searchTerm, filtroTipo]);

  // Paginacao
  const totalPaginas = Math.ceil(filteredUsers.length / ITENS_POR_PAGINA);
  const usersPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return filteredUsers.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [filteredUsers, paginaAtual]);

  // Reset pagina quando filtrar
  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, filtroTipo]);

  const handleOpenDialog = (user?: UserWithPermissions) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        nome: user.nome || '',
        email: user.email || '',
        user_type: user.user_type,
        cliente_id: user.cliente_id || '',
        clientes_vinculados: user.clientes_vinculados || [],
        active: user.active,
        hub_permissions: user.hub_permissions,
      });
    } else {
      setEditingUser(null);
      setFormData({
        nome: '',
        email: '',
        user_type: 'operacional',
        cliente_id: '',
        clientes_vinculados: [],
        active: true,
        hub_permissions: [],
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingUser(null);
    setFormData({
      nome: '',
      email: '',
      user_type: 'operacional',
      cliente_id: '',
      clientes_vinculados: [],
      active: true,
      hub_permissions: [],
    });
  };

  const handleToggleHubPermission = (hubCode: string) => {
    setFormData(prev => {
      const current = prev.hub_permissions;
      if (current.includes(hubCode)) {
        return { ...prev, hub_permissions: current.filter(h => h !== hubCode) };
      } else {
        return { ...prev, hub_permissions: [...current, hubCode] };
      }
    });
  };

  const handleToggleClienteVinculado = (clienteId: string) => {
    setFormData(prev => {
      const current = prev.clientes_vinculados;
      if (current.includes(clienteId)) {
        return { ...prev, clientes_vinculados: current.filter(c => c !== clienteId) };
      } else {
        return { ...prev, clientes_vinculados: [...current, clienteId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim() || !formData.email.trim()) {
      toast({
        title: 'Erro de validacao',
        description: 'Nome e email sao obrigatorios',
        variant: 'destructive',
      });
      return;
    }

    if (formData.user_type === 'cliente' && !formData.cliente_id) {
      toast({
        title: 'Erro de validacao',
        description: 'Selecione um cliente para usuarios do tipo Cliente',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      if (editingUser) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            nome: formData.nome,
            user_type: formData.user_type,
            cliente_id: formData.user_type === 'cliente' ? formData.cliente_id : null,
            active: formData.active,
          })
          .eq('id', editingUser.id);

        if (updateError) throw updateError;

        // Update permissions - delete all and re-insert
        const { error: deleteError } = await supabase
          .from('user_hub_permissions')
          .delete()
          .eq('user_id', editingUser.id);

        if (deleteError) throw deleteError;

        if (formData.hub_permissions.length > 0 && formData.user_type !== 'admin') {
          const permissionsToInsert = formData.hub_permissions.map(hub_code => ({
            user_id: editingUser.id,
            hub_code,
            can_access: true,
          }));

          const { error: insertError } = await supabase
            .from('user_hub_permissions')
            .insert(permissionsToInsert);

          if (insertError) throw insertError;
        }

        // Update user_clientes (vinculos operacional-cliente)
        // Delete existing and re-insert
        const { error: deleteClientesError } = await supabase
          .from('user_clientes')
          .delete()
          .eq('user_id', editingUser.id);

        if (deleteClientesError) throw deleteClientesError;

        // Insert new vinculos for operacional users
        if (formData.user_type === 'operacional' && formData.clientes_vinculados.length > 0) {
          const vinculosToInsert = formData.clientes_vinculados.map(cliente_id => ({
            user_id: editingUser.id,
            cliente_id,
          }));

          const { error: insertClientesError } = await supabase
            .from('user_clientes')
            .insert(vinculosToInsert);

          if (insertClientesError) throw insertClientesError;
        }

        toast({
          title: 'Usuario atualizado',
          description: 'Perfil e permissoes atualizados com sucesso',
        });
      } else {
        // For new users, check if there's already a user_profile for this email
        const { data: existingProfile, error: checkError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', formData.email.toLowerCase())
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingProfile) {
          toast({
            title: 'Usuario ja existe',
            description: 'Ja existe um perfil para este email. Use a opcao de editar.',
            variant: 'destructive',
          });
          return;
        }

        // Create new profile (user will need to sign up separately)
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            nome: formData.nome,
            email: formData.email.toLowerCase(),
            user_type: formData.user_type,
            cliente_id: formData.user_type === 'cliente' ? formData.cliente_id : null,
            active: formData.active,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert permissions
        if (formData.hub_permissions.length > 0 && formData.user_type !== 'admin') {
          const permissionsToInsert = formData.hub_permissions.map(hub_code => ({
            user_id: newProfile.id,
            hub_code,
            can_access: true,
          }));

          const { error: permError } = await supabase
            .from('user_hub_permissions')
            .insert(permissionsToInsert);

          if (permError) throw permError;
        }

        // Insert user_clientes for operacional users
        if (formData.user_type === 'operacional' && formData.clientes_vinculados.length > 0) {
          const vinculosToInsert = formData.clientes_vinculados.map(cliente_id => ({
            user_id: newProfile.id,
            cliente_id,
          }));

          const { error: clientesError } = await supabase
            .from('user_clientes')
            .insert(vinculosToInsert);

          if (clientesError) throw clientesError;
        }

        toast({
          title: 'Usuario criado',
          description: 'Perfil criado. O usuario precisa fazer cadastro com este email.',
        });
      }

      handleCloseDialog();
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: UserWithPermissions) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ active: !user.active })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: user.active ? 'Usuario desativado' : 'Usuario ativado',
        description: `${user.nome} foi ${user.active ? 'desativado' : 'ativado'}`,
      });

      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const getUserTypeBadge = (type: string) => {
    switch (type) {
      case 'admin':
        return <Badge className="bg-primary/10 text-primary border-primary/30">Admin</Badge>;
      case 'cliente':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Cliente</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Operacional</Badge>;
    }
  };

  const handleLimparFiltros = () => {
    setSearchTerm('');
    setFiltroTipo('todos');
  };

  if (!isAdmin) {
    return (
      <EmptyState
        title="Acesso negado"
        description="Apenas administradores podem acessar esta area."
      />
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-6">
          {/* Grupo: Busca */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-primary/40 self-center hidden md:block" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center hidden md:flex">
              <Filter className="w-3.5 h-3.5" />
              <span>Busca</span>
            </div>
            <div className="relative flex-1 min-w-0 md:min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-11 md:h-9"
              />
            </div>
          </div>

          {/* Separador */}
          <div className="h-10 w-px bg-border hidden md:block" />

          {/* Grupo: Tipo */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center hidden md:block" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center hidden md:flex">
              <Shield className="w-3.5 h-3.5" />
              <span>Tipo</span>
            </div>
            <div className="w-full md:w-[160px]">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botao Limpar */}
          {(searchTerm || filtroTipo !== 'todos') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLimparFiltros}
              className="h-11 md:h-9 w-full md:w-auto"
            >
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          )}

          {/* Botao Novo Usuario */}
          <Button onClick={() => handleOpenDialog()} className="h-11 md:h-9 w-full md:w-auto md:ml-auto">
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuario
          </Button>
        </div>
      </div>

      {/* Tabela Premium */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          title="Nenhum usuario encontrado"
          description={searchTerm || filtroTipo !== 'todos'
            ? "Tente ajustar os filtros"
            : "Cadastre o primeiro usuario"
          }
          action={!(searchTerm || filtroTipo !== 'todos') && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuario
            </Button>
          )}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Mobile: Cards */}
          <div className="md:hidden divide-y divide-border/50">
            {usersPaginados.map((user) => (
              <div key={user.id} className={`p-3.5 ${!user.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-base font-medium text-foreground block truncate">{user.nome || '-'}</span>
                    <span className="text-xs text-muted-foreground block truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {getUserTypeBadge(user.user_type)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {user.user_type === 'admin' ? (
                    <span className="text-primary font-medium">Acesso total</span>
                  ) : user.user_type === 'operacional' && user.clientes_vinculados.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.clientes_vinculados.slice(0, 3).map(clienteId => {
                        const cliente = clientes.find(c => c.id === clienteId);
                        return (
                          <Badge key={clienteId} className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                            {cliente?.nome?.substring(0, 15) || clienteId.substring(0, 8)}
                          </Badge>
                        );
                      })}
                      {user.clientes_vinculados.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{user.clientes_vinculados.length - 3}</Badge>
                      )}
                    </div>
                  ) : user.hub_permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.hub_permissions.map(hub => (
                        <Badge key={hub} variant="outline" className="text-[10px] px-1.5 py-0">{hub}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span>Nenhum acesso</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.active}
                      onCheckedChange={() => handleToggleActive(user)}
                    />
                    <span className="text-xs text-muted-foreground">{user.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-11" onClick={() => handleOpenDialog(user)}>
                    <Edit className="w-4 h-4 mr-1.5" />Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Header da tabela */}
          <div className="hidden md:block bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
            <div className="grid grid-cols-[1.5fr_1.5fr_0.8fr_1.5fr_0.6fr_0.6fr] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-primary/40" />
                Nome
              </div>
              <div className="px-3 py-3">Email</div>
              <div className="px-3 py-3 text-center">Tipo</div>
              <div className="px-3 py-3">Acesso</div>
              <div className="px-3 py-3 text-center">Ativo</div>
              <div className="px-2 py-3"></div>
            </div>
          </div>

          {/* Desktop: Linhas */}
          <div className="hidden md:block divide-y divide-border/50">
            {usersPaginados.map((user, index) => (
              <div
                key={user.id}
                className={`
                  group grid grid-cols-[1.5fr_1.5fr_0.8fr_1.5fr_0.6fr_0.6fr] items-center transition-all duration-150
                  hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent
                  ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                  ${!user.active ? 'opacity-50' : ''}
                `}
              >
                {/* Nome */}
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-0.5 h-8 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                  <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {user.nome || '-'}
                  </span>
                </div>

                {/* Email */}
                <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                  {user.email}
                </div>

                {/* Tipo */}
                <div className="px-3 py-3.5 flex justify-center">
                  {getUserTypeBadge(user.user_type)}
                </div>

                {/* Hubs / Clientes */}
                <div className="px-3 py-3.5">
                  {user.user_type === 'admin' ? (
                    <span className="text-primary text-xs font-medium">Acesso total</span>
                  ) : user.user_type === 'operacional' && user.clientes_vinculados.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.clientes_vinculados.slice(0, 2).map(clienteId => {
                        const cliente = clientes.find(c => c.id === clienteId);
                        return (
                          <Badge key={clienteId} className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                            {cliente?.nome?.substring(0, 10) || clienteId.substring(0, 8)}
                          </Badge>
                        );
                      })}
                      {user.clientes_vinculados.length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{user.clientes_vinculados.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : user.hub_permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.hub_permissions.slice(0, 3).map(hub => (
                        <Badge key={hub} variant="outline" className="text-[10px] px-1.5 py-0">
                          {hub}
                        </Badge>
                      ))}
                      {user.hub_permissions.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{user.hub_permissions.length - 3}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Nenhum</span>
                  )}
                </div>

                {/* Ativo */}
                <div className="px-3 py-3.5 flex justify-center">
                  <Switch
                    checked={user.active}
                    onCheckedChange={() => handleToggleActive(user)}
                  />
                </div>

                {/* Acoes */}
                <div className="px-2 py-3.5 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(user)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginacao */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 border-t border-border">
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{((paginaAtual - 1) * ITENS_POR_PAGINA) + 1}-{Math.min(paginaAtual * ITENS_POR_PAGINA, filteredUsers.length)}</span>
                {' '}de{' '}
                <span className="font-medium text-foreground">{filteredUsers.length}</span>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {editingUser ? 'Editar Usuario' : 'Novo Usuario'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? `Editando ${editingUser.nome || editingUser.email}`
                : 'Preencha os dados do novo usuario'
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
                placeholder="Nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                required
                disabled={!!editingUser}
              />
              {!editingUser && (
                <p className="text-xs text-muted-foreground">
                  O usuario precisara fazer cadastro com este email
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_type">Tipo de Usuario *</Label>
              <Select
                value={formData.user_type}
                onValueChange={(v) => setFormData({ ...formData, user_type: v as typeof formData.user_type })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (acesso total)</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.user_type === 'cliente' && (
              <div className="space-y-2">
                <Label htmlFor="cliente_id">Cliente Vinculado *</Label>
                <Select
                  value={formData.cliente_id}
                  onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.user_type === 'operacional' && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Clientes Vinculados
                </Label>
                <p className="text-xs text-muted-foreground">
                  Selecione os clientes que este operacional tera acesso
                </p>
                <div className="max-h-[200px] overflow-y-auto border rounded-lg p-3 space-y-2">
                  {clientes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum cliente cadastrado
                    </p>
                  ) : (
                    clientes.map((cliente) => (
                      <div key={cliente.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cliente-${cliente.id}`}
                          checked={formData.clientes_vinculados.includes(cliente.id)}
                          onCheckedChange={() => handleToggleClienteVinculado(cliente.id)}
                        />
                        <label
                          htmlFor={`cliente-${cliente.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {cliente.nome}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {formData.clientes_vinculados.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Sem clientes vinculados, o operacional nao vera dados na dashboard
                  </p>
                )}
                {formData.clientes_vinculados.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formData.clientes_vinculados.length} cliente(s) selecionado(s)
                  </p>
                )}
              </div>
            )}

            {formData.user_type !== 'admin' && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Permissoes de Acesso
                </Label>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
                  {hubs.map((hub) => (
                    <div key={hub.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`hub-${hub.code}`}
                        checked={formData.hub_permissions.includes(hub.code)}
                        onCheckedChange={() => handleToggleHubPermission(hub.code)}
                      />
                      <label
                        htmlFor={`hub-${hub.code}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {hub.name}
                      </label>
                    </div>
                  ))}
                </div>
                {formData.hub_permissions.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Sem permissoes, o usuario nao tera acesso a nenhum hub
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Usuario ativo</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : (editingUser ? 'Salvar' : 'Criar Usuario')}
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
