/**
 * Navbar Component
 * A simple, elegant top navigation bar with links to the main pages.
 * Uses React Router's Link for client-side navigation.
 */

import { useState } from "react";
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

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b border-border glass">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">

        {/* קישורי ניווט — דסקטופ, בצד ימין */}
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

        {/* כפתור המבורגר — מובייל בלבד, בצד ימין */}
        <button
          className="sm:hidden p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="תפריט"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* אינסטגרם — שמאל */}
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
