import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useRecital } from '@/contexts/RecitalContext';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { Button } from '@/components/ui/button';
import { Music, Crown, LogIn, LogOut, Home, Menu, X, Radio, GraduationCap } from 'lucide-react';
import { SuggestionBox } from '@/components/SuggestionBox';

const Header = () => {
  const { user, signOut } = useAuth();
  const userRole = useUserRole();
  const { activeRecital } = useRecital();
  const { isTrialExpiringSoon } = usePremiumStatus();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="max-w-4xl mx-auto relative">
      <div className="text-center">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          {/* Left: Home link - hidden on mobile */}
          <div className="flex-1 hidden sm:block">
            {location.pathname !== '/' && (
              <Link
                to="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="h-4 w-4" />
                Free Metronome
              </Link>
            )}
          </div>

          {/* Center: Logo - smaller on mobile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Music className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              <Link to="/">Guitar Brain</Link>
            </h1>
          </div>

          {/* Right: Desktop nav buttons */}
          <div className="flex-1 hidden sm:flex justify-end gap-2">
            {activeRecital && (
              <Link to="/recital">
                <Button variant="outline" className="flex items-center gap-2 text-red-500 border-red-500">
                  <Radio className="h-4 w-4 animate-pulse" />
                  Live
                </Button>
              </Link>
            )}
            {userRole === 'admin' && (
              <Link to="/admin" state={{ reset: location.pathname.startsWith('/admin') }}>
                <Button variant="outline" className="flex items-center gap-2">
                  Admin
                </Button>
              </Link>
            )}

            {/* Trial Expiration Warning */}
            {isTrialExpiringSoon && (
              <Link to="/premium" className="hidden lg:flex items-center text-xs font-bold text-orange-500 animate-pulse px-2 bg-orange-500/10 rounded-md border border-orange-500/20 mr-1">
                Trial ending soon!
              </Link>
            )}

            <Link to="/premium" state={{ reset: location.pathname.startsWith('/premium') }}>
              <Button variant="outline" className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Premium
              </Button>
            </Link>
            <Link to="/course">
              <Button variant="outline" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Course
              </Button>
            </Link>
            {user && (
              <Link to="/profile">
                <Button variant="outline" className="flex items-center gap-2">
                  Profile
                </Button>
              </Link>
            )}
            {user ? (
              <Button
                variant="outline"
                onClick={signOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="outline" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </Link>
            )}
            <SuggestionBox />
          </div>

          {/* Mobile: Hamburger button */}
          <div className="flex-1 flex justify-end sm:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden absolute right-0 top-full z-50 bg-card border rounded-lg shadow-lg p-2 min-w-[160px]">
            <div className="flex flex-col gap-1">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 hover:bg-muted rounded-md text-sm"
              >
                Home
              </Link>
              {activeRecital && (
                <Link
                  to="/recital"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 hover:bg-muted rounded-md text-sm flex items-center gap-2 text-red-500"
                >
                  <Radio className="h-4 w-4 animate-pulse" />
                  Live Recital
                </Link>
              )}
              {userRole === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 hover:bg-muted rounded-md text-sm"
                >
                  Admin
                </Link>
              )}
              {isTrialExpiringSoon && (
                <Link
                  to="/premium"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 hover:bg-muted rounded-md text-sm font-bold text-orange-500 animate-pulse bg-orange-500/10 border-l-2 border-orange-500"
                >
                  Trial ending soon!
                </Link>
              )}
              <Link
                to="/premium"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 hover:bg-muted rounded-md text-sm flex items-center gap-2"
              >
                <Crown className="h-4 w-4" />
                Premium
              </Link>
              <Link
                to="/course"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 hover:bg-muted rounded-md text-sm flex items-center gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                Course
              </Link>
              {user && (
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 hover:bg-muted rounded-md text-sm"
                >
                  Profile
                </Link>
              )}
              {user ? (
                <button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="px-3 py-2 hover:bg-muted rounded-md text-sm text-left flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 hover:bg-muted rounded-md text-sm flex items-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;