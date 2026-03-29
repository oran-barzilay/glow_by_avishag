import { FormEvent, useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tryAdminLoginAsync } from "@/lib/adminAuth";

interface AdminLoginProps {
  onSuccess: () => void;
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      const ok = await tryAdminLoginAsync(password);
      if (ok) {
        onSuccess();
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" lang="he" className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold">כניסה לניהול</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          הזיני סיסמה כדי לגשת ללוח הבקרה
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium">
              סיסמה
            </label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-start pr-10"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-destructive">סיסמה שגויה</p>
            )}
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                מתחבר...
              </span>
            ) : "כניסה"}
          </Button>
        </form>
      </div>
    </div>
  );
}
