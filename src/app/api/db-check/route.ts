import { NextResponse } from "next/server";
import { getMysqlCredentials, isMysqlConfigured, getMysqlPool } from "@/lib/mysql/client";
import type { RowDataPacket } from "mysql2";

export async function GET() {
  const creds = getMysqlCredentials();
  const configured = isMysqlConfigured();

  const diagnostic = {
    configured,
    detected_host: creds.host || "NOT DETECTED",
    detected_user: creds.user || "NOT DETECTED",
    detected_database: creds.database || "NOT DETECTED",
    detected_port: creds.port,
    password_set: Boolean(creds.password),
    connection_status: "pending",
    table_canteen_store_exists: false,
    error: null as string | null,
  };

  if (!configured) {
    diagnostic.connection_status = "missing_variables";
    diagnostic.error =
      "One or more required variables are missing in Vercel. Ensure MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE are added.";
    return NextResponse.json(diagnostic);
  }

  try {
    const pool = getMysqlPool();
    if (!pool) {
      diagnostic.connection_status = "pool_error";
      diagnostic.error = "Failed to initialize MySQL pool.";
      return NextResponse.json(diagnostic);
    }

    // Test ping
    await pool.query("SELECT 1");
    diagnostic.connection_status = "connected";

    // Test table canteen_store
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, updated_at FROM canteen_store LIMIT 1"
    );
    diagnostic.table_canteen_store_exists = true;

    return NextResponse.json({
      ...diagnostic,
      message: "🎉 Success! Hostinger MySQL is 100% connected and ready.",
      rows_found: rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostic.connection_status = "connection_failed";
    diagnostic.error = message;
    return NextResponse.json(diagnostic, { status: 500 });
  }
}
