import { useEffect, useMemo, useRef, useState } from 'react';
import { UNIVERSES, type UniverseId } from '@/data/universes';
import {
  FORMULA_CHANNEL,
  buildLibrary,
  describeFormula,
  matches,
  type Formula,
  type FormulaMessage,
  type MelodyChange,
} from '@/lib/formulas';

// Creator only (opened from the practice screen's Formulas button, which only
// the creator sees). A shot list of melody formulas that ticks itself off as
// the practice screen hears each one played across a chord change. Nothing
// here is secret; it just isn't linked from anywhere a student can reach.

type Pace = 'normal' | 'slow';
interface Take {
  at: number;
  bpm: number;
  key: string;
  t: number | null; // ms into the recording, null if it wasn't recording
  manual?: boolean;
}
type Progress = Record<string, Partial<Record<Pace, Take>>>;

const PROGRESS_KEY = 'gb-formulas-progress';
const SLOW_KEY = 'gb-formulas-slow-bpm';
const SEMI_LABEL = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function clock(ms: number | null): string {
  if (ms === null) return 'not recording';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function FormulaChecklistPage() {
  const library = useMemo(buildLibrary, []);
  const [progress, setProgress] = useState<Progress>(() => load(PROGRESS_KEY, {}));
  const [slowBpm, setSlowBpm] = useState<number>(() => load(SLOW_KEY, 60));
  const [state, setState] = useState<Extract<FormulaMessage, { type: 'state' }> | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [heard, setHeard] = useState<(MelodyChange & { hit: string | null })[]>([]);
  const [now, setNow] = useState(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const slowRef = useRef(slowBpm);
  slowRef.current = slowBpm;

  useEffect(() => localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)), [progress]);
  useEffect(() => localStorage.setItem(SLOW_KEY, JSON.stringify(slowBpm)), [slowBpm]);
  useEffect(() => {
    document.title = 'Formulas · Guitar Brain';
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ch = new BroadcastChannel(FORMULA_CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (e: MessageEvent<FormulaMessage>) => {
      const msg = e.data;
      if (msg.type === 'state') {
        setState(msg);
        setLastSeen(Date.now());
      } else if (msg.type === 'change') {
        const c = msg.change;
        const pace: Pace = c.bpm <= slowRef.current ? 'slow' : 'normal';
        const f = library.find((x) => matches(x, c));
        setHeard((h) => [{ ...c, hit: f ? f.id : null }, ...h].slice(0, 6));
        setLastSeen(Date.now());
        if (f) {
          setProgress((p) =>
            p[f.id]?.[pace] ? p : { ...p, [f.id]: { ...p[f.id], [pace]: { at: c.at, bpm: c.bpm, key: c.key, t: c.t } } },
          );
        }
      }
    };
    ch.postMessage({ type: 'hello' } satisfies FormulaMessage);
    return () => ch.close();
  }, [library]);

  const connected = now - lastSeen < 6000;
  const send = (m: FormulaMessage) => channelRef.current?.postMessage(m);

  const toggle = (f: Formula, pace: Pace) => {
    setProgress((p) => {
      const cur = { ...p[f.id] };
      if (cur[pace]) {
        delete cur[pace];
      } else {
        cur[pace] = { at: Date.now(), bpm: state?.bpm ?? 0, key: state?.key ?? '', t: null, manual: true };
        send({ type: 'manualTick', formulaId: f.id, pace });
      }
      return { ...p, [f.id]: cur };
    });
  };

  const done = library.filter((f) => progress[f.id]?.normal && progress[f.id]?.slow).length;

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-slate-100 p-3 text-sm">
      <div className="sticky top-0 bg-[#0b0b0f] pb-2 border-b border-white/10 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-black tracking-wide">Formulas</h1>
          <span className="text-xs text-slate-400">
            {done} / {library.length} done
          </span>
        </div>
        <div className="mt-1 text-xs flex flex-wrap gap-x-3 gap-y-1 items-center">
          <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
            {connected ? '● Practice screen connected' : '○ Open the practice screen in this browser'}
          </span>
          {state && (
            <>
              <span>Key {state.key}</span>
              <span>{state.bpm} bpm ({state.bpm <= slowBpm ? 'slow' : 'normal'})</span>
              {state.recording && <span className="text-red-400 font-bold">● REC</span>}
            </>
          )}
        </div>
        <div className="mt-1 text-xs flex items-center gap-2 text-slate-400">
          Slow takes are at or below
          <input
            type="number"
            className="w-14 bg-black border border-white/20 rounded px-1 text-slate-100"
            value={slowBpm}
            onChange={(e) => setSlowBpm(Number(e.target.value) || 0)}
          />
          bpm
          <button
            className="ml-auto text-red-300 hover:text-red-200"
            onClick={() => window.confirm('Clear every tick?') && setProgress({})}
          >
            Reset all
          </button>
        </div>
        {heard.length > 0 && (
          <div className="mt-2 text-[11px] text-slate-400">
            Heard:{' '}
            {heard.map((h, i) => (
              <span key={h.at + ':' + i} className={`mr-2 ${h.hit ? 'text-emerald-300' : ''}`}>
                {SEMI_LABEL[h.semis[0]]}→{SEMI_LABEL[h.semis[1]]} over {h.chords[0]}→{h.chords[1]}
              </span>
            ))}
          </div>
        )}
      </div>

      {UNIVERSES.map((u) => {
        const items = library.filter((f) => f.universe === u.id);
        const current = state?.universe === u.id;
        return (
          <section key={u.id} className="mt-3">
            <div className="flex items-center gap-2">
              <h2 className={`font-black ${current ? 'text-amber-300' : 'text-slate-300'}`}>{u.label}</h2>
              {current ? (
                <span className="text-[10px] text-amber-300">● playing these chords</span>
              ) : (
                <button
                  className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20"
                  onClick={() => send({ type: 'setUniverse', universe: u.id as UniverseId })}
                >
                  Use these chords
                </button>
              )}
            </div>
            <ul className="mt-1 space-y-1">
              {items.map((f) => {
                const p = progress[f.id] ?? {};
                return (
                  <li
                    key={f.id}
                    className={`rounded border px-2 py-1.5 ${
                      p.normal && p.slow ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-mono font-black text-base leading-tight">
                        <div>
                          <span className="text-slate-500 text-[10px] font-sans mr-1">MELODY</span>
                          {f.melody[0]} → {f.melody[1]}
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] font-sans mr-1">CHORDS</span>
                          {f.chords[0]} → {f.chords[1]}
                        </div>
                      </div>
                      <div className="ml-auto flex gap-1">
                        {(['normal', 'slow'] as Pace[]).map((pace) => {
                          const take = p[pace];
                          return (
                            <button
                              key={pace}
                              onClick={() => toggle(f, pace)}
                              title={
                                take
                                  ? `${take.manual ? 'Ticked by hand' : 'Heard'} at ${take.bpm} bpm in ${take.key}, ${clock(take.t)}. Click to clear.`
                                  : `Tick by hand`
                              }
                              className={`w-16 text-[10px] rounded px-1 py-1 border ${
                                take
                                  ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                                  : 'border-white/20 text-slate-400 hover:border-white/40'
                              }`}
                            >
                              {take ? '✓ ' : ''}
                              {pace === 'normal' ? 'Normal' : 'Slow'}
                              {take && <div className="font-mono">{clock(take.t)}</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-[11px] text-amber-200/90 mt-0.5">{f.idea}</div>
                    <div className="text-[10px] text-slate-400">{describeFormula(f)}</div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
