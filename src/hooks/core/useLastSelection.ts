import { useState, useCallback } from 'react';

/**
 * Hook simples para persistir última seleção por chave no localStorage.
 * Útil para pre-preencher veterinário, técnico, fazenda entre sessões.
 *
 * @param key - Chave única no localStorage (ex: 'ultimo-veterinario')
 * @returns [value, setValue] - valor atual e setter que também persiste
 */
export function useLastSelection(key: string): [string, (value: string) => void] {
  const storageKey = `passagene:${key}`;

  const [value] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });

  const setValue = useCallback((newValue: string) => {
    try {
      if (newValue) {
        localStorage.setItem(storageKey, newValue);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // localStorage indisponível
    }
  }, [storageKey]);

  return [value, setValue];
}
