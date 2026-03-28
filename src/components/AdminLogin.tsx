import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tryAdminLogin } from "@/lib/adminAuth";

interface AdminLoginProps {
  onSuccess: () => void;
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(false);
    if (tryAdminLogin(password)) {
      onSuccess();
    } else {
      setError(true);
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
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-start"
              dir="ltr"
            />
            {error && (
              <p className="mt-2 text-sm text-destructive">סיסמה שגויה</p>
            )}
          </div>
          <Button type="submit" variant="hero" className="w-full">
            כניסה
          </Button>
        </form>
      </div>
    </div>
  );
}
