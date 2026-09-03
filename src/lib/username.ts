/** Shop logins use an Admin-assigned username + password (no email required). */
export const SHOP_LOGIN_DOMAIN = "shops.cloudcart.app";

/** Normalizes a shop username to a stable, email-safe handle. */
export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

/**
 * Deterministic synthetic email for a shop username so Supabase auth can be
 * reused without ever asking a shop for an email address.
 */
export function usernameToEmail(input: string): string {
  return `${normalizeUsername(input)}@${SHOP_LOGIN_DOMAIN}`;
}

/** Sign-in identifier: a real email stays as-is (super admins), a username is mapped. */
export function loginIdentifierToEmail(input: string): string {
  const value = input.trim();
  return value.includes("@") ? value.toLowerCase() : usernameToEmail(value);
}
