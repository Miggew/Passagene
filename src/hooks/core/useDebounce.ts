/**
 * Hook para debounce de valores
 * Útil para campos de busca e filtros
 */

import { useState, useEffect } from 'react';

/**
 * Retorna um valor com debounce
 * @param value - Valor a ser debounced
 * @param delay - Delay em ms (padrão: 300ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
