/**
 * Página de Configurações do Cliente
 * Acessível via menu ☰ da Home
 */

import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useClienteHubData } from '@/hooks/cliente/useClienteHubData';
import { useClientePreferences } from '@/hooks/cliente/useClientePreferences';
import LoadingScreen from '@/components/shared/LoadingScreen';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  User,
  MapPin,
  Palette,
  Sun,
  Moon,
  Monitor,
  Bell,
  Mail,
  Info,
  LogOut,
  Type,
  Stethoscope,
  ScanSearch,
  Baby,
  Syringe,
} from 'lucide-react';

export default function ClienteConfiguracoes() {
  const navigate = useNavigate();
  const { profile, clienteId } = usePermissions();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const { data: hubData, isLoading: hubLoading } = useClienteHubData(clienteId);
  const { preferences, isLoading: prefsLoading, updatePreference } = useClientePreferences(clienteId);

  if (hubLoading || prefsLoading) return <LoadingScreen />;

  const fazendas = hubData?.fazendas || [];
  const iniciais = (profile?.nome || 'U')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Tema ativo (resolver "system")
  const themeButtons: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: React.ElementType }> = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Auto', icon: Monitor },
  ];

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/50 hover:bg-muted border border-border/50 transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Configurações</h1>
      </div>

      {/* ── 1. PERFIL ── */}
      <SectionCard>
        <SectionHeader icon={User} title="Perfil" />
        <div className="flex items-center gap-4 mt-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">{iniciais}</span>
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground truncate">{profile?.nome || 'Usuário'}</p>
            <p className="text-sm text-muted-foreground truncate">{profile?.email || '-'}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Gerenciado pelo administrador</p>
          </div>
        </div>
      </SectionCard>

      {/* ── 2. FAZENDA PADRÃO ── */}
      {fazendas.length > 1 && (
        <SectionCard>
          <SectionHeader icon={MapPin} title="Fazenda padrão" />
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            A fazenda selecionada aparecerá primeiro nos filtros
          </p>
          <Select
            value={preferences.default_fazenda_id || '_all'}
            onValueChange={(v) => updatePreference('default_fazenda_id', v === '_all' ? null : v)}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Selecione uma fazenda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as fazendas</SelectItem>
              {fazendas.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SectionCard>
      )}

      {/* ── 3. APARÊNCIA ── */}
      <SectionCard>
        <SectionHeader icon={Palette} title="Aparência" />

        {/* Tema */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Tema</p>
          <div className="grid grid-cols-3 gap-2">
            {themeButtons.map(({ value, label, icon: Icon }) => {
              const isActive = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`
                    flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                      : 'bg-muted/40 text-muted-foreground border border-transparent hover:bg-muted/60'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-border/50 my-4" />

        {/* Fonte grande */}
        <SettingRow
          icon={Type}
          label="Fonte grande"
          description="Aumenta o tamanho do texto para leitura no campo"
        >
          <Switch
            checked={preferences.font_size === 'grande'}
            onCheckedChange={(checked) => updatePreference('font_size', checked ? 'grande' : 'normal')}
          />
        </SettingRow>
      </SectionCard>

      {/* ── 4. NOTIFICAÇÕES ── */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <SectionHeader icon={Bell} title="Notificações" />
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            Em breve
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          As notificações push serão ativadas em breve
        </p>

        <div className="space-y-1">
          <SettingRow icon={Stethoscope} label="DG pronto" description="Quando atingir 27 dias pós-TE">
            <Switch
              checked={preferences.notif_dg}
              onCheckedChange={(v) => updatePreference('notif_dg', v)}
            />
          </SettingRow>
          <div className="h-px bg-border/30" />
          <SettingRow icon={ScanSearch} label="Sexagem pronta" description="Quando atingir 54 dias pós-D0">
            <Switch
              checked={preferences.notif_sexagem}
              onCheckedChange={(v) => updatePreference('notif_sexagem', v)}
            />
          </SettingRow>
          <div className="h-px bg-border/30" />
          <SettingRow icon={Baby} label="Parto próximo" description="3 dias antes da data prevista">
            <Switch
              checked={preferences.notif_parto}
              onCheckedChange={(v) => updatePreference('notif_parto', v)}
            />
          </SettingRow>
          <div className="h-px bg-border/30" />
          <SettingRow icon={Syringe} label="TE agendada" description="Quando a janela ideal chegar">
            <Switch
              checked={preferences.notif_te}
              onCheckedChange={(v) => updatePreference('notif_te', v)}
            />
          </SettingRow>
        </div>
      </SectionCard>

      {/* ── 5. RELATÓRIOS POR EMAIL ── */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <SectionHeader icon={Mail} title="Relatórios por email" />
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            Em breve
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Receba resumos periódicos no seu email
        </p>

        <SettingRow icon={Mail} label="Receber relatórios" description="Envio automático por email">
          <Switch
            checked={preferences.email_reports}
            onCheckedChange={(v) => updatePreference('email_reports', v)}
          />
        </SettingRow>

        {preferences.email_reports && (
          <div className="mt-3 space-y-3 pl-2 border-l-2 border-primary/20 ml-1">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Frequência</p>
              <Select
                value={preferences.report_frequency}
                onValueChange={(v) => updatePreference('report_frequency', v as 'semanal' | 'quinzenal' | 'mensal')}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Email para relatórios</p>
              <Input
                type="email"
                placeholder={profile?.email || 'seu@email.com'}
                value={preferences.notification_email || ''}
                onChange={(e) => updatePreference('notification_email', e.target.value || null)}
                className="h-9"
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 6. SOBRE ── */}
      <SectionCard>
        <SectionHeader icon={Info} title="Sobre" />
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Versão</span>
            <span className="text-sm font-medium text-foreground">1.0.0</span>
          </div>
          <div className="h-px bg-border/30" />
          <button className="w-full text-left text-sm text-muted-foreground py-1.5 hover:text-foreground transition-colors">
            Termos de uso
          </button>
          <div className="h-px bg-border/30" />
          <button className="w-full text-left text-sm text-muted-foreground py-1.5 hover:text-foreground transition-colors">
            Política de privacidade
          </button>
        </div>
      </SectionCard>

      {/* ── 8. SAIR ── */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 text-red-500 font-medium text-sm hover:bg-red-500/10 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sair da conta
      </button>
    </div>
  );
}

// ==================== SUB-COMPONENTES ====================

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1 h-5 rounded-full bg-primary/50" />
      <Icon className="w-4 h-4 text-primary/60" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon?: React.ElementType;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
