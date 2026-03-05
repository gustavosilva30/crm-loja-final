-- Add recebedor_nome to entregas table
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS recebedor_nome text;
