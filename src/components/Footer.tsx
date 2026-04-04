import { Link } from "react-router-dom";

export const Footer = () => (
  <footer dir="rtl" className="mt-auto border-t border-border bg-background py-4 text-center text-sm text-muted-foreground">
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <span>© {new Date().getFullYear()} Glow Studio by Avishag Beja · כל הזכויות שמורות</span>
      <span className="select-none text-border">·</span>
      <Link to="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
        תקנון ומדיניות
      </Link>
      <span className="select-none text-border">·</span>
      <Link to="/admin" className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
        ניהול
      </Link>
    </p>
  </footer>
);
