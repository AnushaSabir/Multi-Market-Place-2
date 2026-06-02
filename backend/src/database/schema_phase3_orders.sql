-- Phase 3: Order Sync (Billbee Structure)

-- Customers Table (Matches Billbee Customer)
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    billbee_id text, -- Internal ID if migrated
    email text,
    first_name text,
    last_name text,
    phone text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Addresses Table (Matches Billbee Invoice/Delivery Address)
CREATE TABLE IF NOT EXISTS public.addresses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    address_type text, -- 'invoice' or 'delivery'
    first_name text,
    last_name text,
    company text,
    street text,
    house_number text,
    zip text,
    city text,
    country_code text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Orders Table (Matches Billbee Order)
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number text UNIQUE NOT NULL, -- e.g. Shopify #1001
    marketplace text NOT NULL, -- shopify, ebay, otto, kaufland
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    invoice_address_id uuid REFERENCES public.addresses(id),
    delivery_address_id uuid REFERENCES public.addresses(id),
    state text DEFAULT 'pending', -- matching Billbee OrderStateId (1=Ordered, 2=Confirmed, 3=Paid, 4=Shipped)
    total_price numeric(10,2) NOT NULL,
    currency text DEFAULT 'EUR',
    shipping_cost numeric(10,2) DEFAULT 0,
    shipping_provider text, -- for DHL integration later
    shipping_product text, -- e.g. Paket / Kleinpaket
    payment_method text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Order Items Table (Matches Billbee OrderItem)
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL, -- link to our central product
    title text NOT NULL,
    sku text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT 19.00,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- Phase 3 Point 2: DHL Integration Updates

-- Add DHL columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight numeric(10,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dhl_versandart text DEFAULT 'Paket';

-- Add DHL columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dhl_tracking_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dhl_label_url text;

