import { format } from "date-fns";
import { he } from "date-fns/locale";

/**
 * Formats an ISO date string (yyyy-MM-dd) to full Hebrew display format.
 */
export const formatHebrewDate = (isoDate: string): string =>
  format(new Date(`${isoDate}T00:00:00`), "EEEE, d MMMM yyyy", { locale: he });

