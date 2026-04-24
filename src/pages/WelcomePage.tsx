import { Link } from 'react-router-dom';
import { Check, Map, Sparkles } from 'lucide-react';
import { UserButton, useAuth, useClerk } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { useBuyFlow } from '@/hooks/useBuyFlow';
import { usePurchaseStatus } from '@/hooks/usePurchaseStatus';
import { assetUrl } from '@/lib/assetUrl';

const features = [
  'The complete CAGED system — 5 shapes, 20 lessons, all on one fretboard.',
  'Notewalking practice that listens to your guitar via your mic.',
  'A skill tree that turns practice into progress, not a chore.',
  'Lifetime access. No subscription, no upsell.',
];

const WelcomePage = () => {
  const { buy, loading } = useBuyFlow();
  const { purchased } = usePurchaseStatus();
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 flex flex-col">
      {/* Cosmic background — same vibe as the tree, less density */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('/space-bg.jpg')] bg-no-repeat bg-center bg-cover opacity-40 mix-blend-screen" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#1e1b4b_0%,#020617_100%)] opacity-60" />
      </div>

      {/* Minimal nav bar */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between">
        <Link to="/welcome" className="flex items-center gap-2">
          <img src="/logo2.png" alt="GuitarBrain" className="h-8 w-8 object-contain" />
          <span className="text-lg font-black tracking-tight">
            Guitar<span className="text-primary">Brain</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {!isLoaded ? null : !isSignedIn ? (
            <button
              onClick={() => clerk.openSignIn({})}
              className="text-xs font-bold text-slate-300 hover:text-white"
            >
              Sign in
            </button>
          ) : (
            <UserButton afterSignOutUrl="/welcome" />
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-8 sm:py-16">
        <div className="max-w-2xl w-full">
          {/* Hero */}
          <div className="text-center space-y-3 mb-8">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              Learn the entire fretboard.
              <br />
              <span className="text-primary">In one app.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto">
              GuitarBrain is the CAGED system as a skill tree — short videos,
              real-time pitch detection, and exercises that meet you where you are.
            </p>
          </div>

          {/* Hero video */}
          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl mb-8">
            <video
              src={assetUrl('/videos/landing-intro.mp4')}
              controls
              playsInline
              poster="/logo2.png"
              className="w-full h-full"
            />
          </div>

          {/* Value prop */}
          <ul className="space-y-3 mb-8">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm sm:text-base text-slate-200">{f}</span>
              </li>
            ))}
          </ul>

          {/* Price + CTA */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
            <div className="flex items-baseline justify-center gap-2 mb-4">
              <span className="text-5xl font-black text-primary">$9.99</span>
              <span className="text-sm text-slate-400">one-time · lifetime access</span>
            </div>
            {purchased ? (
              <>
                <div className="text-center text-sm text-emerald-400 font-medium mb-4">
                  You own GuitarBrain. Welcome back.
                </div>
                <Link to="/">
                  <Button size="lg" className="w-full">
                    <Map className="h-4 w-4 mr-2" /> Open the skill tree
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="w-full text-base font-black tracking-wide"
                  onClick={buy}
                  disabled={loading}
                >
                  {loading ? 'Redirecting…' : 'Unlock GuitarBrain — $9.99'}
                </Button>
                <p className="text-[11px] text-slate-500 text-center mt-3">
                  Secure checkout via Stripe. Sign-up happens during checkout.
                </p>
              </>
            )}
          </div>

          {/* Secondary CTA — explore the tree */}
          <div className="text-center mt-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-primary transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Or, explore the interactive skill tree first →
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-slate-600 py-6">
        © GuitarBrain
      </footer>
    </div>
  );
};

export default WelcomePage;
