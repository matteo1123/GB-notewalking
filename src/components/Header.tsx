import { Link, NavLink, useLocation } from 'react-router-dom';
import { Map, Play, Sparkles } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { availableXpAtom, completionCountAtom, totalXpAtom } from '@/state/skillTreeAtoms';
import { TOTAL_NODES } from '@/data/skillTree';

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
  const location = useLocation();
  const onPractice = location.pathname === '/practice';

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
          <NavLink to="/practice" className={navClass}>
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Practice</span>
          </NavLink>
        </nav>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary"
            title={`${availableXp} XP available / ${totalXp} total earned`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-bold">{availableXp}</span>
            <span className="text-primary/60">XP</span>
          </div>
          {!onPractice && (
            <span className="text-muted-foreground">
              {completed} / {TOTAL_NODES}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
