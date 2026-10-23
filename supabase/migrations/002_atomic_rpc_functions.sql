-- ==============================================================================
-- HOSTEL CANTEEN POS — ATOMIC POSTGRESQL RPC FUNCTIONS
-- Migration: 002_atomic_rpc_functions.sql
-- Ensures concurrent stock updates and sales never cause inconsistent inventory
-- ==============================================================================

-- Atomic stock update with row-level lock (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.adjust_stock_atomic(
    p_product_id UUID,
    p_movement_type TEXT,
    p_quantity_change INTEGER,
    p_unit_cost NUMERIC,
    p_reference_id TEXT,
    p_reason TEXT,
    p_supplier_name TEXT,
    p_batch_info TEXT,
    p_recorded_by TEXT
)
RETURNS public.inventory_movements
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product public.products;
    v_new_stock INTEGER;
    v_movement public.inventory_movements;
BEGIN
    -- Lock the product row to prevent race conditions during concurrent operations
    SELECT * INTO v_product
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;

    v_new_stock := v_product.stock_quantity + p_quantity_change;

    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for product "%" (Available: %, Requested deduction: %)',
            v_product.name, v_product.stock_quantity, ABS(p_quantity_change);
    END IF;

    UPDATE public.products
    SET stock_quantity = v_new_stock,
        purchase_price = CASE WHEN p_movement_type = 'PURCHASE' AND p_unit_cost > 0 THEN p_unit_cost ELSE purchase_price END,
        supplier_name = COALESCE(NULLIF(p_supplier_name, ''), supplier_name),
        batch_info = COALESCE(NULLIF(p_batch_info, ''), batch_info),
        updated_at = NOW()
    WHERE id = p_product_id;

    INSERT INTO public.inventory_movements (
        product_id,
        product_name_snapshot,
        sku_snapshot,
        movement_type,
        quantity_change,
        previous_stock,
        new_stock,
        unit_cost,
        reference_id,
        reason,
        supplier_name,
        batch_info,
        recorded_by
    ) VALUES (
        v_product.id,
        v_product.name,
        v_product.sku,
        p_movement_type,
        p_quantity_change,
        v_product.stock_quantity,
        v_new_stock,
        COALESCE(p_unit_cost, v_product.purchase_price),
        p_reference_id,
        p_reason,
        p_supplier_name,
        p_batch_info,
        p_recorded_by
    )
    RETURNING * INTO v_movement;

    RETURN v_movement;
END;
$$;
