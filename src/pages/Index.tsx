/**
 * Landing Page (Index)
 * The main entry point for clients visiting the salon website.
 * Shows a hero section and service cards.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/ServiceCard";
import { getServices } from "@/services/api";
import { Service } from "@/services/types";

const Index = () => {
  // State to hold the list of services fetched from the API
  const [services, setServices] = useState<Service[]>([]);
  const navigate = useNavigate();

  // Fetch services when the component first renders
  useEffect(() => {
    getServices().then(setServices);
  }, []);

  /**
   * When a user clicks "Book Now" on a service card,
   * navigate to the booking page with the serviceId as a URL parameter
   */
  const handleBookService = (serviceId: string) => {
    navigate(`/booking?service=${serviceId}`);
  };

  return (
    <div className="min-h-screen">
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden bg-secondary py-20 sm:py-28">
        {/* Decorative blurred circles for visual depth */}
        <div className="absolute -top-20 -end-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -start-20 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />

        <div className="container relative mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            {/* Main heading — Avishag Beja line 1, Glow Studio line 2 */}
            <h1 className="mb-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl" style={{ fontFamily: '"Frank Ruhl Libre", serif' }}>
              Avishag Beja
              <br />
              <span className="bg-hero-gradient bg-clip-text text-transparent">
                Glow Studio
              </span>
            </h1>

            {/* Subheading */}
            <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
              לק ג׳ל, עיצוב גבות ושיזוף בהתזה — במקום אחד חם ומזמין.
            </p>

            {/* CTA Button */}
            <Button
              variant="hero"
              size="lg"
              onClick={() => navigate("/booking")}
              className="gap-2 text-base"
            >
              הזמינו תור
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ===== SERVICES SECTION ===== */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold">השירותים שלנו</h2>
          <p className="text-muted-foreground">
            בחרו מהמגוון הטיפולים שלנו
          </p>
        </div>

        {/* Service cards grid — responsive: 1 col on mobile, 3 on desktop */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <ServiceCard
              key={service.id}
              service={service}
              onBook={handleBookService}
              index={index}
            />
          ))}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 Glow Studio. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  );
};

export default Index;
