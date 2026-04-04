/**
 * TermsLink — replaces every occurrence of the word "תקנון" in a text
 * with a clickable link to /terms.
 *
 * Usage:
 *   <TermsLink text="אני מסכים לתקנון ולמדיניות הביטולים" />
 */

import { Link } from "react-router-dom";

interface TermsLinkProps {
  text: string;
  className?: string;
}

export const TermsLink = ({ text, className }: TermsLinkProps) => {
  const parts = text.split(/(תקנון)/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part === "תקנון" ? (
          <Link
            key={i}
            to="/terms"
            className="underline underline-offset-2 text-primary hover:text-primary/80 transition-colors"
          >
            תקנון
          </Link>
        ) : (
          part
        )
      )}
    </span>
  );
};

