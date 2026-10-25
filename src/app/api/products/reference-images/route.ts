import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { addProductReferenceImage } from "@/lib/db/store";

/**
 * Reference photos captured at the POS "Scan Snack" scanner.
 * Stored under data/product-refs/ (not public/) so newly captured photos are
 * served immediately in both dev and production builds.
 */
const REFS_DIR = path.join(process.cwd(), "data", "product-refs");
const MAX_IMAGE_BYTES = 600 * 1024; // compressed JPEG from the browser is ~20-60 KB
const SAFE_FILE = /^[a-zA-Z0-9_-]+\.jpg$/;

function refUrl(fileName: string) {
  return `/api/products/reference-images?file=${encodeURIComponent(fileName)}`;
}

/** GET ?file=<name>.jpg — serve a stored reference photo (admin only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  const file = req.nextUrl.searchParams.get("file") || "";
  if (!SAFE_FILE.test(file)) {
    return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
  }
  const fullPath = path.join(REFS_DIR, file);
  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const data = fs.readFileSync(fullPath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

/** POST { product_id, image_data: "data:image/jpeg;base64,..." } — save a confirmed scan photo. */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const productId = String(body.product_id || "");
    const imageData = String(body.image_data || "");

    const match = imageData.match(/^data:image\/jpeg;base64,(.+)$/);
    if (!productId || !match) {
      return NextResponse.json(
        { error: "product_id and a JPEG image_data URL are required." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(match[1], "base64");
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is empty or too large." }, { status: 400 });
    }

    fs.mkdirSync(REFS_DIR, { recursive: true });
    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${safeId}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.jpg`;
    fs.writeFileSync(path.join(REFS_DIR, fileName), buffer);

    const { product, removed } = await addProductReferenceImage(
      productId,
      refUrl(fileName),
      auth.admin.full_name
    );

    // Delete photo files that rotated out of the per-product limit
    for (const url of removed) {
      const old = new URL(url, "http://local").searchParams.get("file");
      if (old && SAFE_FILE.test(old)) {
        fs.rmSync(path.join(REFS_DIR, old), { force: true });
      }
    }

    return NextResponse.json({ success: true, product });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save reference photo." },
      { status: 400 }
    );
  }
}
