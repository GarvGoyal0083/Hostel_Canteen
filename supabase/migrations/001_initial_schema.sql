-- ==============================================================================
-- HOSTEL CANTEEN POS — COMPLETE SUPABASE POSTGRESQL SCHEMA & MIGRATIONS
-- Migration: 001_initial_schema.sql
-- Timezone standard: Asia/Kolkata (IST)
-- ==============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. USERS AND ROLES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Links to Supabase auth.users(id) when using Supabase Auth
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'staff')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. PRODUCTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    purchase_price NUMERIC(12, 2) NOT NULL CHECK (purchase_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    estimated_unit_profit NUMERIC(12, 2) GENERATED ALWAYS AS (selling_price - purchase_price) STORED,
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    min_stock_level INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_level >= 0),
    supplier_name TEXT,
    expiry_date DATE,
    batch_info TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- ==============================================================================
-- 3. CUSTOMERS TABLE (HOSTEL STUDENTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    room_number TEXT,
    phone TEXT,
    registration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_purchases NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_purchases >= 0),
    total_payments NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_payments >= 0),
    outstanding_dues NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (outstanding_dues >= 0),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_room ON public.customers(room_number);

-- ==============================================================================
-- 4. DAILY BILL COUNTER TABLE (Atomic Server-Side Bill ID Generation)
-- Format: HC-YYYYMMDD-NNN (e.g., HC-20261024-001)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.daily_bill_counters (
    date_key TEXT PRIMARY KEY, -- YYYYMMDD in Asia/Kolkata
    last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.generate_next_bill_number(p_date_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_seq INTEGER;
BEGIN
    INSERT INTO public.daily_bill_counters (date_key, last_seq)
    VALUES (p_date_key, 1)
    ON CONFLICT (date_key)
    DO UPDATE SET last_seq = public.daily_bill_counters.last_seq + 1
    RETURNING last_seq INTO v_next_seq;

    RETURN 'HC-' || p_date_key || '-' || LPAD(v_next_seq::TEXT, 3, '0');
END;
$$;

-- ==============================================================================
-- 5. SALES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number TEXT UNIQUE NOT NULL,
    idempotency_key TEXT UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name_snapshot TEXT NOT NULL DEFAULT 'Walk-in / Anonymous Student',
    room_number_snapshot TEXT,
    subtotal_amount NUMERIC(12, 2) NOT NULL CHECK (subtotal_amount >= 0),
    item_discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (item_discount_total >= 0),
    bill_discount_type TEXT NOT NULL DEFAULT 'none' CHECK (bill_discount_type IN ('none', 'fixed', 'percentage')),
    bill_discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (bill_discount_value >= 0),
    bill_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (bill_discount_amount >= 0),
    total_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_discount_amount >= 0),
    discount_reason TEXT,
    discount_authorized_by TEXT,
    payable_amount NUMERIC(12, 2) NOT NULL CHECK (payable_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
    outstanding_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (outstanding_amount >= 0),
    cogs_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cogs_amount >= 0),
    estimated_gross_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Paid', 'Partially Paid', 'Pending', 'Failed', 'Refunded')),
    sale_status TEXT NOT NULL DEFAULT 'Completed' CHECK (sale_status IN ('Completed', 'Cancelled', 'Refunded', 'Partially Refunded')),
    payment_methods_summary TEXT NOT NULL DEFAULT 'None',
    upi_references_summary TEXT,
    notes TEXT,
    created_by TEXT NOT NULL,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_bill_number ON public.sales(bill_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON public.sales(payment_status);

-- ==============================================================================
-- 6. SALE ITEMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name_snapshot TEXT NOT NULL,
    sku_snapshot TEXT NOT NULL,
    category_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    refunded_quantity INTEGER NOT NULL DEFAULT 0 CHECK (refunded_quantity >= 0 AND refunded_quantity <= quantity),
    purchase_price_at_sale NUMERIC(12, 2) NOT NULL CHECK (purchase_price_at_sale >= 0),
    selling_price_at_sale NUMERIC(12, 2) NOT NULL CHECK (selling_price_at_sale >= 0),
    original_line_total NUMERIC(12, 2) NOT NULL CHECK (original_line_total >= 0),
    discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'fixed', 'percentage')),
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount <= original_line_total),
    discount_reason TEXT,
    final_line_total NUMERIC(12, 2) NOT NULL CHECK (final_line_total >= 0),
    line_cogs NUMERIC(12, 2) NOT NULL CHECK (line_cogs >= 0),
    line_profit NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- ==============================================================================
