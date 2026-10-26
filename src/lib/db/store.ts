import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import {
  AuditLogRecord,
  CanteenStatus,
  CreateSaleInput,
  Customer,
  CustomerLedgerEntry,
  DiscountType,
  ExpenseRecord,
  InventoryMovement,
  PaymentEntry,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductStockSummary,
  RefundCancellationRecord,
  SaleItem,
  SaleRecord,
  StockMovementType,
} from "@/types/pos";
import {
  createCleanProductionDatabase,
  createDevelopmentSampleDatabase,
  DatabaseSchema,
} from "@/lib/db/seed";
import { getISTCompactDateKey, getISTDateString, round2 } from "@/lib/format";

const isServerless = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
);

const DATA_DIR = isServerless ? os.tmpdir() : path.join(process.cwd(), "data");
const DB_FILE_PATH =
  process.env.POS_DB_FILE_PATH || path.join(DATA_DIR, "canteen_store.json");

// Server-wide async mutex queue to guarantee atomic transactions and prevent race conditions
let lockChain: Promise<unknown> = Promise.resolve();

export async function withTransactionLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = lockChain.then(() => fn());
  lockChain = next.catch(() => undefined);
  return next;
}

function ensureDataDir(): void {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.warn(`[store] Could not ensure directory ${path.dirname(DB_FILE_PATH)}:`, err);
  }
}

export function readDatabase(): DatabaseSchema {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE_PATH)) {
    // 1. Check if a pre-bundled store exists in the deployed app bundle
    const bundledCandidates = [
      path.join(process.cwd(), "src", "lib", "db", "default_seed.json"),
      path.join(process.cwd(), "data", "canteen_store.json"),
    ];
    for (const candidate of bundledCandidates) {
      if (fs.existsSync(candidate)) {
        try {
          const raw = fs.readFileSync(candidate, "utf8");
          const parsed = JSON.parse(raw) as DatabaseSchema;
          writeDatabase(parsed);
          return parsed;
        } catch {
          // continue fallback
        }
      }
    }

    const isProd = process.env.NODE_ENV === "production";
    const seedDev =
      process.env.SEED_DEV_SAMPLE_DATA === "true" ||
      (!isProd && process.env.SEED_DEV_SAMPLE_DATA !== "false") ||
      process.env.SEED_DEMO_DATA === "true";
    const initial = seedDev
      ? createDevelopmentSampleDatabase()
      : createCleanProductionDatabase();
    writeDatabase(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(DB_FILE_PATH, "utf8");
    return JSON.parse(raw) as DatabaseSchema;
  } catch (err) {
    console.warn(`[store] Failed to parse ${DB_FILE_PATH}, falling back to default seed:`, err);
    const initial = createDevelopmentSampleDatabase();
    try {
      writeDatabase(initial);
    } catch {
      // ignore
    }
    return initial;
  }
}

export function writeDatabase(db: DatabaseSchema): void {
  ensureDataDir();
  db.meta.updated_at = new Date().toISOString();
  const tempPath = `${DB_FILE_PATH}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tempPath, DB_FILE_PATH);
  } catch (err) {
    console.error(`[store] Failed to write database to ${DB_FILE_PATH}:`, err);
    if (!isServerless) throw err;
  }
}

function appendAudit(
  db: DatabaseSchema,
  entry: Omit<AuditLogRecord, "id" | "created_at">
): void {
  db.audit_logs.unshift({
    id: `aud-${crypto.randomUUID().slice(0, 12)}`,
    created_at: new Date().toISOString(),
    ...entry,
  });
}

// ==============================================================================
// 1. PRODUCT OPERATIONS
// ==============================================================================

export function listProducts(filters?: {
  search?: string;
  category?: string;
  includeInactive?: boolean;
}): Product[] {
  const db = readDatabase();
  let list = [...db.products];

  if (!filters?.includeInactive) {
    list = list.filter((p) => p.is_active);
  }
  if (filters?.category && filters.category !== "ALL") {
    list = list.filter(
      (p) => p.category.toLowerCase() === filters.category!.toLowerCase()
    );
  }
  if (filters?.search && filters.search.trim() !== "") {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q))
    );
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createProduct(
  input: {
    name: string;
    sku: string;
    category: string;
    image_url?: string;
    purchase_price: number;
    selling_price: number;
    stock_quantity: number;
    min_stock_level: number;
    supplier_name?: string;
    expiry_date?: string;
    batch_info?: string;
  },
  adminName: string
): Promise<Product> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const name = (input.name || "").trim();
    const sku = (input.sku || "").trim().toUpperCase();
    const category = (input.category || "").trim();

    if (!name) throw new Error("Product name is required.");
    if (!sku) throw new Error("Product SKU / code is required.");
    if (!category) throw new Error("Product category is required.");

    if (db.products.some((p) => p.sku.toUpperCase() === sku)) {
      throw new Error(`A product with SKU "${sku}" already exists.`);
    }

    const purchasePrice = round2(Number(input.purchase_price));
    const sellingPrice = round2(Number(input.selling_price));
    const stockQty = Math.floor(Number(input.stock_quantity ?? 0));
    const minStock = Math.floor(Number(input.min_stock_level ?? 5));

    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      throw new Error("Purchase price must be 0 or greater.");
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      throw new Error("Selling price must be 0 or greater.");
    }
    if (!Number.isFinite(stockQty) || stockQty < 0) {
      throw new Error("Opening stock quantity cannot be negative.");
    }
    if (!Number.isFinite(minStock) || minStock < 0) {
      throw new Error("Minimum stock alert level cannot be negative.");
    }

    const now = new Date().toISOString();
    const product: Product = {
      id: `prod-${crypto.randomUUID().slice(0, 12)}`,
      name,
      sku,
      category,
      image_url: input.image_url?.trim() || null,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      estimated_unit_profit: round2(sellingPrice - purchasePrice),
      stock_quantity: stockQty,
      min_stock_level: minStock,
      supplier_name: input.supplier_name?.trim() || null,
      expiry_date: input.expiry_date?.trim() || null,
      batch_info: input.batch_info?.trim() || null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    db.products.push(product);

    if (stockQty > 0) {
      db.inventory_movements.unshift({
        id: `mov-${crypto.randomUUID().slice(0, 12)}`,
        product_id: product.id,
        product_name_snapshot: product.name,
        sku_snapshot: product.sku,
        movement_type: "OPENING",
        quantity_change: stockQty,
        previous_stock: 0,
        new_stock: stockQty,
        unit_cost: purchasePrice,
        reference_id: "OPENING-STOCK",
        reason: "Initial opening stock at product creation",
        supplier_name: product.supplier_name,
        batch_info: product.batch_info,
        recorded_by: adminName,
        created_at: now,
      });
    }

    appendAudit(db, {
      entity_type: "PRODUCT",
      entity_id: product.id,
      action: "CREATE_PRODUCT",
      summary: `Created product "${product.name}" (${product.sku}) with stock ${stockQty}`,
      new_data: product,
      performed_by: adminName,
    });

    writeDatabase(db);
    return product;
  });
}

export async function updateProduct(
  productId: string,
  input: Partial<{
    name: string;
    sku: string;
    category: string;
    image_url: string | null;
    purchase_price: number;
    selling_price: number;
    min_stock_level: number;
    supplier_name: string | null;
    expiry_date: string | null;
    batch_info: string | null;
    is_active: boolean;
  }>,
  adminName: string
): Promise<Product> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const idx = db.products.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error("Product not found.");

    const existing = db.products[idx];
    const previousSnapshot = { ...existing };

    const newSku =
      input.sku !== undefined ? input.sku.trim().toUpperCase() : existing.sku;
    if (!newSku) throw new Error("SKU cannot be empty.");

    if (
      newSku !== existing.sku.toUpperCase() &&
      db.products.some((p) => p.id !== productId && p.sku.toUpperCase() === newSku)
    ) {
      throw new Error(`Another product already uses SKU "${newSku}".`);
    }

    const purchasePrice =
      input.purchase_price !== undefined
        ? round2(Number(input.purchase_price))
        : existing.purchase_price;
    const sellingPrice =
      input.selling_price !== undefined
        ? round2(Number(input.selling_price))
        : existing.selling_price;
    const minStock =
      input.min_stock_level !== undefined
        ? Math.floor(Number(input.min_stock_level))
        : existing.min_stock_level;

    if (purchasePrice < 0) throw new Error("Purchase price cannot be negative.");
    if (sellingPrice < 0) throw new Error("Selling price cannot be negative.");
    if (minStock < 0) throw new Error("Minimum stock alert level cannot be negative.");

    const updated: Product = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      sku: newSku,
      category:
        input.category !== undefined ? input.category.trim() : existing.category,
      image_url:
        input.image_url !== undefined ? input.image_url : existing.image_url,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      estimated_unit_profit: round2(sellingPrice - purchasePrice),
      min_stock_level: minStock,
      supplier_name:
        input.supplier_name !== undefined
          ? input.supplier_name
          : existing.supplier_name,
      expiry_date:
        input.expiry_date !== undefined ? input.expiry_date : existing.expiry_date,
      batch_info:
        input.batch_info !== undefined ? input.batch_info : existing.batch_info,
      is_active:
        input.is_active !== undefined ? Boolean(input.is_active) : existing.is_active,
      updated_at: new Date().toISOString(),
    };

    if (!updated.name) throw new Error("Product name cannot be empty.");

    db.products[idx] = updated;

    appendAudit(db, {
      entity_type: "PRODUCT",
      entity_id: updated.id,
      action: "UPDATE_PRODUCT",
      summary: `Updated product "${updated.name}" (${updated.sku})`,
      previous_data: previousSnapshot,
      new_data: updated,
      performed_by: adminName,
    });

    writeDatabase(db);
    return updated;
  });
}

const MAX_REFERENCE_IMAGES_PER_PRODUCT = 12;

/**
 * Attach a confirmed POS scan photo to a product so future offline recognition improves.
 * Keeps only the most recent MAX_REFERENCE_IMAGES_PER_PRODUCT photos; returns removed URLs.
 */
export async function addProductReferenceImage(
  productId: string,
  imageUrl: string,
  adminName: string
): Promise<{ product: Product; removed: string[] }> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const idx = db.products.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error("Product not found.");

    const existing = db.products[idx];
    const refs = [...(existing.reference_images || []), imageUrl];
    const removed =
      refs.length > MAX_REFERENCE_IMAGES_PER_PRODUCT
        ? refs.splice(0, refs.length - MAX_REFERENCE_IMAGES_PER_PRODUCT)
        : [];

    const updated: Product = {
      ...existing,
      reference_images: refs,
      updated_at: new Date().toISOString(),
    };
    db.products[idx] = updated;

    appendAudit(db, {
      entity_type: "PRODUCT",
      entity_id: updated.id,
      action: "ADD_REFERENCE_IMAGE",
      summary: `Saved scan reference photo for "${updated.name}" (${refs.length} total)`,
      performed_by: adminName,
    });

    writeDatabase(db);
    return { product: updated, removed };
  });
}

// ==============================================================================
// 2. INVENTORY & STOCK MANAGEMENT OPERATIONS
// ==============================================================================

export async function recordStockMovement(
  input: {
    product_id: string;
    movement_type: StockMovementType;
    quantity: number; // positive integer representing units to add or deduct
    unit_cost?: number;
    reference_id?: string;
    reason: string;
    supplier_name?: string;
    batch_info?: string;
    expiry_date?: string;
  },
  adminName: string
): Promise<{ product: Product; movement: InventoryMovement }> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const prodIdx = db.products.findIndex((p) => p.id === input.product_id);
    if (prodIdx === -1) throw new Error("Product not found.");

    const product = db.products[prodIdx];
    const rawQty = Math.floor(Math.abs(Number(input.quantity)));
    if (!Number.isFinite(rawQty) || rawQty <= 0) {
      throw new Error("Stock movement quantity must be a positive whole number.");
    }

    const reason = (input.reason || "").trim();
    if (!reason) {
      throw new Error("A reason is required for all stock movements and adjustments.");
    }

    const additiveTypes: StockMovementType[] = [
      "OPENING",
      "PURCHASE",
      "ADJUSTMENT_ADD",
      "SALE_CANCEL_RESTORE",
      "SALE_REFUND_RESTORE",
    ];
    const deductiveTypes: StockMovementType[] = [
      "SALE",
      "DAMAGED",
      "EXPIRED",
      "MISSING",
      "WASTED",
      "ADJUSTMENT_SUB",
    ];

    let signedDelta = 0;
    if (additiveTypes.includes(input.movement_type)) {
      signedDelta = rawQty;
    } else if (deductiveTypes.includes(input.movement_type)) {
      signedDelta = -rawQty;
    } else {
      throw new Error(`Invalid stock movement type: ${input.movement_type}`);
    }

    const previousStock = product.stock_quantity;
    const newStock = previousStock + signedDelta;

    if (newStock < 0) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${previousStock}, Attempted deduction: ${rawQty}.`
      );
    }

    const now = new Date().toISOString();
    const unitCost =
      input.unit_cost !== undefined && Number(input.unit_cost) >= 0
        ? round2(Number(input.unit_cost))
        : product.purchase_price;

    // Update product stock and purchase attributes if incoming purchase
    product.stock_quantity = newStock;
    if (input.movement_type === "PURCHASE" && unitCost > 0) {
      product.purchase_price = unitCost;
      product.estimated_unit_profit = round2(product.selling_price - unitCost);
    }
    if (input.supplier_name?.trim()) {
      product.supplier_name = input.supplier_name.trim();
    }
    if (input.batch_info?.trim()) {
      product.batch_info = input.batch_info.trim();
    }
    if (input.expiry_date?.trim()) {
      product.expiry_date = input.expiry_date.trim();
    }
    product.updated_at = now;

    const movement: InventoryMovement = {
      id: `mov-${crypto.randomUUID().slice(0, 12)}`,
      product_id: product.id,
      product_name_snapshot: product.name,
      sku_snapshot: product.sku,
      movement_type: input.movement_type,
      quantity_change: signedDelta,
      previous_stock: previousStock,
      new_stock: newStock,
      unit_cost: unitCost,
      reference_id: input.reference_id?.trim() || null,
      reason,
      supplier_name: input.supplier_name?.trim() || product.supplier_name || null,
      batch_info: input.batch_info?.trim() || product.batch_info || null,
      recorded_by: adminName,
      created_at: now,
    };

    db.inventory_movements.unshift(movement);

    appendAudit(db, {
      entity_type: "INVENTORY",
      entity_id: movement.id,
      action: `STOCK_${input.movement_type}`,
      summary: `${input.movement_type} on "${product.name}" (${signedDelta > 0 ? `+${signedDelta}` : signedDelta}): ${previousStock} -> ${newStock}. Reason: ${reason}`,
      new_data: movement,
      performed_by: adminName,
    });

    writeDatabase(db);
    return { product, movement };
  });
}

