/**
 * Offline snack recognition for the POS "Scan Snack" scanner.
 *
 * How it works:
 *  - MobileNet V2 (served locally from /models/mobilenet_v2) turns an image into a
 *    1280-number "fingerprint" (embedding). No internet or API key is needed.
 *  - Every product photo (image_url + reference_images) is fingerprinted once and cached.
 *  - A captured photo is fingerprinted (full frame + centre crop) and compared with
 *    cosine similarity, blended with a small colour-histogram signal so look-alike
 *    packets with different colours (e.g. Lay's blue vs green) separate better.
 */
import type { Product } from "@/types/pos";

type MobileNetModel = {
  infer: (img: HTMLCanvasElement, embedding?: boolean) => {
    data: () => Promise<Float32Array | Int32Array | Uint8Array>;
    dispose: () => void;
  };
};

interface Fingerprint {
  embedding: Float32Array; // L2-normalised
  histogram: Float32Array; // L1-normalised hue/saturation/value histogram
}

export interface ProductMatch {
  product: Product;
  score: number; // raw blended similarity (0..1)
  confidence: number; // 0..100 display value
  matchedImage: string;
}

const MODEL_URL = "/models/mobilenet_v2/model.json";
const SIZE = 224;
const EMBED_WEIGHT = 0.82;
const HIST_WEIGHT = 0.18;

let modelPromise: Promise<MobileNetModel> | null = null;
const fingerprintCache = new Map<string, Promise<Fingerprint | null>>();

/** Lazily load TensorFlow.js + MobileNet (≈13 MB, cached by the browser after first use). */
export function loadRecognitionModel(): Promise<MobileNetModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
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
    })().catch((err) => {
      modelPromise = null; // allow retry
      throw err;
    });
  }
  return modelPromise;
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
  model: MobileNetModel,
  canvas: HTMLCanvasElement
): Promise<Fingerprint> {
  return { embedding: await embed(model, canvas), histogram: colourHistogram(canvas) };
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
  return (
    EMBED_WEIGHT * cosine(query.embedding, ref.embedding) +
    HIST_WEIGHT * histogramIntersection(query.histogram, ref.histogram)
  );
}

function getCatalogFingerprint(model: MobileNetModel, url: string) {
  let cached = fingerprintCache.get(url);
  if (!cached) {
    cached = loadImage(url)
      .then((img) => fingerprintCanvas(model, toSquareCanvas(img)))
      .catch(() => null); // broken image → ignored
    fingerprintCache.set(url, cached);
  }
  return cached;
}

export function productImageUrls(product: Product): string[] {
  return [product.image_url, ...(product.reference_images || [])].filter(
    (u): u is string => Boolean(u)
  );
}

/** Pre-compute fingerprints for the whole catalog (call when the scanner opens). */
export async function warmUpCatalog(products: Product[]): Promise<void> {
  const model = await loadRecognitionModel();
  for (const p of products) {
    for (const url of productImageUrls(p)) {
      await getCatalogFingerprint(model, url);
    }
  }
}

/** Map a raw similarity score to a friendly 0–100 confidence value. */
function toConfidence(score: number): number {
  const LOW = 0.45;
  const HIGH = 0.85;
  return Math.round(Math.max(0, Math.min(1, (score - LOW) / (HIGH - LOW))) * 100);
}

/** Match a captured photo against active products and return the top results. */
export async function matchProducts(
  capture: HTMLCanvasElement,
  products: Product[],
  topK = 3
): Promise<ProductMatch[]> {
  const model = await loadRecognitionModel();

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