-- 7. PAYMENTS TABLE (Strictly Manual Entry — No Payment Gateway)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE RESTRICT,
    bill_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name_snapshot TEXT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Other')),
    expected_amount NUMERIC(12, 2) NOT NULL CHECK (expected_amount >= 0),
    amount_received NUMERIC(12, 2) NOT NULL CHECK (amount_received >= 0),
    upi_reference TEXT, -- Manually entered UTR / UPI Transaction ID
    is_duplicate_upi_warning BOOLEAN NOT NULL DEFAULT false,
    verification_status TEXT NOT NULL DEFAULT 'Manually Recorded (Unverified)',
    payment_status TEXT NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Partially Paid', 'Pending', 'Failed', 'Refunded')),
    notes TEXT,
    recorded_by TEXT NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill_number ON public.payments(bill_number);
CREATE INDEX IF NOT EXISTS idx_payments_upi_reference ON public.payments(upi_reference);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date DESC);

-- ==============================================================================
-- 8. INVENTORY MOVEMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name_snapshot TEXT NOT NULL,
    sku_snapshot TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'OPENING',
        'PURCHASE',
        'SALE',
        'DAMAGED',
        'EXPIRED',
        'MISSING',
        'WASTED',
        'ADJUSTMENT_ADD',
        'ADJUSTMENT_SUB',
        'SALE_CANCEL_RESTORE',
        'SALE_REFUND_RESTORE'
    )),
    quantity_change INTEGER NOT NULL, -- Positive for additions, negative for deductions
    previous_stock INTEGER NOT NULL CHECK (previous_stock >= 0),
    new_stock INTEGER NOT NULL CHECK (new_stock >= 0),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    reference_id TEXT, -- Bill number, PO ref, or adjustment ref
    reason TEXT NOT NULL,
    supplier_name TEXT,
    batch_info TEXT,
    recorded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);

-- ==============================================================================
-- 9. EXPENSES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    supplier_or_receipt_ref TEXT,
    recorded_by TEXT NOT NULL,
    is_voided BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);

-- ==============================================================================
-- 10. REFUNDS AND CANCELLATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.refunds_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    bill_number TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('CANCEL', 'FULL_REFUND', 'PARTIAL_REFUND')),
    refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
    refund_method TEXT NOT NULL DEFAULT 'Cash' CHECK (refund_method IN ('Cash', 'UPI', 'Other', 'Credit Adjustment', 'None')),
    upi_reference TEXT,
    restock_items BOOLEAN NOT NULL DEFAULT true,
    reason TEXT NOT NULL,
    items_json JSONB NOT NULL DEFAULT '[]'::JSONB,
    authorized_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. AUDIT LOGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    performed_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 12. FINANCIAL RECORD PROTECTION TRIGGERS (Prevent Permanent Deletion)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_financial_record_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Permanent deletion of completed financial records (%) is prohibited. Use controlled cancellation, refund, or correction workflows.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sales_delete ON public.sales;
CREATE TRIGGER trg_prevent_sales_delete
BEFORE DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_deletion();

DROP TRIGGER IF EXISTS trg_prevent_payments_delete ON public.payments;
CREATE TRIGGER trg_prevent_payments_delete
BEFORE DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_deletion();

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_bill_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current Supabase user is an active admin/staff
CREATE OR REPLACE FUNCTION public.is_authorized_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE (auth_user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
          AND is_active = true
          AND role IN ('admin', 'manager', 'staff')
    );
$$;

-- Policies for authenticated canteen admins
CREATE POLICY "Admins full access on users" ON public.users FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on products" ON public.products FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on customers" ON public.customers FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on daily_bill_counters" ON public.daily_bill_counters FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on sales" ON public.sales FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on sale_items" ON public.sale_items FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on payments" ON public.payments FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on inventory_movements" ON public.inventory_movements FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on refunds_cancellations" ON public.refunds_cancellations FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
CREATE POLICY "Admins full access on audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (public.is_authorized_admin()) WITH CHECK (public.is_authorized_admin());
