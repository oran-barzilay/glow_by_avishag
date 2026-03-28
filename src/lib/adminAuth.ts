/**
 * Client-side session for the admin dashboard.
 * Persists across visits via localStorage until logout.
 * For stronger security, validate on the server when a backend exists.
 */

const STORAGE_KEY = "glow-studio-admin-auth";

/** Prefer VITE_ADMIN_PASSWORD in .env; fallback for local/dev. */
const resolvePassword = (): string =>
  import.meta.env.VITE_ADMIN_PASSWORD ?? "i_am_shugi";

export function isAdminAuthenticated(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function tryAdminLogin(password: string): boolean {
  if (password === resolvePassword()) {
    localStorage.setItem(STORAGE_KEY, "1");
    return true;
  }
  return false;
}

export function logoutAdmin(): void {
  localStorage.removeItem(STORAGE_KEY);
}
