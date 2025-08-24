import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;