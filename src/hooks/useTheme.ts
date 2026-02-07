/**
 * Hook para gerenciar tema (light/dark mode)
 * Persiste a preferência no localStorage
 */

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Verificar localStorage primeiro
    const stored = localStorage.getItem('passagene-theme') as Theme | null;
    if (stored) return stored;

    // Fallback para preferência do sistema
    return 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    // Determinar tema efetivo
    let effectiveTheme: 'light' | 'dark';
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      effectiveTheme = theme;
    }

    // Aplicar classe
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);

    // Persistir no localStorage
    localStorage.setItem('passagene-theme', theme);
  }, [theme]);

  // Ouvir mudanças na preferência do sistema
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Calcular isDark baseado no estado React (não do DOM)
  const isDark = theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'light';
      // Se for 'system', muda para o oposto do atual
      return isDark ? 'light' : 'dark';
    });
  };

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark,
  };
}
