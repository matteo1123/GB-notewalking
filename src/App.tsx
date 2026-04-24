import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import MainLayout from '@/components/MainLayout';
import SkillTreePage from '@/pages/SkillTreePage';
import PracticePage from '@/pages/PracticePage';
import PaywallPage from '@/pages/PaywallPage';
import WelcomePage from '@/pages/WelcomePage';
import { useSyncProgress } from '@/hooks/useSyncProgress';

// Empty component whose only job is to mount useSyncProgress at the root,
// so the merge-and-push runs once for the whole app rather than per-page.
const ProgressSync = () => {
  useSyncProgress();
  return null;
};

const App = () => (
  <JotaiProvider>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <ProgressSync />
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<SkillTreePage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/unlock" element={<PaywallPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </JotaiProvider>
);

export default App;
