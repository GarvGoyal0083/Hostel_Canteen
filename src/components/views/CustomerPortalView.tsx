"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Store,
  ShoppingBag,
  Package,
  ReceiptText,
  BookOpen,
  Search,
  UserCheck,
  LogOut,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  DoorOpen,
  Wallet,
  CreditCard,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Trash2,
  Truck,
  ArrowRight,
  ShoppingCart,
  QrCode,
  Download,
  Maximize2,
  X,
  BellRing,
} from "lucide-react";
import { StudentNotificationButton } from "@/components/StudentNotificationButton";
import {
  Customer,
  CustomerLedgerEntry,
  CanteenStatus,
  PaymentEntry,
  SaleRecord,
} from "@/types/pos";
import { formatINR, formatIST } from "@/lib/format";
import { PaymentStatusBadge } from "@/components/StatusBadge";
import { ReceiptModal } from "@/components/ReceiptModal";
import { CanteenLogo } from "@/components/CanteenLogo";
import { SunMedium } from "lucide-react";

interface PublicProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  image_url?: string | null;
  selling_price: number;
  stock_quantity: number;
  min_stock_level: number;
  expiry_date?: string | null;
  is_active: boolean;
}

interface CustomerSummary {
  id: string;
  name: string;
  room_number?: string | null;
  outstanding_dues: number;
  total_purchases: number;
  total_payments: number;
}

interface CustomerPortalViewProps {
  initialCustomer?: Customer | null;
  onExitToLogin: () => void;
  isAdminPreview?: boolean;
  onBackToAdmin?: () => void;
}

