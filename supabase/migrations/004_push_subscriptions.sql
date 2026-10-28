-- ==============================================================================
-- HOSTEL CANTEEN POS — WEB PUSH NOTIFICATION SUBSCRIPTIONS TABLE
-- Migration: 004_push_subscriptions.sql
-- Run this in Supabase Dashboard -> SQL Editor (Optional, state also persists in canteen_store)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'customer')),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    user_name TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup when notifying staff or a specific customer
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role ON public.push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer_id ON public.push_subscriptions(customer_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon push registration" ON public.push_subscriptions;
CREATE POLICY "Allow anon push registration"
ON public.push_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);
