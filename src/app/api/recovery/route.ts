import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  ensureDatabaseSync,
  readDatabase,
  withTransactionLock,
  writeDatabase,
} from "@/lib/db/store";
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { Product } from "@/types/pos";

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
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "clear_demo_products") {
      // Clears preloaded demo sample products so the canteen starts 100% fresh
      const result = await withTransactionLock(() => {
        const db = readDatabase();
        const demoProductIds = new Set([
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
        const demoSkus = new Set([
          "SNK-KRK-001", "SNK-LAY-002", "SNK-LAY-003", "SNK-HLD-004",
          "BSC-ORE-001", "BSC-PRL-002", "BSC-BRI-003", "DRK-COK-001",
          "DRK-THM-002", "DRK-STG-003", "NDL-MGI-001", "CHC-KTK-001",
          "SNK-001", "SNK-002", "SNK-003", "SNK-004", "SNK-005",
          "SNK-006", "SNK-007", "SNK-008", "SNK-009", "SNK-010",
          "SNK-011", "SNK-012"
        ]);
        const demoNames = new Set([
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
          "Nestlé KitKat 4-Finger (37g)"
        ]);

        const before = db.products.length;
        db.products = db.products.filter(
          (p) => !demoProductIds.has(p.id) && !demoSkus.has(p.sku) && !demoNames.has(p.name)
        );
        db.meta.environment_mode = "production_clean";
        writeDatabase(db);
        return { removed: before - db.products.length, remaining: db.products.length };
      });
      return NextResponse.json({ success: true, result });
    }

    if (action === "restore_from_audit") {
      // Restores any products found in audit logs back into the live catalog
      const result = await withTransactionLock(() => {
        const db = readDatabase();
        let restored = 0;
        if (Array.isArray(db.audit_logs)) {
          for (const log of db.audit_logs) {
            if (log.action === "CREATE_PRODUCT" && log.new_data) {
              const p = log.new_data as Product;
              if (p && p.id && !db.products.some((x) => x.id === p.id || x.sku.toUpperCase() === p.sku.toUpperCase())) {
                db.products.push(p);
                restored++;
              }
            }
          }
        }
        writeDatabase(db);
        return { restored, total_products: db.products.length };
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
          // User provided custom items or adjustments
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
          // Auto-generate catalog products for every uploaded photo in Supabase
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
                supplier_name: "Local Distributor",
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

        // Switch environment mode to production clean
        db.meta.environment_mode = "production_clean";
        writeDatabase(db);
        return { restored_photos: created, total_products: db.products.length };
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
