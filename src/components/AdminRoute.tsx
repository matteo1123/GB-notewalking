import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const userRole = useUserRole();
  const { user, loading } = useAuth();

  if (loading || userRole === null) {
    return <div>Loading...</div>;
  }

  if (!user || userRole !== 'admin') {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

export default AdminRoute;