export function listInventoryMovements(filters?: {
  product_id?: string;
  movement_type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}): InventoryMovement[] {
  const db = readDatabase();
  let list = [...db.inventory_movements];

  if (filters?.product_id && filters.product_id !== "ALL") {
    list = list.filter((m) => m.product_id === filters.product_id);
  }
  if (filters?.movement_type && filters.movement_type !== "ALL") {
    list = list.filter((m) => m.movement_type === filters.movement_type);
  }
  if (filters?.startDate) {
    list = list.filter(
      (m) => getISTDateString(m.created_at) >= filters.startDate!
    );
  }
  if (filters?.endDate) {
    list = list.filter(
      (m) => getISTDateString(m.created_at) <= filters.endDate!
    );
  }
  if (filters?.search && filters.search.trim() !== "") {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.product_name_snapshot.toLowerCase().includes(q) ||
        m.sku_snapshot.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        (m.reference_id && m.reference_id.toLowerCase().includes(q))
    );
  }

  return list.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Computes complete stock reconciliation table for every product:
 * Opening Stock, Purchases, Sales, Damaged/Expired/Missing/Wasted, Manual Adjustments, Returns, and Closing Stock
 */
export function getProductStockSummaries(): ProductStockSummary[] {
  const db = readDatabase();
  return db.products.map((product) => {
    const movs = db.inventory_movements.filter((m) => m.product_id === product.id);

    let opening = 0;
    let purchases = 0;
    let sales = 0;
    let damagedExpiredWasted = 0;
    let manualAdjustments = 0;
    let returnsRestored = 0;

    for (const m of movs) {
      switch (m.movement_type) {
        case "OPENING":
          opening += m.quantity_change;
          break;
        case "PURCHASE":
          purchases += m.quantity_change;
          break;
        case "SALE":
          sales += Math.abs(m.quantity_change);
          break;
        case "DAMAGED":
        case "EXPIRED":
        case "MISSING":
        case "WASTED":
          damagedExpiredWasted += Math.abs(m.quantity_change);
          break;
        case "ADJUSTMENT_ADD":
        case "ADJUSTMENT_SUB":
          manualAdjustments += m.quantity_change;
          break;
        case "SALE_CANCEL_RESTORE":
        case "SALE_REFUND_RESTORE":
          returnsRestored += m.quantity_change;
          break;
      }
    }

    // If a seed product had fewer historical movement rows than current closing stock, derive implied opening stock
    const trackedNet =
      opening +
      purchases -
      sales -
      damagedExpiredWasted +
      manualAdjustments +
      returnsRestored;
    if (trackedNet !== product.stock_quantity) {
      opening += product.stock_quantity - trackedNet;
    }

    const stockStatus =
      product.stock_quantity === 0
        ? "OUT_OF_STOCK"
        : product.stock_quantity <= product.min_stock_level
          ? "LOW_STOCK"
          : "IN_STOCK";

    return {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      category: product.category,
      is_active: product.is_active,
      opening_stock: opening,
      purchases,
      sales,
      damaged_expired_wasted: damagedExpiredWasted,
      manual_adjustments: manualAdjustments,
      returns_restored: returnsRestored,
      closing_stock: product.stock_quantity,
      min_stock_level: product.min_stock_level,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      inventory_value: round2(product.stock_quantity * product.purchase_price),
      stock_status: stockStatus,
    };
  });
}

// ==============================================================================
// 3. CUSTOMER MANAGEMENT & LEDGER OPERATIONS
// ==============================================================================

function recalculateCustomerTotals(db: DatabaseSchema, customerId: string): void {
  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) return;

  const customerSales = db.sales.filter(
    (s) => s.customer_id === customerId && s.sale_status !== "Cancelled"
  );

  let totalPurchases = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;

  for (const s of customerSales) {
    const netBillPayable = round2(Math.max(0, s.payable_amount - s.refunded_amount));
    totalPurchases = round2(totalPurchases + netBillPayable);
    totalPaid = round2(totalPaid + Math.min(netBillPayable, s.paid_amount));
    totalOutstanding = round2(totalOutstanding + s.outstanding_amount);
  }

  customer.total_purchases = totalPurchases;
  customer.total_payments = totalPaid;
  customer.outstanding_dues = totalOutstanding;
  customer.updated_at = new Date().toISOString();
}

export function listCustomers(search?: string): Customer[] {
  const db = readDatabase();
  let list = [...db.customers];
  if (search && search.trim() !== "") {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.room_number && c.room_number.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }
  return list.sort((a, b) => {
    if (b.outstanding_dues !== a.outstanding_dues) {
      return b.outstanding_dues - a.outstanding_dues;
    }
    return a.name.localeCompare(b.name);
  });
}

