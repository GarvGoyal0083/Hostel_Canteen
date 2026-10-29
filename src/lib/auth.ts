import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AdminUser, UserRole } from "@/types/pos";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ensureDatabaseSync } from "@/lib/db/store";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/roles";

export { ADMIN_EMAILS, isAdminEmail };

// Roles allowed into the admin panel. Sales executives are deliberately not in this list.
const ADMIN_PANEL_ROLES: UserRole[] = ["admin", "manager", "staff"];

export function stripSecrets(user: AdminUser): AdminUser {
  const { password_hash: _omit, ...rest } = user;
  void _omit;
  return rest;
}

export const SESSION_COOKIE_NAME = "hc_pos_admin_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (secret) return secret;
  return "hostel-canteen-pos-stable-production-session-secret-2026";
}

export interface SessionPayload {
  user: AdminUser;
  exp: number;
}

export function signSessionToken(user: AdminUser, ttlHours = 24): string {
  const payload: SessionPayload = {
    user: stripSecrets(user),
    exp: Date.now() + ttlHours * 60 * 60 * 1000,
  };
  const base64Payload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(base64Payload)
    .digest("base64url");
  return `${base64Payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined): AdminUser | null {
  if (!token || !token.includes(".")) return null;
  const [base64Payload, signature] = token.split(".");
  if (!base64Payload || !signature) return null;

  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(base64Payload)
    .digest("base64url");

  if (signature.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(base64Payload, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!parsed || !parsed.user || Date.now() > parsed.exp) {
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

/**
 * Never trust the role / is_active inside the cookie (or a Supabase session):
 * on every request the user is re-read from db.users so deactivation and role
 * changes take effect immediately. An env-defined admin email with no stored
 * record yet is the only account allowed to proceed without one.
 */
async function resolveCurrentUser(candidate: AdminUser): Promise<AdminUser | null> {
  const email = candidate.email.toLowerCase();
  const db = await ensureDatabaseSync();
  const stored = db.users.find((u) => u.email.toLowerCase() === email);
  if (stored) {
    return stored.is_active ? stripSecrets(stored) : null;
  }
  if (isAdminEmail(email)) {
    return stripSecrets({ ...candidate, role: "admin", is_active: true });
  }
  return null;
}

export async function getAuthenticatedUser(): Promise<AdminUser | null> {
  // 1. Check signed server session cookie first
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const verified = verifySessionToken(token);
    if (verified) {
      return await resolveCurrentUser(verified);
    }
  } catch {
    // Fallback if called outside Next.js request context (e.g. CLI test script)
  }

  // 2. If Supabase is configured, also check active Supabase Auth session.
  //    Only the two admin emails (or a stored, active sales executive) are accepted.
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && user.email) {
          return await resolveCurrentUser({
            id: user.id,
            email: user.email,
            full_name:
              (user.user_metadata?.full_name as string) ||
              user.email.split("@")[0] ||
              "Canteen Admin",
            role: "admin",
            is_active: true,
            created_at: user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Ignore Supabase session errors
    }
  }

  return null;
}

/** Logged-in user if they belong in the admin panel (not a sales executive). */
export async function getAuthenticatedAdmin(): Promise<AdminUser | null> {
  const user = await getAuthenticatedUser();
  return user && ADMIN_PANEL_ROLES.includes(user.role) ? user : null;
}

const UNAUTHORIZED = "Unauthorized: Admin login required to access Hostel Canteen POS records.";

export async function requireAdminAuth(): Promise<
  | { authorized: true; admin: AdminUser }
  | { authorized: false; response: NextResponse }
> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: UNAUTHORIZED }, { status: 401 }),
    };
  }
  if (!ADMIN_PANEL_ROLES.includes(user.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden: your role does not have access to this resource." },
        { status: 403 }
      ),
    };
  }
  return { authorized: true, admin: user };
}

/** Any active logged-in user (admin or sales executive). */
export async function requireBillingAuth(): Promise<
  | { authorized: true; user: AdminUser }
  | { authorized: false; response: NextResponse }
> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: UNAUTHORIZED }, { status: 401 }),
    };
  }
  return { authorized: true, user };
}

/** Sales executives only. */
export async function requireExecutiveAuth(): Promise<
  | { authorized: true; user: AdminUser }
  | { authorized: false; response: NextResponse }
> {
  const auth = await requireBillingAuth();
  if (!auth.authorized) return auth;
  if (auth.user.role !== "sales_executive") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden: this resource is for sales executives only." },
        { status: 403 }
      ),
    };
  }
  return auth;
}
