export type UserRole = "admin" | "manager" | "staff" | "sales_executive";

export interface CanteenStatus {
  is_open: boolean;
  closure_type: "open" | "today" | "custom_time" | "break";
  closure_reason: string;
  reopen_at?: string | null;
  updated_at: string;
  updated_by: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  password_hash?: string | null; // scrypt hash; only stored in db.users, never sent to clients
  created_at: string;
  updated_at: string;
}

export type ProductCategory =
  | "Chips & Namkeen"
  | "Biscuits & Cookies"
  | "Cold Drinks & Beverages"
  | "Instant Noodles & Snacks"
  | "Chocolates & Candies"
  | "Dairy & Bakery"
  | "Stationery & Essentials"
  | string;

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  image_url?: string | null;
  reference_images?: string[]; // Extra photos captured at POS to improve offline snack recognition
  purchase_price: number;
  selling_price: number;
  estimated_unit_profit: number; // selling_price - purchase_price
  stock_quantity: number;
  min_stock_level: number;
  supplier_name?: string | null;
  expiry_date?: string | null; // YYYY-MM-DD
  batch_info?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StockMovementType =
  | "OPENING"
  | "PURCHASE"
  | "SALE"
  | "DAMAGED"
  | "EXPIRED"
  | "MISSING"
  | "WASTED"
  | "ADJUSTMENT_ADD"
  | "ADJUSTMENT_SUB"
  | "SALE_CANCEL_RESTORE"
  | "SALE_REFUND_RESTORE";

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  movement_type: StockMovementType;
  quantity_change: number; // + for additions, - for deductions
  previous_stock: number;
  new_stock: number;
  unit_cost: number;
  reference_id?: string | null;
  reason: string;
  supplier_name?: string | null;
  batch_info?: string | null;
  recorded_by: string;
  created_at: string;
}

export interface ProductStockSummary {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  is_active: boolean;
  opening_stock: number;
  purchases: number;
  sales: number;
  damaged_expired_wasted: number;
  manual_adjustments: number;
  returns_restored: number;
  closing_stock: number;
  min_stock_level: number;
  purchase_price: number;
  selling_price: number;
  inventory_value: number;
  stock_status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}

export interface Customer {
  id: string;
  name: string;
  room_number?: string | null;
  phone?: string | null;
  password?: string | null;
  registration_date: string;
  total_purchases: number;
  total_payments: number;
  outstanding_dues: number;
  notes?: string | null;
  is_active: boolean;
  /** Set when a sales executive registered the student. */
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerLedgerEntry {
  id: string;
  customer_id: string;
  date: string;
  type: "PURCHASE" | "PAYMENT" | "REFUND_OR_CANCEL" | "ADJUSTMENT";
  reference_bill: string;
  description: string;
  debit_purchase: number; // Increases customer obligation
  credit_payment: number; // Reduces customer obligation
  payment_method?: string;
  upi_reference?: string | null;
  balance_after: number;
  recorded_by: string;
}

export type DiscountType = "none" | "fixed" | "percentage";

export type PaymentMethod = "Cash" | "UPI" | "Other";

export type PaymentStatus =
  | "Paid"
  | "Partially Paid"
  | "Pending"
  | "Failed"
  | "Refunded";

export type SaleStatus =
  | "Completed"
  | "Cancelled"
  | "Refunded"
  | "Partially Refunded";

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  category_snapshot: string;
  quantity: number;
  refunded_quantity: number;
  purchase_price_at_sale: number;
  selling_price_at_sale: number;
  original_line_total: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  discount_reason?: string | null;
  final_line_total: number;
  line_cogs: number;
  line_profit: number;
  created_at: string;
}

export interface PaymentEntry {
  id: string;
  sale_id?: string | null;
  bill_number: string;
  customer_id?: string | null;
  customer_name_snapshot?: string | null;
  room_number_snapshot?: string | null;
  payment_method: PaymentMethod;
  expected_amount: number;
  amount_received: number;
  upi_reference?: string | null;
  is_duplicate_upi_warning: boolean;
  verification_status: string; // Always "Manually Recorded (Not Independently Verified)"
  payment_status: PaymentStatus;
  notes?: string | null;
  recorded_by: string;
  payment_date: string;
  created_at: string;
  updated_at: string;
}

export interface SaleRecord {
  id: string;
  bill_number: string; // e.g., HC-20261024-001
  idempotency_key?: string | null;
  customer_id?: string | null;
  customer_name_snapshot: string;
  room_number_snapshot?: string | null;
  subtotal_amount: number;
  item_discount_total: number;
  bill_discount_type: DiscountType;
  bill_discount_value: number;
  bill_discount_amount: number;
  total_discount_amount: number;
  discount_reason?: string | null;
  discount_authorized_by?: string | null;
  /** Set only when a sales executive gave the discount (admin discounts leave it empty). */
  discount_given_by_user_id?: string | null;
  payable_amount: number;
  paid_amount: number;
  refunded_amount: number;
  outstanding_amount: number;
  cogs_amount: number;
  estimated_gross_profit: number;
  payment_status: PaymentStatus;
  sale_status: SaleStatus;
  payment_methods_summary: string;
  upi_references_summary?: string | null;
  notes?: string | null;
  created_by: string;
  created_by_user_id?: string | null;
  commission_rate_percent?: number | null; // snapshot of the sales-executive commission rate at creation
  edit_history?: Array<{
    at: string;
    by: string;
    by_user_id: string;
    action: string;
  }>;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  items: SaleItem[];
  payments: PaymentEntry[];
  refunds?: RefundCancellationRecord[];
}

export interface RefundCancellationRecord {
  id: string;
  sale_id: string;
  bill_number: string;
  action_type: "CANCEL" | "FULL_REFUND" | "PARTIAL_REFUND";
  refund_amount: number;
  refund_method: "Cash" | "UPI" | "Other" | "Credit Adjustment" | "None";
  upi_reference?: string | null;
  restock_items: boolean;
  reason: string;
  items_json: Array<{
    product_id: string;
    product_name: string;
    quantity_restocked: number;
    amount_refunded: number;
  }>;
  authorized_by: string;
  authorized_by_user_id?: string | null;
  created_at: string;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  expense_date: string; // YYYY-MM-DD
  description?: string | null;
  supplier_or_receipt_ref?: string | null;
  recorded_by: string;
  is_voided: boolean;
  void_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRecord {
  id: string;
  entity_type:
    | "PRODUCT"
    | "INVENTORY"
    | "SALE"
    | "PAYMENT"
    | "CUSTOMER"
    | "EXPENSE"
    | "SYSTEM"
    | "AUTH";
  entity_id: string;
  action: string;
  summary: string;
  previous_data?: unknown;
  new_data?: unknown;
  performed_by: string;
  created_at: string;
}

export interface CreateSaleInput {
  idempotency_key?: string;
  customer_id?: string | null;
  new_customer?: {
    name: string;
    room_number?: string;
    phone?: string;
  } | null;
  items: Array<{
    product_id: string;
    quantity: number;
    discount_type?: DiscountType;
    discount_value?: number;
    discount_reason?: string;
  }>;
  bill_discount_type?: DiscountType;
  bill_discount_value?: number;
  discount_reason?: string;
  discount_authorized_by?: string;
  payments: Array<{
    payment_method: PaymentMethod;
    amount_received: number;
    upi_reference?: string;
    payment_date?: string;
    notes?: string;
    payment_status?: PaymentStatus;
  }>;
  notes?: string;
}
