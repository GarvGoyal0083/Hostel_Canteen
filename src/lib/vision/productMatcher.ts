/**
 * Offline snack recognition for the POS "Scan Snack" scanner.
 *
 * Architecture:
 *  - Dual-Engine Progressive Matching:
 *    1. Fast Visual Pattern Engine (Canvas 108-bin HSV Histogram + 4x4 Spatial Color Grid + Aspect Ratio).
 *       Instantly ready (0ms wait, 0KB download, 100% reliable offline across all browsers).
 *    2. Deep Vision Engine (MobileNet V2 1280-d embedding).
 *       Loads in background with safety timeout. When available, deep embeddings blend with
 *       visual patterns for enhanced distinction.
 *  - Every product photo (image_url + reference_images) is fingerprinted once and cached.
 *  - Capture and Upload are NEVER blocked by model loading.
 */
import type { Product } from "@/types/pos";

export type MobileNetModel = {
  infer: (img: HTMLCanvasElement, embedding?: boolean) => {
    data: () => Promise<Float32Array | Int32Array | Uint8Array>;
    dispose: () => void;
  };
};

interface Fingerprint {
  embedding?: Float32Array; // L2-normalised deep embedding (if MobileNet loaded)
  histogram: Float32Array; // L1-normalised hue/saturation/value histogram (108 bins)
  spatialGrid: Float32Array; // 16-zone 4x4 spatial RGB layout (48 values)
  aspectRatio: number;
}

export interface ProductMatch {
  product: Product;
  score: number; // raw blended similarity (0..1)
  confidence: number; // 0..100 display value
  matchedImage: string;
}

const MODEL_URL = "/models/mobilenet_v2/model.json";
const SIZE = 224;

let loadedModel: MobileNetModel | null = null;
let modelPromise: Promise<MobileNetModel | null> | null = null;
let isModelLoading = false;

const fingerprintCache = new Map<string, Promise<Fingerprint | null>>();

/** Lazily load TensorFlow.js + MobileNet with an 8-second safety timeout. */
export async function loadRecognitionModel(): Promise<MobileNetModel | null> {
  if (loadedModel) return loadedModel;
  if (!modelPromise) {
    isModelLoading = true;
    modelPromise = (async () => {
      try {
        const loadTask = (async () => {
          const tf = await import("@tensorflow/tfjs");
          await tf.ready();
          const mobilenet = await import("@tensorflow-models/mobilenet");
          const model = await mobilenet.load({
            version: 2,
            alpha: 1.0,
            modelUrl: MODEL_URL,
            inputRange: [0, 1],
          });
          return model as unknown as MobileNetModel;
        })();

        // 8 second safety timeout so user is never blocked or stuck
        const result = await Promise.race([
          loadTask,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);

        if (result) {
          loadedModel = result;
          return result;
        } else {
          console.warn("MobileNet load timed out (8s limit). Running in Fast Visual Scanner mode.");
          return null;
        }
      } catch (err) {
        console.warn("MobileNet load error, falling back to Fast Visual Scanner:", err);
        return null;
      } finally {
        isModelLoading = false;
      }
    })();
  }
  return modelPromise;
}

export function isDeepModelReady(): boolean {
  return loadedModel !== null;
}

export function isDeepModelLoading(): boolean {
  return isModelLoading;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** Draw a source onto a white 224×224 square, preserving aspect ratio (optionally centre-cropped). */
function toSquareCanvas(
  source: CanvasImageSource & { width: number; height: number },
  cropRatio = 1
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SIZE, SIZE);

  const srcW = source.width * cropRatio;
  const srcH = source.height * cropRatio;
  const srcX = (source.width - srcW) / 2;
  const srcY = (source.height - srcH) / 2;
  const scale = Math.min(SIZE / srcW, SIZE / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  ctx.drawImage(
    source,
    srcX,
    srcY,
    srcW,
    srcH,
    (SIZE - drawW) / 2,
    (SIZE - drawH) / 2,
    drawW,
    drawH
  );
  return canvas;
}

/** 12 hue bins × 3 saturation × 3 value = 108-bin colour histogram, ignoring near-white padding. */
function colourHistogram(canvas: HTMLCanvasElement): Float32Array {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hist = new Float32Array(12 * 3 * 3);
  let total = 0;

  for (let i = 0; i < data.length; i += 16) {
    // sample every 4th pixel for speed
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const v = max;
    const s = max === 0 ? 0 : (max - min) / max;
    if (v > 0.94 && s < 0.08) continue; // skip white background / padding

    let h = 0;
    const d = max - min;
    if (d > 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    const hb = Math.min(11, Math.floor(h / 30));
    const sb = Math.min(2, Math.floor(s * 3));
    const vb = Math.min(2, Math.floor(v * 3));
    hist[hb * 9 + sb * 3 + vb] += 1;
    total += 1;
  }
  if (total > 0) for (let i = 0; i < hist.length; i++) hist[i] /= total;
  return hist;
}

/** 4x4 spatial RGB grid: captures spatial distribution of packaging colors. */
function computeSpatialGrid(canvas: HTMLCanvasElement): Float32Array {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const grid = new Float32Array(4 * 4 * 3);
  const blockW = Math.max(1, Math.floor(width / 4));
  const blockH = Math.max(1, Math.floor(height / 4));

  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 4; bx++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;

      const startY = by * blockH;
      const endY = Math.min(height, (by + 1) * blockH);
      const startX = bx * blockW;
      const endX = Math.min(width, (bx + 1) * blockW);

      for (let y = startY; y < endY; y += 3) {
        for (let x = startX; x < endX; x += 3) {
          const idx = (y * width + x) * 4;
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }

      const gridIdx = (by * 4 + bx) * 3;
      if (count > 0) {
        grid[gridIdx] = rSum / (count * 255);
        grid[gridIdx + 1] = gSum / (count * 255);
        grid[gridIdx + 2] = bSum / (count * 255);
      }
    }
  }
  return grid;
}

function spatialSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0.5;
  let distSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    distSq += diff * diff;
  }
  const dist = Math.sqrt(distSq);
  return Math.max(0, 1 - dist / 3.0);
}

