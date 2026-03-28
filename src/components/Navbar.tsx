/**
 * Navbar Component
 * A simple, elegant top navigation bar with links to the main pages.
 * Uses React Router's Link for client-side navigation.
 */

import { Link, useLocation } from "react-router-dom";
import { Scissors, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  // useLocation gives us the current URL path so we can highlight the active link
  const location = useLocation();

  /** Helper to check if a path is the current route */
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b border-border glass">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">

        {/* Navigation Links — right side (RTL: appears on the right) */}
        <div className="flex items-center gap-1">
          <Link
            to="/"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            בית
          </Link>
          <Link
            to="/booking"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/booking")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            הזמנת תור
          </Link>
          <Link
            to="/admin"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/admin")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ניהול
          </Link>
          <Link
            to="/my-appointments"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive("/my-appointments")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            התורים שלי
          </Link>
        </div>

        {/* Logo / Brand + Instagram — left side */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" />
            <span className="font-heading text-xl font-bold text-foreground">
              Glow Studio
            </span>
          </Link>
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

      </div>
    </nav>
  );
}
