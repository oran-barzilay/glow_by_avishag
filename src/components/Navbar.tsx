/**
 * Navbar Component
 * A simple, elegant top navigation bar with links to the main pages.
 * Uses React Router's Link for client-side navigation.
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Instagram, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "בית" },
  { to: "/booking", label: "הזמנת תור" },
  { to: "/my-appointments", label: "התורים שלי" },
  { to: "/admin", label: "ניהול" },
];

export function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNavLogo, setShowNavLogo] = useState(true);

  const isActive = (path: string) => location.pathname === path;

  // הסתר/הצג לוגו בנאב לפי נראות הלוגו הגדול בעמוד הבית
  useEffect(() => {
    const update = () => {
      const attr = document.documentElement.getAttribute("data-hero-logo");
      setShowNavLogo(attr !== "visible");
    };
    // בדוק בכל שינוי attribute
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-hero-logo"] });
    update(); // בדיקה ראשונית
    return () => observer.disconnect();
  }, []);

  // כשלא בעמוד הבית — תמיד הצג לוגו
  const isHome = location.pathname === "/";
  const displayLogo = !isHome || showNavLogo;

  return (
    <nav className="sticky top-0 z-50 border-b border-border glass">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">

        {/* קישורי ניווט — דסקטופ, צד ימין */}
        <div className="hidden sm:flex items-center gap-1">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* כפתור המבורגר — מובייל, צד ימין */}
        <button
          className="sm:hidden p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="תפריט"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* לוגו במרכז — מופיע כשהלוגו הגדול לא נראה */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
          <img
            src="/file.svg"
            alt="Logo"
            className={cn(
              "h-8 w-auto transition-all duration-500",
              displayLogo ? "opacity-100 scale-100" : "opacity-0 scale-75"
            )}
          />
        </div>

        {/* אינסטגרם — צד שמאל */}
        <a
          href="https://www.instagram.com/avishagbeja.cosmetics/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="Instagram"
        >
          <Instagram className="h-5 w-5" />
        </a>
      </div>

      {/* תפריט נפתח — מובייל */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-background/95 backdrop-blur-md">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "block px-6 py-3 text-base font-medium transition-colors border-b border-border/50",
                isActive(to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
