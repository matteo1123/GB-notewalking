import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Music2, Target, MapPin, Zap, Lock } from 'lucide-react';

const NOTEWALKING_PRICE_ID = import.meta.env.VITE_NOTEWALKING_PRICE_ID as string;

export function Paywall() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: NOTEWALKING_PRICE_ID,
          mode: 'payment',
          successUrl: `${window.location.origin}/purchase-success`,
          cancelUrl: window.location.origin,
          metadata: { type: 'notewalking_purchase' },
        },
      });
      if (error || !data?.url) throw new Error(error?.message || 'Could not start checkout');
      window.location.href = data.url;
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Something went wrong', description: err.message });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Music2 className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">GB Notewalking</span>
        </div>
        {!user && (
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
        )}
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-10 max-w-lg mx-auto w-full">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight">
            Target chord tones.<br />
            <span className="text-primary">Own the fretboard.</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            A focused practice tool that trains you to land on chord tones — by ear, in any key, over any chord.
          </p>
        </div>

        {/* Feature list */}
        <ul className="w-full space-y-3">
          {[
            { icon: Target, text: 'Live fretboard — see every chord tone highlighted in real time' },
            { icon: Zap, text: 'Metronome with speed trainer built in' },
            { icon: MapPin, text: 'Fretboard painter — track your comfort zone across the neck' },
            { icon: Music2, text: 'Any key, any diatonic chord pair, any BPM' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <span className="text-sm text-muted-foreground">{text}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="w-full space-y-3 text-center">
          {user ? (
            <Button
              size="lg"
              className="w-full text-base font-semibold"
              onClick={handlePurchase}
              disabled={loading}
            >
              <Lock className="h-4 w-4 mr-2" />
              {loading ? 'Redirecting…' : 'Buy for $5.99 — yours forever'}
            </Button>
          ) : (
            <div className="space-y-3">
              <Link to="/auth?tab=signup" className="block">
                <Button size="lg" className="w-full text-base font-semibold">
                  Create account to buy — $5.99
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground">
                Already have an account?{' '}
                <Link to="/auth" className="underline hover:text-foreground">Sign in</Link>
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">One-time purchase. No subscription. No expiry.</p>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground py-4 border-t border-border/50">
        A <a href="https://guitarbrain.org" className="underline hover:text-foreground">Guitar Brain</a> tool
      </footer>
    </div>
  );
}
