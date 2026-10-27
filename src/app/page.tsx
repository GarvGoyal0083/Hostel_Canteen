"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  ReceiptText,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  Clock,
  PlusCircle,
  GraduationCap,
  Sparkles,
  ScanLine,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  AdminUser,
  AuditLogRecord,
  CanteenStatus,
  Customer,
  ExpenseRecord,
  InventoryMovement,
  PaymentEntry,
  Product,
  ProductStockSummary,
  SaleRecord,
} from "@/types/pos";
import { formatINR, formatIST } from "@/lib/format";
import { LoginView } from "@/components/views/LoginView";
import { DashboardView } from "@/components/views/DashboardView";
import { PosBillingView } from "@/components/views/PosBillingView";
import { ProductsView } from "@/components/views/ProductsView";
import { InventoryView } from "@/components/views/InventoryView";
import { CustomersView } from "@/components/views/CustomersView";
import { TransactionsView } from "@/components/views/TransactionsView";
import { PaymentsView } from "@/components/views/PaymentsView";
import { ExpensesView } from "@/components/views/ExpensesView";
import { ReportsView } from "@/components/views/ReportsView";
import { SettingsView } from "@/components/views/SettingsView";
import { CustomerPortalView } from "@/components/views/CustomerPortalView";
import { CanteenStatusModal } from "@/components/CanteenStatusModal";
import { ReceiptModal } from "@/components/ReceiptModal";
import { CanteenLogo } from "@/components/CanteenLogo";

type NavTab =
  | "dashboard"
  | "pos"
  | "products"
  | "inventory"
  | "customers"
  | "transactions"
  | "payments"
  | "expenses"
  | "reports"
  | "settings"
  | "customer_portal";

const SIDEBAR_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "Fast POS Billing", icon: ShoppingCart },
  { id: "products", label: "Products & Snacks", icon: Package },
  { id: "inventory", label: "Inventory Stock", icon: Boxes },
  { id: "customers", label: "Students & Udhaar", icon: Users },
  { id: "transactions", label: "Sales & Receipts", icon: ReceiptText },
  { id: "payments", label: "Payments & Ledger", icon: CreditCard },
  { id: "expenses", label: "Expenses", icon: Wallet },
  { id: "reports", label: "Analytics & P&L", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const LiveISTClock = React.memo(function LiveISTClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => setTime(formatIST(new Date(), true));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="truncate">{time}</span>;
});

