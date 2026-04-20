import { useNavigate } from 'react-router-dom';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePurchaseStatus } from '@/hooks/usePurchaseStatus';
import { useStartCheckout } from '@/hooks/useStartCheckout';
import { Check } from 'lucide-react';

const features = [
  'The complete CAGED skill tree — 20 skills across all 5 shapes',
  'Notewalking practice: I–IV progressions in every key',
  'Pitch detection — see what you play, in real time',
  'Works offline. No subscription. Yours forever.',
];

const PaywallPage = () => {
  const navigate = useNavigate();
  const { purchased, isAuthLoaded } = usePurchaseStatus();
  const { start, loading, error } = useStartCheckout();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Unlock GuitarBrain</CardTitle>
          <CardDescription>One-time purchase. Lifetime access to the full app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="pt-2 flex flex-col gap-2">
            {!isAuthLoaded ? (
              <Button disabled>Loading…</Button>
            ) : purchased ? (
              <>
                <div className="rounded-md bg-primary/10 text-primary p-3 text-sm font-medium">
                  You own GuitarBrain. Enjoy.
                </div>
                <Button onClick={() => navigate('/')}>Continue</Button>
              </>
            ) : (
              <>
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button size="lg">Sign in to unlock</Button>
                  </SignInButton>
                  <p className="text-[11px] text-muted-foreground text-center">
                    You'll create an account, then pay $9.99 — one-time, no subscription.
                  </p>
                </SignedOut>
                <SignedIn>
                  <Button size="lg" onClick={start} disabled={loading}>
                    {loading ? 'Redirecting…' : 'Unlock — $9.99'}
                  </Button>
                  {error && (
                    <p className="text-xs text-destructive text-center">{error}</p>
                  )}
                  <div className="flex justify-center pt-1">
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </SignedIn>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaywallPage;
