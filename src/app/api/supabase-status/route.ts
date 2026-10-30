import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getMysqlPool, isMysqlConfigured } from "@/lib/mysql/client";
import type { RowDataPacket } from "mysql2";

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  // 1. If Hostinger MySQL is configured, test Hostinger MySQL first
  if (isMysqlConfigured()) {
    try {
      const pool = getMysqlPool();
      if (!pool) {
        return NextResponse.json({
          configured: true,
          provider: "hostinger_mysql",
          persisting: false,
          error: "Failed to initialize Hostinger MySQL connection pool.",
        });
      }

      // Test connection and table existence
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id, updated_at FROM canteen_store WHERE id = 'main' LIMIT 1"
      );

      return NextResponse.json({
        configured: true,
        provider: "hostinger_mysql",
        persisting: true,
        table_exists: true,
        host: process.env.MYSQL_HOST || process.env.HOSTINGER_MYSQL_HOST,
        database: process.env.MYSQL_DATABASE || process.env.HOSTINGER_MYSQL_DATABASE,
        main_record_exists: rows && rows.length > 0,
        message: "🎉 Success! Connected to Hostinger MySQL. Your products, sales, and udhaar are permanently stored on Hostinger and will NEVER be deleted or reset.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({
        configured: true,
        provider: "hostinger_mysql",
        persisting: false,
        error: `Hostinger MySQL Connection Error: ${message}. Make sure 'Remote MySQL' is enabled in Hostinger with Any Host (%) and the password is correct in Vercel.`,
      });
    }
  }

  // 2. Supabase Fallback (if still configured)
  const configured = isSupabaseConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      persisting: false,
      error: "No cloud database configured (neither Hostinger MySQL nor Supabase). Add Hostinger MYSQL_* variables in Vercel.",
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({
        configured: true,
        provider: "supabase",
        persisting: false,
        error: "Failed to initialize Supabase client.",
      });
    }

    const { data: readData, error: readError } = await supabase
      .from("canteen_store")
      .select("id, updated_at")
      .eq("id", "main")
      .maybeSingle();

    if (readError) {
      return NextResponse.json({
        configured: true,
        provider: "supabase",
        persisting: false,
        error: `Supabase query error: ${readError.message}`,
      });
    }

    return NextResponse.json({
      configured: true,
      provider: "supabase",
      persisting: true,
      table_exists: true,
      message: "Connected to Supabase Cloud.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      configured: true,
      provider: "supabase",
      persisting: false,
      error: `Supabase connection exception: ${message}`,
    });
  }
}
