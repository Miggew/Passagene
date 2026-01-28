/**
 * FormDialog - Componente generico de dialog com formulario
 *
 * Suporta:
 * - Dialog com titulo e descricao
 * - Formulario com submit
 * - Estados de loading/submitting
 * - Botoes de confirmar/cancelar customizaveis
 * - Trigger customizavel ou controlado externamente
 */

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export interface FormDialogProps {
  // Dialog control
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Content
  title: string;
  description?: string;
  children: ReactNode;

  // Trigger (opcional - se nao fornecido, controle externo)
  trigger?: ReactNode;

  // Form submission
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  submitting?: boolean;

  // Button labels
  submitLabel?: string;
  cancelLabel?: string;
  submittingLabel?: string;

  // Styling
  submitClassName?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

  // Callbacks
  onCancel?: () => void;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  onSubmit,
  submitting = false,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  submittingLabel = 'Salvando...',
  submitClassName = '',
  maxWidth = 'md',
  onCancel,
}: FormDialogProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  const content = (
    <DialogContent className={`${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto`}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        <FormDialogActions
          submitting={submitting}
          submitLabel={submitLabel}
          cancelLabel={cancelLabel}
          submittingLabel={submittingLabel}
          submitClassName={submitClassName}
          onCancel={handleCancel}
        />
      </form>
    </DialogContent>
  );

  // Se trigger fornecido, usa DialogTrigger
  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {content}
      </Dialog>
    );
  }

  // Sem trigger - controle externo
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {content}
    </Dialog>
  );
}

// Sub-componente para botoes de acao
interface FormDialogActionsProps {
  submitting: boolean;
  submitLabel: string;
  cancelLabel: string;
  submittingLabel: string;
  submitClassName: string;
  onCancel: () => void;
}

function FormDialogActions({
  submitting,
  submitLabel,
  cancelLabel,
  submittingLabel,
  submitClassName,
  onCancel,
}: FormDialogActionsProps) {
  return (
    <div className="flex gap-2 pt-2">
      <Button type="submit" className={`flex-1 ${submitClassName}`} disabled={submitting}>
        {submitting ? submittingLabel : submitLabel}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
        {cancelLabel}
      </Button>
    </div>
  );
}

// Componente auxiliar para campos do formulario (opcional)
export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  );
}

// Componente para grid de campos
export interface FormGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3;
}

export function FormGrid({ children, columns = 2 }: FormGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
  };

  return <div className={`grid ${gridCols[columns]} gap-4`}>{children}</div>;
}

export default FormDialog;
