import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import AdminEmbryoScoreTab from '@/components/admin/AdminEmbryoScoreTab';

export default function EmbryoScore() {
  const { isAdmin } = usePermissions();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="EmbryoScore IA"
        description="Configuração, monitoramento e correlação da análise morfocinética por IA"
      />
      <AdminEmbryoScoreTab />
    </div>
  );
}
