import { usePermissions } from '@/hooks/usePermissions';
import { useUserClientes } from '@/hooks/useUserClientes';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { HomeCliente, HomeDefault } from '@/components/home';

export default function Home() {
  const { isCliente, isOperacional, clienteId } = usePermissions();
  const { clienteIds, loading: loadingClientes } = useUserClientes();

  // Loading state para operacional e cliente
  if ((isCliente || isOperacional) && loadingClientes) {
    return <LoadingSpinner />;
  }

  // Layout compacto para cliente (cabe na tela sem scroll)
  if (isCliente && clienteId) {
    return (
      <HomeCliente
        clienteId={clienteId}
      />
    );
  }

  return <HomeDefault clienteIds={clienteIds} />;
}