export function getCustomerDetailsWithLedger(customerId: string): {
  customer: Customer;
  sales: SaleRecord[];
  payments: PaymentEntry[];
  ledger: CustomerLedgerEntry[];
} {
  const db = readDatabase();
  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) throw new Error("Customer not found.");

  const sales = db.sales
    .filter((s) => s.customer_id === customerId)
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const payments = db.payments
    .filter((p) => p.customer_id === customerId)
    .sort(
      (a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );

  // Build chronological ledger from oldest to newest
  const rawEvents: Array<{
    id: string;
    date: string;
    type: CustomerLedgerEntry["type"];
    reference_bill: string;
    description: string;
    debit_purchase: number;
    credit_payment: number;
    payment_method?: string;
    upi_reference?: string | null;
    recorded_by: string;
  }> = [];

  for (const s of sales) {
    rawEvents.push({
      id: `led-sale-${s.id}`,
      date: s.created_at,
      type: "PURCHASE",
      reference_bill: s.bill_number,
      description: `Sale (${s.items.map((i) => `${i.product_name_snapshot} x${i.quantity}`).join(", ")})`,
      debit_purchase: s.payable_amount,
      credit_payment: 0,
      recorded_by: s.created_by,
    });

    if (s.refunds && s.refunds.length > 0) {
      for (const r of s.refunds) {
        const creditEffect =
          r.action_type === "CANCEL" ? s.payable_amount : r.refund_amount;
        rawEvents.push({
          id: `led-ref-${r.id}`,
          date: r.created_at,
          type: "REFUND_OR_CANCEL",
          reference_bill: s.bill_number,
          description: `${r.action_type}: ${r.reason}`,
          debit_purchase: 0,
          credit_payment: creditEffect,
          recorded_by: r.authorized_by,
        });
      }
    }
  }

  for (const p of payments) {
    if (p.payment_status !== "Failed" && p.payment_status !== "Refunded") {
      rawEvents.push({
        id: `led-pay-${p.id}`,
        date: p.payment_date || p.created_at,
        type: "PAYMENT",
        reference_bill: p.bill_number,
        description: `Payment via ${p.payment_method}${p.upi_reference ? ` (Ref: ${p.upi_reference})` : ""}${p.notes ? ` — ${p.notes}` : ""}`,
        debit_purchase: 0,
        credit_payment: p.amount_received,
        payment_method: p.payment_method,
        upi_reference: p.upi_reference,
        recorded_by: p.recorded_by,
      });
    }
  }

  rawEvents.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = 0;
  const ledger: CustomerLedgerEntry[] = rawEvents.map((ev) => {
    runningBalance = round2(
      Math.max(0, runningBalance + ev.debit_purchase - ev.credit_payment)
    );
    return {
      ...ev,
      customer_id: customerId,
      balance_after: runningBalance,
    };
  });

  return {
    customer,
    sales,
    payments,
    ledger: ledger.reverse(), // Most recent on top for UI display
  };
}

export async function createCustomer(
  input: {
    name: string;
    room_number?: string;
    phone?: string;
    notes?: string;
  },
  adminName: string
): Promise<Customer> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const name = (input.name || "").trim();
    if (!name) throw new Error("Customer name is required.");

    const now = new Date().toISOString();
    const customer: Customer = {
      id: `cust-${crypto.randomUUID().slice(0, 12)}`,
      name,
      room_number: input.room_number?.trim() || null,
      phone: input.phone?.trim() || null,
      registration_date: now,
      total_purchases: 0,
      total_payments: 0,
      outstanding_dues: 0,
      notes: input.notes?.trim() || null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    db.customers.push(customer);

    appendAudit(db, {
      entity_type: "CUSTOMER",
      entity_id: customer.id,
      action: "CREATE_CUSTOMER",
      summary: `Registered customer "${customer.name}" (Room: ${customer.room_number || "N/A"})`,
      new_data: customer,
      performed_by: adminName,
    });

    writeDatabase(db);
    return customer;
  });
}

export async function updateCustomer(
  customerId: string,
  input: Partial<{
    name: string;
    room_number: string | null;
    phone: string | null;
    notes: string | null;
    is_active: boolean;
  }>,
  adminName: string
): Promise<Customer> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const idx = db.customers.findIndex((c) => c.id === customerId);
    if (idx === -1) throw new Error("Customer not found.");

    const existing = db.customers[idx];
    const updated: Customer = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      room_number:
        input.room_number !== undefined
          ? input.room_number?.trim() || null
          : existing.room_number,
      phone:
        input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
      notes:
        input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
      is_active:
        input.is_active !== undefined ? Boolean(input.is_active) : existing.is_active,
      updated_at: new Date().toISOString(),
    };

    if (!updated.name) throw new Error("Customer name cannot be empty.");
    db.customers[idx] = updated;

    appendAudit(db, {
      entity_type: "CUSTOMER",
      entity_id: updated.id,
      action: "UPDATE_CUSTOMER",
      summary: `Updated customer "${updated.name}"`,
      previous_data: existing,
      new_data: updated,
      performed_by: adminName,
    });

    writeDatabase(db);
    return updated;
  });
}

// ==============================================================================
// 4. BILLING / POS, DISCOUNTS, & MANUAL PAYMENT ENGINE
// ==============================================================================

/**
 * Checks if a manually entered UPI transaction reference / UTR already exists in any payment
 */
export function checkDuplicateUpiReference(
  upiReference: string | undefined | null,
  excludePaymentId?: string
): {
  isDuplicate: boolean;
  matchingPayments: Array<{
    payment_id: string;
    bill_number: string;
    amount_received: number;
    payment_date: string;
    customer_name?: string | null;
  }>;
} {
  const normalized = (upiReference || "").trim().toUpperCase();
  if (!normalized) {
    return { isDuplicate: false, matchingPayments: [] };
  }

  const db = readDatabase();
  const matches = db.payments.filter(
    (p) =>
      p.id !== excludePaymentId &&
      p.upi_reference &&
      p.upi_reference.trim().toUpperCase() === normalized
  );

  return {
    isDuplicate: matches.length > 0,
    matchingPayments: matches.map((m) => ({
      payment_id: m.id,
      bill_number: m.bill_number,
      amount_received: m.amount_received,
      payment_date: m.payment_date,
      customer_name: m.customer_name_snapshot,
    })),
  };
}

function generateNextBillNumberInLock(db: DatabaseSchema, date = new Date()): string {
  const dateKey = getISTCompactDateKey(date);
  const currentSeq = db.daily_bill_counters[dateKey] || 0;
  let nextSeq = currentSeq + 1;
  let candidate = `HC-${dateKey}-${String(nextSeq).padStart(3, "0")}`;

  // Never reuse bill IDs under any circumstance
  while (db.sales.some((s) => s.bill_number === candidate)) {
    nextSeq++;
    candidate = `HC-${dateKey}-${String(nextSeq).padStart(3, "0")}`;
  }

  db.daily_bill_counters[dateKey] = nextSeq;
  return candidate;
}

function recalculateSalePaymentSummary(db: DatabaseSchema, sale: SaleRecord): void {
  const salePayments = db.payments.filter((p) => p.sale_id === sale.id);
  sale.payments = salePayments;

  const validPayments = salePayments.filter(
    (p) => p.payment_status !== "Failed" && p.payment_status !== "Refunded"
  );

  const totalReceived = round2(
    validPayments.reduce((acc, p) => acc + p.amount_received, 0)
  );
  const netPayable = round2(Math.max(0, sale.payable_amount - sale.refunded_amount));

  sale.paid_amount = totalReceived;
  sale.outstanding_amount = round2(Math.max(0, netPayable - totalReceived));

  if (sale.sale_status === "Cancelled") {
    sale.outstanding_amount = 0;
    sale.payment_status = sale.paid_amount > 0 ? "Refunded" : "Pending";
  } else if (sale.sale_status === "Refunded") {
    sale.outstanding_amount = 0;
    sale.payment_status = "Refunded";
  } else if (netPayable === 0) {
    sale.payment_status = "Paid";
  } else if (totalReceived >= netPayable) {
    sale.payment_status = "Paid";
  } else if (totalReceived > 0 && totalReceived < netPayable) {
    sale.payment_status = "Partially Paid";
  } else {
    const hasOnlyFailed =
      salePayments.length > 0 &&
      salePayments.every((p) => p.payment_status === "Failed");
    sale.payment_status = hasOnlyFailed ? "Failed" : "Pending";
  }

  // Update individual valid payment status tags for clarity
  for (const p of validPayments) {
    p.payment_status =
      sale.payment_status === "Paid"
        ? "Paid"
        : sale.payment_status === "Partially Paid"
          ? "Partially Paid"
          : p.payment_status;
  }

  const methods = Array.from(new Set(validPayments.map((p) => p.payment_method)));
  sale.payment_methods_summary =
    methods.length > 0
      ? methods.join(", ")
      : sale.outstanding_amount > 0
        ? "Unpaid (Udhaar)"
        : "None";

  const upiRefs = validPayments
    .map((p) => p.upi_reference)
    .filter((ref): ref is string => Boolean(ref && ref.trim() !== ""));
  sale.upi_references_summary = upiRefs.length > 0 ? upiRefs.join(", ") : null;
}

