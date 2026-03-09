import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import { LevelUpCelebration } from './LevelUpCelebration';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center">
      <div className="w-full">
        <Header />
      </div>
      <main className="w-full flex-1">
        <Outlet />
      </main>
      <LevelUpCelebration />
    </div>
  );
};

export default MainLayout;