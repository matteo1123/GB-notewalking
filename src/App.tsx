import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AutoRecordProvider } from "@/contexts/AutoRecordContext";
import { PracticeSettingsProvider } from "@/contexts/PracticeSettingsContext";
import { RecitalProvider } from "@/contexts/RecitalContext";
import { RecitalBanner } from "@/components/RecitalBanner";
import { Analytics } from "@/components/Analytics";
import Index from "./pages/Index";
import RecitalPage from "./pages/Recital";
import Premium from "./pages/Premium";
import Auth from "./pages/Auth";
import AdminIndex from "./pages/Admin/Index";
import ShapeLibrary from "./pages/Admin/ShapeLibrary";
import ProgressionEditor from "./pages/Admin/ProgressionEditor";
import ScaleSequenceEditor from "./pages/Admin/ScaleSequenceEditor";
import AudioSandbox from "./pages/Admin/AudioSandbox";
// LessonBuilder import removed - deprecated lessons system
import { ChordProgressionTrainer } from "./components/ChordProgressionTrainer";
import NotFound from "./pages/NotFound";
import AdminRoute from "./components/AdminRoute";
import MainLayout from "./components/MainLayout";
import Profile from "./pages/Profile";
import TestScaleModule from "./pages/TestScaleModule";
import JsonTroubleshooter from "./pages/Admin/JsonTroubleshooter";
import SprintPractice from "./pages/SprintPractice";
import Course from "./pages/Course";
import CourseVerifications from "./pages/Admin/CourseVerifications";
import CourseEditor from "./pages/Admin/CourseEditor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AutoRecordProvider>
        <PracticeSettingsProvider>
          <RecitalProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Analytics />
                <RecitalBanner />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route element={<MainLayout />}>
                    <Route path="/premium" element={<Premium />} />
                    <Route path="/recital" element={<RecitalPage />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/course" element={<Course />} />
                    <Route path="/practice/sprint/:sprintId" element={<SprintPractice />} />
                    <Route path="/admin" element={<AdminRoute><AdminIndex /></AdminRoute>} />
                    <Route path="/admin/shape-library" element={<AdminRoute><ShapeLibrary /></AdminRoute>} />
                    <Route path="/admin/progression-editor" element={<AdminRoute><ProgressionEditor /></AdminRoute>} />
                    <Route path="/admin/scale-sequence-editor" element={<AdminRoute><ScaleSequenceEditor /></AdminRoute>} />
                    <Route path="/admin/audio-sandbox" element={<AdminRoute><AudioSandbox /></AdminRoute>} />
                    {/* LessonBuilder route removed - deprecated lessons system */}
                    <Route path="/admin/chord-trainer" element={<AdminRoute><div className="h-screen p-4"><ChordProgressionTrainer /></div></AdminRoute>} />
                    <Route path="/admin/json-troubleshooter" element={<AdminRoute><JsonTroubleshooter /></AdminRoute>} />
                    <Route path="/admin/course-verifications" element={<AdminRoute><CourseVerifications /></AdminRoute>} />
                    <Route path="/admin/course-editor" element={<AdminRoute><CourseEditor /></AdminRoute>} />
                  </Route>
                  <Route path="/auth" element={<Auth />} />
                  {/* Test route for Playwright E2E tests - only in dev */}
                  {import.meta.env.DEV && (
                    <Route path="/test/scale-module" element={<TestScaleModule />} />
                  )}
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </RecitalProvider>
        </PracticeSettingsProvider>
      </AutoRecordProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
