/**
 * Hook para gerenciar formulário de cadastro de touros
 * - Estado do formulário
 * - Campos dinâmicos por raça
 * - Validação e submissão
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TouroInsert } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// Tipo para valores de campos dinâmicos
export type ValorDinamico = string | number | boolean | null | undefined;

export interface TouroFormData {
  registro: string;
  nome: string;
  raca: string;
  data_nascimento: string;
  proprietario: string;
  fazenda_nome: string;
  pai_registro: string;
  pai_nome: string;
  mae_registro: string;
  mae_nome: string;
  genealogia_texto: string;
  link_catalogo: string;
  foto_url: string;
  link_video: string;
  observacoes: string;
}

export interface DadosDinamicos {
  dados_geneticos: Record<string, ValorDinamico>;
  dados_producao: Record<string, ValorDinamico>;
  dados_conformacao: Record<string, ValorDinamico>;
  medidas_fisicas: Record<string, ValorDinamico>;
  dados_saude_reproducao: Record<string, ValorDinamico>;
  caseinas: Record<string, ValorDinamico>;
  outros_dados: Record<string, ValorDinamico>;
}

const initialFormData: TouroFormData = {
  registro: '',
  nome: '',
  raca: '',
  data_nascimento: '',
  proprietario: '',
  fazenda_nome: '',
  pai_registro: '',
  pai_nome: '',
  mae_registro: '',
  mae_nome: '',
  genealogia_texto: '',
  link_catalogo: '',
  foto_url: '',
  link_video: '',
  observacoes: '',
};

const initialDadosDinamicos: DadosDinamicos = {
  dados_geneticos: {},
  dados_producao: {},
  dados_conformacao: {},
  medidas_fisicas: {},
  dados_saude_reproducao: {},
  caseinas: {},
  outros_dados: {},
};

export interface UseTourosFormProps {
  onSuccess: () => void;
}

export interface UseTourosFormReturn {
  // State
  formData: TouroFormData;
  setFormData: React.Dispatch<React.SetStateAction<TouroFormData>>;
  dadosDinamicos: DadosDinamicos;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  submitting: boolean;

  // Actions
  resetForm: () => void;
  handleCampoDinamicoChange: (campo: string, valor: ValorDinamico, categoria: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;

  // Helpers
  getValoresDinamicos: () => Record<string, ValorDinamico>;
}

export function useTourosForm({ onSuccess }: UseTourosFormProps): UseTourosFormReturn {
  const { toast } = useToast();

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState<TouroFormData>(initialFormData);
  const [dadosDinamicos, setDadosDinamicos] = useState<DadosDinamicos>(initialDadosDinamicos);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setDadosDinamicos(initialDadosDinamicos);
  }, []);

  // Handle dynamic field changes
  const handleCampoDinamicoChange = useCallback(
    (campo: string, valor: ValorDinamico, categoria: string) => {
      setDadosDinamicos((prev) => ({
        ...prev,
        [categoria]: {
          ...prev[categoria as keyof DadosDinamicos],
          [campo]: valor === '' ? undefined : valor,
        },
      }));
    },
    []
  );

  // Get all dynamic values merged
  const getValoresDinamicos = useCallback((): Record<string, ValorDinamico> => {
    return {
      ...dadosDinamicos.dados_geneticos,
      ...dadosDinamicos.dados_producao,
      ...dadosDinamicos.dados_conformacao,
      ...dadosDinamicos.medidas_fisicas,
      ...dadosDinamicos.dados_saude_reproducao,
      ...dadosDinamicos.caseinas,
      ...dadosDinamicos.outros_dados,
    };
  }, [dadosDinamicos]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validation
      if (!formData.registro.trim()) {
        toast({
          title: 'Erro de validacao',
          description: 'Registro e obrigatorio',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.nome.trim()) {
        toast({
          title: 'Erro de validacao',
          description: 'Nome e obrigatorio',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.raca) {
        toast({
          title: 'Erro de validacao',
          description: 'Raca e obrigatoria',
          variant: 'destructive',
        });
        return;
      }

      try {
        setSubmitting(true);

        // Clean empty fields from dynamic data
        const limparCamposVazios = (
          obj: Record<string, ValorDinamico>
        ): Record<string, ValorDinamico> | null => {
          const limpo: Record<string, ValorDinamico> = {};
          Object.entries(obj).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              limpo[key] = value;
            }
          });
          return Object.keys(limpo).length > 0 ? limpo : {};
        };

        const insertData: TouroInsert = {
          registro: formData.registro.trim(),
          nome: formData.nome.trim(),
          raca: formData.raca,
          data_nascimento: formData.data_nascimento || null,
          proprietario: formData.proprietario.trim() || null,
          fazenda_nome: formData.fazenda_nome.trim() || null,
          pai_registro: formData.pai_registro.trim() || null,
          pai_nome: formData.pai_nome.trim() || null,
          mae_registro: formData.mae_registro.trim() || null,
          mae_nome: formData.mae_nome.trim() || null,
          genealogia_texto: formData.genealogia_texto.trim() || null,
          link_catalogo: formData.link_catalogo.trim() || null,
          foto_url: formData.foto_url.trim() || null,
          link_video: formData.link_video.trim() || null,
          observacoes: formData.observacoes.trim() || null,
          disponivel: true,
          // Dynamic fields in JSONB
          dados_geneticos: limparCamposVazios(dadosDinamicos.dados_geneticos),
          dados_producao: limparCamposVazios(dadosDinamicos.dados_producao),
          dados_conformacao: limparCamposVazios(dadosDinamicos.dados_conformacao),
          medidas_fisicas: limparCamposVazios(dadosDinamicos.medidas_fisicas),
          dados_saude_reproducao: limparCamposVazios(dadosDinamicos.dados_saude_reproducao),
          caseinas: limparCamposVazios(dadosDinamicos.caseinas),
          outros_dados: limparCamposVazios(dadosDinamicos.outros_dados),
        };

        const { error } = await supabase.from('touros').insert([insertData]);

        if (error) throw error;

        toast({
          title: 'Touro cadastrado',
          description: 'Touro cadastrado com sucesso no catalogo',
        });

        setShowDialog(false);
        resetForm();
        onSuccess();
      } catch (error: unknown) {
        let errorMessage = 'Erro desconhecido';
        if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = (error as { message: string }).message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }

        // More specific messages for common errors
        if (errorMessage.includes('RLS') || errorMessage.includes('policy')) {
          errorMessage = 'RLS esta bloqueando escrita. Configure politicas anon no Supabase.';
        } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
          errorMessage = 'Ja existe um touro com este registro no catalogo.';
        } else if (errorMessage.includes('null value') || errorMessage.includes('NOT NULL')) {
          errorMessage =
            'Um ou mais campos obrigatorios nao foram preenchidos. Verifique o formulario.';
        }

        toast({
          title: 'Erro ao cadastrar touro',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, dadosDinamicos, toast, resetForm, onSuccess]
  );

  return {
    // State
    formData,
    setFormData,
    dadosDinamicos,
    showDialog,
    setShowDialog,
    submitting,

    // Actions
    resetForm,
    handleCampoDinamicoChange,
    handleSubmit,

    // Helpers
    getValoresDinamicos,
  };
}

export default useTourosForm;
