import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAdmin,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth";
import {
  ensureDatabaseSync,
  getCloudPersistenceStatus,
  getLastSyncError,
  readDatabase,
  withTransactionLock,
  writeDatabase,
} from "@/lib/db/store";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  const admin = await getAuthenticatedAdmin();
  if (admin) {
    if (admin.email.toLowerCase() === "nidhishmathur2007@gmail.com") {
      admin.full_name = "Nidhish Mathur (Founder)";
    } else if (admin.email.toLowerCase() === "garvgoyal927@gmail.com") {
      admin.full_name = "Garv Goyal (Co-Founder)";
    }
  }
  const db = await ensureDatabaseSync();
  return NextResponse.json({
    authenticated: Boolean(admin),
    admin,
    supabase_configured: isSupabaseConfigured(),
    supabase_cloud_synced: getCloudPersistenceStatus(),
    supabase_sync_error: getLastSyncError(),
    environment_mode: db.meta.environment_mode,
    available_admins: admin
      ? db.users
          .filter((u) => u.is_active)
          .map((u) => {
            let fullName = u.full_name;
            if (u.email.toLowerCase() === "nidhishmathur2007@gmail.com") {
              fullName = "Nidhish Mathur (Founder)";
            } else if (u.email.toLowerCase() === "garvgoyal927@gmail.com") {
              fullName = "Garv Goyal (Co-Founder)";
            }
            return { email: u.email, full_name: fullName, role: u.role };
          })
      : [],
    available_customers: admin
      ? db.customers
          .filter((c) => c.is_active)
          .map((c) => ({
            id: c.id,
            name: c.name,
            room_number: c.room_number,
            outstanding_dues: c.outstanding_dues,
          }))
      : [],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // 1. If Supabase Auth is configured, attempt Supabase signInWithPassword first
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error && data.user) {
          const adminUser = {
            id: data.user.id,
            email: data.user.email || email,
            full_name:
              (data.user.user_metadata?.full_name as string) ||
              email.split("@")[0] ||
              "Canteen Admin",
            role: "admin" as const,
            is_active: true,
            created_at: data.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const token = signSessionToken(adminUser);
          const res = NextResponse.json({ authenticated: true, admin: adminUser });
          res.cookies.set(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24,
          });
          return res;
        }
      }
    }

    // 2. Specific Authorized Admin Credentials Verification
    const AUTHORIZED_ADMINS: Record<
      string,
      { name: string; password: string | undefined; role: "admin" | "manager" }
    > = {
      "nidhishmathur2007@gmail.com": {
        name: "Nidhish Mathur (Founder)",
        password: process.env.ADMIN_NIDHISH_PASSWORD,
        role: "admin",
      },
      "garvgoyal927@gmail.com": {
        name: "Garv Goyal (Co-Founder)",
        password: process.env.ADMIN_GARV_PASSWORD,
        role: "admin",
      },
    };

    const authConfig = AUTHORIZED_ADMINS[email];
    if (!authConfig) {
      return NextResponse.json(
        {
          error:
            "Invalid admin email address. Access restricted to authorized canteen administrators.",
        },
        { status: 401 }
      );
    }

    if (!authConfig.password || password !== authConfig.password) {
      return NextResponse.json(
        {
          error:
            "Incorrect password for admin account. Access denied.",
        },
        { status: 401 }
      );
    }

    const db = await ensureDatabaseSync();
    let matchingUser = db.users.find(
      (u) => u.email.toLowerCase() === email && u.is_active
    );

    if (!matchingUser) {
      matchingUser = {
        id: `admin-${email.split("@")[0]}`,
        email,
        full_name: authConfig.name,
        role: authConfig.role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await withTransactionLock(() => {
        const currentDb = readDatabase();
        if (!currentDb.users.some((u) => u.email.toLowerCase() === email)) {
          currentDb.users.push(matchingUser!);
          writeDatabase(currentDb);
        }
      });
    } else if (matchingUser.full_name !== authConfig.name) {
      matchingUser.full_name = authConfig.name;
      await withTransactionLock(() => {
        const currentDb = readDatabase();
        const userInDb = currentDb.users.find(
          (u) => u.email.toLowerCase() === email
        );
        if (userInDb) {
          userInDb.full_name = authConfig.name;
          writeDatabase(currentDb);
        }
      });
    }

    await withTransactionLock(() => {
      const currentDb = readDatabase();
      currentDb.audit_logs.unshift({
        id: `aud-${Date.now()}`,
        entity_type: "AUTH",
        entity_id: matchingUser.id,
        action: "ADMIN_LOGIN",
        summary: `Admin "${matchingUser.full_name}" (${matchingUser.email}) signed in.`,
        performed_by: matchingUser.full_name,
        created_at: new Date().toISOString(),
      });
      writeDatabase(currentDb);
    });

    const token = signSessionToken(matchingUser);
    const res = NextResponse.json({
      authenticated: true,
      admin: matchingUser,
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase?.auth.signOut();
    } catch {
      // ignore
    }
  }
  const res = NextResponse.json({ authenticated: false });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