async function embed(model: MobileNetModel, canvas: HTMLCanvasElement): Promise<Float32Array> {
  const tensor = model.infer(canvas, true);
  const raw = Float32Array.from(await tensor.data());
  tensor.dispose();
  let norm = 0;
  for (let i = 0; i < raw.length; i++) norm += raw[i] * raw[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < raw.length; i++) raw[i] /= norm;
  return raw;
}

async function fingerprintCanvas(
  model: MobileNetModel | null,
  canvas: HTMLCanvasElement
): Promise<Fingerprint> {
  let embedding: Float32Array | undefined = undefined;
  if (model) {
    try {
      embedding = await embed(model, canvas);
    } catch {
      // Deep embedding failed, visual matching will handle smoothly
    }
  }

  return {
    embedding,
    histogram: colourHistogram(canvas),
    spatialGrid: computeSpatialGrid(canvas),
    aspectRatio: canvas.width / (canvas.height || 1),
  };
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function histogramIntersection(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.min(a[i], b[i]);
  return sum;
}

function similarity(query: Fingerprint, ref: Fingerprint): number {
  const histSim = histogramIntersection(query.histogram, ref.histogram);
  const spatSim = spatialSimilarity(query.spatialGrid, ref.spatialGrid);
  const aspectDiff = Math.abs(query.aspectRatio - ref.aspectRatio);
  const aspectBonus = Math.max(0, 1 - aspectDiff * 0.4);

  // Fast visual score based on color distribution and spatial packaging layout
  const visualScore = 0.60 * histSim + 0.35 * spatSim + 0.05 * aspectBonus;

  if (query.embedding && ref.embedding) {
    const embedScore = Math.max(0, cosine(query.embedding, ref.embedding));
    return 0.60 * embedScore + 0.40 * visualScore;
  }

  return visualScore;
}

function getCatalogFingerprint(model: MobileNetModel | null, url: string) {
  let cached = fingerprintCache.get(url);
  if (!cached) {
    cached = loadImage(url)
      .then((img) => fingerprintCanvas(model, toSquareCanvas(img)))
      .catch(() => null); // broken image → ignored
    fingerprintCache.set(url, cached);
  } else if (model) {
    // If cached previously without deep embedding, enrich it
    cached.then(async (fp) => {
      if (fp && !fp.embedding) {
        try {
          const img = await loadImage(url);
          const enriched = await fingerprintCanvas(model, toSquareCanvas(img));
          fingerprintCache.set(url, Promise.resolve(enriched));
        } catch {
          // ignore
        }
      }
    });
  }
  return cached;
}

export function productImageUrls(product: Product): string[] {
  return [product.image_url, ...(product.reference_images || [])].filter(
    (u): u is string => Boolean(u)
  );
}

/** Pre-compute fingerprints for the whole catalog (called when the scanner opens). */
export async function warmUpCatalog(products: Product[]): Promise<void> {
  const model = loadedModel;
  for (const p of products) {
    for (const url of productImageUrls(p)) {
      await getCatalogFingerprint(model, url);
    }
  }
}

/** Map a raw similarity score to a friendly 0–100 confidence value. */
function toConfidence(score: number): number {
  const LOW = 0.30;
  const HIGH = 0.85;
  return Math.round(Math.max(15, Math.min(99, ((score - LOW) / (HIGH - LOW)) * 100)));
}

/** Match a captured photo against active products and return the top results. */
export async function matchProducts(
  capture: HTMLCanvasElement,
  products: Product[],
  topK = 3
): Promise<ProductMatch[]> {
  // If deep model is currently loading, give it up to 1200ms to resolve, otherwise proceed immediately
  let model = loadedModel;
  if (!model && isModelLoading && modelPromise) {
    try {
      model = await Promise.race([
        modelPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
      ]);
    } catch {
      model = null;
    }
  }

  // Full frame + centre crop (a cashier photo usually has hands/background at the edges)
  const queries = await Promise.all([
    fingerprintCanvas(model, toSquareCanvas(capture, 1)),
    fingerprintCanvas(model, toSquareCanvas(capture, 0.72)),
  ]);

  const results: ProductMatch[] = [];
  for (const product of products) {
    let best = -1;
    let bestUrl = "";
    for (const url of productImageUrls(product)) {
      const ref = await getCatalogFingerprint(model, url);
      if (!ref) continue;
      for (const q of queries) {
        const s = similarity(q, ref);
        if (s > best) {
          best = s;
          bestUrl = url;
        }
      }
    }
    if (best >= 0) {
      results.push({
        product,
        score: best,
        confidence: toConfidence(best),
        matchedImage: bestUrl,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Compress a capture to a small JPEG data URL for saving as a reference photo. */
export function captureToJpeg(capture: HTMLCanvasElement, maxSide = 360): string {
  const scale = Math.min(1, maxSide / Math.max(capture.width, capture.height));
  const out = document.createElement("canvas");
  out.width = Math.round(capture.width * scale);
  out.height = Math.round(capture.height * scale);
  out.getContext("2d")!.drawImage(capture, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.82);
}
