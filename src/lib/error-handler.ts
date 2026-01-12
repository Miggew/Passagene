import { toast } from '@/hooks/use-toast';

/**
 * Handle errors consistently across the application
 * Provides user-friendly error messages for common error types
 */
export function handleError(error: unknown, defaultTitle: string = 'Erro', defaultMessage: string = 'Ocorreu um erro inesperado') {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;
  
  // Mensagens específicas para erros comuns
  if (errorMessage.includes('RLS') || errorMessage.includes('policy') || errorMessage.includes('permission')) {
    toast({
      title: defaultTitle,
      description: 'RLS está bloqueando a operação. Configure políticas no Supabase.',
      variant: 'destructive',
    });
    return;
  }

  // Erro de chave duplicada (PostgreSQL 23505)
  if (errorMessage.includes('23505') || errorMessage.includes('duplicate key')) {
    toast({
      title: defaultTitle,
      description: 'Já existe um registro com esses dados.',
      variant: 'destructive',
    });
    return;
  }

  // Erro de chave estrangeira (PostgreSQL 23503)
  if (errorMessage.includes('23503') || errorMessage.includes('foreign key')) {
    toast({
      title: defaultTitle,
      description: 'Não é possível realizar esta operação. O registro está sendo usado em outro lugar.',
      variant: 'destructive',
    });
    return;
  }

  // Erro de não encontrado (PostgreSQL PGRST301)
  if (errorMessage.includes('PGRST301') || errorMessage.includes('not found')) {
    toast({
      title: defaultTitle,
      description: 'Registro não encontrado.',
      variant: 'destructive',
    });
    return;
  }

  // Mensagem genérica
  toast({
    title: defaultTitle,
    description: errorMessage,
    variant: 'destructive',
  });
}
