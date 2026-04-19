import { Outlet } from 'react-router-dom';
import Header from './Header';

const MainLayout = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Header />
    <main className="flex-1 flex flex-col min-h-0">
      <Outlet />
    </main>
  </div>
);

export default MainLayout;
