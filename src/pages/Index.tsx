/**
 * Landing Page (Index)
 * The main entry point for clients visiting the salon website.
 * Shows a hero section and service cards.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/ServiceCard";
import { getServices } from "@/services/api";
import { Service } from "@/services/types";

const Index = () => {
  const [services, setServices] = useState<Service[]>([]);
  const navigate = useNavigate();
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getServices().then(setServices);
  }, []);


  // מעדכן את ה-Navbar אם הלוגו בעמוד נראה
  useEffect(() => {
    const el = logoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        document.documentElement.setAttribute(
          "data-hero-logo",
          entry.isIntersecting ? "visible" : "hidden"
        );
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
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
            {/* לוגו גדול במרכז */}
            <div ref={logoRef} className="flex justify-center mb-6">
              <img
                src="/file.svg"
                alt="Avishag Beja Logo"
                className="w-40 h-auto sm:w-52 md:w-64 opacity-90"
              />
            </div>

            {/* Main heading */}
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
    </div>
  );
};

export default Index;
