import fs from "fs";
import path from "path";
import os from "os";
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

const isServerless = Boolean(
  process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
);

const IMAGES_DIR =
  process.env.CANTEEN_IMAGES_DIR ||
  (isServerless
    ? path.join(os.tmpdir(), "canteen-images")
    : path.join(process.cwd(), "data", "images"));

// In-memory cache for ultra-fast response without disk/network latency
const memoryCache = new Map<string, { buffer: Buffer; mime: string }>();

function ensureImagesDir(): void {
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn(`[canteen-images] Could not ensure directory ${IMAGES_DIR}:`, err);
  }
}

/** Detect image MIME type from binary magic bytes */
export function detectMimeType(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buffer.length >= 6 &&
    (buffer.toString("ascii", 0, 6) === "GIF89a" || buffer.toString("ascii", 0, 6) === "GIF87a")
  ) {
    return "image/gif";
  }
  return "image/jpeg";
}

/** Read inline product image directly from JSON file on disk without importing store */
function getStoredProductImage(safeId: string): string | null {
  try {
    const dbPath =
      process.env.POS_DB_FILE_PATH ||
      path.join(
        isServerless ? os.tmpdir() : path.join(process.cwd(), "data"),
        "canteen_store.json"
      );
    if (fs.existsSync(dbPath)) {
      const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      const prod = parsed.products?.find((p: { id: string }) => p.id === safeId);
      if (prod && prod.image_url && prod.image_url.startsWith("data:image/")) {
        return prod.image_url;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Persists an image binary for a product.
 * Caches in memory, saves to disk, and pushes to Supabase Cloud (if configured).
 * Returns the public image URL.
 */
export async function saveProductImage(
  productId: string,
  dataUrlOrBase64: string
): Promise<string> {
  const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) throw new Error("Invalid product ID.");

  let mime = "image/jpeg";
  let base64 = dataUrlOrBase64;

  const match = dataUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mime = match[1];
    base64 = match[2];
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error("Empty image data.");
  }

  const detectedMime = detectMimeType(buffer);
  if (detectedMime) mime = detectedMime;

  // 1. Cache in memory
  memoryCache.set(safeId, { buffer, mime });

  // 2. Write to local disk cache
  ensureImagesDir();
  const filePath = path.join(IMAGES_DIR, `${safeId}.bin`);
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.warn(`[canteen-images] Failed to write image to disk ${filePath}:`, err);
  }

  // 3. Persist to Supabase Cloud if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      if (supabase) {
        await supabase.from("canteen_store").upsert({
          id: `img_${safeId}`,
          data: {
            mime,
            base64,
            size: buffer.length,
            updated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`[canteen-images] Failed to persist image to Supabase:`, err);
    }
  }

  return `/api/images/${safeId}?v=${Date.now()}`;
}

/**
 * Retrieves a stored product image.
 * Tries: Memory Cache (0ms) -> Disk Cache (<1ms) -> Direct Store JSON (<1ms) -> Supabase Cloud.
 */
export async function getProductImage(
  productId: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return null;

  // 1. In-Memory Cache (Instant 0ms)
  const mem = memoryCache.get(safeId);
  if (mem) return mem;

  // 2. Local Disk Cache (<1ms)
  const filePath = path.join(IMAGES_DIR, `${safeId}.bin`);
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const mime = detectMimeType(buffer);
      memoryCache.set(safeId, { buffer, mime });
      return { buffer, mime };
    }
  } catch (err) {
    console.warn(`[canteen-images] Error reading disk cache for ${safeId}:`, err);
  }

  // 3. Direct Store JSON Fallback (<1ms, no network round-trip)
  const inlineDataUrl = getStoredProductImage(safeId);
  if (inlineDataUrl) {
    const match = inlineDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      let mime = match[1];
      const buffer = Buffer.from(match[2], "base64");
      const detected = detectMimeType(buffer);
      if (detected) mime = detected;

      ensureImagesDir();
      try {
        fs.writeFileSync(filePath, buffer);
      } catch {
        // ignore
      }
      memoryCache.set(safeId, { buffer, mime });
      return { buffer, mime };
    }
  }

  // 4. Supabase Cloud Fallback (if image was persisted remotely)
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("canteen_store")
          .select("data")
          .eq("id", `img_${safeId}`)
          .maybeSingle();

        if (!error && data && data.data && data.data.base64) {
          const base64 = data.data.base64;
          const mime = data.data.mime || "image/jpeg";
          const buffer = Buffer.from(base64, "base64");

          ensureImagesDir();
          try {
            fs.writeFileSync(filePath, buffer);
          } catch {
            // ignore
          }

          memoryCache.set(safeId, { buffer, mime });
          return { buffer, mime };
        }
      }
    } catch (err) {
      console.warn(`[canteen-images] Error fetching from Supabase for ${safeId}:`, err);
    }
  }

  return null;
}

/**
 * Deletes a stored product image from all stores.
 */
export async function deleteProductImage(productId: string): Promise<void> {
  const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return;

  memoryCache.delete(safeId);

  const filePath = path.join(IMAGES_DIR, `${safeId}.bin`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseAdminClient();
      if (supabase) {
        await supabase.from("canteen_store").delete().eq("id", `img_${safeId}`);
      }
    } catch {
      // ignore
    }
  }
}