export default function HostelCanteenPosApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [customerModeActive, setCustomerModeActive] = useState(false);
  const [loggedInCustomer, setLoggedInCustomer] = useState<Customer | null>(
    null
  );

  const [availableAdmins, setAvailableAdmins] = useState<
    Array<{ email: string; full_name: string; role: string }>
  >([]);
  const [availableCustomers, setAvailableCustomers] = useState<
    Array<{
      id: string;
      name: string;
      room_number?: string | null;
      outstanding_dues: number;
    }>
  >([]);

  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedInventoryProductId, setSelectedInventoryProductId] = useState<
    string | null
  >(null);
  const [receiptSale, setReceiptSale] = useState<SaleRecord | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [scanTrigger, setScanTrigger] = useState(0);

  const [privacyMode, setPrivacyMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hc_privacy_mode") === "true";
    }
    return false;
  });

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("hc_privacy_mode", String(next));
      }
      return next;
    });
  }, []);

  const handleOpenScan = useCallback(() => {
    setActiveTab("pos");
    setScanTrigger((prev) => prev + 1);
  }, []);
  const [canteenStatus, setCanteenStatus] = useState<CanteenStatus>({
    is_open: true,
    closure_type: "open",
    closure_reason: "",
    reopen_at: null,
    updated_at: "",
    updated_by: "System",
  });

  const [dateFilter, setDateFilter] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: "",
    endDate: "",
  });

  // Main state fetched from /api/analytics
  const [appData, setAppData] = useState<{
    environment_mode: "development_sample" | "production_clean";
    supabase_configured: boolean;
    supabase_cloud_synced?: boolean;
    supabase_sync_error?: string | null;
    kpis: {
      today_sales: number;
      weekly_sales: number;
      monthly_sales: number;
      period_gross_sales: number;
      period_discounts: number;
      period_refunds: number;
      period_net_sales: number;
      period_cogs: number;
      period_gross_profit: number;
      period_expenses: number;
      period_net_profit: number;
      total_transactions: number;
      cash_collected: number;
      upi_collected: number;
      other_collected: number;
      total_collected: number;
      pending_payments_amount: number;
      pending_bills_count: number;
      customer_udhaar_total: number;
      total_products: number;
      active_products: number;
      current_inventory_value: number;
      current_retail_inventory_value: number;
      low_stock_count: number;
      out_of_stock_count: number;
      duplicate_upi_warnings_count: number;
    };
    alerts: {
      out_of_stock: Product[];
      low_stock: Product[];
    };
    best_selling_products: Array<{
      product_id: string;
      product_name: string;
      sku: string;
      category: string;
      units_sold: number;
      gross_revenue: number;
      discounts: number;
      net_revenue: number;
      cogs: number;
      estimated_profit: number;
    }>;
    daily_series: Array<{
      date: string;
      sales: number;
      cogs: number;
      gross_profit: number;
      expenses: number;
      net_profit: number;
      cash_collected: number;
      upi_collected: number;
      discounts: number;
      transactions_count: number;
    }>;
    recent_transactions: SaleRecord[];
    stock_summaries: ProductStockSummary[];
    customers: Customer[];
    sales: SaleRecord[];
    payments: PaymentEntry[];
    expenses: ExpenseRecord[];
    movements: InventoryMovement[];
    products: Product[];
    audit_logs: AuditLogRecord[];
  } | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter.startDate) params.set("startDate", dateFilter.startDate);
      if (dateFilter.endDate) params.set("endDate", dateFilter.endDate);

      const res = await fetch(`/api/analytics?${params.toString()}`);
      if (res.status === 401) {
        setAdmin(null);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setAppData(json);
        if (json.canteen_status) {
          setCanteenStatus(json.canteen_status);
        }
      }
    } catch {
      // ignore network error
    }
  }, [dateFilter.startDate, dateFilter.endDate]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          setAvailableAdmins(data.available_admins || []);
          setAvailableCustomers(data.available_customers || []);
          if (data.authenticated && data.admin) {
            setAdmin(data.admin);
          }
        }
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (admin) {
      fetchAllData();
    }
  }, [admin, fetchAllData]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAdmin(null);
    setAppData(null);
    setCustomerModeActive(false);
    setLoggedInCustomer(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090D16] text-xs font-bold text-slate-400">
        Loading Hostel Canteen 3D Terminal...
      </div>
    );
  }

  // If Customer / Student Portal mode is active (either via student login or admin preview)
  if (customerModeActive || activeTab === "customer_portal") {
    return (
      <CustomerPortalView
        initialCustomer={
          loggedInCustomer || (appData?.customers?.[0] ?? null)
        }
        isAdminPreview={Boolean(admin)}
        onBackToAdmin={
          admin
            ? () => {
                setCustomerModeActive(false);
                setActiveTab("dashboard");
              }
            : undefined
        }
        onExitToLogin={() => {
          setCustomerModeActive(false);
          setLoggedInCustomer(null);
          setActiveTab("dashboard");
        }}
      />
    );
  }

  if (!admin) {
    return (
      <LoginView
        availableAdmins={availableAdmins}
        availableCustomers={availableCustomers}
        onLoginSuccess={(loggedInAdmin) => setAdmin(loggedInAdmin)}
        onCustomerLoginSuccess={(customer) => {
          setLoggedInCustomer(customer);
          setCustomerModeActive(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F1F5F9] text-[#111827] w-full max-w-full overflow-x-hidden">
      {/* Mobile Top Header Bar */}
      <div className="bg-[#090D16] text-white lg:hidden border-b border-slate-800 shadow-md sticky top-0 z-30">
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <CanteenLogo className="h-7 w-7 shrink-0" size={28} />
            <div className="truncate">
              <span className="font-extrabold text-sm tracking-tight block leading-tight">
                Hostel Canteen
              </span>
              <span className="text-[10px] text-slate-400 font-semibold leading-none">
                POS &bull; {canteenStatus.is_open ? "Open" : "Closed"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab("pos")}
              className="btn-3d-primary rounded-xl px-3 py-1.5 text-xs font-black text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Billing</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl p-2 text-gray-200 hover:text-white bg-slate-800/80 border border-slate-700/80 cursor-pointer transition active:scale-95"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Secondary Action Strip */}
        <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 text-[11px]">
          <button
            onClick={() => setStatusModalOpen(true)}
            className={`flex-1 rounded-lg py-1 px-2 font-bold flex items-center justify-center gap-1 border transition ${
              canteenStatus.is_open
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/15 border-red-500/30 text-red-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                canteenStatus.is_open ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span className="truncate">{canteenStatus.is_open ? "Open" : "Closed"}</span>
          </button>

          <button
            onClick={handleOpenScan}
            className="flex-1 rounded-lg py-1 px-2 font-bold bg-blue-500/15 border border-blue-500/30 text-blue-300 flex items-center justify-center gap-1"
          >
            <ScanLine className="h-3 w-3" />
            <span>Scan</span>
          </button>

          <button
            onClick={() => setActiveTab("customer_portal")}
            className="flex-1 rounded-lg py-1 px-2 font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center gap-1"
          >
            <GraduationCap className="h-3 w-3" />
            <span>Student View</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-35 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Floating Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen
            ? "fixed inset-y-0 left-0 w-72 max-w-[85vw] z-40 flex flex-col bg-white shadow-2xl overflow-y-auto"
            : "hidden"
        } lg:flex lg:w-68 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 shadow-xs z-20`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <CanteenLogo className="h-9 w-9 shadow-sm" size={36} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 leading-tight">
                  Hostel Canteen
                </span>
                <span className="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                  POS
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Management Portal
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50/40">
          {/* Shop Operating Status Widget */}
          <button
            type="button"
            onClick={() => setStatusModalOpen(true)}
            className={`w-full rounded-xl p-2.5 text-xs font-semibold flex items-center justify-between transition cursor-pointer border ${
              canteenStatus.is_open
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-800 hover:bg-emerald-100/80"
                : "bg-red-50/80 border-red-200 text-red-800 hover:bg-red-100/80"
            }`}
          >
            <div className="flex items-center gap-2 text-left min-w-0">
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  canteenStatus.is_open
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <div className="truncate">
                <div className="text-[11px] font-bold uppercase tracking-wider leading-none">
                  {canteenStatus.is_open ? "Shop Open" : "Shop Closed"}
                </div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5 truncate max-w-[130px]">
                  {canteenStatus.is_open
                    ? "Taking orders"
                    : canteenStatus.reopen_at || "Closed"}
                </div>
              </div>
            </div>
            <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
              Change
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleOpenScan();
              setMobileMenuOpen(false);
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
          >
            <ScanLine className="h-4 w-4 text-blue-600" />
            <span>Scan Snack Photo</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("pos");
              setMobileMenuOpen(false);
            }}
            className="btn-3d-primary w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Fast POS Billing</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("customer_portal");
              setMobileMenuOpen(false);
            }}
            className="btn-3d-secondary w-full inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 cursor-pointer"
          >
            <GraduationCap className="h-4 w-4 text-[#2563EB]" />
            <span>Student Portal View</span>
          </button>
        </div>

        {/* 3D Navigation Links */}
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id !== "inventory") {
                    setSelectedInventoryProductId(null);
                  }
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold cursor-pointer ${
                  isActive
                    ? "nav-item-3d-active"
                    : "nav-item-3d text-[#111827]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-[#2563EB]" : "text-slate-500"
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.id === "inventory" &&
                  appData &&
                  appData.kpis.out_of_stock_count +
                    appData.kpis.low_stock_count >
                    0 && (
                    <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-900 shadow-2xs">
                      {appData.kpis.out_of_stock_count +
                        appData.kpis.low_stock_count}
                    </span>
                  )}
                {item.id === "customers" &&
                  appData &&
                  appData.kpis.pending_bills_count > 0 && (
                    <span className="rounded-full bg-blue-100 border border-blue-300 px-2 py-0.5 text-[10px] font-black text-[#1D4ED8] shadow-2xs">
                      {appData.kpis.pending_bills_count}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>

        {/* Admin Footer */}
        <div className="border-t border-slate-100 p-3.5 bg-slate-50/50 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <div className="font-bold text-slate-900 truncate text-xs">
                {admin.full_name}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {admin.email}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-3d-secondary rounded-lg p-2 text-slate-600 hover:text-red-600 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-white rounded-lg px-2.5 py-1.5 border border-slate-200">
            <Clock className="h-3 w-3 text-[#2563EB] shrink-0" />
            <LiveISTClock />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-68 w-full max-w-full overflow-x-hidden min-w-0">
        {/* Persistence Alert Banner if table is not yet set up in Supabase */}
        {appData?.supabase_configured && appData?.supabase_cloud_synced === false && (
          <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white px-5 py-2 text-xs font-bold flex items-center justify-between gap-3 shadow-sm sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />
              <span>
                <strong>Cloud Persistence Alert:</strong> Products and students are currently saved in temporary memory. Table <code>canteen_store</code> must be created in Supabase to save permanently.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className="bg-white text-red-900 rounded-lg px-2.5 py-1 text-[11px] font-black hover:bg-red-50 cursor-pointer shadow-xs shrink-0 transition"
            >
              Fix in Settings &rarr;
            </button>
          </div>
        )}

        {/* Top Context & Quick Stats Bar */}
        <div className="hidden lg:block sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-2.5 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700">
                <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
                {SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.label ||
                  "Dashboard"}
              </span>
              {appData && (
                <div className="flex items-center gap-2.5 text-xs text-slate-500 pl-1">
                  <span>
                    Today:{" "}
                    <strong className="text-slate-900 font-bold">
                      {privacyMode ? "₹••••" : formatINR(appData.kpis.today_sales)}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Pending Udhaar:{" "}
                    <strong className="text-blue-600 font-bold">
                      {privacyMode ? "₹••••" : formatINR(appData.kpis.customer_udhaar_total)}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {/* Scan Snack Button - Highly Accessible at Top of Page */}
              <button
                type="button"
                onClick={handleOpenScan}
                className="rounded-xl bg-blue-50/80 border border-blue-200 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100/80 flex items-center gap-2 cursor-pointer transition shadow-2xs hover:scale-[1.02] active:scale-95"
                title="Scan a snack photo with camera or file upload"
              >
                <ScanLine className="h-4 w-4 text-blue-600" />
                <span>Scan Snack</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusModalOpen(true)}
                className={`rounded-xl px-3 py-1.5 text-xs font-extrabold flex items-center gap-2 cursor-pointer border transition shadow-xs ${
                  canteenStatus.is_open
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                    : "bg-red-50 border-red-300 text-red-800 hover:bg-red-100"
                }`}
                title="Click to change shop status (closed for today, custom time, or open)"
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    canteenStatus.is_open ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                  }`}
                />
                <span>{canteenStatus.is_open ? "Shop: Open" : "Shop: Closed"}</span>
                {!canteenStatus.is_open && canteenStatus.reopen_at && (
                  <span className="text-[10px] text-red-700 font-semibold hidden xl:inline">
                    ({canteenStatus.reopen_at})
                  </span>
                )}
                <span className="rounded bg-white/90 px-1.5 py-0.2 text-[9px] font-extrabold border border-slate-200">
                  Manage
                </span>
              </button>

              <button
                onClick={() => setActiveTab("customer_portal")}
                className="btn-3d-secondary rounded-xl px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <GraduationCap className="h-4 w-4 text-[#2563EB]" />
                <span>Customer / Student View</span>
              </button>

              {/* Highlighted Fast Billing Primary Action */}
              <button
                onClick={() => setActiveTab("pos")}
                className="btn-3d-primary rounded-xl px-4 py-1.5 text-xs font-black flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/25 hover:scale-[1.03] active:scale-95 transition-all"
                title="Open Fast POS Billing"
              >
                <ShoppingCart className="h-4 w-4 text-white" />
                <span>Fast Billing</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-3 sm:p-6 w-full">
          {!appData ? (
            <div className="card-3d-static rounded-2xl p-12 text-center text-xs font-bold text-slate-500">
              Loading canteen 3D database records...
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <DashboardView
                  data={appData}
                  dateFilter={dateFilter}
                  onDateFilterChange={(startDate, endDate) =>
                    setDateFilter({ startDate, endDate })
                  }
                  onNavigate={(tab) => setActiveTab(tab as NavTab)}
                  onSelectReceipt={(sale) => setReceiptSale(sale)}
                  onRefresh={fetchAllData}
                  onOpenStatusModal={() => setStatusModalOpen(true)}
                  privacyMode={privacyMode}
                  onTogglePrivacyMode={togglePrivacyMode}
                />
              )}

              {activeTab === "pos" && (
                <PosBillingView
                  products={appData.products}
                  customers={appData.customers}
                  adminName={admin.full_name}
                  externalScanTrigger={scanTrigger}
                  onSaleCompleted={(newSale) => {
                    setReceiptSale(newSale);
                    fetchAllData();
                  }}
                />
              )}

              {activeTab === "products" && (
                <ProductsView
                  products={appData.products}
                  onRefresh={fetchAllData}
                  onNavigateToInventory={(productId) => {
                    setSelectedInventoryProductId(productId);
                    setActiveTab("inventory");
                  }}
                />
              )}

              {activeTab === "inventory" && (
                <InventoryView
                  products={appData.products}
                  summaries={appData.stock_summaries}
                  movements={appData.movements}
                  initialSelectedProductId={selectedInventoryProductId}
                  onRefresh={fetchAllData}
                />
              )}

              {activeTab === "customers" && (
                <CustomersView
                  customers={appData.customers}
                  onRefresh={fetchAllData}
                  onSelectReceipt={(sale) => setReceiptSale(sale)}
                />
              )}

              {activeTab === "transactions" && (
                <TransactionsView
                  sales={appData.sales}
                  onRefresh={fetchAllData}
                  onSelectReceipt={(sale) => setReceiptSale(sale)}
                />
              )}

              {activeTab === "payments" && (
                <PaymentsView
                  payments={appData.payments}
                  sales={appData.sales}
                  onRefresh={fetchAllData}
                />
              )}

              {activeTab === "expenses" && (
                <ExpensesView
                  expenses={appData.expenses}
                  kpis={appData.kpis}
                  onRefresh={fetchAllData}
                />
              )}

              {activeTab === "reports" && (
                <ReportsView
                  sales={appData.sales}
                  payments={appData.payments}
                  products={appData.products}
                  customers={appData.customers}
                  movements={appData.movements}
                  expenses={appData.expenses}
                  bestSellingProducts={appData.best_selling_products}
                  dailySeries={appData.daily_series}
                  kpis={appData.kpis}
                  dateFilter={dateFilter}
                  onDateFilterChange={(startDate, endDate) =>
                    setDateFilter({ startDate, endDate })
                  }
                />
              )}

              {activeTab === "settings" && (
                <SettingsView
                  admin={admin}
                  supabaseConfigured={appData.supabase_configured}
                  supabaseCloudSynced={appData.supabase_cloud_synced}
                  supabaseSyncError={appData.supabase_sync_error}
                  environmentMode={appData.environment_mode}
                  auditLogs={appData.audit_logs}
                  canteenStatus={canteenStatus}
                  onOpenStatusModal={() => setStatusModalOpen(true)}
                  onRefresh={fetchAllData}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Shop Operating Status Modal (Closed for Today, Custom Time, Reopen) */}
      <CanteenStatusModal
        isOpen={statusModalOpen}
        currentStatus={canteenStatus}
        onClose={() => setStatusModalOpen(false)}
        onStatusUpdated={(updated) => {
          setCanteenStatus(updated);
          fetchAllData();
        }}
      />

      {/* Printable & Downloadable Receipt Modal */}
      <ReceiptModal
        sale={receiptSale}
        onClose={() => setReceiptSale(null)}
      />
    </div>
  );
}
