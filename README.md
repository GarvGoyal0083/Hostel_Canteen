# Hostel Canteen POS — Complete Canteen Management System

A full-stack, modern, responsive Point-of-Sale (POS), Inventory, Customer Udhaar, Manual Cash/UPI Payment, Expense, and Profit Management web application built with **Next.js (App Router), React, TypeScript, Tailwind CSS, and Supabase PostgreSQL**.

> **Zero Payment Gateways by Design:** No Razorpay, Cashfree, or PhonePe Payment Gateway API keys are required or integrated. All Cash and UPI payments (Google Pay, PhonePe, Paytm, etc.) and UTR / transaction reference numbers are entered manually by the admin, flagged clearly as manually recorded, and checked automatically for duplicate UTR warnings.

---

## ✨ Key Capabilities & Modern Features

### 🛒 High-Speed Point of Sale (POS) & Fast Billing
- **One-Click Fast Billing:** Always accessible via the highlighted top bar button and sidebar for lightning-fast order checkout.
- **AI Snack Photo Scanner:** Point your phone camera or upload a photo of a snack to instantly recognize the product and add it to the cart.
- **Smart Split Payments:** Accept payments split across Cash, Manual UPI (with UTR tracking and duplicate UTR alerts), and Customer Udhaar (Dues) on the same bill.
- **Discounts & Receipts:** Apply percentage (`%`) or flat (`₹`) discounts with thermal printable, digital 3D receipts and bill cancellation / refund protections.

### 🔒 Customer Counter Privacy Mode (One-Click Hide Analytics)
- **Instant Privacy:** A single click on the **Hide Analytics** button (located next to the `Shop Operating Status` banner and in the sticky header) conceals all sensitive business finances.
- **Masked Data:** Replaces period net sales, net profit, gross profit, cash/UPI collections, wholesale/retail inventory valuations, COGS, 3D chart pillars, product revenue, and transaction amounts with `₹••••`.
- **Persistent State:** Saves the operator's privacy preference in `localStorage` (`hc_privacy_mode`) across sessions.

### 📱 Dedicated Student / Customer Portal (`/customer`)
- **Self-Service Student View:** Students can log in to check their real-time outstanding balance, review their complete itemized purchase history, and inspect the live canteen menu with real-time stock availability.
- **Custom Password Authentication:** Student accounts use secure custom passwords with mobile number as an optional field.
- **Admin Password & Profile Management:** Admins can view/show passwords, reset passwords, and update room numbers or details directly from the **Customers** module.

### 🏪 Shop Operating Status Control
- **Live Status Toggle:** Switch the canteen between **Shop Open**, **Closed (Rest of Day)**, or **Closed with Custom Reopening Time** (e.g., `05:30 PM`, `Tomorrow 08:00 AM`).
- **Instant Customer Notice:** Students visiting the portal or menu immediately see the active status and scheduled reopening time.

### 📱 Official Canteen UPI QR Code
- **Counter QR Modal:** Prominently featured highlighted **UPI QR Code** button on the dashboard.
- **Any UPI App:** Customers can scan directly using PhonePe, Google Pay, Paytm, BHIM, or any banking UPI app.
- **One-Click Download:** Built-in download option for printing or displaying counter QR standees.

### 📊 Financial Analytics & 12 Detailed Accounting Reports
- **Real-Time KPI Cards:** Today's sales, weekly sales, monthly sales, gross sales, discounts, refunds, COGS, gross profit, operating expenses, net profit, and total collections.
- **3D Interactive Charts:** Day-by-day pillar visualization of sales vs. profits and cash vs. UPI collections in IST time.
- **Full CSV Exports:** Clean, multi-column CSV exports with headers across Expenses, Sales, Inventory Ledger, Customers/Udhaar, Manual Payments, and the complete 12 Reports Suite.

---

## 1. Setup & Installation Instructions

### Prerequisites
- **Node.js** `v18.18+` (tested on `v20+` and `v24+`)
- **npm** `v9+`

