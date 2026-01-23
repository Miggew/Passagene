-- Persistência de sessão de transferência de embriões
CREATE TABLE IF NOT EXISTS public.transferencias_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL,
  protocolo_id uuid NULL,
  pacote_id uuid NULL,
  data_te date NULL,
  veterinario_responsavel text NULL,
  tecnico_responsavel text NULL,
  origem_embriao text NULL,
  filtro_cliente_id uuid NULL,
  filtro_raca text NULL,
  permitir_duplas boolean NOT NULL DEFAULT false,
  transferencias_ids jsonb NULL,
  protocolo_receptora_ids jsonb NULL,
  status text NOT NULL DEFAULT 'ABERTA',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garantir apenas uma sessão por fazenda e status
CREATE UNIQUE INDEX IF NOT EXISTS transferencias_sessoes_fazenda_status_idx
ON public.transferencias_sessoes (fazenda_id, status);
