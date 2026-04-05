/**
 * CookieConsent — GDPR-style cookie consent banner
 * Appears at the bottom of the screen on first visit (global floating).
 * Saves the user's choice to localStorage.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const COOKIE_CONSENT_KEY = "cookie_consent";

export type CookieConsentValue = "accepted" | "declined" | null;

export const getCookieConsent = (): CookieConsentValue => {
  try {
    return (localStorage.getItem(COOKIE_CONSENT_KEY) as CookieConsentValue) ?? null;
  } catch {
    return null;
  }
};

export const setCookieConsent = (value: "accepted" | "declined") => {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // ignore
  }
};

/** Global floating banner — shown on every page until user responds */
export const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const handleAccept = () => {
    setCookieConsent("accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    setCookieConsent("declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-0 inset-x-0 z-50 flex justify-center p-3 sm:p-4 pointer-events-none"
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-2xl",
          "rounded-t-2xl sm:rounded-2xl sm:mb-3 shadow-elevated",
          "border border-border bg-card text-card-foreground",
          "animate-in slide-in-from-bottom-4 duration-300"
        )}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 sm:p-5">
          <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="flex-1 text-sm leading-relaxed">
            <p className="font-semibold text-foreground mb-0.5">
              אנחנו משתמשים בעוגיות (Cookies)
            </p>
            <p className="text-muted-foreground text-xs">
              האתר משתמש בעוגיות לשיפור חווית המשתמש ושמירת העדפות.{" "}
              <Link to="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors" onClick={handleDecline}>
                מדיניות פרטיות
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleDecline}>
              <X className="w-3 h-3" /> דחה
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1 bg-primary hover:bg-primary/90" onClick={handleAccept}>
              <Check className="w-3 h-3" /> קבל הכל
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

