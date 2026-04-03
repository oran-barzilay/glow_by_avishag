/**
 * Israeli Jewish holidays for a given Gregorian year range.
 * Dates are approximate Gregorian equivalents (vary ±1 day by year/sunset).
 * We use a fixed table per Hebrew year mapped to Gregorian dates.
 *
 * Returns { holidays: string[], erevChag: string[] } as "YYYY-MM-DD" strings.
 */

interface HolidayEntry {
  name: string;
  date: string; // "YYYY-MM-DD"
  isErevChag?: boolean; // eve of holiday
}

/** Build the list of holidays + eves for years 2025–2030 */
function buildHolidays(): HolidayEntry[] {
  return [
    // ── 2025 ──────────────────────────────────────────────────────────────
    { name: "ערב פסח",        date: "2025-04-12", isErevChag: true },
    { name: "פסח",            date: "2025-04-13" },
    { name: "שביעי של פסח",   date: "2025-04-19" },
    { name: "ערב שביעי של פסח", date: "2025-04-18", isErevChag: true },
    { name: "יום העצמאות",    date: "2025-04-30" },
    { name: "ערב שבועות",     date: "2025-06-01", isErevChag: true },
    { name: "שבועות",         date: "2025-06-02" },
    { name: "ערב ראש השנה",   date: "2025-09-22", isErevChag: true },
    { name: "ראש השנה א׳",    date: "2025-09-23" },
    { name: "ראש השנה ב׳",    date: "2025-09-24" },
    { name: "ערב יום כיפור",  date: "2025-10-01", isErevChag: true },
    { name: "יום כיפור",      date: "2025-10-02" },
    { name: "ערב סוכות",      date: "2025-10-06", isErevChag: true },
    { name: "סוכות",          date: "2025-10-07" },
    { name: "ערב שמיני עצרת", date: "2025-10-13", isErevChag: true },
    { name: "שמיני עצרת/שמחת תורה", date: "2025-10-14" },

    // ── 2026 ──────────────────────────────────────────────────────────────
    { name: "ערב פסח",        date: "2026-04-01", isErevChag: true },
    { name: "פסח",            date: "2026-04-02" },
    { name: "שביעי של פסח",   date: "2026-04-08" },
    { name: "ערב שביעי של פסח", date: "2026-04-07", isErevChag: true },
    { name: "יום העצמאות",    date: "2026-04-20" },
    { name: "ערב שבועות",     date: "2026-05-21", isErevChag: true },
    { name: "שבועות",         date: "2026-05-22" },
    { name: "ערב ראש השנה",   date: "2026-09-10", isErevChag: true },
    { name: "ראש השנה א׳",    date: "2026-09-11" },
    { name: "ראש השנה ב׳",    date: "2026-09-12" },
    { name: "ערב יום כיפור",  date: "2026-09-19", isErevChag: true },
    { name: "יום כיפור",      date: "2026-09-20" },
    { name: "ערב סוכות",      date: "2026-09-24", isErevChag: true },
    { name: "סוכות",          date: "2026-09-25" },
    { name: "ערב שמיני עצרת", date: "2026-10-01", isErevChag: true },
    { name: "שמיני עצרת/שמחת תורה", date: "2026-10-02" },

    // ── 2027 ──────────────────────────────────────────────────────────────
    { name: "ערב פסח",        date: "2027-03-22", isErevChag: true },
    { name: "פסח",            date: "2027-03-23" },
    { name: "שביעי של פסח",   date: "2027-03-29" },
    { name: "ערב שביעי של פסח", date: "2027-03-28", isErevChag: true },
    { name: "יום העצמאות",    date: "2027-05-12" },
    { name: "ערב שבועות",     date: "2027-05-11", isErevChag: true },
    { name: "שבועות",         date: "2027-05-12" },
    { name: "ערב ראש השנה",   date: "2027-09-29", isErevChag: true },
    { name: "ראש השנה א׳",    date: "2027-09-30" },
    { name: "ראש השנה ב׳",    date: "2027-10-01" },
    { name: "ערב יום כיפור",  date: "2027-10-08", isErevChag: true },
    { name: "יום כיפור",      date: "2027-10-09" },
    { name: "ערב סוכות",      date: "2027-10-13", isErevChag: true },
    { name: "סוכות",          date: "2027-10-14" },
    { name: "ערב שמיני עצרת", date: "2027-10-20", isErevChag: true },
    { name: "שמיני עצרת/שמחת תורה", date: "2027-10-21" },

    // ── 2028 ──────────────────────────────────────────────────────────────
    { name: "ערב פסח",        date: "2028-04-10", isErevChag: true },
    { name: "פסח",            date: "2028-04-11" },
    { name: "שביעי של פסח",   date: "2028-04-17" },
    { name: "ערב שביעי של פסח", date: "2028-04-16", isErevChag: true },
    { name: "יום העצמאות",    date: "2028-05-01" },
    { name: "ערב שבועות",     date: "2028-05-30", isErevChag: true },
    { name: "שבועות",         date: "2028-05-31" },
    { name: "ערב ראש השנה",   date: "2028-09-20", isErevChag: true },
    { name: "ראש השנה א׳",    date: "2028-09-21" },
    { name: "ראש השנה ב׳",    date: "2028-09-22" },
    { name: "ערב יום כיפור",  date: "2028-09-29", isErevChag: true },
    { name: "יום כיפור",      date: "2028-09-30" },
    { name: "ערב סוכות",      date: "2028-10-04", isErevChag: true },
    { name: "סוכות",          date: "2028-10-05" },
    { name: "ערב שמיני עצרת", date: "2028-10-11", isErevChag: true },
    { name: "שמיני עצרת/שמחת תורה", date: "2028-10-12" },
  ];
}

const ALL_HOLIDAYS = buildHolidays();

/** Returns all holiday dates (not eves) as "YYYY-MM-DD" */
export function getHolidayDates(): string[] {
  return ALL_HOLIDAYS.filter((h) => !h.isErevChag).map((h) => h.date);
}

/** Returns all erev-chag dates as "YYYY-MM-DD" */
export function getErevChagDates(): string[] {
  return ALL_HOLIDAYS.filter((h) => h.isErevChag).map((h) => h.date);
}

/** Returns a map of date → holiday name (for tooltips) */
export function getHolidayNameMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of ALL_HOLIDAYS) map[h.date] = h.name;
  return map;
}

/** Returns all holiday + erev-chag dates combined */
export function getAllHolidayDates(): string[] {
  return ALL_HOLIDAYS.map((h) => h.date);
}