export async function createSaleTransaction(
  input: CreateSaleInput,
  adminName: string
): Promise<{
  sale: SaleRecord;
  duplicateUpiWarnings: string[];
}> {
  return withTransactionLock(() => {
    const db = readDatabase();

    // 1. Idempotency check to prevent duplicate submissions and duplicate stock deductions
    if (input.idempotency_key) {
      const existingSale = db.sales.find(
        (s) => s.idempotency_key === input.idempotency_key
      );
      if (existingSale) {
        return { sale: existingSale, duplicateUpiWarnings: [] };
      }
    }

    if (!input.items || input.items.length === 0) {
      throw new Error("Cannot create a sale with an empty cart.");
    }

    // 2. Resolve customer (existing, newly entered, or anonymous walk-in)
    let customer: Customer | null = null;
    if (input.customer_id) {
      customer = db.customers.find((c) => c.id === input.customer_id) || null;
      if (!customer) throw new Error("Selected customer was not found.");
    } else if (input.new_customer && input.new_customer.name.trim() !== "") {
      const nowIso = new Date().toISOString();
      customer = {
        id: `cust-${crypto.randomUUID().slice(0, 12)}`,
        name: input.new_customer.name.trim(),
        room_number: input.new_customer.room_number?.trim() || null,
        phone: input.new_customer.phone?.trim() || null,
        registration_date: nowIso,
        total_purchases: 0,
        total_payments: 0,
        outstanding_dues: 0,
        notes: null,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.customers.push(customer);
    }

    // 3. Validate all products, stock availability, and item-level discounts BEFORE mutating stock
    const nowIso = new Date().toISOString();
    const saleId = `sale-${crypto.randomUUID().slice(0, 12)}`;
    const consolidatedQtyByProduct = new Map<string, number>();

    for (const itemReq of input.items) {
      const qty = Math.floor(Number(itemReq.quantity));
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error("Item quantity must be a positive integer.");
      }
      consolidatedQtyByProduct.set(
        itemReq.product_id,
        (consolidatedQtyByProduct.get(itemReq.product_id) || 0) + qty
      );
    }

    for (const [productId, totalReqQty] of consolidatedQtyByProduct.entries()) {
      const product = db.products.find((p) => p.id === productId);
      if (!product) {
        throw new Error(`Product ID "${productId}" does not exist.`);
      }
      if (!product.is_active) {
        throw new Error(`Product "${product.name}" is deactivated and cannot be sold.`);
      }
      if (totalReqQty > product.stock_quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, Requested: ${totalReqQty}.`
        );
      }
    }

    // 4. Compute line items, item-level discounts, and COGS
    const saleItems: SaleItem[] = [];
    let subtotalAmount = 0;
    let itemDiscountTotal = 0;
    let totalCogs = 0;

    for (const itemReq of input.items) {
      const product = db.products.find((p) => p.id === itemReq.product_id)!;
      const qty = Math.floor(Number(itemReq.quantity));
      const originalLineTotal = round2(product.selling_price * qty);
      const lineCogs = round2(product.purchase_price * qty);

      const discType: DiscountType = itemReq.discount_type || "none";
      const discVal = round2(Math.max(0, Number(itemReq.discount_value || 0)));
      let itemDiscAmount = 0;

      if (discType === "fixed") {
        if (discVal > originalLineTotal) {
          throw new Error(
            `Fixed discount (₹${discVal}) on "${product.name}" cannot exceed its line total (₹${originalLineTotal}).`
          );
        }
        itemDiscAmount = discVal;
      } else if (discType === "percentage") {
        if (discVal > 100) {
          throw new Error(
            `Percentage discount (${discVal}%) on "${product.name}" cannot exceed 100%.`
          );
        }
        itemDiscAmount = round2((originalLineTotal * discVal) / 100);
      }

      const finalLineTotal = round2(originalLineTotal - itemDiscAmount);
      if (finalLineTotal < 0) {
        throw new Error(`Discount on "${product.name}" resulted in a negative price.`);
      }

      const lineProfit = round2(finalLineTotal - lineCogs);

      subtotalAmount = round2(subtotalAmount + originalLineTotal);
      itemDiscountTotal = round2(itemDiscountTotal + itemDiscAmount);
      totalCogs = round2(totalCogs + lineCogs);

      saleItems.push({
        id: `sitem-${crypto.randomUUID().slice(0, 12)}`,
        sale_id: saleId,
        product_id: product.id,
        product_name_snapshot: product.name,
        sku_snapshot: product.sku,
        category_snapshot: product.category,
        quantity: qty,
        refunded_quantity: 0,
        purchase_price_at_sale: product.purchase_price,
        selling_price_at_sale: product.selling_price,
        original_line_total: originalLineTotal,
        discount_type: discType,
        discount_value: discVal,
        discount_amount: itemDiscAmount,
        discount_reason: itemReq.discount_reason?.trim() || null,
        final_line_total: finalLineTotal,
        line_cogs: lineCogs,
        line_profit: lineProfit,
        created_at: nowIso,
      });
    }

    // 5. Compute Bill-Level Discount
    const subtotalAfterItemDiscounts = round2(subtotalAmount - itemDiscountTotal);
    const billDiscType: DiscountType = input.bill_discount_type || "none";
    const billDiscVal = round2(Math.max(0, Number(input.bill_discount_value || 0)));
    let billDiscAmount = 0;

    if (billDiscType === "fixed") {
      if (billDiscVal > subtotalAfterItemDiscounts) {
        throw new Error(
          `Bill discount (₹${billDiscVal}) cannot exceed subtotal after item discounts (₹${subtotalAfterItemDiscounts}).`
        );
      }
      billDiscAmount = billDiscVal;
    } else if (billDiscType === "percentage") {
      if (billDiscVal > 100) {
        throw new Error(`Bill percentage discount (${billDiscVal}%) cannot exceed 100%.`);
      }
      billDiscAmount = round2((subtotalAfterItemDiscounts * billDiscVal) / 100);
    }

    const totalDiscountAmount = round2(itemDiscountTotal + billDiscAmount);
    const payableAmount = round2(subtotalAmount - totalDiscountAmount);
    if (payableAmount < 0) {
      throw new Error("Final payable amount cannot be negative.");
    }

    // 6. Validate payments before committing
    const inputPayments = input.payments || [];
    let runningPaid = 0;
    const duplicateUpiWarnings: string[] = [];

    for (const payReq of inputPayments) {
      const amt = round2(Number(payReq.amount_received));
      if (!Number.isFinite(amt) || amt < 0) {
        throw new Error("Payment amount cannot be negative.");
      }
      if (amt > 0) {
        runningPaid = round2(runningPaid + amt);
      }
    }

    if (runningPaid > payableAmount + 0.01) {
      throw new Error(
        `Total payment received (₹${runningPaid}) cannot exceed final bill payable amount (₹${payableAmount}). If change was returned, enter the net amount retained for the bill.`
      );
    }

    // If there is an unpaid balance (credit / udhaar), ensure a customer is linked so dues are tracked
    const expectedOutstanding = round2(Math.max(0, payableAmount - runningPaid));
    if (expectedOutstanding > 0 && !customer) {
      throw new Error(
        `This bill has an unpaid balance (Udhaar) of ₹${expectedOutstanding}. Please select or enter a Hostel Customer so pending dues can be tracked.`
      );
    }

    // 7. Generate Unique Server-Side Bill ID (`HC-YYYYMMDD-NNN`)
    const billNumber = generateNextBillNumberInLock(db, new Date());

    // 8. Atomically deduct inventory & log movements
    for (const sItem of saleItems) {
      const product = db.products.find((p) => p.id === sItem.product_id)!;
      const prevStock = product.stock_quantity;
      const newStock = prevStock - sItem.quantity;
      product.stock_quantity = newStock;
      product.updated_at = nowIso;

      db.inventory_movements.unshift({
        id: `mov-${crypto.randomUUID().slice(0, 12)}`,
        product_id: product.id,
        product_name_snapshot: product.name,
        sku_snapshot: product.sku,
        movement_type: "SALE",
        quantity_change: -sItem.quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        unit_cost: product.purchase_price,
        reference_id: billNumber,
        reason: `Sold in Bill ${billNumber}`,
        recorded_by: adminName,
        created_at: nowIso,
      });
    }

    // 9. Create Payment Records (only for entries with amount_received > 0 or explicitly Failed)
    const createdPayments: PaymentEntry[] = [];
    let remainingExpected = payableAmount;

    for (const payReq of inputPayments) {
      const amt = round2(Number(payReq.amount_received));
      if (amt <= 0 && payReq.payment_status !== "Failed") {
        continue;
      }

      const upiRef = payReq.upi_reference?.trim() || null;
      const dupCheck = checkDuplicateUpiReference(upiRef);
      if (dupCheck.isDuplicate && upiRef) {
        duplicateUpiWarnings.push(
          `UPI Reference "${upiRef}" was previously recorded on Bill ${dupCheck.matchingPayments.map((m) => m.bill_number).join(", ")}. Flagged for admin review.`
        );
      }

      const paymentEntry: PaymentEntry = {
        id: `pay-${crypto.randomUUID().slice(0, 12)}`,
        sale_id: saleId,
        bill_number: billNumber,
        customer_id: customer?.id || null,
        customer_name_snapshot:
          customer?.name || "Walk-in / Anonymous Student",
        room_number_snapshot: customer?.room_number || null,
        payment_method: payReq.payment_method,
        expected_amount: remainingExpected,
        amount_received: amt,
        upi_reference: upiRef,
        is_duplicate_upi_warning: dupCheck.isDuplicate,
        verification_status: "Manually Recorded (Not Independently Verified)",
        payment_status:
          payReq.payment_status === "Failed"
            ? "Failed"
            : amt >= remainingExpected
              ? "Paid"
              : "Partially Paid",
        notes: payReq.notes?.trim() || null,
        recorded_by: adminName,
        payment_date: payReq.payment_date || nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };

      if (paymentEntry.payment_status !== "Failed") {
        remainingExpected = round2(Math.max(0, remainingExpected - amt));
      }

      db.payments.unshift(paymentEntry);
      createdPayments.push(paymentEntry);
    }

    // 10. Create Sale Record
    const saleRecord: SaleRecord = {
      id: saleId,
      bill_number: billNumber,
      idempotency_key: input.idempotency_key || null,
      customer_id: customer?.id || null,
      customer_name_snapshot:
        customer?.name || "Walk-in / Anonymous Student",
      room_number_snapshot: customer?.room_number || null,
      subtotal_amount: subtotalAmount,
      item_discount_total: itemDiscountTotal,
      bill_discount_type: billDiscType,
      bill_discount_value: billDiscVal,
      bill_discount_amount: billDiscAmount,
      total_discount_amount: totalDiscountAmount,
      discount_reason:
        input.discount_reason?.trim() ||
        (totalDiscountAmount > 0 ? "Promotional / Student Discount" : null),
      discount_authorized_by:
        totalDiscountAmount > 0
          ? input.discount_authorized_by?.trim() || adminName
          : null,
      payable_amount: payableAmount,
      paid_amount: 0,
      refunded_amount: 0,
      outstanding_amount: payableAmount,
      cogs_amount: totalCogs,
      estimated_gross_profit: round2(payableAmount - totalCogs),
      payment_status: "Pending",
      sale_status: "Completed",
      payment_methods_summary: "Unpaid (Udhaar)",
      upi_references_summary: null,
      notes: input.notes?.trim() || null,
      created_by: adminName,
      updated_by: adminName,
      created_at: nowIso,
      updated_at: nowIso,
      items: saleItems,
      payments: createdPayments,
      refunds: [],
    };

    recalculateSalePaymentSummary(db, saleRecord);
    db.sales.unshift(saleRecord);

    if (customer) {
      recalculateCustomerTotals(db, customer.id);
    }

    appendAudit(db, {
      entity_type: "SALE",
      entity_id: saleRecord.id,
      action: "CREATE_SALE",
      summary: `Created Bill ${billNumber} for "${saleRecord.customer_name_snapshot}" — Payable: ₹${payableAmount}, Paid: ₹${saleRecord.paid_amount}, Status: ${saleRecord.payment_status}`,
      new_data: {
        bill_number: billNumber,
        payable_amount: payableAmount,
        paid_amount: saleRecord.paid_amount,
        outstanding_amount: saleRecord.outstanding_amount,
        total_discount_amount: totalDiscountAmount,
      },
      performed_by: adminName,
    });

    writeDatabase(db);
    return { sale: saleRecord, duplicateUpiWarnings };
  });
}

/**
 * Record a new manual payment against an existing bill (e.g., settling partial payment / customer udhaar)
 */
export async function recordManualPaymentForBill(
  input: {
    sale_id: string;
    payment_method: PaymentMethod;
    amount_received: number;
    upi_reference?: string;
    payment_date?: string;
    notes?: string;
    payment_status?: PaymentStatus;
  },
  adminName: string
): Promise<{
  payment: PaymentEntry;
  sale: SaleRecord;
  duplicateUpiWarning: boolean;
  matchingBills: string[];
}> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const sale = db.sales.find(
      (s) => s.id === input.sale_id || s.bill_number === input.sale_id
    );
    if (!sale) throw new Error("Bill / Sale record not found.");
    if (sale.sale_status === "Cancelled" || sale.sale_status === "Refunded") {
      throw new Error(
        `Cannot record a new payment on a ${sale.sale_status.toLowerCase()} bill (${sale.bill_number}).`
      );
    }

    const amt = round2(Number(input.amount_received));
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error("Payment amount must be greater than ₹0.");
    }

    const isFailedAttempt = input.payment_status === "Failed";
    if (!isFailedAttempt && amt > sale.outstanding_amount + 0.01) {
      throw new Error(
        `Payment amount (₹${amt}) exceeds remaining bill balance (₹${sale.outstanding_amount}) for Bill ${sale.bill_number}.`
      );
    }

    const upiRef = input.upi_reference?.trim() || null;
    const dupCheck = checkDuplicateUpiReference(upiRef);
    const nowIso = new Date().toISOString();

    const paymentEntry: PaymentEntry = {
      id: `pay-${crypto.randomUUID().slice(0, 12)}`,
      sale_id: sale.id,
      bill_number: sale.bill_number,
      customer_id: sale.customer_id || null,
      customer_name_snapshot: sale.customer_name_snapshot,
      room_number_snapshot: sale.room_number_snapshot || null,
      payment_method: input.payment_method,
      expected_amount: sale.outstanding_amount,
      amount_received: amt,
      upi_reference: upiRef,
      is_duplicate_upi_warning: dupCheck.isDuplicate,
      verification_status: "Manually Recorded (Not Independently Verified)",
      payment_status: isFailedAttempt
        ? "Failed"
        : amt >= sale.outstanding_amount
          ? "Paid"
          : "Partially Paid",
      notes: input.notes?.trim() || null,
      recorded_by: adminName,
      payment_date: input.payment_date || nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };

    db.payments.unshift(paymentEntry);
    recalculateSalePaymentSummary(db, sale);
    sale.updated_by = adminName;
    sale.updated_at = nowIso;

    if (sale.customer_id) {
      recalculateCustomerTotals(db, sale.customer_id);
    }

    appendAudit(db, {
      entity_type: "PAYMENT",
      entity_id: paymentEntry.id,
      action: "RECORD_MANUAL_PAYMENT",
      summary: `Recorded manual ${paymentEntry.payment_method} payment of ₹${amt} for Bill ${sale.bill_number}${upiRef ? ` (UPI Ref: ${upiRef})` : ""}`,
      new_data: paymentEntry,
      performed_by: adminName,
    });

    writeDatabase(db);
    return {
      payment: paymentEntry,
      sale,
      duplicateUpiWarning: dupCheck.isDuplicate,
      matchingBills: dupCheck.matchingPayments.map((m) => m.bill_number),
    };
  });
}

/**
 * Record a customer lump-sum repayment across their oldest pending bills automatically
 */
export async function recordCustomerDuesRepayment(
  input: {
    customer_id: string;
    payment_method: PaymentMethod;
    amount_received: number;
    upi_reference?: string;
    notes?: string;
  },
  adminName: string
): Promise<{
  allocatedPayments: PaymentEntry[];
  duplicateUpiWarning: boolean;
}> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const customer = db.customers.find((c) => c.id === input.customer_id);
    if (!customer) throw new Error("Customer not found.");

    const totalAmt = round2(Number(input.amount_received));
    if (!Number.isFinite(totalAmt) || totalAmt <= 0) {
      throw new Error("Repayment amount must be greater than ₹0.");
    }
    if (totalAmt > customer.outstanding_dues + 0.01) {
      throw new Error(
        `Repayment amount (₹${totalAmt}) exceeds customer's total outstanding dues (₹${customer.outstanding_dues}).`
      );
    }

    // Find all pending/partially paid bills for this customer, oldest first
    const pendingSales = db.sales
      .filter(
        (s) =>
          s.customer_id === customer.id &&
          s.sale_status !== "Cancelled" &&
          s.outstanding_amount > 0
      )
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

    if (pendingSales.length === 0) {
      throw new Error("Customer has no unpaid bills to allocate payment against.");
    }

    const upiRef = input.upi_reference?.trim() || null;
    const dupCheck = checkDuplicateUpiReference(upiRef);
    const nowIso = new Date().toISOString();
    let remainingToAllocate = totalAmt;
    const allocatedPayments: PaymentEntry[] = [];

    for (const sale of pendingSales) {
      if (remainingToAllocate <= 0) break;
      const alloc = round2(Math.min(sale.outstanding_amount, remainingToAllocate));
      remainingToAllocate = round2(remainingToAllocate - alloc);

      const paymentEntry: PaymentEntry = {
        id: `pay-${crypto.randomUUID().slice(0, 12)}`,
        sale_id: sale.id,
        bill_number: sale.bill_number,
        customer_id: customer.id,
        customer_name_snapshot: customer.name,
        room_number_snapshot: customer.room_number || null,
        payment_method: input.payment_method,
        expected_amount: sale.outstanding_amount,
        amount_received: alloc,
        upi_reference: upiRef,
        is_duplicate_upi_warning: dupCheck.isDuplicate,
        verification_status: "Manually Recorded (Not Independently Verified)",
        payment_status: alloc >= sale.outstanding_amount ? "Paid" : "Partially Paid",
        notes:
          input.notes?.trim() ||
          `Customer Udhaar settlement (${customer.name})`,
        recorded_by: adminName,
        payment_date: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };

      db.payments.unshift(paymentEntry);
      recalculateSalePaymentSummary(db, sale);
      sale.updated_by = adminName;
      sale.updated_at = nowIso;
      allocatedPayments.push(paymentEntry);
    }

    recalculateCustomerTotals(db, customer.id);

    appendAudit(db, {
      entity_type: "CUSTOMER",
      entity_id: customer.id,
      action: "CUSTOMER_DUES_REPAYMENT",
      summary: `Recorded ₹${totalAmt} ${input.payment_method} repayment from "${customer.name}" across ${allocatedPayments.length} bill(s).`,
      new_data: allocatedPayments,
      performed_by: adminName,
    });

    writeDatabase(db);
    return {
      allocatedPayments,
      duplicateUpiWarning: dupCheck.isDuplicate,
    };
  });
}

