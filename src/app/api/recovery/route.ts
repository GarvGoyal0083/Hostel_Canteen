import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  ensureDatabaseSync,
  readDatabase,
  withTransactionLock,
  writeDatabase,
} from "@/lib/db/store";
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { Customer, Product } from "@/types/pos";

const DEMO_PRODUCT_IDS = new Set([
  "prod-kurkure-masala",
  "prod-lays-magic",
  "prod-lays-cream",
  "prod-haldiram-bhujia",
  "prod-oreo-choco",
  "prod-parle-g",
  "prod-good-day",
  "prod-coke-250",
  "prod-thums-up",
  "prod-sting-energy",
  "prod-maggi-single",
  "prod-kitkat-4f",
]);

const DEMO_SKUS = new Set([
  "SNK-KRK-001", "SNK-LAY-002", "SNK-LAY-003", "SNK-HLD-004",
  "BSC-ORE-001", "BSC-PRL-002", "BSC-BRI-003", "DRK-COK-001",
  "DRK-THM-002", "DRK-STG-003", "NDL-MGI-001", "CHC-KTK-001",
  "SNK-001", "SNK-002", "SNK-003", "SNK-004", "SNK-005",
  "SNK-006", "SNK-007", "SNK-008", "SNK-009", "SNK-010",
  "SNK-011", "SNK-012",
]);

const DEMO_NAMES = new Set([
  "Kurkure Masala Munch (90g)",
  "Lay's India's Magic Masala (50g)",
  "Lay's American Cream & Onion (50g)",
  "Haldiram's Aloo Bhujia (150g)",
  "Cadbury Oreo Chocolate Crème (120g)",
  "Parle-G Gold Biscuits (100g)",
  "Britannia Good Day Cashew (100g)",
  "Coca-Cola PET Bottle (250ml)",
  "Thums Up Charged (250ml)",
  "Sting Energy Drink (250ml)",
  "Maggi 2-Minute Masala Noodles (70g)",
  "Nestlé KitKat 4-Finger (37g)",
]);

