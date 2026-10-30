import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  computeFinancialMetrics,
  ensureDatabaseSync,
  getActiveCloudPersistenceStatus,
  getActiveCloudProvider,
  getActiveSyncError,
  getProductStockSummaries,
  listCustomers,
  listExpenses,
  listInventoryMovements,
  listPayments,
  listProducts,
  listSales,
  readDatabase,
  switchDatabaseEnvironmentMode,
} from "@/lib/db/store";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isMysqlConfigured } from "@/lib/mysql/client";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  await ensureDatabaseSync();

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const includeFullBackup = searchParams.get("backup") === "true";

  if (includeFullBackup) {
    const fullDb = readDatabase();
    // Never export password hashes
    const backup = {
      ...fullDb,
      users: fullDb.users.map((u) => {
        const { password_hash: _omit, ...rest } = u;
        void _omit;
        return rest;
      }),
    };
    return NextResponse.json({ backup });
  }

  const metrics = computeFinancialMetrics({ startDate, endDate });
  const stockSummaries = getProductStockSummaries();
  const customers = listCustomers();
  const sales = listSales({ startDate, endDate, sortBy: "newest" });
  const payments = listPayments({ startDate, endDate });
  const expenses = listExpenses({ startDate, endDate, includeVoided: true });
  const movements = listInventoryMovements({ startDate, endDate });
  const products = listProducts({ includeInactive: true });
  const db = readDatabase();

  const isConnected = isMysqlConfigured() || isSupabaseConfigured();

  return NextResponse.json({
    ...metrics,
    supabase_configured: isConnected,
    supabase_cloud_synced: isConnected ? getActiveCloudPersistenceStatus() : false,
    supabase_sync_error: getActiveSyncError(),
    cloud_provider: getActiveCloudProvider(),
    stock_summaries: stockSummaries,
    customers,
    sales,
    payments,
    expenses,
    movements,
    products,
    refunds_cancellations: db.refunds_cancellations,
    audit_logs: db.audit_logs.slice(0, 100),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    if (
      body.action === "switch_mode" &&
      (body.mode === "production_clean" || body.mode === "development_sample")
    ) {
      const meta = await switchDatabaseEnvironmentMode(
        body.mode,
        auth.admin.full_name
      );
      return NextResponse.json({ meta });
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed." },
      { status: 400 }
    );
  }
}
