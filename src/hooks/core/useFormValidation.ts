/**
 * useFormValidation - Hook para validação de formulários com Zod
 */

import { useState, useCallback } from 'react';
import { z } from 'zod';
import { validateWithZod } from '@/lib/validations';

export interface UseFormValidationOptions<T> {
  schema: z.ZodSchema<T>;
  onSubmit: (data: T) => void | Promise<void>;
}

export interface UseFormValidationReturn<T> {
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  validate: (data: unknown) => boolean;
  validateField: (field: string, value: unknown, fullData: unknown) => string | null;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  handleSubmit: (data: unknown) => Promise<boolean>;
  isValid: boolean;
}

export function useFormValidation<T>({
  schema,
  onSubmit,
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validar todos os campos
  const validate = useCallback(
    (data: unknown): boolean => {
      const result = validateWithZod(schema, data);
      if (result.success) {
        setErrors({});
        return true;
      }
      setErrors(result.errors);
      return false;
    },
    [schema]
  );

  // Validar um campo específico
  const validateField = useCallback(
    (field: string, value: unknown, fullData: unknown): string | null => {
      const dataWithField = { ...(fullData as object), [field]: value };
      const result = validateWithZod(schema, dataWithField);

      if (result.success) {
        setErrors((prev) => {
          const { [field]: _, ...rest } = prev;
          return rest;
        });
        return null;
      }

      const fieldError = result.errors[field];
      if (fieldError) {
        setErrors((prev) => ({ ...prev, [field]: fieldError }));
        return fieldError;
      }

      return null;
    },
    [schema]
  );

  // Limpar todos os erros
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Limpar erro de um campo específico
  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Handler de submit com validação
  const handleSubmit = useCallback(
    async (data: unknown): Promise<boolean> => {
      const result = validateWithZod(schema, data);

      if (!result.success) {
        setErrors(result.errors);
        return false;
      }

      setErrors({});
      await onSubmit(result.data);
      return true;
    },
    [schema, onSubmit]
  );

  const isValid = Object.keys(errors).length === 0;

  return {
    errors,
    setErrors,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    handleSubmit,
    isValid,
  };
}

export default useFormValidation;