### Step-by-Step Local Setup
1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/GarvGoyal0083/Hostel_Canteen.git
   cd Hostel_Canteen
   npm install
   ```
2. **Configure environment variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. **Open the application:**
   Visit `http://localhost:3000` in your browser.
   - **Default Admin Email:** `admin@hostelcanteen.local`
   - **Default Admin Password:** `ChangeThisStrongPassword!2026`
   - **Student / Customer View:** `http://localhost:3000/customer`

---

## 2. Supabase Configuration Instructions

The project includes complete PostgreSQL schema, Row Level Security (RLS) policies, financial deletion-prevention triggers, and atomic PL/pgSQL transaction functions in `supabase/migrations/`.

1. Create a project at [https://supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Run the migrations in order:
   - Run `supabase/migrations/001_initial_schema.sql` (creates `users`, `products`, `customers`, `daily_bill_counters`, `sales`, `sale_items`, `payments`, `inventory_movements`, `expenses`, `refunds_cancellations`, `audit_logs`, triggers, and RLS policies).
   - Run `supabase/migrations/002_atomic_rpc_functions.sql` (creates atomic row-locking stock and transaction RPCs).
4. In **Authentication -> Users**, create your admin account (e.g. `admin@yourdomain.com`) and insert a matching row into `public.users` with `role = 'admin'` and `is_active = true`:
   ```sql
   INSERT INTO public.users (email, full_name, role, is_active)
   VALUES ('admin@yourdomain.com', 'Hostel Canteen Owner', 'admin', true);
   ```
5. Copy your project credentials from **Project Settings -> API** into `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
   ```
   > **Security Rule:** `SUPABASE_SERVICE_ROLE_KEY` is strictly server-only (`src/lib/supabase/server.ts`) and is never exposed to client components or committed to Git.

---

## 3. Deployment Guide (Vercel)

1. Push your repository to GitHub (verify `.env.local` and local data files are in `.gitignore`).
2. Import the repository into [Vercel](https://vercel.com).
3. In Vercel **Project Settings -> Environment Variables**, configure:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_DEFAULT_EMAIL`
   - `ADMIN_DEFAULT_PASSWORD`
   - `SESSION_SECRET` (generate a random 64-character hex string)
   - `SEED_DEV_SAMPLE_DATA=false` (ensures production begins with a clean state)
4. Click **Deploy**.

---

## 4. Testing & Verification

### Automated Verification Suite
Run the automated test suite covering all business and accounting rules:
```bash
npm run test:pos
```
This suite verifies:
1. Clean Production Mode initialization (0 sample records)
2. Product creation, editing, SKU uniqueness, and automated unit profit calculation
3. Incoming stock purchases, damaged stock deductions, and oversell prevention
4. Billing subtotal, item-level & bill-level fixed (`₹`) and percentage (`%`) discounts
5. Split payments (e.g., Cash + Manual UPI + Udhaar) and manual UTR recording
6. Customer Udhaar ledger, partial repayments, and duplicate UPI reference warnings
7. Controlled bill cancellations & refunds with automated inventory restoration
8. COGS, Gross Profit, Operating Expenses, Net Profit calculations, CSV exports, and HMAC session security

### Production Build Verification
To verify TypeScript types and production compilation:
```bash
npx tsc --noEmit
npm run build
```

---

## 5. Backup & Data-Export Guidance

1. **Full JSON Database Snapshot:**
   Navigate to **Settings -> Backup & Data Export** and click **Download Full JSON Backup Snapshot** to download all products, inventory movements, customers, sales, payments, expenses, and audit logs.
2. **Module CSV Exports:**
   - **Products:** Click **Export Report** on the **Products** page.
   - **Inventory:** Export the **Opening & Closing Stock Reconciliation Ledger** or **Stock Movement History** from the **Inventory** page.
   - **Customers & Udhaar:** Click **Export Report** on the **Customers** page.
   - **Transactions:** Click **Export Report (CSV)** on the **Transactions** page.
   - **Manual Payments:** Click **Export Report** on the **Payments** page.
   - **Expenses:** Click **Export CSV** on the **Expenses** page.
   - **12 Reports Suite:** Export any of the financial reports in **Reports** to CSV.
3. **Clean Production Reset:**
   In **Settings**, click **Switch to Clean Production (0 Records)** before recording live hostel canteen sales to ensure test data is never mixed with real balances.
