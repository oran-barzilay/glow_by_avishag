/**
 * Client-side session for the admin dashboard.
 * Persists across visits via localStorage until logout.
 * Password can be stored in DB (settings table) or .env fallback.
 */

import { getAdminPassword } from "@/services/api";

const STORAGE_KEY = "glow-studio-admin-auth";

/** Fallback password if DB has none */
const FALLBACK_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "i_am_shugi";

export function isAdminAuthenticated(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

/** Async login: checks DB first, falls back to env/hardcoded */
export async function tryAdminLoginAsync(password: string): Promise<boolean> {
  try {
    const dbPassword = await getAdminPassword();
    const correct = dbPassword ?? FALLBACK_PASSWORD;
    if (password === correct) {
      localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return false;
  } catch {
    // fallback to local
    if (password === FALLBACK_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return false;
  }
}

/** Sync fallback (for components that haven't migrated yet) */
export function tryAdminLogin(password: string): boolean {
  if (password === FALLBACK_PASSWORD) {
    localStorage.setItem(STORAGE_KEY, "1");
    return true;
  }
  return false;
}

export function logoutAdmin(): void {
  localStorage.removeItem(STORAGE_KEY);
}
