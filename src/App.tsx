import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AutoRecordProvider } from "@/contexts/AutoRecordContext";
import { PracticeSettingsProvider } from "@/contexts/PracticeSettingsContext";
import { SessionProvider } from "@/contexts/SessionContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PurchaseSuccess from "./pages/PurchaseSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AutoRecordProvider>
        <PracticeSettingsProvider>
          <SessionProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/purchase-success" element={<PurchaseSuccess />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </SessionProvider>
        </PracticeSettingsProvider>
      </AutoRecordProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
