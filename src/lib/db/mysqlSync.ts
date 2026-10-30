import { DatabaseSchema } from "@/lib/db/seed";
import { getMysqlPool, isMysqlConfigured } from "@/lib/mysql/client";
import type { RowDataPacket } from "mysql2";

let lastRemoteUpdateTime: number = 0;
let lastSyncCheckTime: number = 0;
let isMysqlPersistenceActive: boolean = false;
let lastSyncError: string | null = null;

const SYNC_COOLDOWN_MS = 2500;

export function getMysqlPersistenceStatus(): boolean {
  return isMysqlPersistenceActive;
}

export function getLastMysqlSyncError(): string | null {
  return lastSyncError;
}

interface CanteenStoreRow extends RowDataPacket {
  id: string;
  data: string;
  updated_at: Date | string;
}

/**
 * Pulls the latest centralized database state from Hostinger MySQL.
 */
export async function fetchMysqlDatabase(force = false): Promise<DatabaseSchema | null> {
  if (!isMysqlConfigured()) {
    isMysqlPersistenceActive = false;
    return null;
  }

  const now = Date.now();
  if (!force && now - lastSyncCheckTime < SYNC_COOLDOWN_MS && isMysqlPersistenceActive) {
    return null;
  }
  lastSyncCheckTime = now;

  try {
    const pool = getMysqlPool();
    if (!pool) return null;

    const [rows] = await pool.query<CanteenStoreRow[]>(
      "SELECT data, updated_at FROM canteen_store WHERE id = ? LIMIT 1",
      ["main"]
    );

    isMysqlPersistenceActive = true;
    lastSyncError = null;

    if (!rows || rows.length === 0 || !rows[0].data) {
      return null;
    }

    const rawData = rows[0].data;
    const remoteDb = (typeof rawData === "string" ? JSON.parse(rawData) : rawData) as DatabaseSchema;
    const remoteTime = new Date(remoteDb.meta?.updated_at || rows[0].updated_at || 0).getTime();

    if (force || remoteTime >= lastRemoteUpdateTime) {
      lastRemoteUpdateTime = remoteTime;
      return remoteDb;
    }

    return null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[hostinger-mysql] Fetch exception:", message);
    lastSyncError = message;
    isMysqlPersistenceActive = false;
    return null;
  }
}

/**
 * Pushes updated DatabaseSchema to Hostinger MySQL.
 */
export async function pushMysqlDatabase(db: DatabaseSchema): Promise<boolean> {
  if (!isMysqlConfigured()) {
    isMysqlPersistenceActive = false;
    return false;
  }

  try {
    const pool = getMysqlPool();
    if (!pool) return false;

    const nowIso = new Date().toISOString();
    db.meta.updated_at = nowIso;
    lastRemoteUpdateTime = Date.now();

    const jsonString = JSON.stringify(db);

    await pool.query(
      `INSERT INTO canteen_store (id, data, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
      ["main", jsonString]
    );

    isMysqlPersistenceActive = true;
    lastSyncError = null;
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[hostinger-mysql] Push exception:", message);
    lastSyncError = message;
    isMysqlPersistenceActive = false;
    return false;
  }
}