const EXISTING_STUDENTS: Customer[] = [
  {
    id: "cust-aarav",
    name: "Aarav Sharma",
    room_number: "B-204",
    phone: "9876543210",
    registration_date: "2026-10-16T21:07:17.484Z",
    total_purchases: 0,
    total_payments: 0,
    outstanding_dues: 0,
    notes: "Regular late-night Maggi & Coke buyer",
    is_active: true,
    created_at: "2026-10-16T21:07:17.484Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "cust-rohit",
    name: "Rohit Verma",
    room_number: "A-112",
    phone: "9811122233",
    registration_date: "2026-10-16T21:07:17.484Z",
    total_purchases: 0,
    total_payments: 0,
    outstanding_dues: 0,
    notes: "Prefers UPI payment",
    is_active: true,
    created_at: "2026-10-16T21:07:17.484Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "cust-kabir",
    name: "Kabir Nair",
    room_number: "C-308",
    phone: "9765432109",
    registration_date: "2026-10-16T21:07:17.484Z",
    total_purchases: 0,
    total_payments: 0,
    outstanding_dues: 0,
    notes: "Settles udhaar on weekends",
    is_active: true,
    created_at: "2026-10-16T21:07:17.484Z",
    updated_at: new Date().toISOString(),
  },
  {
    id: "cust-dev",
    name: "Devansh Patel",
    room_number: "B-210",
    phone: "9988776655",
    registration_date: "2026-10-16T21:07:17.484Z",
    total_purchases: 0,
    total_payments: 0,
    outstanding_dues: 0,
    notes: "Room next door",
    is_active: true,
    created_at: "2026-10-16T21:07:17.484Z",
    updated_at: new Date().toISOString(),
  },
];

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  await ensureDatabaseSync();
  const db = readDatabase();

  let supabaseImages: Array<{ id: string; updated_at?: string; size?: number }> = [];
  let supabaseAuditLogs: unknown[] = [];
  let sqlProducts: unknown[] = [];

  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      if (supabase) {
        // 1. Fetch all product image blobs from canteen_store
        const { data: rows } = await supabase
          .from("canteen_store")
          .select("id, updated_at, data");
        if (rows) {
          supabaseImages = rows
            .filter((r) => r.id.startsWith("img_"))
            .map((r) => ({
              id: r.id,
              updated_at: r.updated_at || r.data?.updated_at,
              size: r.data?.size || 0,
            }));
        }

        // 2. Fetch main audit logs
        const { data: mainRow } = await supabase
          .from("canteen_store")
          .select("data")
          .eq("id", "main")
          .maybeSingle();

        if (mainRow?.data?.audit_logs) {
          supabaseAuditLogs = mainRow.data.audit_logs;
        }

        // 3. Check if relational tables have any data
        try {
          const { data: pRows } = await supabase.from("products").select("*").limit(100);
          if (pRows && pRows.length > 0) {
            sqlProducts = pRows;
          }
        } catch {
          // ignore if table doesn't exist
        }
      }
    } catch {
      // ignore
    }
  }

  // Find products that were created in audit logs
  const allAuditLogs = [
    ...(Array.isArray(supabaseAuditLogs) ? supabaseAuditLogs : []),
    ...(Array.isArray(db.audit_logs) ? db.audit_logs : []),
  ];

  const recoverableProducts: Product[] = [];
  const seenIds = new Set<string>();

  for (const log of allAuditLogs) {
    const l = log as { action?: string; new_data?: Product };
    if (l && l.action === "CREATE_PRODUCT" && l.new_data?.id) {
      if (!seenIds.has(l.new_data.id)) {
        seenIds.add(l.new_data.id);
        recoverableProducts.push(l.new_data);
      }
    }
  }

  // Map uploaded photos to product recovery candidates
  const currentProductIds = new Set(db.products.map((p) => p.id));
  const photoCandidates = supabaseImages.map((img, idx) => {
    const prodId = img.id.replace("img_", "");
    const existing = db.products.find((p) => p.id === prodId);
    return {
      product_id: prodId,
      image_row_id: img.id,
      image_url: `/api/images/${prodId}`,
      size: img.size,
      updated_at: img.updated_at,
      already_in_catalog: currentProductIds.has(prodId),
      existing_name: existing?.name || null,
      default_name: `Canteen Item ${idx + 1}`,
      default_sku: `ITM-${prodId.slice(-6).toUpperCase()}`,
      default_category: "Snacks",
      default_selling_price: 20,
      default_purchase_price: 16,
      default_stock: 25,
    };
  });

  return NextResponse.json({
    current_products_count: db.products.length,
    environment_mode: db.meta.environment_mode,
    uploaded_photos_in_cloud: supabaseImages.length,
    photo_candidates: photoCandidates,
    sql_products_found: sqlProducts.length,
    sql_products: sqlProducts,
    recoverable_products_count: recoverableProducts.length,
    recoverable_products: recoverableProducts,
    students_count: db.customers.length,
    students: db.customers,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const action = body.action;

    // 1. Remove Demo Products and Ensure Existing Student Details
    if (
      action === "clear_demo_products" ||
      action === "remove_demo_and_add_students"
    ) {
      let cloudPhotos: Array<{ id: string; updated_at?: string }> = [];
      if (isSupabaseConfigured()) {
        const supabase = createSupabaseAdminClient();
        if (supabase) {
          const { data } = await supabase.from("canteen_store").select("id, updated_at");
          if (data) {
            cloudPhotos = data.filter((r) => r.id.startsWith("img_"));
          }
        }
      }

      const result = await withTransactionLock(() => {
        const db = readDatabase();
        const beforeProducts = db.products.length;

        // A. Remove all 12 demo products
        db.products = db.products.filter(
          (p) => !DEMO_PRODUCT_IDS.has(p.id) && !DEMO_SKUS.has(p.sku) && !DEMO_NAMES.has(p.name)
        );
        const removedDemo = beforeProducts - db.products.length;

        // B. Ensure existing student details are present in db.customers
        if (!Array.isArray(db.customers)) {
          db.customers = [];
        }
        let addedStudents = 0;
        for (const student of EXISTING_STUDENTS) {
          const exists = db.customers.some(
            (c) => c.id === student.id || c.name.toLowerCase() === student.name.toLowerCase()
          );
          if (!exists) {
            db.customers.push(student);
            addedStudents++;
          }
        }

        // C. If products catalog is now empty, automatically restore products for all 22 photos
        let restoredPhotos = 0;
        if (db.products.length === 0 && cloudPhotos.length > 0) {
          const now = new Date().toISOString();
          cloudPhotos.forEach((img, idx) => {
            const prodId = img.id.replace("img_", "");
            db.products.push({
              id: prodId,
              name: `Canteen Item ${idx + 1}`,
              sku: `SNK-${prodId.slice(-6).toUpperCase()}`,
              category: "Snacks",
              image_url: `/api/images/${prodId}`,
              purchase_price: 15,
              selling_price: 20,
              estimated_unit_profit: 5,
              stock_quantity: 20,
              min_stock_level: 5,
              supplier_name: "Hostel Canteen Vendor",
              expiry_date: null,
              batch_info: null,
              is_active: true,
              created_at: img.updated_at || now,
              updated_at: img.updated_at || now,
            });
            restoredPhotos++;
          });
        }

        // D. Clear fake demo sales
        db.sales = db.sales.filter((s) => !s.id.startsWith("sale-"));
        db.payments = db.payments.filter((p) => !p.id.startsWith("pay-"));
        db.inventory_movements = db.inventory_movements.filter(
          (m) => !m.product_id?.startsWith("prod-kurkure") && !m.product_id?.startsWith("prod-lays")
        );

        db.meta.environment_mode = "production_clean";
        writeDatabase(db);

        return {
          removed_demo_products: removedDemo,
          total_products: db.products.length,
          restored_photos: restoredPhotos,
          total_students: db.customers.length,
          added_students: addedStudents,
        };
      });

      return NextResponse.json({ success: true, result });
    }

    if (action === "restore_from_photos") {
      // Automatically creates/restores products for all photos uploaded to Supabase
      const itemsToRestore = Array.isArray(body.items) ? body.items : null;

      let cloudPhotos: Array<{ id: string; updated_at?: string }> = [];
      if (isSupabaseConfigured()) {
        const supabase = createSupabaseAdminClient();
        if (supabase) {
          const { data } = await supabase.from("canteen_store").select("id, updated_at");
          if (data) {
            cloudPhotos = data.filter((r) => r.id.startsWith("img_"));
          }
        }
      }

      const result = await withTransactionLock(() => {
        const db = readDatabase();
        let created = 0;
        const now = new Date().toISOString();

        if (itemsToRestore && itemsToRestore.length > 0) {
          for (const item of itemsToRestore) {
            const prodId = item.product_id || `prod-${crypto.randomUUID().slice(0, 12)}`;
            const existingIdx = db.products.findIndex((p) => p.id === prodId);
            const product: Product = {
              id: prodId,
              name: (item.name || `Canteen Item`).trim(),
              sku: (item.sku || `ITM-${prodId.slice(-6).toUpperCase()}`).trim().toUpperCase(),
              category: (item.category || "Snacks").trim(),
              image_url: `/api/images/${prodId}`,
              purchase_price: Math.max(0, Number(item.purchase_price) || 0),
              selling_price: Math.max(0, Number(item.selling_price) || 0),
              estimated_unit_profit: Math.max(0, (Number(item.selling_price) || 0) - (Number(item.purchase_price) || 0)),
              stock_quantity: Math.max(0, Math.floor(Number(item.stock_quantity) || 20)),
              min_stock_level: Math.max(1, Math.floor(Number(item.min_stock_level) || 5)),
              supplier_name: item.supplier_name?.trim() || "Hostel Canteen Vendor",
              expiry_date: item.expiry_date?.trim() || null,
              batch_info: item.batch_info?.trim() || null,
              is_active: true,
              created_at: now,
              updated_at: now,
            };

            if (existingIdx >= 0) {
              db.products[existingIdx] = product;
            } else {
              db.products.push(product);
              created++;
            }
          }
        } else {
          cloudPhotos.forEach((img, idx) => {
            const prodId = img.id.replace("img_", "");
            if (!db.products.some((p) => p.id === prodId)) {
              const product: Product = {
                id: prodId,
                name: `Canteen Item ${idx + 1}`,
                sku: `SNK-${prodId.slice(-6).toUpperCase()}`,
                category: "Snacks",
                image_url: `/api/images/${prodId}`,
                purchase_price: 15,
                selling_price: 20,
                estimated_unit_profit: 5,
                stock_quantity: 20,
                min_stock_level: 5,
                supplier_name: "Hostel Canteen Vendor",
                expiry_date: null,
                batch_info: null,
                is_active: true,
                created_at: img.updated_at || now,
                updated_at: img.updated_at || now,
              };
              db.products.push(product);
              created++;
            }
          });
        }

        // Ensure students exist
        if (!Array.isArray(db.customers) || db.customers.length === 0) {
          db.customers = [...EXISTING_STUDENTS];
        }

        db.meta.environment_mode = "production_clean";
        writeDatabase(db);
        return { restored_photos: created, total_products: db.products.length, total_students: db.customers.length };
      });

      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Invalid recovery action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recovery failed." },
      { status: 500 }
    );
  }
}
