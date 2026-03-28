/**
 * ServiceCard Component
 * Displays a single salon service with its details and a "Book Now" button.
 * Uses framer-motion for entrance animations.
 */

import { motion } from "framer-motion";
import { Sparkles, Eye, Sun, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Service } from "@/services/types";

// Map icon string names to actual Lucide icon components
const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  Eye,
  Sun,
};

interface ServiceCardProps {
  service: Service;
  /** Called when the user clicks "Book Now" on this service */
  onBook: (serviceId: string) => void;
  /** Animation delay index for staggered entrance */
  index: number;
}

export function ServiceCard({ service, onBook, index }: ServiceCardProps) {
  // Look up the icon component from our map, default to Sparkles
  const IconComponent = iconMap[service.icon] || Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1"
    >
      {/* Decorative gradient circle behind the icon */}
      <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-${service.color}/15`}>
        <IconComponent className={`h-7 w-7 text-${service.color}`} />
      </div>

      {/* Service name */}
      <h3 className="mb-2 text-xl font-heading font-semibold text-foreground">
        {service.name}
      </h3>

      {/* Service description */}
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        {service.description}
      </p>

      {/* Duration and price info */}
      <div className="mb-5 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          🕐 {service.duration} דק׳
        </span>
        <span className="font-semibold text-foreground">
          ₪{service.price}
        </span>
      </div>

      {/* Book button */}
      <Button
        onClick={() => onBook(service.id)}
        variant="hero"
        className="w-full"
      >
        הזמינו תור
      </Button>
    </motion.div>
  );
}
