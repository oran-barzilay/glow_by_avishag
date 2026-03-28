/**
 * Tailwind-safe classes and options for salon services (icons & theme colors).
 */

export const SERVICE_ICON_OPTIONS = [
  { value: "Sparkles", label: "ברק / נוצץ" },
  { value: "Eye", label: "עין" },
  { value: "Sun", label: "שמש" },
  { value: "Heart", label: "לב" },
  { value: "Scissors", label: "מספריים" },
  { value: "Star", label: "כוכב" },
  { value: "Flower2", label: "פרח" },
] as const;

export const SERVICE_COLOR_OPTIONS = [
  { value: "service-nails", label: "ורוד" },
  { value: "service-brows", label: "חום" },
  { value: "service-tan", label: "זהוב" },
  { value: "service-extra", label: "סגול" },
] as const;

export type ServiceColorKey = (typeof SERVICE_COLOR_OPTIONS)[number]["value"];

export function getServiceColorClasses(color: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    "service-nails": { bg: "bg-service-nails/15", text: "text-service-nails" },
    "service-brows": { bg: "bg-service-brows/15", text: "text-service-brows" },
    "service-tan": { bg: "bg-service-tan/15", text: "text-service-tan" },
    "service-extra": { bg: "bg-service-extra/15", text: "text-service-extra" },
  };
  return map[color] ?? map["service-nails"];
}
