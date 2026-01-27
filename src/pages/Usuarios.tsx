import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Hub, UserProfile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Shield, Search, Users } from 'lucide-react';

interface UserWithPermissions extends UserProfile {
  hub_permissions: string[];
}

interface Cliente {
  id: string;
  nome: string;
}

export default function Usuarios() {
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

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    user_type: 'operacional' as 'admin' | 'cliente' | 'operacional',
    cliente_id: '',
    active: true,
    hub_permissions: [] as string[],
  });

  // Check if current user is admin
  const isAdmin = permissions?.isAdmin;

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
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

      // Map permissions to users
      const permissionsMap = new Map<string, string[]>();
      (permissionsData || []).forEach(p => {
        const current = permissionsMap.get(p.user_id) || [];
        current.push(p.hub_code);
        permissionsMap.set(p.user_id, current);
      });

      const usersWithPermissions: UserWithPermissions[] = (usersData || []).map(user => ({
        ...user,
        hub_permissions: permissionsMap.get(user.id) || [],
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo = filtroTipo === 'todos' || user.user_type === filtroTipo;

    return matchesSearch && matchesTipo;
  });

  const handleOpenDialog = (user?: UserWithPermissions) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        nome: user.nome || '',
        email: user.email || '',
        user_type: user.user_type,
        cliente_id: user.cliente_id || '',
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
        active: true,
        hub_permissions: [],
      });
    }
    setShowDialog(true);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim() || !formData.email.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Nome e email são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (formData.user_type === 'cliente' && !formData.cliente_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione um cliente para usuários do tipo Cliente',
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

        toast({
          title: 'Usuário atualizado',
          description: 'Perfil e permissões atualizados com sucesso',
        });
      } else {
        // For new users, we need to check if there's already a user_profile for this email
        // This happens when a user signs up but hasn't been configured yet
        const { data: existingProfile, error: checkError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', formData.email.toLowerCase())
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingProfile) {
          toast({
            title: 'Usuário já existe',
            description: 'Já existe um perfil para este email. Use a opção de editar.',
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

        toast({
          title: 'Usuário criado',
          description: 'Perfil criado. O usuário precisa fazer cadastro com este email.',
        });
      }

      setShowDialog(false);
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
        title: user.active ? 'Usuário desativado' : 'Usuário ativado',
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
        return <Badge className="bg-purple-100 text-purple-800">Admin</Badge>;
      case 'cliente':
        return <Badge className="bg-blue-100 text-blue-800">Cliente</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Operacional</Badge>;
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Acesso negado"
          description="Apenas administradores podem acessar esta página."
        />
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administração de Usuários"
        description="Gerencie perfis e permissões de acesso"
        actions={
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        }
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Admins</p>
            <p className="text-2xl font-bold">{users.filter(u => u.user_type === 'admin').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Operacionais</p>
            <p className="text-2xl font-bold">{users.filter(u => u.user_type === 'operacional').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Clientes</p>
            <p className="text-2xl font-bold">{users.filter(u => u.user_type === 'cliente').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[150px]">
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

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <EmptyState
              title="Nenhum usuário encontrado"
              description={searchTerm || filtroTipo !== 'todos'
                ? "Tente ajustar os filtros"
                : "Cadastre o primeiro usuário"
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Hubs</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className={!user.active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{user.nome || '-'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getUserTypeBadge(user.user_type)}</TableCell>
                    <TableCell>
                      {user.user_type === 'admin' ? (
                        <span className="text-purple-600 text-sm">Acesso total</span>
                      ) : user.hub_permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.hub_permissions.map(hub => (
                            <Badge key={hub} variant="outline" className="text-xs">
                              {hub}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Nenhum</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.active}
                        onCheckedChange={() => handleToggleActive(user)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(user)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criação/edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? `Editando ${editingUser.nome || editingUser.email}`
                : 'Preencha os dados do novo usuário'
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
                  O usuário precisará fazer cadastro com este email
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_type">Tipo de Usuário *</Label>
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

            {formData.user_type !== 'admin' && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Permissões de Acesso
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
                    Sem permissões, o usuário não terá acesso a nenhum hub
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
              <Label htmlFor="active">Usuário ativo</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : (editingUser ? 'Salvar' : 'Criar Usuário')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
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
