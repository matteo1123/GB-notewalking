import { useEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { useStartCheckout } from './useStartCheckout';

// One click → Stripe. Handles the sign-up-then-checkout chain so callers
// don't have to reimplement the pendingCheckout state machine. If the user
// is already signed in, jumps straight to Stripe; otherwise it opens Clerk's
// sign-up modal and resumes checkout once the new identity arrives.
export function useBuyFlow() {
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const { start: startCheckout, loading } = useStartCheckout();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (pending && isSignedIn) {
      setPending(false);
      startCheckout();
    }
  }, [pending, isSignedIn, startCheckout]);

  const buy = () => {
    if (isSignedIn) {
      startCheckout();
    } else {
      setPending(true);
      clerk.openSignUp({});
    }
  };

  return { buy, loading: loading || pending };
}
