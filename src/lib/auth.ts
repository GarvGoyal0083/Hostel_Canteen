import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AdminUser } from "@/types/pos";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const SESSION_COOKIE_NAME = "hc_pos_admin_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable is required in production. Set it to a long random string."
    );
  }
  return "hostel-canteen-pos-dev-only-session-secret";
}

export interface SessionPayload {
  user: AdminUser;
  exp: number;
}

export function signSessionToken(user: AdminUser, ttlHours = 24): string {
  const payload: SessionPayload = {
    user,
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

export async function getAuthenticatedAdmin(): Promise<AdminUser | null> {
  // 1. Check signed server session cookie first
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const verified = verifySessionToken(token);
    if (verified && verified.is_active) {
      return verified;
    }
  } catch {
    // Fallback if called outside Next.js request context (e.g. CLI test script)
  }

  // 2. If Supabase is configured, also check active Supabase Auth session
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && user.email) {
          return {
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
          };
        }
      }
    } catch {
      // Ignore Supabase session errors
    }
  }

  return null;
}

export async function requireAdminAuth(): Promise<
  | { authorized: true; admin: AdminUser }
  | { authorized: false; response: NextResponse }
> {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized: Admin login required to access Hostel Canteen POS records." },
        { status: 401 }
      ),
    };
  }
  return { authorized: true, admin };
}