/**
 * Authorized correction of a payment entry with mandatory reason and full audit trail
 */
export async function correctPaymentRecord(
  paymentId: string,
  input: {
    payment_method?: PaymentMethod;
    amount_received?: number;
    upi_reference?: string | null;
    payment_status?: PaymentStatus;
    notes?: string;
    correction_reason: string;
  },
  adminName: string
): Promise<PaymentEntry> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const payIdx = db.payments.findIndex((p) => p.id === paymentId);
    if (payIdx === -1) throw new Error("Payment record not found.");

    const reason = (input.correction_reason || "").trim();
    if (!reason) {
      throw new Error(
        "An audit reason is required to modify an existing payment record."
      );
    }

    const existing = db.payments[payIdx];
    const previousSnapshot = { ...existing };

    const newAmount =
      input.amount_received !== undefined
        ? round2(Number(input.amount_received))
        : existing.amount_received;
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      throw new Error("Corrected payment amount cannot be negative.");
    }

    const newUpiRef =
      input.upi_reference !== undefined
        ? input.upi_reference?.trim() || null
        : existing.upi_reference;
    const dupCheck = checkDuplicateUpiReference(newUpiRef, existing.id);

    const updated: PaymentEntry = {
      ...existing,
      payment_method: input.payment_method || existing.payment_method,
      amount_received: newAmount,
      upi_reference: newUpiRef,
      is_duplicate_upi_warning: dupCheck.isDuplicate,
      payment_status: input.payment_status || existing.payment_status,
      notes:
        input.notes !== undefined
          ? `${input.notes.trim()} [Corrected: ${reason}]`
          : `${existing.notes || ""} [Corrected: ${reason}]`.trim(),
      updated_at: new Date().toISOString(),
    };

    db.payments[payIdx] = updated;

    if (updated.sale_id) {
      const sale = db.sales.find((s) => s.id === updated.sale_id);
      if (sale) {
        recalculateSalePaymentSummary(db, sale);
        // Ensure corrected amount does not exceed bill payable unless refunded
        if (
          sale.paid_amount > sale.payable_amount + 0.01 &&
          updated.payment_status !== "Refunded" &&
          updated.payment_status !== "Failed"
        ) {
          // Rollback in memory before throwing
          db.payments[payIdx] = previousSnapshot;
          recalculateSalePaymentSummary(db, sale);
          throw new Error(
            `Corrected payment amount causes total paid (₹${sale.paid_amount}) to exceed bill payable (₹${sale.payable_amount}).`
          );
        }
        if (sale.customer_id) {
          recalculateCustomerTotals(db, sale.customer_id);
        }
      }
    }

    appendAudit(db, {
      entity_type: "PAYMENT",
      entity_id: updated.id,
      action: "AUTHORIZED_PAYMENT_CORRECTION",
      summary: `Corrected payment on Bill ${updated.bill_number}. Reason: ${reason}`,
      previous_data: previousSnapshot,
      new_data: updated,
      performed_by: adminName,
    });

    writeDatabase(db);
    return updated;
  });
}

