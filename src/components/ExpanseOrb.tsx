import { useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Link } from 'react-router-dom';
import { CheckCircle, Lock, Orbit, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SKILL_NODE_BY_ID } from '@/data/skillTree';
import {
  EXPANSE_VIDEO_SRC,
  HOME_UNIVERSE,
  PRACTICE_SECTIONS,
  SEASONED_SECONDS,
  formatMinutes,
  secondsFor,
  sectionsNeedingTime,
} from '@/data/universes';
import { expanseOpenedAtom, practiceSecondsAtom } from '@/state/practiceTimeAtoms';

/**
 * The Expanse — the orb beside the HUD constellation that appears once every
 * CAGED node is unlocked. It stays sealed until each practice section has
 * SEASONED_SECONDS of play over I–IV; then it opens onto the closing video,
 * and watching it unlocks the other universes (chord pairs).
 *
 * Only rendered by SkillTree when the tree is complete, so players still on
 * the course never see it.
 */
export function ExpanseOrb() {
  const seconds = useAtomValue(practiceSecondsAtom);
  const [opened, setOpened] = useAtom(expanseOpenedAtom);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const remaining = useMemo(() => sectionsNeedingTime(seconds), [seconds]);
  const total = PRACTICE_SECTIONS.length;
  const done = total - remaining.length;
  const ready = remaining.length === 0;
  const state: 'sealed' | 'ready' | 'opened' = opened ? 'opened' : ready ? 'ready' : 'sealed';

  // Progress ring around the orb: seasoned sections out of 20.
  const R = 26;
  const C = 2 * Math.PI * R;
  const frac = opened ? 1 : done / total;

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="pointer-events-auto relative shrink-0 w-16 h-16 rounded-full flex items-center justify-center group self-center transition-transform hover:scale-110 active:scale-95"
        title={
          state === 'sealed'
            ? `The Expanse: ${done}/${total} sections have ${SEASONED_SECONDS / 60} minutes`
            : state === 'ready'
            ? 'The Expanse is open. Click to enter.'
            : 'The Expanse'
        }
        aria-label="The Expanse"
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke="url(#expanse-ring)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${C * frac} ${C}`}
            className="transition-all duration-1000"
          />
          <defs>
            <linearGradient id="expanse-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
        </svg>
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-700 ${
            state === 'sealed'
              ? 'bg-slate-950/80 border-slate-700'
              : state === 'ready'
              ? 'bg-[radial-gradient(circle,#f0abfc_0%,#7c3aed_45%,#0e7490_100%)] border-fuchsia-200 shadow-[0_0_40px_rgba(217,70,239,0.8)] animate-pulse'
              : 'bg-[radial-gradient(circle,#e9d5ff_0%,#6d28d9_50%,#0c4a6e_100%)] border-violet-300/70 shadow-[0_0_28px_rgba(139,92,246,0.6)]'
          }`}
        >
          {state === 'sealed' ? (
            <Lock className="w-4 h-4 text-slate-500" />
          ) : (
            <Orbit className="w-5 h-5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
          )}
        </div>
        {state === 'ready' && (
          <div className="absolute inset-1 rounded-full border-2 border-fuchsia-300/60 animate-ping pointer-events-none" />
        )}
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="node-dialog bg-slate-950 border-white/10 max-w-2xl w-[calc(100%-1rem)] max-h-[calc(100%-1rem)] overflow-y-auto overflow-x-hidden">
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="text-xl">The Expanse</DialogTitle>
              <DialogDescription>
                {state === 'sealed'
                  ? `Every star is unlocked. Now give each section ${SEASONED_SECONDS / 60} minutes of play over I – IV, and the Expanse opens.`
                  : state === 'ready'
                  ? 'You have walked every section of the neck. Watch what comes next.'
                  : 'The same stars, in other universes. Practice any section over new chord pairs.'}
              </DialogDescription>
            </DialogHeader>

            {state === 'sealed' ? (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-400 transition-all"
                      style={{ width: `${(done / total) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono tabular-nums text-slate-300">
                    {done}/{total}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {PRACTICE_SECTIONS.map((id) => {
                    const s = secondsFor(seconds, HOME_UNIVERSE, id);
                    const ok = s >= SEASONED_SECONDS;
                    return (
                      <Link
                        key={id}
                        to={`/practice?node=${id}`}
                        className={`rounded border px-2 py-1.5 text-[11px] leading-tight transition-colors ${
                          ok
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30'
                        }`}
                      >
                        <div className="font-bold truncate">{SKILL_NODE_BY_ID[id]?.title ?? id}</div>
                        <div className="font-mono tabular-nums text-[10px] opacity-80 flex items-center gap-1">
                          {ok && <CheckCircle className="w-3 h-3" />}
                          {formatMinutes(Math.min(s, SEASONED_SECONDS))} / {SEASONED_SECONDS / 60}:00
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500">
                  Time counts while the backing plays, the section is picked in Focus, and
                  you're actually playing.
                </p>
              </>
            ) : (
              <>
                <div className="aspect-video bg-black rounded-md overflow-hidden border border-white/5">
                  {videoFailed ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                      <Orbit className="w-8 h-8" />
                      <div className="text-sm">Video arriving soon</div>
                    </div>
                  ) : (
                    <video
                      src={EXPANSE_VIDEO_SRC}
                      controls
                      playsInline
                      className="w-full h-full"
                      onEnded={() => setOpened(true)}
                      onError={() => setVideoFailed(true)}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  {state === 'opened' ? (
                    <Link to="/practice" className="text-sm text-primary hover:underline font-bold">
                      Practice in another universe →
                    </Link>
                  ) : (
                    <span />
                  )}
                  {state === 'ready' && (
                    <Button onClick={() => setOpened(true)}>
                      <Sparkles className="h-4 w-4 mr-2" /> Enter the Expanse
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
