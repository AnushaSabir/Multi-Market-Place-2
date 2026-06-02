-- Phase 3 Point 3: Invoice Columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number text UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_date timestamp with time zone;