/**
 * Controlled Cancellation or Refund of a Sale with controlled Stock Restoration
 */
export async function cancelOrRefundSale(
  saleId: string,
  input: {
    action_type: "CANCEL" | "FULL_REFUND" | "PARTIAL_REFUND";
    reason: string;
    restock_items: boolean;
    refund_method?: "Cash" | "UPI" | "Other" | "Credit Adjustment" | "None";
    upi_reference?: string;
    partial_items?: Array<{
      product_id: string;
      quantity_to_refund: number;
    }>;
  },
  adminName: string
): Promise<SaleRecord> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const sale = db.sales.find(
      (s) => s.id === saleId || s.bill_number === saleId
    );
    if (!sale) throw new Error("Sale record not found.");

    if (sale.sale_status === "Cancelled" || sale.sale_status === "Refunded") {
      throw new Error(
        `Bill ${sale.bill_number} has already been ${sale.sale_status.toLowerCase()}.`
      );
    }

    const reason = (input.reason || "").trim();
    if (!reason) {
      throw new Error(
        "A valid reason is required to authorize a cancellation or refund."
      );
    }

    const nowIso = new Date().toISOString();
    const restockedItemsSummary: RefundCancellationRecord["items_json"] = [];
    let refundValue = 0;

    if (input.action_type === "CANCEL" || input.action_type === "FULL_REFUND") {
      for (const sItem of sale.items) {
        const remainingQty = sItem.quantity - sItem.refunded_quantity;
        if (remainingQty <= 0) continue;

        const unitEffectivePrice = round2(sItem.final_line_total / sItem.quantity);
        const itemRefundVal = round2(unitEffectivePrice * remainingQty);
        refundValue = round2(refundValue + itemRefundVal);
        sItem.refunded_quantity = sItem.quantity;

        if (input.restock_items) {
          const product = db.products.find((p) => p.id === sItem.product_id);
          if (product) {
            const prevStock = product.stock_quantity;
            const newStock = prevStock + remainingQty;
            product.stock_quantity = newStock;
            product.updated_at = nowIso;

            db.inventory_movements.unshift({
              id: `mov-${crypto.randomUUID().slice(0, 12)}`,
              product_id: product.id,
              product_name_snapshot: product.name,
              sku_snapshot: product.sku,
              movement_type:
                input.action_type === "CANCEL"
                  ? "SALE_CANCEL_RESTORE"
                  : "SALE_REFUND_RESTORE",
              quantity_change: remainingQty,
              previous_stock: prevStock,
              new_stock: newStock,
              unit_cost: sItem.purchase_price_at_sale,
              reference_id: sale.bill_number,
              reason: `${input.action_type} of Bill ${sale.bill_number}: ${reason}`,
              recorded_by: adminName,
              created_at: nowIso,
            });
          }
        }

        restockedItemsSummary.push({
          product_id: sItem.product_id,
          product_name: sItem.product_name_snapshot,
          quantity_restocked: input.restock_items ? remainingQty : 0,
          amount_refunded: itemRefundVal,
        });
      }

      // Account for bill-level discount proportionally so refundValue equals remaining net payable
      refundValue = round2(sale.payable_amount - sale.refunded_amount);
      sale.refunded_amount = sale.payable_amount;
      sale.cogs_amount = 0;
      sale.estimated_gross_profit = 0;
      sale.sale_status =
        input.action_type === "CANCEL" ? "Cancelled" : "Refunded";

      // Mark associated payments as Refunded if money was collected
      for (const p of db.payments.filter((pay) => pay.sale_id === sale.id)) {
        if (p.payment_status !== "Failed") {
          p.payment_status = "Refunded";
          p.updated_at = nowIso;
        }
      }
    } else if (input.action_type === "PARTIAL_REFUND") {
      if (!input.partial_items || input.partial_items.length === 0) {
        throw new Error("Specify at least one item and quantity for a partial refund.");
      }

      const billDiscountRatio =
        sale.subtotal_amount - sale.item_discount_total > 0
          ? 1 -
            sale.bill_discount_amount /
              (sale.subtotal_amount - sale.item_discount_total)
          : 1;

      for (const part of input.partial_items) {
        const qtyToRefund = Math.floor(Number(part.quantity_to_refund));
        if (qtyToRefund <= 0) continue;

        const sItem = sale.items.find((i) => i.product_id === part.product_id);
        if (!sItem) {
          throw new Error("Item not found in this bill.");
        }
        const maxRefundableQty = sItem.quantity - sItem.refunded_quantity;
        if (qtyToRefund > maxRefundableQty) {
          throw new Error(
            `Cannot refund ${qtyToRefund} units of "${sItem.product_name_snapshot}" (max refundable: ${maxRefundableQty}).`
          );
        }

        sItem.refunded_quantity += qtyToRefund;
        const unitNetAfterBillDisc = round2(
          (sItem.final_line_total / sItem.quantity) * billDiscountRatio
        );
        const lineRefundAmount = round2(unitNetAfterBillDisc * qtyToRefund);
        refundValue = round2(refundValue + lineRefundAmount);

        const cogsReduction = round2(sItem.purchase_price_at_sale * qtyToRefund);
        sale.cogs_amount = round2(Math.max(0, sale.cogs_amount - cogsReduction));

        if (input.restock_items) {
          const product = db.products.find((p) => p.id === sItem.product_id);
          if (product) {
            const prevStock = product.stock_quantity;
            const newStock = prevStock + qtyToRefund;
            product.stock_quantity = newStock;
            product.updated_at = nowIso;

            db.inventory_movements.unshift({
              id: `mov-${crypto.randomUUID().slice(0, 12)}`,
              product_id: product.id,
              product_name_snapshot: product.name,
              sku_snapshot: product.sku,
              movement_type: "SALE_REFUND_RESTORE",
              quantity_change: qtyToRefund,
              previous_stock: prevStock,
              new_stock: newStock,
              unit_cost: sItem.purchase_price_at_sale,
              reference_id: sale.bill_number,
              reason: `Partial refund on Bill ${sale.bill_number}: ${reason}`,
              recorded_by: adminName,
              created_at: nowIso,
            });
          }
        }

        restockedItemsSummary.push({
          product_id: sItem.product_id,
          product_name: sItem.product_name_snapshot,
          quantity_restocked: input.restock_items ? qtyToRefund : 0,
          amount_refunded: lineRefundAmount,
        });
      }

      if (restockedItemsSummary.length === 0) {
        throw new Error("No valid item quantities were selected for partial refund.");
      }

      sale.refunded_amount = round2(
        Math.min(sale.payable_amount, sale.refunded_amount + refundValue)
      );
      const netSaleRevenue = round2(sale.payable_amount - sale.refunded_amount);
      sale.estimated_gross_profit = round2(netSaleRevenue - sale.cogs_amount);

      const allRefunded = sale.items.every(
        (i) => i.refunded_quantity >= i.quantity
      );
      sale.sale_status = allRefunded ? "Refunded" : "Partially Refunded";
    }

    const refundRecord: RefundCancellationRecord = {
      id: `ref-${crypto.randomUUID().slice(0, 12)}`,
      sale_id: sale.id,
      bill_number: sale.bill_number,
      action_type: input.action_type,
      refund_amount: refundValue,
      refund_method: input.refund_method || "Cash",
      upi_reference: input.upi_reference?.trim() || null,
      restock_items: Boolean(input.restock_items),
      reason,
      items_json: restockedItemsSummary,
      authorized_by: adminName,
      created_at: nowIso,
    };

    db.refunds_cancellations.unshift(refundRecord);
    if (!sale.refunds) sale.refunds = [];
    sale.refunds.unshift(refundRecord);

    recalculateSalePaymentSummary(db, sale);
    sale.updated_by = adminName;
    sale.updated_at = nowIso;

    if (sale.customer_id) {
      recalculateCustomerTotals(db, sale.customer_id);
    }

    appendAudit(db, {
      entity_type: "SALE",
      entity_id: sale.id,
      action: `SALE_${input.action_type}`,
      summary: `${input.action_type} on Bill ${sale.bill_number} (Amount: ₹${refundValue}, Restocked: ${input.restock_items ? "Yes" : "No"}). Reason: ${reason}`,
      new_data: refundRecord,
      performed_by: adminName,
    });

    writeDatabase(db);
    return sale;
  });
}

// ==============================================================================
// 5. TRANSACTION & PAYMENT QUERIES
// ==============================================================================

