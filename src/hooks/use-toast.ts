import type { ReactNode } from 'react';

import { toast as sonnerToast } from '@/components/ui/sonner';

type ToastInput = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: 'default' | 'destructive' | 'success';
};

const toast = ({ title, description, variant = 'default' }: ToastInput) => {
  const message = title ?? description ?? 'Aviso';
  const options = title && description ? { description } : undefined;

  if (variant === 'destructive') {
    return sonnerToast.error(message, options);
  }

  if (variant === 'success') {
    return sonnerToast.success(message, options);
  }

  return sonnerToast(message, options);
};

const useToast = () => ({ toast });

export { useToast, toast };
