import { useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../../convex/_generated/api';

// Single source of truth for "is the signed-in user paid?". Returns
// `purchased: undefined` while loading so callers can distinguish
// loading-vs-locked. Side-effect: ensures a Convex `users` row exists for
// the current Clerk identity, idempotently.
export function usePurchaseStatus() {
  const { isSignedIn, isLoaded } = useAuth();
  const purchased = useQuery(api.purchases.isPurchased);
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      ensureUser().catch((err) => console.error('ensureUser failed', err));
    }
  }, [isLoaded, isSignedIn, ensureUser]);

  return {
    isSignedIn: !!isSignedIn,
    isAuthLoaded: isLoaded,
    purchased: isSignedIn ? purchased : false,
  };
}