export function listSales(filters?: {
  billId?: string;
  customerName?: string;
  roomNumber?: string;
  productName?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  upiReference?: string;
  search?: string;
  sortBy?: "newest" | "oldest" | "highest" | "lowest";
}): SaleRecord[] {
  const db = readDatabase();
  let list = db.sales.map((s) => ({
    ...s,
    payments: db.payments.filter((p) => p.sale_id === s.id),
    refunds: db.refunds_cancellations.filter((r) => r.sale_id === s.id),
  }));

  if (filters?.billId && filters.billId.trim() !== "") {
    const q = filters.billId.trim().toLowerCase();
    list = list.filter((s) => s.bill_number.toLowerCase().includes(q));
  }
  if (filters?.customerName && filters.customerName.trim() !== "") {
    const q = filters.customerName.trim().toLowerCase();
    list = list.filter((s) =>
      s.customer_name_snapshot.toLowerCase().includes(q)
    );
  }
  if (filters?.roomNumber && filters.roomNumber.trim() !== "") {
    const q = filters.roomNumber.trim().toLowerCase();
    list = list.filter(
      (s) =>
        s.room_number_snapshot &&
        s.room_number_snapshot.toLowerCase().includes(q)
    );
  }
  if (filters?.productName && filters.productName.trim() !== "") {
    const q = filters.productName.trim().toLowerCase();
    list = list.filter((s) =>
      s.items.some(
        (i) =>
          i.product_name_snapshot.toLowerCase().includes(q) ||
          i.sku_snapshot.toLowerCase().includes(q)
      )
    );
  }
  if (filters?.startDate) {
    list = list.filter(
      (s) => getISTDateString(s.created_at) >= filters.startDate!
    );
  }
  if (filters?.endDate) {
    list = list.filter(
      (s) => getISTDateString(s.created_at) <= filters.endDate!
    );
  }
  if (filters?.paymentMethod && filters.paymentMethod !== "ALL") {
    const m = filters.paymentMethod.toLowerCase();
    list = list.filter(
      (s) =>
        s.payment_methods_summary.toLowerCase().includes(m) ||
        s.payments.some((p) => p.payment_method.toLowerCase() === m)
    );
  }
  if (filters?.paymentStatus && filters.paymentStatus !== "ALL") {
    list = list.filter((s) => s.payment_status === filters.paymentStatus);
  }
  if (filters?.upiReference && filters.upiReference.trim() !== "") {
    const q = filters.upiReference.trim().toLowerCase();
    list = list.filter(
      (s) =>
        (s.upi_references_summary &&
          s.upi_references_summary.toLowerCase().includes(q)) ||
        s.payments.some(
          (p) => p.upi_reference && p.upi_reference.toLowerCase().includes(q)
        )
    );
  }
  if (filters?.search && filters.search.trim() !== "") {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (s) =>
        s.bill_number.toLowerCase().includes(q) ||
        s.customer_name_snapshot.toLowerCase().includes(q) ||
        (s.room_number_snapshot &&
          s.room_number_snapshot.toLowerCase().includes(q)) ||
        (s.upi_references_summary &&
          s.upi_references_summary.toLowerCase().includes(q)) ||
        s.items.some((i) => i.product_name_snapshot.toLowerCase().includes(q))
    );
  }

  const sortBy = filters?.sortBy || "newest";
  list.sort((a, b) => {
    if (sortBy === "oldest") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    if (sortBy === "highest") {
      return b.payable_amount - a.payable_amount;
    }
    if (sortBy === "lowest") {
      return a.payable_amount - b.payable_amount;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return list;
}

export function listPayments(filters?: {
  search?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  duplicateOnly?: boolean;
  startDate?: string;
  endDate?: string;
}): PaymentEntry[] {
  const db = readDatabase();
  let list = [...db.payments];

  if (filters?.paymentMethod && filters.paymentMethod !== "ALL") {
    list = list.filter((p) => p.payment_method === filters.paymentMethod);
  }
  if (filters?.paymentStatus && filters.paymentStatus !== "ALL") {
    list = list.filter((p) => p.payment_status === filters.paymentStatus);
  }
  if (filters?.duplicateOnly) {
    list = list.filter((p) => p.is_duplicate_upi_warning);
  }
  if (filters?.startDate) {
    list = list.filter(
      (p) => getISTDateString(p.payment_date) >= filters.startDate!
    );
  }
  if (filters?.endDate) {
    list = list.filter(
      (p) => getISTDateString(p.payment_date) <= filters.endDate!
    );
  }
  if (filters?.search && filters.search.trim() !== "") {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.bill_number.toLowerCase().includes(q) ||
        (p.customer_name_snapshot &&
          p.customer_name_snapshot.toLowerCase().includes(q)) ||
        (p.upi_reference && p.upi_reference.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
    );
  }

  return list.sort(
    (a, b) =>
      new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
  );
}

// ==============================================================================
// 6. EXPENSE OPERATIONS
// ==============================================================================

export function listExpenses(filters?: {
  category?: string;
  startDate?: string;
  endDate?: string;
  includeVoided?: boolean;
}): ExpenseRecord[] {
  const db = readDatabase();
  let list = [...db.expenses];

  if (!filters?.includeVoided) {
    list = list.filter((e) => !e.is_voided);
  }
  if (filters?.category && filters.category !== "ALL") {
    list = list.filter((e) => e.category === filters.category);
  }
  if (filters?.startDate) {
    list = list.filter((e) => e.expense_date >= filters.startDate!);
  }
  if (filters?.endDate) {
    list = list.filter((e) => e.expense_date <= filters.endDate!);
  }

  return list.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
}

export async function createExpense(
  input: {
    title: string;
    category: string;
    amount: number;
    expense_date?: string;
    description?: string;
    supplier_or_receipt_ref?: string;
  },
  adminName: string
): Promise<ExpenseRecord> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const title = (input.title || "").trim();
    const category = (input.category || "").trim();
    const amount = round2(Number(input.amount));

    if (!title) throw new Error("Expense title is required.");
    if (!category) throw new Error("Expense category is required.");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Expense amount must be greater than ₹0.");
    }

    const nowIso = new Date().toISOString();
    const expense: ExpenseRecord = {
      id: `exp-${crypto.randomUUID().slice(0, 12)}`,
      title,
      category,
      amount,
      expense_date: input.expense_date || getISTDateString(),
      description: input.description?.trim() || null,
      supplier_or_receipt_ref: input.supplier_or_receipt_ref?.trim() || null,
      recorded_by: adminName,
      is_voided: false,
      created_at: nowIso,
      updated_at: nowIso,
    };

    db.expenses.unshift(expense);

    appendAudit(db, {
      entity_type: "EXPENSE",
      entity_id: expense.id,
      action: "CREATE_EXPENSE",
      summary: `Recorded expense "${expense.title}" (${expense.category}) of ₹${expense.amount}`,
      new_data: expense,
      performed_by: adminName,
    });

    writeDatabase(db);
    return expense;
  });
}

export async function voidExpense(
  expenseId: string,
  voidReason: string,
  adminName: string
): Promise<ExpenseRecord> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const exp = db.expenses.find((e) => e.id === expenseId);
    if (!exp) throw new Error("Expense record not found.");
    const reason = (voidReason || "").trim();
    if (!reason) throw new Error("A reason is required to void an expense.");

    exp.is_voided = true;
    exp.void_reason = reason;
    exp.updated_at = new Date().toISOString();

    appendAudit(db, {
      entity_type: "EXPENSE",
      entity_id: exp.id,
      action: "VOID_EXPENSE",
      summary: `Voided expense "${exp.title}" (₹${exp.amount}). Reason: ${reason}`,
      new_data: exp,
      performed_by: adminName,
    });

    writeDatabase(db);
    return exp;
  });
}

// ==============================================================================
// 7. FINANCIAL ANALYTICS, DASHBOARD & REPORTS ENGINE
// ==============================================================================

