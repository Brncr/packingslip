import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Sheets from "./pages/Sheets";
import Workflow from "./pages/Workflow";
import Wallet from "./pages/Wallet";
import AdminLogin from "./pages/AdminLogin";
import OrderTracking from "./pages/OrderTracking";
import PackingSlipView from "./pages/PackingSlipView";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Protected admin routes */}
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/sheets" element={<ProtectedRoute><Sheets /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          
          {/* Public routes */}
          <Route path="/workflow" element={<Workflow />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/track/:orderNumber" element={<OrderTracking />} />
          <Route path="/slip/:orderNumber" element={<PackingSlipView />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
