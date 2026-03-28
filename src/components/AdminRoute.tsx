import { useState } from "react";
import { AdminLogin } from "@/components/AdminLogin";
import Admin from "@/pages/Admin";
import { isAdminAuthenticated, logoutAdmin } from "@/lib/adminAuth";

/**
 * Renders the admin dashboard only when a valid password was entered;
 * session is stored in localStorage until logout.
 */
export function AdminRoute() {
  const [authed, setAuthed] = useState(isAdminAuthenticated);

  const handleLogout = () => {
    logoutAdmin();
    setAuthed(false);
  };

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return <Admin onLogout={handleLogout} />;
}