export function CustomerPortalView({
  initialCustomer,
  onExitToLogin,
  isAdminPreview = false,
  onBackToAdmin,
}: CustomerPortalViewProps) {
  const [activeTab, setActiveTab] = useState<"stock" | "purchases" | "ledger">(
    "stock"
  );
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerSummary[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(
    initialCustomer || null
  );
  const [canteenStatus, setCanteenStatus] = useState<CanteenStatus>({
    is_open: true,
    closure_type: "open",
    closure_reason: "",
    reopen_at: null,
    updated_at: "",
    updated_by: "Admin",
  });
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptSale, setReceiptSale] = useState<SaleRecord | null>(null);

  // Stock filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Quick Student Switch / Self-Login Modal
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regName, setRegName] = useState("");
  const [regRoom, setRegRoom] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // Shopping Cart & Room Delivery State
  const [cart, setCart] = useState<Array<{ product: PublicProduct; quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [roomDelivery, setRoomDelivery] = useState(true);
  const [deliveryRoom, setDeliveryRoom] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<
    "Cash" | "UPI"
  >("Cash");
  const [orderUpiRef, setOrderUpiRef] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccessSale, setOrderSuccessSale] = useState<SaleRecord | null>(
    null
  );
  const [showPortalQrModal, setShowPortalQrModal] = useState(false);

  useEffect(() => {
    if (currentCustomer?.room_number && !deliveryRoom) {
      setDeliveryRoom(currentCustomer.room_number);
    }
  }, [currentCustomer, deliveryRoom]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce(
      (acc, item) => acc + item.product.selling_price * item.quantity,
      0
    );
  }, [cart]);

  const deliveryFee = roomDelivery ? 20 : 0;
  const cartGrandTotal = cartSubtotal + deliveryFee;
  const totalCartItems = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const addToCart = (product: PublicProduct) => {
    if (product.stock_quantity <= 0) return;
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const nextQty = Math.min(
          product.stock_quantity,
          next[idx].quantity + 1
        );
        next[idx] = { ...next[idx], quantity: nextQty };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.product.id !== productId);
      }
      return prev.map((item) => {
        if (item.product.id === productId) {
          const validQty = Math.min(item.product.stock_quantity, quantity);
          return { ...item, quantity: validQty };
        }
        return item;
      });
    });
  };

  const clearCart = () => setCart([]);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!currentCustomer) {
      setShowSwitchModal(true);
      return;
    }
    if (roomDelivery && !deliveryRoom.trim()) {
      setOrderError("Please enter your hostel room number for room delivery.");
      return;
    }
    if (orderPaymentMethod === "UPI" && !orderUpiRef.trim()) {
      setOrderError(
        "Please enter the 12-digit UPI reference (UTR) after completing payment."
      );
      return;
    }

    setOrderError(null);
    setPlacingOrder(true);

    try {
      const res = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "order",
          customer_id: currentCustomer.id,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
          room_delivery: roomDelivery,
          room_number: deliveryRoom.trim(),
          notes: deliveryNotes.trim() || undefined,
          payment_method: orderPaymentMethod,
          upi_reference:
            orderPaymentMethod === "UPI" ? orderUpiRef.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order.");

      setCart([]);
      setIsCartOpen(false);
      setOrderSuccessSale(data.sale);
      fetchPortalData(currentCustomer.id);
    } catch (err) {
      setOrderError(
        err instanceof Error ? err.message : "Failed to place order."
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  const fetchPortalData = useCallback(async (custId?: string) => {
    setLoading(true);
    try {
      const url = custId
        ? `/api/customer-portal?customerId=${encodeURIComponent(custId)}`
        : `/api/customer-portal`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setAllCustomers(data.customers || []);
        if (data.canteen_status) {
          setCanteenStatus(data.canteen_status);
        }
        if (data.customer_profile) {
          setCurrentCustomer(data.customer_profile);
          setSales(data.sales || []);
          setPayments(data.payments || []);
          setLedger(data.ledger || []);
        } else if (!custId) {
          // Stay in guest view
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortalData(initialCustomer?.id);
  }, [initialCustomer?.id, fetchPortalData]);

  const handleSelfLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmittingLogin(true);
    try {
      const payload =
        authMode === "register"
          ? {
              action: "register",
              name: regName.trim(),
              room_number: regRoom.trim(),
              phone: regMobile.trim(),
              password: regPassword.trim(),
            }
          : {
              action: "login",
              name: loginIdentifier.trim(),
              password: loginPassword.trim(),
            };

      const res = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }
      setShowSwitchModal(false);
      setLoginIdentifier("");
      setLoginPassword("");
      setRegName("");
      setRegRoom("");
      setRegMobile("");
      setRegPassword("");
      await fetchPortalData(data.customer.id);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Failed to sign in.");
    } finally {
      setSubmittingLogin(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return ["ALL", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (onlyAvailable && p.stock_quantity <= 0) return false;
      if (selectedCategory !== "ALL" && p.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, onlyAvailable, selectedCategory, searchQuery]);

  const inStockCount = useMemo(
    () => products.filter((p) => p.stock_quantity > 0).length,
    [products]
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-16">
      {/* Top Clean Modern Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <CanteenLogo className="h-10 w-10 shadow-sm" size={40} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  Hostel Canteen
                </span>
                {canteenStatus.is_open ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Open for Orders
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    Closed • {canteenStatus.reopen_at || "Reopening Soon"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Live Snack Stock, Bills &amp; Room Udhaar Passbook
              </p>
            </div>
          </div>

          {/* Right Student Identity & Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdminPreview && onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="btn-3d-dark rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                <span>Back to Admin POS</span>
              </button>
            )}

            <button
              onClick={() => setShowSwitchModal(true)}
              className="btn-3d-secondary rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <UserCheck className="h-4 w-4 text-[#2563EB]" />
              {currentCustomer ? (
                <div className="text-left flex items-center gap-1.5">
                  <span className="font-extrabold text-[#111827]">
                    {currentCustomer.name}
                  </span>
                  {currentCustomer.room_number && (
                    <span className="rounded-md bg-[#EFF6FF] border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                      Room {currentCustomer.room_number}
                    </span>
                  )}
                </div>
              ) : (
                <span>Select Room / Student Login</span>
              )}
            </button>

            {/* Web Push Live Order Notification Button */}
            <StudentNotificationButton
              customerId={currentCustomer?.id}
              customerName={currentCustomer?.name}
            />

            {/* Shopping Cart Pill Button */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative btn-3d-primary rounded-xl px-3.5 py-2 text-xs font-bold text-white flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 active:scale-95 transition"
              title="View Cart & Checkout"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Cart</span>
              {totalCartItems > 0 && (
                <span className="rounded-full bg-white text-[#2563EB] px-1.5 py-0.5 text-[10px] font-black">
                  {totalCartItems}
                </span>
              )}
            </button>

            <button
              onClick={() =>
                fetchPortalData(currentCustomer ? currentCustomer.id : undefined)
              }
              className="btn-3d-secondary rounded-xl p-2 text-slate-700 cursor-pointer"
              title="Refresh Live Stock & Bills"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#2563EB]" : ""}`} />
            </button>

            {!isAdminPreview && (
              <button
                onClick={onExitToLogin}
                className="btn-3d-secondary rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:text-red-600 flex items-center gap-1.5 cursor-pointer"
                title="Exit Portal"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* 3D Hero & Student Passbook Summary */}
        {currentCustomer ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Student Profile & Total Purchased */}
            <div className="card-3d rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <ShoppingBag className="h-3.5 w-3.5 text-[#2563EB]" />
                    My Total Purchases
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#111827] mt-1.5">
                    {formatINR(currentCustomer.total_purchases)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Across{" "}
                    <span className="font-bold text-[#111827]">
                      {sales.filter((s) => s.sale_status !== "Cancelled").length}
                    </span>{" "}
                    canteen bills
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl orb-3d-blue flex items-center justify-center text-white shrink-0">
                  <ShoppingBag className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 2: Total Paid */}
            <div className="card-3d rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                    Total Paid (Cash &amp; UPI)
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1.5">
                    {formatINR(currentCustomer.total_payments)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-bold text-slate-800">
                      {payments.length}
                    </span>{" "}
                    recorded payments
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl orb-3d-emerald flex items-center justify-center text-white shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 3: Room Udhaar / Outstanding Balance */}
            <div
              className={`rounded-2xl p-5 relative overflow-hidden ${
                currentCustomer.outstanding_dues > 0
                  ? "card-3d-dark text-white"
                  : "card-3d"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${
                      currentCustomer.outstanding_dues > 0
                        ? "text-amber-300"
                        : "text-slate-500"
                    }`}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Pending Room Udhaar
                  </span>
                  <div
                    className={`text-2xl sm:text-3xl font-black mt-1.5 ${
                      currentCustomer.outstanding_dues > 0
                        ? "text-amber-400"
                        : "text-[#111827]"
                    }`}
                  >
                    {formatINR(currentCustomer.outstanding_dues)}
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      currentCustomer.outstanding_dues > 0
                        ? "text-slate-300"
                        : "text-emerald-600 font-semibold"
                    }`}
                  >
                    {currentCustomer.outstanding_dues > 0
                      ? "Payable via Cash or UPI at canteen room"
                      : "All dues settled! Zero pending balance"}
                  </p>
                </div>
                <div
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                    currentCustomer.outstanding_dues > 0
                      ? "orb-3d-amber"
                      : "orb-3d-dark"
                  }`}
                >
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Guest Welcome 3D Banner */
          <div className="card-3d-dark rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 px-3 py-0.5 text-xs font-bold text-blue-300">
                <Sparkles className="h-3.5 w-3.5" />
                Hostel Room Canteen • Student Self-Service
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Check live snack stock or view your purchase history
              </h2>
              <p className="text-xs text-slate-300 max-w-xl">
                Sign in with your Name &amp; Hostel Room Number to see everything you&apos;ve purchased, download receipts, and check your room udhaar balance.
              </p>
            </div>
            <button
              onClick={() => setShowSwitchModal(true)}
              className="btn-3d-primary rounded-xl px-5 py-3 text-xs font-bold shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <UserCheck className="h-4 w-4" />
              <span>Student Sign In / Select Room</span>
            </button>
          </div>
        )}

        {/* 3D Canteen Closed Notification Banner */}
        {!canteenStatus.is_open && (
          <div className="card-3d-dark rounded-2xl p-5 border-l-4 border-l-amber-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white shadow-xl">
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-2xl orb-3d-amber flex items-center justify-center text-white shrink-0 mt-0.5">
                <SunMedium className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 rounded-full">
                    Canteen Counter Closed
                  </span>
                  {canteenStatus.reopen_at && (
                    <span className="text-xs text-slate-300 flex items-center gap-1.5 font-bold">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      Reopening: <span className="text-white">{canteenStatus.reopen_at}</span>
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-white">
                  {canteenStatus.closure_reason || "The canteen is closed for today."}
                </p>
                <p className="text-xs text-slate-300">
                  You can still browse the snack menu, check live stock, view past purchases, and check your room udhaar balance.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-xl bg-white/10 px-3.5 py-2 text-[11px] font-bold text-slate-300 border border-white/10">
              Notice by: {canteenStatus.updated_by}
            </div>
          </div>
        )}

        {/* Clean Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs gap-1">
            <button
              onClick={() => setActiveTab("stock")}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                activeTab === "stock"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Live Snack Stock</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  activeTab === "stock"
                    ? "bg-white/20 text-white"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {inStockCount}
              </span>
            </button>

            <button
              onClick={() => {
                if (!currentCustomer) {
                  setShowSwitchModal(true);
                } else {
                  setActiveTab("purchases");
                }
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                activeTab === "purchases"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <ReceiptText className="h-4 w-4" />
              <span>My Purchases</span>
              {currentCustomer && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    activeTab === "purchases"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {sales.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (!currentCustomer) {
                  setShowSwitchModal(true);
                } else {
                  setActiveTab("ledger");
                }
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                activeTab === "ledger"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Udhaar &amp; Payments</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-normal flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span>Prices &amp; stock updated live from Canteen POS</span>
          </div>
        </div>

        {/* ====================================================================
            TAB 1: LIVE SNACK STOCK & MENU
            ==================================================================== */}
        {activeTab === "stock" && (
          <div className="space-y-5">
            {!canteenStatus.is_open && (
              <div className="card-3d-static rounded-2xl bg-amber-50 border-amber-200 p-4 flex items-center justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <SunMedium className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Menu Preview Only:</strong> Canteen counter is currently closed. New billing will resume {canteenStatus.reopen_at || "shortly"}.
                  </span>
                </div>
                <span className="text-[11px] font-extrabold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                  Closed
                </span>
              </div>
            )}

            {/* Search & Category Filter Bar */}
            <div className="card-3d-static rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Kurkure, chips, biscuits, cold drinks..."
                    className="input-3d w-full rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#111827] placeholder:text-slate-400"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none px-3 py-2 rounded-xl bg-slate-100 border border-slate-200">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                    className="rounded border-slate-300 text-[#2563EB]"
                  />
                  <span>Show In-Stock Only</span>
                </label>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        active
                          ? "btn-3d-primary"
                          : "btn-3d-secondary text-slate-700"
                      }`}
                    >
                      {cat === "ALL" ? "All Snacks & Drinks" : cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3D Product Grid */}
            {filteredProducts.length === 0 ? (
              <div className="card-3d-static rounded-2xl p-12 text-center space-y-2">
                <Package className="h-8 w-8 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-[#111827]">
                  No snacks match your search
                </div>
                <p className="text-xs text-slate-500">
                  Try clearing the search filter or switching category.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => {
                  const isOut = product.stock_quantity <= 0;
                  const isLow =
                    !isOut && product.stock_quantity <= product.min_stock_level;
                  const stockPercent = Math.min(
                    100,
                    Math.round(
                      (product.stock_quantity /
                        Math.max(15, product.min_stock_level * 3)) *
                        100
                    )
                  );

                  const cartItem = cart.find(
                    (i) => i.product.id === product.id
                  );
                  const cartQty = cartItem ? cartItem.quantity : 0;

                  return (
                    <div
                      key={product.id}
                      className={`card-3d rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 ${
                        isOut ? "opacity-60" : ""
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Category & Price Header */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-lg bg-blue-50 border border-blue-200/80 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                            {product.category}
                          </span>
                          <div className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-xs sm:text-sm font-bold shadow-xs">
                            {formatINR(product.selling_price)}
                          </div>
                        </div>

                        {/* Product Image Display */}
                        <div className="relative h-44 w-full rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-center overflow-hidden p-3 group">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 select-none"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300 py-6">
                              <Package className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                              <span className="text-[11px] font-medium text-slate-400 mt-1">
                                Hostel Snack
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Product Name & SKU */}
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                            {product.name}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Code: {product.sku}
                          </p>
                        </div>
                      </div>

                      {/* 3D Stock Meter & Availability Badge */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1.5 font-extrabold text-red-600">
                              <span className="h-2 w-2 rounded-full bg-red-500" />
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1.5 font-extrabold text-amber-600">
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                              Hurry! Only {product.stock_quantity} left
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-700">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              In Stock ({product.stock_quantity} available)
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-slate-500">
                            {product.stock_quantity} units
                          </span>
                        </div>

                        {/* 3D Progress Bar */}
                        <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden p-0.5 shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOut
                                ? "w-0 bg-red-400"
                                : isLow
                                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                                  : "bg-gradient-to-r from-[#2563EB] to-emerald-500"
                            }`}
                            style={{ width: `${isOut ? 0 : Math.max(12, stockPercent)}%` }}
                          />
                        </div>
                      </div>

                      {/* Add to Cart / Quantity Stepper Action */}
                      <div className="pt-2 border-t border-slate-100">
                        {isOut ? (
                          <button
                            type="button"
                            disabled
                            className="w-full py-2 px-3 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed border border-slate-200 text-center"
                          >
                            Out of Stock
                          </button>
                        ) : cartQty > 0 ? (
                          <div className="flex items-center justify-between bg-blue-50/90 border border-blue-200 rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQuantity(product.id, cartQty - 1)
                              }
                              className="h-8 w-8 rounded-lg bg-white border border-blue-200 text-blue-700 font-black flex items-center justify-center hover:bg-blue-100 transition active:scale-95 cursor-pointer text-sm shadow-2xs"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="font-black text-xs text-blue-900">
                              {cartQty} in cart
                            </span>
                            <button
                              type="button"
                              disabled={cartQty >= product.stock_quantity}
                              onClick={() =>
                                updateCartQuantity(product.id, cartQty + 1)
                              }
                              className={`h-8 w-8 rounded-lg bg-[#2563EB] text-white font-black flex items-center justify-center hover:bg-blue-700 transition active:scale-95 text-sm shadow-2xs ${
                                cartQty >= product.stock_quantity
                                  ? "opacity-50 cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="btn-3d-primary w-full py-2.5 px-3 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add to Cart</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 2: MY PURCHASES & BILL RECEIPTS
            ==================================================================== */}
        {activeTab === "purchases" && currentCustomer && (
          <div className="space-y-4">
            {sales.length === 0 ? (
              <div className="card-3d-static rounded-2xl p-12 text-center space-y-2">
                <ReceiptText className="h-8 w-8 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-[#111827]">
                  No purchases recorded yet for {currentCustomer.name}
                </div>
                <p className="text-xs text-slate-500">
                  Whenever you buy snacks at the canteen under your name/room, your bills and receipts will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="card-3d rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-lg bg-[#EFF6FF] border border-blue-200 px-2.5 py-1 text-xs font-black font-mono text-[#1D4ED8]">
                          {sale.bill_number}
                        </span>
                        <PaymentStatusBadge status={sale.payment_status} />
                        {sale.sale_status !== "Completed" && (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800">
                            {sale.sale_status}
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-medium">
                          {formatIST(sale.created_at)}
                        </span>
                      </div>

                      {/* Items Purchased */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {sale.items.map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#111827]"
                          >
                            <span>{item.product_name_snapshot}</span>
                            <span className="rounded bg-white px-1.5 py-0.2 text-[10px] font-extrabold text-[#2563EB]">
                              x{item.quantity}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              ({formatINR(item.final_line_total)})
                            </span>
                          </span>
                        ))}
                      </div>

                      {/* Discount / Payment Method Note */}
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                        {sale.total_discount_amount > 0 && (
                          <span className="text-emerald-700 font-bold">
                            Discount Saved: {formatINR(sale.total_discount_amount)}
                          </span>
                        )}
                        <span>
                          Payment Mode:{" "}
                          <strong className="text-slate-700">
                            {sale.payment_methods_summary || "Pending / Udhaar"}
                          </strong>
                        </span>
                        {sale.upi_references_summary && (
                          <span className="font-mono">
                            UTR: {sale.upi_references_summary}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Price Breakdown & Receipt Button */}
                    <div className="flex sm:flex-col items-end justify-between w-full sm:w-auto gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-slate-500">Bill Total</div>
                        <div className="text-xl font-black text-[#111827]">
                          {formatINR(sale.payable_amount)}
                        </div>
                        {sale.outstanding_amount > 0 ? (
                          <div className="text-[11px] font-bold text-amber-600">
                            Due: {formatINR(sale.outstanding_amount)}
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-emerald-600">
                            Paid: {formatINR(sale.paid_amount)}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setReceiptSale(sale)}
                        className="btn-3d-secondary rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ReceiptText className="h-3.5 w-3.5 text-[#2563EB]" />
                        <span>View Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 3: MY UDHAAR & PAYMENTS LEDGER
            ==================================================================== */}
        {activeTab === "ledger" && currentCustomer && (
          <div className="card-3d-static rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-white">
              <div>
                <h3 className="text-sm font-extrabold text-[#111827]">
                  Chronological Room Passbook — {currentCustomer.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Every snack purchase, UPI/cash payment, and running balance in order.
                </p>
              </div>
              <div className="rounded-xl bg-[#EFF6FF] border border-blue-200 px-3.5 py-2 text-xs font-bold text-[#1D4ED8]">
                Current Balance Due:{" "}
                <span className="font-black">
                  {formatINR(currentCustomer.outstanding_dues)}
                </span>
              </div>
            </div>

            {ledger.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No ledger entries recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase text-slate-600">
                      <th className="py-3 px-4">Date &amp; Time</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Ref / Bill</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4 text-right">Purchase (+)</th>
                      <th className="py-3 px-4 text-right">Paid (-)</th>
                      <th className="py-3 px-4 text-right">Due Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {ledger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-blue-50/40 transition">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                          {formatIST(entry.date)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                              entry.type === "PURCHASE"
                                ? "bg-blue-50 text-[#1D4ED8] border border-blue-200"
                                : entry.type === "PAYMENT"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#111827]">
                          {entry.reference_bill}
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-md">
                          {entry.description}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#111827]">
                          {entry.debit_purchase > 0
                            ? `+${formatINR(entry.debit_purchase)}`
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          {entry.credit_payment > 0
                            ? `-${formatINR(entry.credit_payment)}`
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-[#111827]">
                          {formatINR(entry.balance_after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================================
          STUDENT SWITCHER / ROOM LOGIN MODAL
          ====================================================================== */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="card-3d-static w-full max-w-md rounded-2xl p-6 space-y-5 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl orb-3d-blue flex items-center justify-center text-white">
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#111827]">
                    {authMode === "signin"
                      ? "Student Canteen Sign In"
                      : "Register as New Student"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {authMode === "signin"
                      ? "Enter your name and mobile password"
                      : "Create your student passbook account"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSwitchModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setLoginError(null);
                }}
                className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                  authMode === "signin"
                    ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setLoginError(null);
                }}
                className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                  authMode === "register"
                    ? "bg-white text-emerald-700 shadow-xs border border-emerald-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                + Register New Student
              </button>
            </div>

            {loginError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Secure Sign In / Register Form */}
            <form onSubmit={handleSelfLogin} className="space-y-3.5 text-xs">
              {authMode === "signin" ? (
                /* ================= SIGN IN ================= */
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Student Name or Room Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="e.g. Aarav Sharma or B-204"
                      className="input-3d w-full rounded-xl px-3 py-2 text-xs text-[#111827]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Password *
                      </label>
                      <span className="text-[10px] text-blue-600 font-semibold">
                        🔒 Portal password
                      </span>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your custom password"
                        maxLength={30}
                        className="input-3d w-full rounded-xl pl-9 pr-9 py-2 text-xs text-[#111827]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-[#111827] cursor-pointer"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ================= REGISTER ================= */
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Rohan Sharma"
                      className="input-3d w-full rounded-xl px-3 py-2 text-xs text-[#111827]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Hostel Room No. *
                      </label>
                      <input
                        type="text"
                        required
                        value={regRoom}
                        onChange={(e) => setRegRoom(e.target.value)}
                        placeholder="e.g. B-204"
                        className="input-3d w-full rounded-xl px-3 py-2 text-xs text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Mobile Number (Optional)
                      </label>
                      <input
                        type="tel"
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value)}
                        placeholder="10-digit mobile (optional)"
                        maxLength={10}
                        className="input-3d w-full rounded-xl px-3 py-2 text-xs text-[#111827]"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Create Password *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        {showRegPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Create a private password (min 3 chars)"
                        minLength={3}
                        maxLength={30}
                        className="input-3d w-full rounded-xl pl-9 pr-9 py-2 text-xs text-[#111827]"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    🔒 You will use your Name/Room and this password to sign in. Keep it private.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingLogin}
                className="btn-3d-primary w-full rounded-xl py-2.5 text-xs font-bold cursor-pointer"
              >
                {submittingLogin
                  ? "Verifying..."
                  : authMode === "signin"
                  ? "Sign In to My Passbook"
                  : "Register & Open Passbook"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-xl mx-auto z-40 animate-in slide-in-from-bottom duration-200">
          <div className="card-3d bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="truncate">
                <div className="font-extrabold text-sm flex items-center gap-2">
                  <span>
                    {totalCartItems} {totalCartItems === 1 ? "Item" : "Items"}
                  </span>
                  <span className="text-slate-400 font-normal">•</span>
                  <span className="text-emerald-400 font-black">
                    {formatINR(cartGrandTotal)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  {roomDelivery
                    ? `Room Delivery to ${deliveryRoom ? `Room ${deliveryRoom}` : "Room"} (+₹20)`
                    : "Self Pickup at Canteen (FREE)"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="btn-3d-primary py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black text-white shrink-0 shadow-lg flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 transition"
            >
              <span>View Cart</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Shopping Cart & Room Delivery Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#F8FAFC] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    My Snack Cart
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {totalCartItems}{" "}
                    {totalCartItems === 1 ? "snack item" : "snack items"} selected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="h-16 w-16 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Your cart is empty
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Browse our live snack catalog and click &quot;Add to Cart&quot; to order!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="btn-3d-primary py-2 px-4 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    Browse Snacks
                  </button>
                </div>
              ) : (
                <>
                  {/* Cart Items List */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>Selected Items</span>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-red-600 hover:text-red-700 cursor-pointer font-bold lowercase text-xs"
                      >
                        clear cart
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl bg-slate-50/50 overflow-hidden">
                      {cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="p-3 flex items-center justify-between gap-3 bg-white first:border-t-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 p-1">
                              {item.product.image_url ? (
                                <img
                                  src={item.product.image_url}
                                  alt={item.product.name}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <Package className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-xs text-slate-900 truncate">
                                {item.product.name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatINR(item.product.selling_price)} each
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Stepper */}
                            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartQuantity(
                                    item.product.id,
                                    item.quantity - 1
                                  )
                                }
                                className="h-6 w-6 rounded bg-white text-slate-700 flex items-center justify-center font-bold text-xs hover:bg-slate-200 cursor-pointer shadow-2xs"
                              >
                                -
                              </button>
                              <span className="w-5 text-center font-black text-xs text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={
                                  item.quantity >= item.product.stock_quantity
                                }
                                onClick={() =>
                                  updateCartQuantity(
                                    item.product.id,
                                    item.quantity + 1
                                  )
                                }
                                className={`h-6 w-6 rounded bg-white text-slate-700 flex items-center justify-center font-bold text-xs hover:bg-slate-200 shadow-2xs ${
                                  item.quantity >= item.product.stock_quantity
                                    ? "opacity-40 cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                +
                              </button>
                            </div>

                            <span className="font-black text-xs text-slate-900 w-14 text-right">
                              {formatINR(
                                item.product.selling_price * item.quantity
                              )}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                updateCartQuantity(item.product.id, 0)
                              }
                              className="text-slate-400 hover:text-red-600 transition cursor-pointer p-1"
                              title="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ROOM DELIVERY OPTION - 20 RUPEES CHARGE */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Delivery Option
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Room Delivery Card */}
                      <button
                        type="button"
                        onClick={() => setRoomDelivery(true)}
                        className={`text-left p-3.5 rounded-xl border-2 transition cursor-pointer relative ${
                          roomDelivery
                            ? "border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck
                              className={`h-4 w-4 ${
                                roomDelivery
                                  ? "text-blue-600"
                                  : "text-slate-500"
                              }`}
                            />
                            <span className="font-extrabold text-xs text-slate-900">
                              Room Delivery
                            </span>
                          </div>
                          <span className="rounded-full bg-blue-600 text-white px-2 py-0.5 text-[10px] font-black shadow-xs">
                            +₹20
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                          Delivered straight to your hostel room door (+₹20 fee).
                        </p>
                      </button>

                      {/* Self Pickup Card */}
                      <button
                        type="button"
                        onClick={() => setRoomDelivery(false)}
                        className={`text-left p-3.5 rounded-xl border-2 transition cursor-pointer relative ${
                          !roomDelivery
                            ? "border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DoorOpen
                              className={`h-4 w-4 ${
                                !roomDelivery
                                  ? "text-emerald-600"
                                  : "text-slate-500"
                              }`}
                            />
                            <span className="font-extrabold text-xs text-slate-900">
                              Self Pickup
                            </span>
                          </div>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                            FREE
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                          Collect in person directly from the canteen counter.
                        </p>
                      </button>
                    </div>

                    {/* Room Number & Delivery Notes (if Room Delivery selected) */}
                    {roomDelivery && (
                      <div className="rounded-xl bg-blue-50/80 border border-blue-200/80 p-3.5 space-y-2.5 animate-in fade-in duration-150">
                        <div>
                          <label className="text-[11px] font-extrabold text-blue-950 block mb-1">
                            Hostel Room Number *
                          </label>
                          <input
                            type="text"
                            required
                            value={deliveryRoom}
                            onChange={(e) => setDeliveryRoom(e.target.value)}
                            placeholder="e.g. Room 110, B-204"
                            className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-600 block mb-1">
                            Delivery Instructions (Optional)
                          </label>
                          <input
                            type="text"
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                            placeholder="e.g. Call upon arrival / knock on door"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Payment Mode
                    </span>

                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setOrderPaymentMethod("Cash")}
                        className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                          orderPaymentMethod === "Cash"
                            ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-extrabold ring-2 ring-emerald-400/30 shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <CreditCard className="h-5 w-5 mx-auto mb-1 text-emerald-700" />
                        <span className="text-xs font-extrabold">Cash on Delivery</span>
                        <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
                          {roomDelivery ? "Pay at room door" : "Pay at counter"}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrderPaymentMethod("UPI")}
                        className={`p-3 rounded-xl border text-center transition cursor-pointer relative ${
                          orderPaymentMethod === "UPI"
                            ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-500 text-blue-950 font-extrabold ring-2 ring-blue-500/40 shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="absolute -top-2 right-2 rounded-full bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 shadow-xs uppercase tracking-wider animate-pulse">
                          QR Available
                        </span>
                        <QrCode className="h-5 w-5 mx-auto mb-1 text-blue-700" />
                        <span className="text-xs font-extrabold">UPI Payment</span>
                        <div className="text-[10px] text-blue-700 font-bold mt-0.5">
                          Pay now via QR Code
                        </div>
                      </button>
                    </div>

                    {/* HIGHLY HIGHLIGHTED UPI QR CODE CARD */}
                    {orderPaymentMethod === "UPI" && (
                      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-4 text-white shadow-xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200 border border-blue-400/40">
                        {/* Header & QR Badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shadow-xs">
                              <QrCode className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <div className="font-black text-xs tracking-tight">
                                Canteen UPI Payment QR
                              </div>
                              <div className="text-[10px] text-blue-100">
                                Scan &amp; Pay Instantly
                              </div>
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-400 text-emerald-950 font-black text-xs px-3 py-1 shadow-xs">
                            Pay {formatINR(cartGrandTotal)}
                          </span>
                        </div>

                        {/* High Visibility Framed QR Image Container */}
                        <div className="bg-white rounded-2xl p-3 text-center shadow-md">
                          <div
                            className="relative group cursor-pointer inline-block"
                            onClick={() => setShowPortalQrModal(true)}
                            title="Click to view full size QR code"
                          >
                            <img
                              src="/canteen-upi-qr.jpg"
                              alt="Hostel Canteen UPI QR Code"
                              className="w-48 h-48 mx-auto rounded-xl object-contain shadow-xs bg-white p-1 transition-transform group-hover:scale-102"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold text-xs gap-1.5 backdrop-blur-2xs">
                              <Maximize2 className="h-4 w-4" />
                              <span>Tap to Enlarge</span>
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowPortalQrModal(true)}
                              className="btn-3d-primary inline-flex items-center gap-1.5 text-xs font-black text-white py-1.5 px-3 rounded-xl cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                              <span>View Full Size QR</span>
                            </button>
                            <a
                              href="/canteen-upi-qr.jpg"
                              download="Hostel_Canteen_UPI_QR.jpg"
                              className="btn-3d-secondary inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 py-1.5 px-3 rounded-xl cursor-pointer transition shadow-2xs"
                            >
                              <Download className="h-3.5 w-3.5 text-blue-600" />
                              <span>Download</span>
                            </a>
                          </div>

                          <div className="mt-2 text-[10px] text-slate-500 font-bold flex items-center justify-center gap-1">
                            <span>PhonePe</span> • <span>GPay</span> • <span>Paytm</span> • <span>BHIM UPI</span>
                          </div>
                        </div>

                        {/* 12-Digit UTR Input Form */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[11px] font-black text-white block">
                            Enter 12-Digit UPI Reference (UTR) *
                          </label>
                          <input
                            type="text"
                            required
                            value={orderUpiRef}
                            onChange={(e) => setOrderUpiRef(e.target.value)}
                            placeholder="e.g. 331298457610 (from payment receipt)"
                            className="w-full rounded-xl border border-white/40 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-white shadow-sm placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                          />
                          <p className="text-[10px] text-blue-100 font-medium">
                            ✓ Open GPay/PhonePe/Paytm &rarr; scan QR &rarr; pay {formatINR(cartGrandTotal)} &rarr; copy UTR number here.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bill Summary */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Items Subtotal</span>
                      <span className="font-bold text-slate-800">
                        {formatINR(cartSubtotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Room Delivery Fee</span>
                      {roomDelivery ? (
                        <span className="font-bold text-blue-700">+₹20.00</span>
                      ) : (
                        <span className="font-bold text-emerald-700">FREE</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
                      <span className="font-black text-slate-900">
                        Total Payable
                      </span>
                      <span className="font-black text-base text-[#2563EB]">
                        {formatINR(cartGrandTotal)}
                      </span>
                    </div>
                  </div>

                  {orderError && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                      <span>{orderError}</span>
                    </div>
                  )}

                  {/* Place Order CTA */}
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={placingOrder}
                      onClick={handlePlaceOrder}
                      className="btn-3d-primary w-full py-3 px-4 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition cursor-pointer"
                    >
                      {placingOrder ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Placing Your Order...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            Place Order • {formatINR(cartGrandTotal)}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmation Modal */}
      {orderSuccessSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Order Confirmed
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">
                Order #{orderSuccessSale.bill_number}
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                {orderSuccessSale.notes?.includes("ROOM DELIVERY")
                  ? "Your snacks are being prepared and will be delivered to your room shortly!"
                  : "Your order is confirmed! Please collect your snacks from the canteen counter."}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-left space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Student:</span>
                <span className="font-bold text-slate-900">
                  {orderSuccessSale.customer_name_snapshot}
                </span>
              </div>
              {orderSuccessSale.room_number_snapshot && (
                <div className="flex justify-between text-slate-600">
                  <span>Room:</span>
                  <span className="font-bold text-blue-700">
                    Room {orderSuccessSale.room_number_snapshot}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Total Amount:</span>
                <span className="font-black text-slate-900">
                  {formatINR(orderSuccessSale.payable_amount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Payment:</span>
                <span className="font-semibold text-slate-800">
                  {orderSuccessSale.payment_methods_summary}
                </span>
              </div>
            </div>

            {/* Live Order Alerts Prompt */}
            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-3 text-left flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <BellRing className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="text-[11px] text-blue-900 leading-tight">
                  <span className="block font-black">Enable Order Alerts</span>
                  <span className="text-[10px] text-blue-700">Get notified when food is ready / delivered</span>
                </div>
              </div>
              <StudentNotificationButton
                customerId={currentCustomer?.id || orderSuccessSale.customer_id}
                customerName={currentCustomer?.name || orderSuccessSale.customer_name_snapshot}
                compact
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setReceiptSale(orderSuccessSale);
                  setOrderSuccessSale(null);
                }}
                className="btn-3d-secondary flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ReceiptText className="h-4 w-4 text-blue-600" />
                <span>View Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderSuccessSale(null)}
                className="btn-3d-primary flex-1 py-2.5 px-3 rounded-xl text-xs font-black text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen High-Visibility UPI QR Modal */}
      {showPortalQrModal && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-3d bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowPortalQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 mb-3 border border-blue-200 shadow-xs">
              <QrCode className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Hostel Canteen UPI QR</h3>
            <div className="mt-1 inline-block rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black px-3 py-1">
              Amount to Pay: {formatINR(cartGrandTotal)}
            </div>
            <div className="mt-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 shadow-inner inline-block">
              <img
                src="/canteen-upi-qr.jpg"
                alt="Hostel Canteen UPI QR Code"
                className="w-64 h-64 mx-auto rounded-xl object-contain shadow-xs bg-white p-1"
              />
            </div>
            <div className="mt-3 text-[11px] font-black text-slate-600 bg-slate-100 rounded-xl py-1.5 px-3">
              PhonePe • Google Pay • Paytm • BHIM UPI
            </div>
            <div className="mt-4 flex gap-2">
              <a
                href="/canteen-upi-qr.jpg"
                download="Hostel_Canteen_UPI_QR.jpg"
                className="btn-3d-secondary flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-800 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                <span>Save Image</span>
              </a>
              <button
                type="button"
                onClick={() => setShowPortalQrModal(false)}
                className="btn-3d-primary flex-1 py-2.5 text-xs font-black text-white cursor-pointer"
              >
                Back to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal for Students */}
      <ReceiptModal
        sale={receiptSale}
        onClose={() => setReceiptSale(null)}
      />
    </div>
  );
}
