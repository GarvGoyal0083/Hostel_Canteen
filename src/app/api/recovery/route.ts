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

  let supabaseImages: Array<{ id: string; updated_at: string }> = [];
  let supabaseAuditLogs: unknown[] = [];

  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      if (supabase) {
        const { data: rows } = await supabase
          .from("canteen_store")
          .select("id, updated_at");
        if (rows) {
          supabaseImages = rows.filter((r) => r.id.startsWith("img_"));
        }

        const { data: mainRow } = await supabase
          .from("canteen_store")
          .select("data")
          .eq("id", "main")
          .maybeSingle();

        if (mainRow?.data?.audit_logs) {
          supabaseAuditLogs = mainRow.data.audit_logs;
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

  return NextResponse.json({
    current_products_count: db.products.length,
    environment_mode: db.meta.environment_mode,
    uploaded_photos_in_cloud: supabaseImages.length,
    uploaded_photo_ids: supabaseImages.map((i) => i.id.replace("img_", "")),
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

    return NextResponse.json({ error: "Invalid recovery action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recovery failed." },
      { status: 500 }
    );
  }
}
