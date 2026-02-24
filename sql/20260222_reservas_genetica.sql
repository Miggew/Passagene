-- ============================================================
-- Tabela: reservas_genetica
-- Mercado de Genética — solicitações de reserva de clientes
-- Executar manualmente no Supabase Dashboard (SQL Editor)
-- ============================================================

CREATE TABLE public.reservas_genetica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalogo_id UUID NOT NULL REFERENCES public.catalogo_genetica(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('doadora', 'touro')),
  data_desejada DATE,
  quantidade_embrioes INTEGER,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE','CONFIRMADA','RECUSADA','CANCELADA','CONCLUIDA')),
  resposta_admin TEXT,
  respondido_por UUID REFERENCES auth.users(id),
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_reservas_gen_cliente ON public.reservas_genetica(cliente_id);
CREATE INDEX idx_reservas_gen_status ON public.reservas_genetica(status);

-- RLS
ALTER TABLE public.reservas_genetica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel_own" ON public.reservas_genetica FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_operacional());

CREATE POLICY "ins_own" ON public.reservas_genetica FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "upd_own" ON public.reservas_genetica FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "all_admin" ON public.reservas_genetica FOR ALL
  USING (public.is_admin_or_operacional());
