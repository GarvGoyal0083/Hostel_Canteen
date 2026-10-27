// The only accounts that can ever hold the admin role. Kept free of imports so both
// auth.ts and the store can use it without a circular dependency.
export const ADMIN_EMAILS = ["nidhishmathur2007@gmail.com", "garvgoyal927@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.trim().toLowerCase()));
}
