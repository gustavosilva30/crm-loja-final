-- Updates v50 - WhatsApp Context Menu Features

ALTER TABLE public.mensagens
ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.mensagens(id),
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
