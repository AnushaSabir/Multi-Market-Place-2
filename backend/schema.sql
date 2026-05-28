-- Reset Tables (Fix for "Already Exists" and missing columns)
DROP TABLE IF EXISTS public.marketplace_credentials;
DROP TABLE IF EXISTS public.sync_logs;
DROP TABLE IF EXISTS public.marketplace_products;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.amazon_products;

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Products Table
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  sku text,
  ean text,
  price numeric(10, 2),
  quantity integer default 0,
  weight numeric(10, 2),
  shipping_type text,
  images text[],
  status text check (status in ('imported', 'optimized', 'published')) default 'imported',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Marketplace Products Table
create table public.marketplace_products (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id) on delete cascade,
  marketplace text check (marketplace in ('otto', 'ebay', 'kaufland', 'shopify', 'billbee')),
  external_id text,
  price numeric(10, 2),
  quantity integer,
  last_synced_at timestamp with time zone,
  sync_status text check (sync_status in ('pending', 'synced', 'failed')),
  unique(product_id, marketplace)
);

-- 4. Sync Logs Table
create table public.sync_logs (
  id uuid primary key default uuid_generate_v4(),
  marketplace text not null,
  action text check (action in ('import', 'export', 'update')),
  status text not null,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Amazon Products (Crawler)
create table public.amazon_products (
  id uuid primary key default uuid_generate_v4(),
  asin text unique not null,
  raw_data jsonb,
  extracted_at timestamp with time zone default timezone('utc'::text, now()),
  crawl_status text check (crawl_status in ('pending', 'success', 'failed')) default 'pending',
  error_message text
);

-- 6. Marketplace Credentials
create table public.marketplace_credentials (
  id uuid primary key default uuid_generate_v4(),
  marketplace text unique not null check (marketplace in ('otto', 'ebay', 'kaufland', 'shopify', 'billbee')),
  credentials jsonb not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Stock Movements (Billbee Alternative)
create table public.stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id) on delete cascade,
  change integer not null,
  current_stock integer not null,
  order_id text,
  platform text not null,
  type text check (type in ('manual', 'order', 'initial', 'merge')) default 'manual',
  user_name text default 'Admin',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ALTER EXISTING TABLE (Run these in Supabase SQL Editor manually if the table already exists)
-- ALTER TABLE public.marketplace_products ADD COLUMN IF NOT EXISTS is_custom_price boolean default false;
