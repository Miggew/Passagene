import { toast } from '@/hooks/use-toast';

/**
 * Scroll até o primeiro campo inválido e aplica highlight temporário.
 * Retorna true se encontrou campo inválido (ou seja, form é inválido).
 */
export function scrollToFirstInvalid(
  formRef: React.RefObject<HTMLElement | null>,
  camposFaltantes: string[]
): boolean {
  if (camposFaltantes.length === 0) return false;

  toast({
    title: 'Campos obrigatórios',
    description: camposFaltantes.join(', '),
    variant: 'destructive',
  });

  // Tentar focar o primeiro input vazio dentro do form
  if (formRef.current) {
    const inputs = formRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, select, textarea'
    );
    for (const input of inputs) {
      if (!input.value || input.value.trim() === '') {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
        // Highlight temporário
        input.classList.add('ring-2', 'ring-danger');
        setTimeout(() => {
          input.classList.remove('ring-2', 'ring-danger');
        }, 2000);
        break;
      }
    }
  }

  return true;
}
