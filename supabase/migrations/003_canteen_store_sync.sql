-- ==============================================================================
-- HOSTEL CANTEEN POS — REAL-TIME CLOUD PERSISTENCE TABLE
-- Migration: 003_canteen_store_sync.sql
-- Run this in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Create the persistent store table for all canteen state
CREATE TABLE IF NOT EXISTS public.canteen_store (
    id TEXT PRIMARY KEY DEFAULT 'main',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.canteen_store ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policy if present, then allow full read/write for application access
DROP POLICY IF EXISTS "Allow all access to canteen_store" ON public.canteen_store;
CREATE POLICY "Allow all access to canteen_store"
ON public.canteen_store
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Enable Realtime updates (Optional, for instant live socket updates across tabs)
ALTER PUBLICATION supabase_realtime ADD TABLE public.canteen_store;
