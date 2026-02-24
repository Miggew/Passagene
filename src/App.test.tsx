import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Smoke Test', () => {
    it('renders without crashing', () => {
        render(<App />);
        // Verifica se algo básico da tela de login (rota padrão para deslogado) aparece
        // Como a AuthProvider redireciona para login, esperamos ver algo do Login ou Loading
        // Pelo código, o Login é lazy loaded, então pode aparecer o LoadingSpinner primeiro
        // Vamos apenas garantir que o render não explodiu com exceção
        expect(document.body).toBeInTheDocument();
    });
});
