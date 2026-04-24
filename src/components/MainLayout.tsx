import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';

const MainLayout = () => {
  const location = useLocation();
  // The skill-tree route renders its own in-page HUD (logo, XP, Practice link),
  // and the marketing /welcome page owns its own minimal nav, so the outer
  // Header would just steal vertical space and double-print the brand on both.
  // Hide it there; keep it everywhere else.
  const showHeader = location.pathname !== '/' && location.pathname !== '/welcome';
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showHeader && <Header />}
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
