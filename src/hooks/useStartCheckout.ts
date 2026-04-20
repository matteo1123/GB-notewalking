import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Kicks off Stripe Checkout. Calls the Convex action to create a Session
// then redirects the browser to Stripe's hosted page.
export function useStartCheckout() {
  const create = useAction(api.stripe.createCheckoutSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await create({});
      window.location.assign(url);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setLoading(false);
    }
  };

  return { start, loading, error };
}
