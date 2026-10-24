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
  { id: "dashboard", label: "1. Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "2. New Sale / POS", icon: ShoppingCart },
  { id: "products", label: "3. Products", icon: Package },
  { id: "inventory", label: "4. Inventory", icon: Boxes },
  { id: "customers", label: "5. Customers", icon: Users },
  { id: "transactions", label: "6. Transactions", icon: ReceiptText },
  { id: "payments", label: "7. Payments", icon: CreditCard },
  { id: "expenses", label: "8. Expenses", icon: Wallet },
  { id: "reports", label: "9. Reports", icon: BarChart3 },
  { id: "settings", label: "10. Settings", icon: Settings },
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F1F5F9] text-[#111827]">
      {/* Mobile 3D Header */}
      <div className="flex items-center justify-between bg-[#090D16] px-4 py-3 text-white lg:hidden border-b border-slate-800 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl orb-3d-blue p-1.5">
            <Store className="h-4 w-4 text-white" />
          </div>
          <span className="font-black text-sm tracking-tight">
            Hostel Canteen POS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusModalOpen(true)}
            className={`rounded-lg px-2 py-1 text-[10px] font-extrabold flex items-center gap-1.5 ${
              canteenStatus.is_open
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                canteenStatus.is_open ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span>{canteenStatus.is_open ? "Open" : "Closed"}</span>
          </button>
          <button
            onClick={() => setActiveTab("customer_portal")}
            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
          >
            Student View
          </button>
          <button
            onClick={() => setActiveTab("pos")}
            className="btn-3d-primary rounded-lg px-2.5 py-1 text-xs font-bold text-white"
          >
            + POS
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-1.5 text-gray-200 hover:bg-gray-800"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* 3D Floating Sidebar Navigation (10 Admin Modules + Student Portal Switcher) */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } lg:flex lg:w-68 lg:flex-col lg:fixed lg:inset-y-0 bg-white/95 backdrop-blur-md border-r-2 border-slate-200 shadow-xl z-40`}
      >
        {/* 3D Brand Header */}
        <div className="hidden lg:flex items-center gap-3.5 px-5 py-4 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/80">
          <div className="h-11 w-11 rounded-2xl orb-3d-blue flex items-center justify-center text-white shrink-0">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-[#111827] leading-tight">
                Hostel Canteen
              </span>
              <span className="rounded-md bg-[#EFF6FF] border border-blue-200 px-1.5 py-0.2 text-[9px] font-black text-[#2563EB]">
                3D POS
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Admin Command Center
            </div>
          </div>
        </div>

        {/* Quick 3D Action Buttons (Shop Status + New Sale + Student Portal View) */}
        <div className="p-3.5 border-b border-slate-200 space-y-2 bg-slate-50/50">
          {/* Shop Operating Status Widget */}
          <button
            type="button"
            onClick={() => setStatusModalOpen(true)}
            className={`w-full rounded-xl p-2.5 text-xs font-extrabold flex items-center justify-between transition cursor-pointer border shadow-2xs ${
              canteenStatus.is_open
                ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                : "bg-red-50 border-red-300 text-red-800 hover:bg-red-100"
            }`}
          >
            <div className="flex items-center gap-2 text-left">
              <span
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  canteenStatus.is_open
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <div className="truncate">
                <div className="text-[11px] font-black uppercase tracking-wider leading-none">
                  {canteenStatus.is_open ? "Shop Open" : "Shop Closed"}
                </div>
                <div className="text-[9px] text-slate-500 font-medium mt-0.5 truncate max-w-[140px]">
                  {canteenStatus.is_open
                    ? "Taking orders"
                    : canteenStatus.reopen_at || "Closed"}
                </div>
              </div>
            </div>
            <span className="rounded bg-white px-2 py-0.5 text-[9px] font-extrabold border border-slate-200 shadow-2xs">
              Change
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("pos");
              setMobileMenuOpen(false);
            }}
            className="btn-3d-primary w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Sale / Fast POS</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("customer_portal");
              setMobileMenuOpen(false);
            }}
            className="btn-3d-secondary w-full inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold text-slate-800 cursor-pointer"
          >
            <GraduationCap className="h-4 w-4 text-[#2563EB]" />
            <span>Open Student Portal</span>
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

        {/* 3D Admin Footer */}
        <div className="border-t border-slate-200 p-4 bg-gradient-to-b from-slate-50 to-slate-100 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <div className="font-extrabold text-[#111827] truncate">
                {admin.full_name}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {admin.email}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-3d-secondary rounded-xl p-2 text-slate-700 hover:text-red-600 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 bg-white/80 rounded-lg px-2.5 py-1.5 border border-slate-200">
            <Clock className="h-3 w-3 text-[#2563EB] shrink-0" />
            <LiveISTClock />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-68">
        {/* Top 3D Context & Quick Stats Bar */}
        <div className="hidden lg:block sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 shadow-2xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#EFF6FF] border border-blue-200 px-3 py-1 text-xs font-extrabold text-[#1D4ED8]">
                <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
                {SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.label ||
                  "Dashboard"}
              </span>
              {appData && (
                <div className="flex items-center gap-2 text-xs text-slate-500 pl-2">
                  <span>
                    Today:{" "}
                    <strong className="text-[#111827]">
                      {formatINR(appData.kpis.today_sales)}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Active Udhaar:{" "}
                    <strong className="text-[#2563EB]">
                      {formatINR(appData.kpis.customer_udhaar_total)}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
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
              <button
                onClick={() => setActiveTab("pos")}
                className="btn-3d-primary rounded-xl px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Fast Billing</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 sm:p-6">
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
                />
              )}

              {activeTab === "pos" && (
                <PosBillingView
                  products={appData.products}
                  customers={appData.customers}
                  adminName={admin.full_name}
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
