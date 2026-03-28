/**
 * App Component — Root of the application
 * Sets up routing, global providers (React Query, tooltips, toasts),
 * and wraps everything with the Navbar for consistent navigation.
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import Index from "./pages/Index";
import Booking from "./pages/Booking";
import { AdminRoute } from "@/components/AdminRoute";
import NotFound from "./pages/NotFound";
import MyAppointments from "./pages/MyAppointments";

// Create a React Query client for managing server state (caching, refetching, etc.)
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Navbar is outside Routes so it appears on every page */}
        <Navbar />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/my-appointments" element={<MyAppointments />} />
          {/* Catch-all route for 404 pages */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
