-- Migração: Adiciona coluna tipo_diagnostico na tabela diagnosticos_gestacao
-- Essa coluna diferencia DG (Diagnóstico de Gestação) de SEXAGEM

-- Adiciona a coluna se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'diagnosticos_gestacao'
        AND column_name = 'tipo_diagnostico'
    ) THEN
        ALTER TABLE public.diagnosticos_gestacao
        ADD COLUMN tipo_diagnostico TEXT DEFAULT 'DG';

        COMMENT ON COLUMN public.diagnosticos_gestacao.tipo_diagnostico
        IS 'Tipo do diagnóstico: DG (Diagnóstico de Gestação) ou SEXAGEM';
    END IF;
END $$;

-- Cria índice para melhorar performance das queries filtradas por tipo
CREATE INDEX IF NOT EXISTS idx_diagnosticos_gestacao_tipo_diagnostico
ON public.diagnosticos_gestacao(tipo_diagnostico);

-- Atualiza registros existentes:
-- Se o registro tem sexagem preenchida, é do tipo SEXAGEM
-- Caso contrário, é DG
UPDATE public.diagnosticos_gestacao
SET tipo_diagnostico = CASE
    WHEN sexagem IS NOT NULL AND sexagem != '' THEN 'SEXAGEM'
    ELSE 'DG'
END
WHERE tipo_diagnostico IS NULL OR tipo_diagnostico = 'DG';
