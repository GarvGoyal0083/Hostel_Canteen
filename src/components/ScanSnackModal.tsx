"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Upload,
  X,
  ScanLine,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Search,
  UserCheck,
  UserPlus,
  Users,
  Package,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { Customer, Product } from "@/types/pos";
import { formatINR } from "@/lib/format";
import {
  captureToJpeg,
  isDeepModelReady,
  loadRecognitionModel,
  matchProducts,
  warmUpCatalog,
  type ProductMatch,
} from "@/lib/vision/productMatcher";

export type ScanCustomerSelection =
  | { mode: "anonymous" }
  | { mode: "existing"; customerId: string }
  | { mode: "new"; name: string; room_number: string; phone: string };

interface ScanSnackModalProps {
  open: boolean;
  products: Product[];
  customers: Customer[];
  cartUnits: number;
  onAddToCart: (product: Product) => void;
  onCustomerSelected: (selection: ScanCustomerSelection) => void;
  onClose: () => void;
}

type Step = "scan" | "matching" | "results" | "customer";
type ModelState = "fast_ready" | "loading" | "deep_ready";

const MAX_CAPTURE_SIDE = 720;

export function ScanSnackModal({
  open,
  products,
  customers,
  cartUnits,
  onAddToCart,
  onCustomerSelected,
  onClose,
}: ScanSnackModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);

  const [step, setStep] = useState<Step>("scan");
  const [modelState, setModelState] = useState<ModelState>("fast_ready");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [matches, setMatches] = useState<ProductMatch[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [teachEnabled, setTeachEnabled] = useState(true);
  const [scannedCount, setScannedCount] = useState(0);
  // Reference photos saved during this session (used immediately for later scans)
  const [sessionRefs, setSessionRefs] = useState<Record<string, string[]>>({});

  // Customer step state
  const [customerTab, setCustomerTab] = useState<"existing" | "new" | "anonymous">("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", room_number: "", phone: "" });
  const [customerError, setCustomerError] = useState<string | null>(null);

  const scannableProducts = useMemo(
    () =>
      products
        .filter((p) => p.is_active)
        .map((p) =>
          sessionRefs[p.id]
            ? { ...p, reference_images: [...(p.reference_images || []), ...sessionRefs[p.id]] }
            : p
        ),
    [products, sessionRefs]
  );

  const productsWithPhotos = useMemo(
    () => scannableProducts.filter((p) => p.image_url || (p.reference_images || []).length > 0),
    [scannableProducts]
  );

  // ---------------------------------------------------------------- camera
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (startingRef.current || streamRef.current) return;
    startingRef.current = true;
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not available in this browser. Use Upload Image instead.");
      startingRef.current = false;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraOn(true);
    } catch {
      setCameraError("Camera permission was denied or no camera was found. Use Upload Image instead.");
    } finally {
      startingRef.current = false;
    }
  }, []);

  // ---------------------------------------------------------------- lifecycle
  useEffect(() => {
    if (!open) return;
    setStep("scan");
    setMatches([]);
    setPreviewUrl(null);
    setErrorMsg(null);
    setScannedCount(0);
    setCustomerError(null);

    // 1. Fast visual recognition is ready immediately (0 wait time)
    setModelState("fast_ready");
    warmUpCatalog(productsWithPhotos).catch(() => {});

    // 2. Background-load deep AI model (non-blocking)
    if (!isDeepModelReady()) {
      setModelState("loading");
      loadRecognitionModel()
        .then((model) => {
          if (model) {
            setModelState("deep_ready");
            warmUpCatalog(productsWithPhotos).catch(() => {});
          } else {
            setModelState("fast_ready");
          }
        })
        .catch(() => {
          setModelState("fast_ready");
        });
    } else {
      setModelState("deep_ready");
    }

    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && step === "scan" && !cameraOn && !cameraError) {
      startCamera();
    }
    if (step !== "scan" && cameraOn) {
      stopCamera();
    }
  }, [open, step, cameraOn, cameraError, startCamera, stopCamera]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------------------------------------------------------------- recognition
  const runMatching = async (canvas: HTMLCanvasElement) => {
    captureRef.current = canvas;
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.8));
    setErrorMsg(null);
    setStep("matching");

    if (productsWithPhotos.length === 0) {
      setErrorMsg("No products have photos yet. Add product photos first so the scanner can recognise them.");
      setMatches([]);
      setStep("results");
      return;
    }

    try {
      const found = await matchProducts(canvas, productsWithPhotos, 3);
      setMatches(found);
      setStep("results");
    } catch {
      setErrorMsg("Recognition failed. Please try again or search manually.");
      setStep("results");
    }
  };

  const drawToCaptureCanvas = (
    source: CanvasImageSource,
    width: number,
    height: number
  ): HTMLCanvasElement => {
    const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    runMatching(drawToCaptureCanvas(video, video.videoWidth, video.videoHeight));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      runMatching(drawToCaptureCanvas(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setErrorMsg("Could not read that image file.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const saveReferencePhoto = async (product: Product) => {
    const canvas = captureRef.current;
    if (!canvas) return;
    try {
      const res = await fetch("/api/products/reference-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, image_data: captureToJpeg(canvas) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const refs: string[] = data.product?.reference_images || [];
      const latest = refs[refs.length - 1];
      if (latest) {
        setSessionRefs((prev) => ({ ...prev, [product.id]: [...(prev[product.id] || []), latest] }));
      }
    } catch {
      // Learning is best-effort; billing must never be blocked by it.
    }
  };

  const handleConfirmMatch = (product: Product) => {
    if (product.stock_quantity <= 0) {
      setErrorMsg(`"${product.name}" is out of stock.`);
      return;
    }
    onAddToCart(product);
    setScannedCount((n) => n + 1);
    setToast(`Added ${product.name}`);
    if (teachEnabled) saveReferencePhoto(product);
    setMatches([]);
    setPreviewUrl(null);
    setStep("scan");
  };

  // ---------------------------------------------------------------- customer step
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const list = customers.filter((c) => c.is_active !== false);
    if (!q) return list.slice(0, 30);
    return list
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.room_number || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [customers, customerSearch]);

  const handleConfirmCustomer = () => {
    setCustomerError(null);
    if (customerTab === "existing") {
      if (!selectedCustomerId) {
        setCustomerError("Select the student who is buying.");
        return;
      }
      onCustomerSelected({ mode: "existing", customerId: selectedCustomerId });
    } else if (customerTab === "new") {
      if (!newCustomer.name.trim()) {
        setCustomerError("Enter the student's name.");
        return;
      }
      if (!newCustomer.room_number.trim()) {
        setCustomerError("Enter the room number.");
        return;
      }
      onCustomerSelected({
        mode: "new",
        name: newCustomer.name.trim(),
        room_number: newCustomer.room_number.trim(),
        phone: newCustomer.phone.trim(),
      });
    } else {
      onCustomerSelected({ mode: "anonymous" });
    }
    stopCamera();
    onClose();
  };

  if (!open) return null;

  const best = matches[0];
  const isConfident =
    best && best.confidence >= 70 && (matches.length < 2 || best.confidence - matches[1].confidence >= 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6">
      <div className="w-full max-w-2xl max-h-[94vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl orb-3d-blue flex items-center justify-center text-white">
              {step === "customer" ? <UserCheck className="h-4.5 w-4.5" /> : <ScanLine className="h-4.5 w-4.5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {step === "customer" ? "Who is buying?" : "Scan Snack"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {step === "customer"
                  ? `${cartUnits} item${cartUnits === 1 ? "" : "s"} in cart`
                  : "Offline recognition from your product photos"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {scannedCount > 0 && step !== "customer" && (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                {scannedCount} scanned
              </span>
            )}
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-xs text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {toast && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {toast}
            </div>
          )}

          {/* ------------------------------------------------ STEP: SCAN */}
          {step === "scan" && (
            <>
              <div className="relative aspect-[4/3] w-full rounded-xl bg-slate-900 overflow-hidden">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${cameraOn ? "" : "hidden"}`}
                />
                {cameraOn && (
                  <div className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
                )}
                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 p-6 text-center">
                    <Camera className="h-10 w-10 text-slate-500" />
                    <span className="text-xs">
                      {cameraError || "Starting camera…"}
                    </span>
                  </div>
                )}
                {modelState === "loading" ? (
                  <div className="absolute top-3 left-3 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-medium text-slate-200 flex items-center gap-1.5 backdrop-blur-xs border border-white/10 shadow-sm">
                    <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                    <span>Scanner Ready • Loading AI…</span>
                  </div>
                ) : modelState === "deep_ready" ? (
                  <div className="absolute top-3 left-3 rounded-full bg-emerald-950/85 px-3 py-1 text-[11px] font-medium text-emerald-200 flex items-center gap-1.5 backdrop-blur-xs border border-emerald-500/30 shadow-sm">
                    <Sparkles className="h-3 w-3 text-emerald-400" />
                    <span>AI Vision Enhanced</span>
                  </div>
                ) : (
                  <div className="absolute top-3 left-3 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-medium text-slate-200 flex items-center gap-1.5 backdrop-blur-xs border border-white/10 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Fast Visual Scanner Ready</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 text-center">
                Hold one packet inside the frame with the front label facing the camera.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleCapture}
                  disabled={!cameraOn}
                  className="btn-3d-primary rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="h-4 w-4" />
                  Capture
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-3d-secondary rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="h-4 w-4 text-blue-600" />
                  Upload Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
              </div>
            </>
          )}

          {/* ------------------------------------------------ STEP: MATCHING */}
          {step === "matching" && (
            <div className="flex flex-col items-center gap-3 py-10">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Captured" className="h-36 rounded-xl object-contain border border-slate-200" />
              )}
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Recognising snack…
              </div>
            </div>
          )}

          {/* ------------------------------------------------ STEP: RESULTS */}
          {step === "results" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Captured"
                    className="h-16 w-16 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                )}
                <div className="text-xs text-slate-600">
                  {matches.length > 0 ? (
                    <>
                      <span className="font-semibold text-slate-900">Tap the correct snack</span> to add it to the cart.
                      {isConfident && (
                        <span className="ml-1 inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <Sparkles className="h-3 w-3" /> Strong match found
                        </span>
                      )}
                    </>
                  ) : (
                    "No match found. Try again with better lighting, or add it from the product grid."
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {matches.map((m, idx) => {
                  const out = m.product.stock_quantity <= 0;
                  const highlighted = idx === 0 && isConfident;
                  return (
                    <button
                      key={m.product.id}
                      onClick={() => handleConfirmMatch(m.product)}
                      disabled={out}
                      className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        highlighted
                          ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-500/15"
                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden p-1">
                        {m.product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.product.image_url} alt={m.product.name} className="h-full w-full object-contain" />
                        ) : (
                          <Package className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{m.product.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatINR(m.product.selling_price)} • {out ? "Out of stock" : `${m.product.stock_quantity} in stock`}
                        </div>
                        <div className="mt-1.5 h-1.5 w-full max-w-[160px] rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              m.confidence >= 70 ? "bg-emerald-500" : m.confidence >= 40 ? "bg-amber-500" : "bg-slate-400"
                            }`}
                            style={{ width: `${Math.max(4, m.confidence)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-slate-900">{m.confidence}%</div>
                        <div className="text-[10px] font-semibold text-blue-600 flex items-center gap-0.5 justify-end">
                          Add <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={teachEnabled}
                    onChange={(e) => setTeachEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Save this photo to improve recognition
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setStep("scan");
                      setErrorMsg(null);
                    }}
                    className="btn-3d-secondary rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Scan again
                  </button>
                  <button
                    onClick={() => {
                      stopCamera();
                      onClose();
                    }}
                    className="btn-3d-secondary rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Search manually
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ STEP: CUSTOMER */}
          {step === "customer" && (
            <div className="space-y-4">
              <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1">
                {(
                  [
                    { id: "existing", label: "Existing Student", icon: Users },
                    { id: "new", label: "New Student", icon: UserPlus },
                    { id: "anonymous", label: "Walk-in", icon: UserCheck },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setCustomerTab(t.id);
                      setCustomerError(null);
                    }}
                    className={`rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      customerTab === t.id ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {customerError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-800">
                  {customerError}
                </div>
              )}

              {customerTab === "existing" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      autoFocus
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search name, room or phone…"
                      className="input-3d w-full pl-9 pr-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    {filteredCustomers.length === 0 ? (
                      <div className="text-center text-xs text-slate-500 py-6">
                        No student found. Use the <strong>New Student</strong> tab.
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={`w-full rounded-xl border px-3 py-2.5 text-xs flex items-center justify-between transition cursor-pointer ${
                            selectedCustomerId === c.id
                              ? "border-blue-400 bg-blue-50/70"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{c.name}</span>
                            {c.room_number && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                Room {c.room_number}
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              c.outstanding_dues > 0 ? "text-amber-600" : "text-emerald-600"
                            }`}
                          >
                            {c.outstanding_dues > 0 ? `Due ${formatINR(c.outstanding_dues)}` : "No dues"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {customerTab === "new" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Student Name *</label>
                    <input
                      autoFocus
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Aarav Sharma"
                      className="input-3d w-full px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Room Number *</label>
                    <input
                      value={newCustomer.room_number}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, room_number: e.target.value }))}
                      placeholder="e.g. B-204"
                      className="input-3d w-full px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Phone (optional)</label>
                    <input
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="10-digit mobile"
                      inputMode="tel"
                      className="input-3d w-full px-3 py-2 text-slate-900"
                    />
                  </div>
                </div>
              )}

              {customerTab === "anonymous" && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
                  Bill without a name. Walk-in sales must be paid in full (no udhaar).
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-2 bg-slate-50/60">
          {step === "customer" ? (
            <>
              <button
                onClick={() => setStep("scan")}
                className="btn-3d-secondary rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer"
              >
                Back to scanning
              </button>
              <button
                onClick={handleConfirmCustomer}
                className="btn-3d-primary rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Continue to payment
              </button>
            </>
          ) : (
            <>
              <span className="text-[11px] text-slate-500">
                {productsWithPhotos.length} products recognisable
              </span>
              <button
                onClick={() => setStep("customer")}
                disabled={cartUnits === 0}
                className="btn-3d-primary rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Done ({cartUnits} in cart) — Choose customer
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
