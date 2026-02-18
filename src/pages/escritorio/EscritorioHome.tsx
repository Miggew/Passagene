import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  ThumbsUp,
  ArrowRightLeft,
  Syringe,
  TestTube,
  History,
  ChevronRight,
} from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';

export default function EscritorioHome() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Hub Escritório"
        description="Cadastro de relatórios de campo — OCR ou entrada manual"
        icon={FileText}
      />

      {/* Quick Actions Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <QuickActionCard
          title="Diagnóstico (DG)"
          icon={ThumbsUp}
          description="Registrar resultados de diagnóstico de gestação"
          onClick={() => navigate('/escritorio/dg')}
          color="green"
        />
        <QuickActionCard
          title="Sexagem"
          icon={GenderIcon}
          description="Registrar resultados de sexagem fetal"
          onClick={() => navigate('/escritorio/sexagem')}
          color="pink"
        />
        <QuickActionCard
          title="Protocolo P2"
          icon={Syringe}
          description="Confirmar presença no 2º passo do protocolo"
          onClick={() => navigate('/escritorio/protocolo-p2')}
          color="violet"
        />
        <QuickActionCard
          title="Transferência (TE)"
          icon={ArrowRightLeft}
          description="Registrar transferências de embriões"
          onClick={() => navigate('/escritorio/te')}
          color="blue"
        />
        <QuickActionCard
          title="Aspiração"
          icon={TestTube}
          description="Registrar aspirações foliculares"
          onClick={() => navigate('/escritorio/aspiracao')}
          color="amber"
        />
        <QuickActionCard
          title="Protocolo P1"
          icon={Syringe}
          description="Cadastrar novo protocolo (1º passo)"
          onClick={() => navigate('/escritorio/protocolo-p1')}
          color="cyan"
        />
      </div>

      {/* Histórico */}
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate('/escritorio/historico')}
      >
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <History className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Histórico de Importações</p>
              <p className="text-sm text-muted-foreground">Ver relatórios cadastrados e desfazer importações</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  icon: React.ElementType;
  description: string;
  onClick: () => void;
  color: 'blue' | 'green' | 'violet' | 'cyan' | 'amber' | 'pink';
}

function QuickActionCard({ title, icon: Icon, description, onClick, color }: QuickActionCardProps) {
  const colorStyles = {
    blue: 'bg-blue-500/10 text-blue-600 border-blue-200 hover:border-blue-300',
    green: 'bg-green-500/10 text-green-600 border-green-200 hover:border-green-300',
    violet: 'bg-violet-500/10 text-violet-600 border-violet-200 hover:border-violet-300',
    cyan: 'bg-cyan-500/10 text-cyan-600 border-cyan-200 hover:border-cyan-300',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-200 hover:border-amber-300',
    pink: 'bg-pink-500/10 text-pink-600 border-pink-200 hover:border-pink-300',
  };

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between p-6 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer ${colorStyles[color]} hover:bg-opacity-20`}
    >
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-5 h-5" />
      </div>
      <div className="space-y-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/70 dark:bg-black/20 backdrop-blur-sm">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <p className="text-sm opacity-80 mt-2">{description}</p>
    </div>
  );
}
