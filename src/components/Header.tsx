import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Music, Crown, LogIn, LogOut, Home } from 'lucide-react';

const Header = () => {
  const { user, signOut } = useAuth();
  const userRole = useUserRole();
  const location = useLocation();

  return (
    <header className="max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
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
          <div className="flex items-center gap-3">
            <Music className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              <Link to="/">Guitar Dojo</Link>
            </h1>
          </div>
          <div className="flex-1 flex justify-end gap-2">
            {userRole === 'admin' && (
              <Link to="/admin" state={{ reset: location.pathname.startsWith('/admin') }}>
                <Button variant="outline" className="flex items-center gap-2">
                  Admin
                </Button>
              </Link>
            )}
            <Link to="/premium" state={{ reset: location.pathname.startsWith('/premium') }}>
              <Button variant="outline" className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Premium
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;