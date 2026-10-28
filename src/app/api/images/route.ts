import { NextRequest, NextResponse } from "next/server";
import { getProductImage } from "@/lib/images/store";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing image ID parameter (?id=...)" }, { status: 400 });
    }

    const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const img = await getProductImage(cleanId);

    if (!img) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(img.buffer), {
      status: 200,
      headers: {
        "Content-Type": img.mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": img.buffer.length.toString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to serve image" },
      { status: 500 }
    );
  }
}
