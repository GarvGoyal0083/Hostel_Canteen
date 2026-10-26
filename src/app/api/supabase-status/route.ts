import { NextResponse } from "next/server";
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  const configured = isSupabaseConfigured();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasServiceRoleKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("your-supabase-service-role")
  );

  if (!configured) {
    return NextResponse.json({
      configured: false,
      table_exists: false,
      persisting: false,
      error: "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY) are not set in Vercel.",
      sql_needed: true,
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({
        configured: true,
        table_exists: false,
        persisting: false,
        error: "Failed to initialize Supabase client.",
        sql_needed: true,
      });
    }

    // Test 1: Check if canteen_store table exists by querying 1 row
    const { data: readData, error: readError } = await supabase
      .from("canteen_store")
      .select("id, updated_at")
      .eq("id", "main")
      .maybeSingle();

    if (readError) {
      const isMissingTable =
        readError.code === "42P01" ||
        readError.message.toLowerCase().includes("does not exist") ||
        readError.message.toLowerCase().includes("relation");

      return NextResponse.json({
        configured: true,
        table_exists: false,
        persisting: false,
        error_code: readError.code,
        error: isMissingTable
          ? "Table 'canteen_store' does not exist in your Supabase database. You must run the SQL snippet in Supabase SQL Editor to enable permanent storage."
          : `Supabase read error: ${readError.message}`,
        sql_needed: true,
        has_service_role_key: hasServiceRoleKey,
      });
    }

    // Test 2: Verify write permission by performing a test ping
    const testPingTime = new Date().toISOString();
    const { error: writeError } = await supabase
      .from("canteen_store")
      .upsert(
        {
          id: "main",
          data: readData ? undefined : {}, // don't wipe data if already present
          updated_at: testPingTime,
        },
        { onConflict: "id" }
      );

    if (writeError && !readData) {
      return NextResponse.json({
        configured: true,
        table_exists: true,
        persisting: false,
        error: `Write permission error (RLS policy missing): ${writeError.message}. Run the SQL snippet to grant access.`,
        sql_needed: true,
        has_service_role_key: hasServiceRoleKey,
      });
    }

    return NextResponse.json({
      configured: true,
      table_exists: true,
      persisting: true,
      message: "Supabase cloud persistence is ACTIVE and storing data permanently across all browsers and devices.",
      has_service_role_key: hasServiceRoleKey,
      sql_needed: false,
      last_updated_at: readData?.updated_at || testPingTime,
    });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      table_exists: false,
      persisting: false,
      error: err instanceof Error ? err.message : "Unexpected connection error to Supabase.",
      sql_needed: true,
    });
  }
}