export function computeFinancialMetrics(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const db = readDatabase();
  const startDate = filters?.startDate;
  const endDate = filters?.endDate;

  const todayStr = getISTDateString(new Date());
  const sevenDaysAgoStr = getISTDateString(
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  );
  const monthStartStr = `${todayStr.slice(0, 7)}-01`;

  // Filter sales by date range if provided
  const activeSalesAllTime = db.sales.filter((s) => s.sale_status !== "Cancelled");

  const salesInPeriod = activeSalesAllTime.filter((s) => {
    const d = getISTDateString(s.created_at);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  const paymentsInPeriod = db.payments.filter((p) => {
    if (p.payment_status === "Failed" || p.payment_status === "Refunded") {
      return false;
    }
    const d = getISTDateString(p.payment_date);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  const expensesInPeriod = db.expenses.filter((e) => {
    if (e.is_voided) return false;
    if (startDate && e.expense_date < startDate) return false;
    if (endDate && e.expense_date > endDate) return false;
    return true;
  });

  // Period metrics
  let grossSalesBeforeDiscounts = 0;
  let totalDiscountsGiven = 0;
  let totalRefundedAmount = 0;
  let netSalesRevenue = 0;
  let costOfGoodsSold = 0;

  for (const s of salesInPeriod) {
    grossSalesBeforeDiscounts = round2(
      grossSalesBeforeDiscounts + s.subtotal_amount
    );
    totalDiscountsGiven = round2(totalDiscountsGiven + s.total_discount_amount);
    totalRefundedAmount = round2(totalRefundedAmount + s.refunded_amount);
    const netSale = round2(Math.max(0, s.payable_amount - s.refunded_amount));
    netSalesRevenue = round2(netSalesRevenue + netSale);
    costOfGoodsSold = round2(costOfGoodsSold + s.cogs_amount);
  }

  const estimatedGrossProfit = round2(netSalesRevenue - costOfGoodsSold);
  const operatingExpenses = round2(
    expensesInPeriod.reduce((acc, e) => acc + e.amount, 0)
  );
  const estimatedNetProfit = round2(estimatedGrossProfit - operatingExpenses);

  // Collections strictly from actual recorded payments (Credit / Udhaar never counted as collected!)
  const cashCollected = round2(
    paymentsInPeriod
      .filter((p) => p.payment_method === "Cash")
      .reduce((acc, p) => acc + p.amount_received, 0)
  );
  const upiCollected = round2(
    paymentsInPeriod
      .filter((p) => p.payment_method === "UPI")
      .reduce((acc, p) => acc + p.amount_received, 0)
  );
  const otherCollected = round2(
    paymentsInPeriod
      .filter((p) => p.payment_method === "Other")
      .reduce((acc, p) => acc + p.amount_received, 0)
  );
  const totalCollected = round2(cashCollected + upiCollected + otherCollected);

  // Today / Weekly / Monthly Sales (All-Time KPI cards on Dashboard)
  const calcNetSalesForCondition = (pred: (dateStr: string) => boolean) =>
    round2(
      activeSalesAllTime
        .filter((s) => pred(getISTDateString(s.created_at)))
        .reduce((acc, s) => acc + Math.max(0, s.payable_amount - s.refunded_amount), 0)
    );

  const todaySales = calcNetSalesForCondition((d) => d === todayStr);
  const weeklySales = calcNetSalesForCondition(
    (d) => d >= sevenDaysAgoStr && d <= todayStr
  );
  const monthlySales = calcNetSalesForCondition(
    (d) => d >= monthStartStr && d <= todayStr
  );

  // Outstanding dues & pending bills
  const pendingBills = activeSalesAllTime.filter((s) => s.outstanding_amount > 0);
  const totalPendingPaymentsAmount = round2(
    pendingBills.reduce((acc, s) => acc + s.outstanding_amount, 0)
  );
  const totalCustomerUdhaar = round2(
    db.customers.reduce((acc, c) => acc + c.outstanding_dues, 0)
  );

  // Inventory metrics
  const activeProducts = db.products.filter((p) => p.is_active);
  const currentInventoryValue = round2(
    activeProducts.reduce(
      (acc, p) => acc + p.stock_quantity * p.purchase_price,
      0
    )
  );
  const currentRetailInventoryValue = round2(
    activeProducts.reduce(
      (acc, p) => acc + p.stock_quantity * p.selling_price,
      0
    )
  );
  const outOfStockProducts = activeProducts.filter((p) => p.stock_quantity === 0);
  const lowStockProducts = activeProducts.filter(
    (p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level
  );

  // Best-selling products (in period)
  const productPerfMap = new Map<
    string,
    {
      product_id: string;
      product_name: string;
      sku: string;
      category: string;
      units_sold: number;
      gross_revenue: number;
      discounts: number;
      net_revenue: number;
      cogs: number;
      estimated_profit: number;
    }
  >();

  for (const s of salesInPeriod) {
    const billDiscFactor =
      s.subtotal_amount - s.item_discount_total > 0
        ? 1 -
          s.bill_discount_amount / (s.subtotal_amount - s.item_discount_total)
        : 1;

    for (const item of s.items) {
      const netQty = item.quantity - item.refunded_quantity;
      if (netQty <= 0) continue;

      const ratio = netQty / item.quantity;
      const itemNetRev = round2(item.final_line_total * ratio * billDiscFactor);
      const itemCogs = round2(item.purchase_price_at_sale * netQty);
      const itemGross = round2(item.original_line_total * ratio);
      const itemDisc = round2(itemGross - itemNetRev);
      const itemProfit = round2(itemNetRev - itemCogs);

      const existing = productPerfMap.get(item.product_id) || {
        product_id: item.product_id,
        product_name: item.product_name_snapshot,
        sku: item.sku_snapshot,
        category: item.category_snapshot,
        units_sold: 0,
        gross_revenue: 0,
        discounts: 0,
        net_revenue: 0,
        cogs: 0,
        estimated_profit: 0,
      };

      existing.units_sold += netQty;
      existing.gross_revenue = round2(existing.gross_revenue + itemGross);
      existing.discounts = round2(existing.discounts + itemDisc);
      existing.net_revenue = round2(existing.net_revenue + itemNetRev);
      existing.cogs = round2(existing.cogs + itemCogs);
      existing.estimated_profit = round2(
        existing.estimated_profit + itemProfit
      );

      productPerfMap.set(item.product_id, existing);
    }
  }

  const bestSellingProducts = Array.from(productPerfMap.values()).sort(
    (a, b) => b.units_sold - a.units_sold || b.net_revenue - a.net_revenue
  );

  // Daily chart series
  const dailyMap = new Map<
    string,
    {
      date: string;
      sales: number;
      cogs: number;
      gross_profit: number;
      expenses: number;
      net_profit: number;
      cash_collected: number;
      upi_collected: number;
      discounts: number;
      transactions_count: number;
    }
  >();

  // Ensure last 7 days are represented when no custom date filter is narrow
  for (let i = 6; i >= 0; i--) {
    const d = getISTDateString(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) {
      dailyMap.set(d, {
        date: d,
        sales: 0,
        cogs: 0,
        gross_profit: 0,
        expenses: 0,
        net_profit: 0,
        cash_collected: 0,
        upi_collected: 0,
        discounts: 0,
        transactions_count: 0,
      });
    }
  }

  const ensureDay = (d: string) => {
    if (!dailyMap.has(d)) {
      dailyMap.set(d, {
        date: d,
        sales: 0,
        cogs: 0,
        gross_profit: 0,
        expenses: 0,
        net_profit: 0,
        cash_collected: 0,
        upi_collected: 0,
        discounts: 0,
        transactions_count: 0,
      });
    }
    return dailyMap.get(d)!;
  };

  for (const s of salesInPeriod) {
    const d = getISTDateString(s.created_at);
    const entry = ensureDay(d);
    const netSale = round2(Math.max(0, s.payable_amount - s.refunded_amount));
    entry.sales = round2(entry.sales + netSale);
    entry.cogs = round2(entry.cogs + s.cogs_amount);
    entry.gross_profit = round2(entry.sales - entry.cogs);
    entry.net_profit = round2(entry.gross_profit - entry.expenses);
    entry.discounts = round2(entry.discounts + s.total_discount_amount);
    entry.transactions_count += 1;
  }

  for (const p of paymentsInPeriod) {
    const d = getISTDateString(p.payment_date);
    const entry = ensureDay(d);
    if (p.payment_method === "Cash") {
      entry.cash_collected = round2(entry.cash_collected + p.amount_received);
    } else if (p.payment_method === "UPI") {
      entry.upi_collected = round2(entry.upi_collected + p.amount_received);
    }
  }

  for (const e of expensesInPeriod) {
    const entry = ensureDay(e.expense_date);
    entry.expenses = round2(entry.expenses + e.amount);
    entry.net_profit = round2(entry.gross_profit - entry.expenses);
  }

  const dailyChartSeries = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    environment_mode: db.meta.environment_mode,
    kpis: {
      today_sales: todaySales,
      weekly_sales: weeklySales,
      monthly_sales: monthlySales,
      period_gross_sales: grossSalesBeforeDiscounts,
      period_discounts: totalDiscountsGiven,
      period_refunds: totalRefundedAmount,
      period_net_sales: netSalesRevenue,
      period_cogs: costOfGoodsSold,
      period_gross_profit: estimatedGrossProfit,
      period_expenses: operatingExpenses,
      period_net_profit: estimatedNetProfit,
      total_transactions: salesInPeriod.length,
      cash_collected: cashCollected,
      upi_collected: upiCollected,
      other_collected: otherCollected,
      total_collected: totalCollected,
      pending_payments_amount: totalPendingPaymentsAmount,
      pending_bills_count: pendingBills.length,
      customer_udhaar_total: totalCustomerUdhaar,
      total_products: db.products.length,
      active_products: activeProducts.length,
      current_inventory_value: currentInventoryValue,
      current_retail_inventory_value: currentRetailInventoryValue,
      low_stock_count: lowStockProducts.length,
      out_of_stock_count: outOfStockProducts.length,
      duplicate_upi_warnings_count: db.payments.filter(
        (p) => p.is_duplicate_upi_warning
      ).length,
    },
    alerts: {
      out_of_stock: outOfStockProducts,
      low_stock: lowStockProducts,
    },
    best_selling_products: bestSellingProducts,
    daily_series: dailyChartSeries,
    recent_transactions: listSales({ sortBy: "newest" }).slice(0, 8),
    canteen_status: getCanteenStatus(),
  };
}

export function getCanteenStatus(): CanteenStatus {
  const db = readDatabase();
  if (db.meta && db.meta.canteen_status) {
    return db.meta.canteen_status;
  }
  return {
    is_open: true,
    closure_type: "open",
    closure_reason: "",
    reopen_at: null,
    updated_at: new Date().toISOString(),
    updated_by: "System",
  };
}

export async function updateCanteenStatus(
  input: {
    is_open: boolean;
    closure_type?: CanteenStatus["closure_type"];
    closure_reason?: string;
    reopen_at?: string | null;
  },
  adminName: string
): Promise<CanteenStatus> {
  return withTransactionLock(() => {
    const db = readDatabase();
    const newStatus: CanteenStatus = {
      is_open: input.is_open,
      closure_type: input.is_open ? "open" : (input.closure_type || "today"),
      closure_reason: input.is_open
        ? ""
        : (input.closure_reason?.trim() || "Canteen is currently closed."),
      reopen_at: input.is_open ? null : (input.reopen_at || null),
      updated_at: new Date().toISOString(),
      updated_by: adminName,
    };
    db.meta.canteen_status = newStatus;
    appendAudit(db, {
      entity_type: "SYSTEM",
      entity_id: "canteen_status",
      action: input.is_open ? "REOPEN_CANTEEN" : "CLOSE_CANTEEN",
      summary: input.is_open
        ? `Canteen reopened by ${adminName}.`
        : `Canteen marked closed (${newStatus.closure_type}: ${newStatus.closure_reason}${newStatus.reopen_at ? ` - Reopening ${newStatus.reopen_at}` : ""}) by ${adminName}.`,
      performed_by: adminName,
    });
    writeDatabase(db);
    return newStatus;
  });
}

export async function switchDatabaseEnvironmentMode(
  mode: "development_sample" | "production_clean",
  adminName: string
): Promise<DatabaseSchema["meta"]> {
  return withTransactionLock(() => {
    const newDb =
      mode === "development_sample"
        ? createDevelopmentSampleDatabase()
        : createCleanProductionDatabase();
    appendAudit(newDb, {
      entity_type: "SYSTEM",
      entity_id: "system",
      action: `RESET_DB_${mode.toUpperCase()}`,
      summary: `Database reset to ${mode === "production_clean" ? "Clean Production Mode (0 sample records)" : "Development Sample Mode"} by ${adminName}`,
      performed_by: adminName,
    });
    writeDatabase(newDb);
    return newDb.meta;
  });
}
