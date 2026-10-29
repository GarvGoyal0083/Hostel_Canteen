import { DatabaseSchema } from "@/lib/db/seed";
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

let lastRemoteUpdateTime: number = 0;
let lastSyncCheckTime: number = 0;
let isCloudPersistenceActive: boolean = false;
let lastSyncError: string | null = null;

// Minimum interval (in ms) to poll Supabase on reads to prevent redundant network round-trips
const SYNC_COOLDOWN_MS = 2500;

export function getCloudPersistenceStatus(): boolean {
  return isCloudPersistenceActive;
}

export function getLastSyncError(): string | null {
  return lastSyncError;
}

/**
 * Pulls the latest centralized database state from Supabase Cloud.
 * If the remote store is newer than local memory/tmp, returns the remote DatabaseSchema.
 * Otherwise returns null.
 */
export async function fetchRemoteDatabase(force = false): Promise<DatabaseSchema | null> {
  if (!isSupabaseConfigured()) {
    isCloudPersistenceActive = false;
    return null;
  }

  const now = Date.now();
  if (!force && now - lastSyncCheckTime < SYNC_COOLDOWN_MS && isCloudPersistenceActive) {
    return null; // Local copy is already fresh within cooldown window
  }
  lastSyncCheckTime = now;

  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("canteen_store")
      .select("data, updated_at")
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      // Table canteen_store may not have been created yet in Supabase SQL editor
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn(
          "[supabase-sync] Table 'canteen_store' does not exist yet. Please run migration 003_canteen_store_sync.sql in Supabase SQL Editor."
        );
      } else {
        console.warn("[supabase-sync] Error fetching canteen_store:", error.message);
      }
      isCloudPersistenceActive = false;
      return null;
    }

    isCloudPersistenceActive = true;

    if (!data || !data.data) {
      // Table exists but row 'main' is not yet initialized
      return null;
    }

    const remoteDb = data.data as DatabaseSchema;
    const remoteTime = new Date(remoteDb.meta?.updated_at || data.updated_at || 0).getTime();

    if (force || remoteTime >= lastRemoteUpdateTime) {
      lastRemoteUpdateTime = remoteTime;
      return remoteDb;
    }

    return null;
  } catch (err) {
    console.warn("[supabase-sync] Fetch exception:", err);
    isCloudPersistenceActive = false;
    return null;
  }
}

/**
 * Pushes updated DatabaseSchema to Supabase Cloud so all devices & serverless instances
 * receive the changes in real time.
 */
export async function pushRemoteDatabase(db: DatabaseSchema): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    isCloudPersistenceActive = false;
    return false;
  }

  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return false;

    const nowIso = new Date().toISOString();
    db.meta.updated_at = nowIso;
    lastRemoteUpdateTime = Date.now();

    const { error } = await supabase.from("canteen_store").upsert(
      {
        id: "main",
        data: db,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn("[supabase-sync] Push error:", error.message);
      isCloudPersistenceActive = false;
      return false;
    }

    isCloudPersistenceActive = true;
    return true;
  } catch (err) {
    console.warn("[supabase-sync] Push exception:", err);
    isCloudPersistenceActive = false;
    return false;
  }
}
