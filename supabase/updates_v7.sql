-- Updates v7: Campos extras para transportadoras

ALTER TABLE public.transportadoras ADD COLUMN IF NOT EXISTS documento VARCHAR(50); -- CPF/CNPJ
ALTER TABLE public.transportadoras ADD COLUMN IF NOT EXISTS contato VARCHAR(255); -- Telefone ou E-mail
