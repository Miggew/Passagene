
import { renderHook, act } from '@testing-library/react';
import { useTransferenciaEmbrioesFilters } from './useTransferenciaEmbrioesFilters';
import { describe, it, expect } from 'vitest';

describe('useTransferenciaEmbrioesFilters', () => {
    it('should initialize with default values', () => {
        const { result } = renderHook(() => useTransferenciaEmbrioesFilters());

        expect(result.current.origemEmbriao).toBe('FRESCO');
        expect(result.current.filtroClienteId).toBe('');
        expect(result.current.filtroRaca).toBe('');
        expect(result.current.dataPasso2).toBe('');
        expect(result.current.embrioesPage).toBe(1);
        expect(result.current.showRelatorioDialog).toBe(false);
    });

    it('should update filters', () => {
        const { result } = renderHook(() => useTransferenciaEmbrioesFilters());

        act(() => {
            result.current.setOrigemEmbriao('CONGELADO');
            result.current.setFiltroClienteId('123');
            result.current.setFiltroRaca('NELORE');
        });

        expect(result.current.origemEmbriao).toBe('CONGELADO');
        expect(result.current.filtroClienteId).toBe('123');
        expect(result.current.filtroRaca).toBe('NELORE');
    });

    it('should reset filters', () => {
        const { result } = renderHook(() => useTransferenciaEmbrioesFilters());

        act(() => {
            result.current.setFiltroClienteId('123');
            result.current.resetFilters();
        });

        expect(result.current.filtroClienteId).toBe('');
    });

    it('should handle session restoration', () => {
        const { result } = renderHook(() => useTransferenciaEmbrioesFilters());

        const sessaoMock = {
            origem_embriao: 'CONGELADO',
            filtro_cliente_id: 'abc',
            filtro_raca: 'ANGUS',
            data_passo2: '2023-01-01',
            embrioes_page: 5
        };

        act(() => {
            result.current.aplicarFiltrosSessao(sessaoMock);
        });

        expect(result.current.origemEmbriao).toBe('CONGELADO');
        expect(result.current.filtroClienteId).toBe('abc');
        expect(result.current.filtroRaca).toBe('ANGUS');
        expect(result.current.dataPasso2).toBe('2023-01-01');
        expect(result.current.embrioesPage).toBe(5);
    });
});
