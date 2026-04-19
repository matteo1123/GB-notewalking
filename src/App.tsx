import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import MainLayout from '@/components/MainLayout';
import SkillTreePage from '@/pages/SkillTreePage';
import PracticePage from '@/pages/PracticePage';
import PaywallPage from '@/pages/PaywallPage';

const App = () => (
  <JotaiProvider>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<SkillTreePage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/unlock" element={<PaywallPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </JotaiProvider>
);

export default App;
