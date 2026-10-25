/**
 * One-time setup: downloads the MobileNet V2 image model into
 * public/models/mobilenet_v2/ so the POS "Scan Snack" feature works fully offline.
 *
 * Usage: npm run setup:vision
 */
import fs from "node:fs";
import path from "node:path";

const SOURCE =
  "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2/model.json?tfjs-format=file";
const OUT_DIR = path.join(process.cwd(), "public", "models", "mobilenet_v2");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Downloading model.json ...");
  const res = await fetch(SOURCE, { redirect: "follow" });
  if (!res.ok) throw new Error(`model.json download failed: HTTP ${res.status}`);
  const modelJson = await res.json();
  fs.writeFileSync(path.join(OUT_DIR, "model.json"), JSON.stringify(modelJson));

  // Each shard must be resolved through the same hub path (each gets its own signed redirect).
  const base = SOURCE.split("?")[0].replace(/model\.json$/, "");
  const query = "?tfjs-format=file";

  const shards = (modelJson.weightsManifest || []).flatMap((g) => g.paths);
  for (const shard of shards) {
    process.stdout.write(`Downloading ${shard} ... `);
    const r = await fetch(base + shard + query, { redirect: "follow" });
    if (!r.ok) throw new Error(`${shard} download failed: HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, shard), buf);
    console.log(`${(buf.length / 1024 / 1024).toFixed(2)} MB`);
  }

  console.log(`\nModel saved to ${OUT_DIR} (${shards.length} weight shards).`);
}

main().catch((err) => {
  console.error("Vision model setup failed:", err.message);
  process.exit(1);
});
