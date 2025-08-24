import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  user_role: string;
}

export const useUserRole = () => {
  const { session } = useAuth();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (session?.access_token) {
      try {
        const decoded = jwtDecode<DecodedToken>(session.access_token);
        setRole(decoded.user_role);
      } catch (error) {
        console.error('Error decoding token:', error);
        setRole(null);
      }
    } else {
      setRole(null);
    }
  }, [session]);

  return role;
};