import { useState } from 'react';
import { useAction } from 'convex/react';
import { useToast } from '@/hooks/use-toast';
import { api } from '../../convex/_generated/api';

// Kicks off Stripe Checkout. Calls the Convex action to create a Session
// then redirects the browser to Stripe's hosted page.
export function useStartCheckout() {
  const create = useAction(api.stripe.createCheckoutSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await create({});
      window.location.assign(url);
    } catch (err) {
      console.error('createCheckoutSession failed', err);
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      setError(msg);
      // Surface failure to the user. Without this the buy button just looks
      // dead — silent failures are how launches get killed.
      toast({
        title: "Couldn't start checkout",
        description: msg,
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return { start, loading, error };
}
