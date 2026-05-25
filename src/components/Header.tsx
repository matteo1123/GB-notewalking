import { Link, NavLink, useLocation } from 'react-router-dom';
import { Map, Play, Sparkles } from 'lucide-react';
import { useAtom, useAtomValue } from 'jotai';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { availableXpAtom, completionCountAtom, totalXpAtom, xpSpeedAtom, type XpSpeed } from '@/state/skillTreeAtoms';
import { TOTAL_NODES } from '@/data/skillTree';
import { usePurchaseStatus } from '@/hooks/usePurchaseStatus';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground shadow'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
  }`;

const Header = () => {
  const completed = useAtomValue(completionCountAtom);
  const totalXp = useAtomValue(totalXpAtom);
  const availableXp = useAtomValue(availableXpAtom);
  const [xpSpeed, setXpSpeed] = useAtom(xpSpeedAtom);
  const location = useLocation();
  const onPractice = location.pathname === '/practice';
  const { purchased } = usePurchaseStatus();

  return (
    <header className="w-full border-b border-white/5 bg-black/60 backdrop-blur-md shrink-0">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo2.png" alt="GuitarBrain" className="h-8 w-8 object-contain" />
          <span className="text-lg font-black tracking-tight text-foreground">
            Guitar<span className="text-primary">Brain</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navClass}>
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Skill Tree</span>
          </NavLink>
          {purchased && (
            <NavLink to="/practice" className={navClass}>
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Practice</span>
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors cursor-pointer"
                title={`${availableXp} XP available / ${totalXp} total earned. Click to configure XP Speed.`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="font-bold">{availableXp}</span>
                <span className="text-primary/60">XP</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-black/95 backdrop-blur border-white/10 p-3" sideOffset={8}>
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                  XP Earning Speed
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['slow', 'medium', 'fast'] as XpSpeed[]).map((s) => (
                    <button
                      key={s}
                      className={`h-7 text-[10px] rounded font-bold capitalize transition-colors ${
                        xpSpeed === s
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      onClick={() => setXpSpeed(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {!onPractice && (
            <span className="text-muted-foreground">
              {completed} / {TOTAL_NODES}
            </span>
          )}
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-xs font-bold text-primary hover:underline">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
};

export default Header;
