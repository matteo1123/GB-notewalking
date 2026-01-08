import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AutoRecordProvider } from "@/contexts/AutoRecordContext";
import { PracticeSettingsProvider } from "@/contexts/PracticeSettingsContext";
import Index from "./pages/Index";
import Premium from "./pages/Premium";
import Auth from "./pages/Auth";
import AdminIndex from "./pages/Admin/Index";
import ShapeLibrary from "./pages/Admin/ShapeLibrary";
import ProgressionEditor from "./pages/Admin/ProgressionEditor";
import ScaleSequenceEditor from "./pages/Admin/ScaleSequenceEditor";
import AudioSandbox from "./pages/Admin/AudioSandbox";
import LessonBuilder from "./pages/Admin/LessonBuilder";
import { ChordProgressionTrainer } from "./components/ChordProgressionTrainer";
import NotFound from "./pages/NotFound";
import AdminRoute from "./components/AdminRoute";
import MainLayout from "./components/MainLayout";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AutoRecordProvider>
        <PracticeSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route element={<MainLayout />}>
                  <Route path="/premium" element={<Premium />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/admin" element={<AdminRoute><AdminIndex /></AdminRoute>} />
                  <Route path="/admin/shape-library" element={<AdminRoute><ShapeLibrary /></AdminRoute>} />
                  <Route path="/admin/progression-editor" element={<AdminRoute><ProgressionEditor /></AdminRoute>} />
                  <Route path="/admin/scale-sequence-editor" element={<AdminRoute><ScaleSequenceEditor /></AdminRoute>} />
                  <Route path="/admin/audio-sandbox" element={<AdminRoute><AudioSandbox /></AdminRoute>} />
                  <Route path="/admin/lesson-builder" element={<AdminRoute><LessonBuilder /></AdminRoute>} />
                  <Route path="/admin/chord-trainer" element={<AdminRoute><div className="h-screen p-4"><ChordProgressionTrainer /></div></AdminRoute>} />
                </Route>
                <Route path="/auth" element={<Auth />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </PracticeSettingsProvider>
      </AutoRecordProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
