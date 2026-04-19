import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { Play, Pause, Shuffle, Volume2, VolumeX, Map as MapIcon, Mic, MicOff } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMetronome, type MetronomeSettings, type MetronomeState } from '@/hooks/useMetronome';
import { useNotePlayer } from '@/hooks/useNotePlayer';
import { usePitchDetection } from '@/hooks/usePitchDetection';
import { useChordProgression } from '@/hooks/useChordProgression';
import { Button } from '@/components/ui/button';
import { BeatVisualizer } from '@/components/BeatVisualizer';
import Fretboard from '@/components/Fretboard';
import { CagedConstellationFill } from '@/components/CagedConstellation';
import type { CagedShape } from '@/lib/cagedSystem';
import { ForceLandscapeWrapper } from '@/components/ForceLandscapeWrapper';
import { createDegreeMap, findAllNoteOccurrences } from '@/lib/musicTheory';
import { getChordTones, getChordInfo, calculateDegreeFromRoot } from '@/lib/chordProgression';
import type { ChordNumeral, ChordProgressionSettings } from '@/types/chords';
import { addXpAtom, completedSetAtom } from '@/state/skillTreeAtoms';
import { SKILL_NODE_BY_ID, type NodeId } from '@/data/skillTree';
import { computeRevealedFrets } from '@/lib/fretboardReveal';

const MAJOR_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'D#', 'F#', 'G#', 'A#'];

const DEGREE_COLORS: Record<number, string> = {
  1: '#FF6B6B',
  2: '#4ECDC4',
  3: '#45B7D1',
  4: '#96CEB4',
  5: '#FFEAA7',
  6: '#DDA0DD',
  7: '#98D8C8',
};

function pickRandomKey(exclude?: string): string {
  const pool = exclude ? MAJOR_KEYS.filter((k) => k !== exclude) : MAJOR_KEYS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getGuitarPitch(stringNum: number, fret: number): string {
  const stringMidi: Record<number, number> = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = stringMidi[stringNum] + fret;
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

type FocusMode = 'focused' | 'unlocked' | 'full';

interface NotewalkingExerciseProps {
  initialNode?: NodeId;
}

export function NotewalkingExercise({ initialNode }: NotewalkingExerciseProps = {}) {
  const [key, setKey] = useState(() => pickRandomKey());
  const [bpm, setBpm] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [drumBeat, setDrumBeat] = useState(true);
  const [droneEnabled, setDroneEnabled] = useState(true);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [detectedPitch, setDetectedPitch] = useState<string | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  // Mic on by default — the primary path for highlighting notes is playing
  // or singing them. Users (mainly the author recording videos) can toggle
  // it off to let keyboard 1–7 drive highlights without interference.
  const [micEnabled, setMicEnabled] = useState(true);
  const [tickCount, setTickCount] = useState(0);
  // Keyboard-driven scale-degree highlight (1–7). Mirrors what pitch detection
  // does, so video demos work without singing/playing into the mic.
  const [keyDegree, setKeyDegree] = useState<number | null>(null);
  const keyDegreeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectedNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useAtomValue(completedSetAtom);
  const [focusMode, setFocusMode] = useState<FocusMode>(initialNode ? 'focused' : 'unlocked');
  const [focusedNode, setFocusedNode] = useState<NodeId | null>(() => {
    if (initialNode) return initialNode;
    // Pick the most-recently-unlocked practiceable node as a sensible default
    const practiceable = [...completed].filter((id) => {
      const n = SKILL_NODE_BY_ID[id];
      return n && n.kind !== 'intro';
    });
    return practiceable.length > 0 ? (practiceable[practiceable.length - 1] as NodeId) : null;
  });
  const xpAccRef = useRef(0);

  // Cinematic shape spotlight: clicking a shape label fades the screen black,
  // floats just that shape's constellation in slowly, then fades back to the
  // normal fretboard. Any pointer/key cancels.
  type CinematicPhase = 'init' | 'solo' | 'reveal';
  const [cinematic, setCinematic] = useState<{
    shapes: CagedShape[];
    phase: CinematicPhase;
    rect: { left: number; top: number; width: number; height: number };
  } | null>(null);
  const fretboardWrapperRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const cinematicTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancelCinematic = useCallback(() => {
    cinematicTimersRef.current.forEach((t) => clearTimeout(t));
    cinematicTimersRef.current = [];
    setCinematic(null);
  }, []);

  const triggerCinematic = useCallback((input: CagedShape | CagedShape[]) => {
    const shapes = Array.isArray(input) ? input : [input];
    if (shapes.length === 0) return;
    const wrapper = fretboardWrapperRef.current;
    const container = stageContainerRef.current;
    if (!wrapper || !container) return;
    // Target the LIVE .fretboard element (not its wrapper) so the cinematic
    // SVG receives the same width/height as the on-fretboard constellation.
    // CagedConstellation positions stars in pixel-space from those dimensions
    // — matching them ensures the spotlit shape lands on the exact frets it
    // occupies once the overlay clears.
    const el = wrapper.querySelector<HTMLElement>('.fretboard');
    if (!el) return;
    // Use offsetLeft/Top (walked up the offsetParent chain) — NOT
    // getBoundingClientRect — because ForceLandscapeWrapper rotates 90° on
    // mobile portrait. getBoundingClientRect returns post-transform visual
    // coords; absolute positioning then re-applies the rotation, doubling it.
    let left = 0;
    let top = 0;
    let node: HTMLElement | null = el;
    while (node && node !== container) {
      left += node.offsetLeft;
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    cinematicTimersRef.current.forEach((t) => clearTimeout(t));
    cinematicTimersRef.current = [];
    setCinematic({
      shapes,
      phase: 'init',
      rect: { left, top, width: el.offsetWidth, height: el.offsetHeight },
    });
    // Phase progression: init (paint black + start fading shape in) → solo
    // (shape at full brightness) → reveal (fade overlay + shape out together).
    cinematicTimersRef.current.push(
      setTimeout(() => {
        setCinematic((c) => (c ? { ...c, phase: 'solo' } : c));
      }, 60),
    );
    cinematicTimersRef.current.push(
      setTimeout(() => {
        setCinematic((c) => (c ? { ...c, phase: 'reveal' } : c));
      }, 1900),
    );
    cinematicTimersRef.current.push(setTimeout(() => setCinematic(null), 2900));
  }, []);

  useEffect(() => {
    return () => {
      cinematicTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // When the page is opened from a SkillTree "Practice this node" click, play
  // the cinematic for that node's shape on mount. Connect nodes use the first
  // shape of their pair as the spotlight subject.
  const initialCinematicFiredRef = useRef(false);
  useEffect(() => {
    if (initialCinematicFiredRef.current) return;
    if (!initialNode) return;
    const node = SKILL_NODE_BY_ID[initialNode];
    if (!node) return;
    // Connect nodes spotlight BOTH adjacent shapes — the cinematic is a
    // visual rehearsal of what the focused practice view will reveal.
    const shapes: CagedShape[] = node.connectPair
      ? [...node.connectPair]
      : node.shape
      ? [node.shape]
      : [];
    if (shapes.length === 0) return;
    initialCinematicFiredRef.current = true;
    // Two rAFs so layout (incl. ForceLandscapeWrapper's transform pass) has
    // settled and offsetWidth/offsetLeft of `.fretboard` are reliable.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => triggerCinematic(shapes));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [initialNode, triggerCinematic]);

  useEffect(() => {
    const ctx = new AudioContext();
    setAudioContext(ctx);
    return () => {
      ctx.close();
    };
  }, []);

  const { playChord, preloadChords, stop: stopPlayer } = useNotePlayer(audioContext);
  const addXp = useSetAtom(addXpAtom);

  const settings: ChordProgressionSettings = useMemo(
    () => ({
      key,
      selectedChords: ['I', 'IV'],
      measuresPerChord: 4,
      droneEnabled,
      droneVolume: 0.5,
      promptFretboardPainter: false,
      droneMode: 'chord-major',
      scaleView: 'major',
    }),
    [key, droneEnabled],
  );

  const { currentChordIndex, currentChord, handleMetronomeTick } = useChordProgression({
    settings,
  });

  const currentChordA = settings.selectedChords[0] as ChordNumeral;
  const currentChordB = settings.selectedChords[1] as ChordNumeral;
  const chordInfoA = useMemo(() => getChordInfo(key, currentChordA), [key, currentChordA]);
  const chordInfoB = useMemo(() => getChordInfo(key, currentChordB), [key, currentChordB]);

  useEffect(() => {
    if (!audioContext) return;
    preloadChords([chordInfoA.rootNote, chordInfoB.rootNote]);
  }, [audioContext, chordInfoA.rootNote, chordInfoB.rootNote, preloadChords]);

  const metronomeSettings: MetronomeSettings = {
    mode: 'regular',
    startBpm: bpm,
    endBpm: bpm,
    measures: 999,
    muted,
    drumBeat,
    onTick: (state: MetronomeState) => {
      setTickCount((t) => t + 1);
      handleMetronomeTick(state);
      if (state.currentBeat === 1 && droneEnabled) {
        playChord(currentChord.rootNote, settings.droneVolume);
      }
    },
  };

  const metronome = useMetronome(metronomeSettings);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      metronome.pause();
      stopPlayer();
      setIsPlaying(false);
    } else {
      if (metronome.audioContext?.state === 'suspended') metronome.audioContext.resume();
      metronome.start();
      setIsPlaying(true);
      setTickCount(0);
    }
  }, [isPlaying, metronome, stopPlayer]);

  const handleRerollKey = useCallback(() => {
    const wasPlaying = metronome.state.isPlaying;
    if (wasPlaying) {
      metronome.stop();
      stopPlayer();
      setIsPlaying(false);
    }
    setKey((prev) => pickRandomKey(prev));
  }, [metronome, stopPlayer]);

  useEffect(() => {
    return () => {
      metronome.stop();
      stopPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePitchDetected = useCallback(
    (result: { frequency: number; note: string; confidence: number }) => {
      const name = result.note.replace(/\d/g, '');
      setDetectedNote(name);
      setDetectedPitch(result.note);
      // Auto-clear the highlight a beat after the last detection so notes
      // don't stay lit forever between phrases.
      if (detectedNoteTimerRef.current) clearTimeout(detectedNoteTimerRef.current);
      detectedNoteTimerRef.current = setTimeout(() => {
        setDetectedNote(null);
        setDetectedPitch(null);
      }, 800);
    },
    [],
  );

  usePitchDetection({
    isEnabled: micEnabled && !!audioContext,
    onNoteDetected: handlePitchDetected,
    sensitivity: 0.7,
  });

  // When the mic turns off, drop any lingering detected note so the keyboard
  // 1–7 highlight isn't suppressed by a stale pitch reading.
  useEffect(() => {
    if (!micEnabled) {
      if (detectedNoteTimerRef.current) clearTimeout(detectedNoteTimerRef.current);
      setDetectedNote(null);
      setDetectedPitch(null);
    }
  }, [micEnabled]);

  const revealedFrets = useMemo(() => {
    if (focusMode === 'full') {
      const all = new Set<string>();
      for (let s = 1; s <= 6; s++) for (let f = 0; f <= 22; f++) all.add(`${s}-${f}`);
      return all;
    }
    if (focusMode === 'focused' && focusedNode) {
      return computeRevealedFrets(key, new Set([focusedNode]));
    }
    return computeRevealedFrets(key, completed);
  }, [key, completed, focusMode, focusedNode]);

  const practiceableNodes = useMemo(
    () =>
      [...completed]
        .map((id) => SKILL_NODE_BY_ID[id])
        .filter((n) => n && n.kind !== 'intro'),
    [completed],
  );

  const degreeMap = useMemo(() => createDegreeMap(key, 'major'), [key]);

  // Degree → note name lookup for the current key. Used by the keyboard
  // 1–7 shortcut to translate "press 3" into "the third of this key".
  const degreeToNoteName = useMemo(() => {
    const map = new Map<number, string>();
    degreeMap.forEach((deg, note) => {
      if (!map.has(deg)) map.set(deg, note);
    });
    return map;
  }, [degreeMap]);

  // The effective note name to highlight on the fretboard. Mic detection wins
  // when present; otherwise a keyboard 1–7 press resolves through the key.
  const highlightedNoteName = useMemo<string | null>(() => {
    if (detectedNote) return detectedNote;
    if (keyDegree !== null) return degreeToNoteName.get(keyDegree) ?? null;
    return null;
  }, [detectedNote, keyDegree, degreeToNoteName]);

  const fretboardNotes = useMemo(() => {
    const degreeToNotes = new Map<number, string[]>();
    degreeMap.forEach((deg, note) => {
      if (!degreeToNotes.has(deg)) degreeToNotes.set(deg, []);
      degreeToNotes.get(deg)!.push(note);
    });

    const structureNotes = new Set<string>();
    settings.selectedChords.forEach((numeral) => {
      getChordTones(numeral as ChordNumeral).forEach((t) => {
        degreeToNotes.get(t)?.forEach((n) => structureNotes.add(n));
      });
    });

    const activeNotes = new Set<string>();
    const activeNumeral = settings.selectedChords[currentChordIndex] as ChordNumeral;
    getChordTones(activeNumeral).forEach((t) => {
      degreeToNotes.get(t)?.forEach((n) => activeNotes.add(n));
    });

    const notes: Array<{
      string: number;
      fret: number;
      isStructure: boolean;
      isActive: boolean;
      isPlaying: boolean;
      color: string;
    }> = [];

    // Match by note NAME (not octave-specific pitch) so every occurrence of
    // the played/sung/keyed note across all revealed frets lights up.
    Array.from(degreeMap.keys()).forEach((noteName) => {
      findAllNoteOccurrences(noteName).forEach((pos) => {
        const onRevealed = revealedFrets.has(`${pos.string}-${pos.fret}`);
        const isCurrentlyPlaying =
          highlightedNoteName === noteName && onRevealed;
        notes.push({
          string: pos.string,
          fret: pos.fret,
          isStructure: structureNotes.has(noteName),
          isActive: activeNotes.has(noteName),
          isPlaying: isCurrentlyPlaying,
          color: '#3f3f46',
        });
      });
    });

    return notes.filter((n) => n.isPlaying || revealedFrets.has(`${n.string}-${n.fret}`));
  }, [degreeMap, settings.selectedChords, currentChordIndex, highlightedNoteName, revealedFrets]);

  const scaleDegree = detectedNote ? calculateDegreeFromRoot(detectedNote, key) : null;
  // Show keyboard-pressed degree in the readout when there's no live mic
  // detection — same number, same colour, same fretboard highlight.
  const displayedDegree = scaleDegree ?? keyDegree;
  const displayedNoteLabel = detectedPitch ?? (highlightedNoteName ?? '---');
  const degreeColor = displayedDegree ? DEGREE_COLORS[displayedDegree] || '#666' : '#666';

  // Keyboard 1–7 → highlight the matching scale degree across every revealed
  // occurrence on the fretboard. Auto-clears so the highlight reads as a
  // brief pulse, matching how the mic detection behaves.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 7) {
        setKeyDegree(n);
        if (keyDegreeTimerRef.current) clearTimeout(keyDegreeTimerRef.current);
        keyDegreeTimerRef.current = setTimeout(() => setKeyDegree(null), 700);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (keyDegreeTimerRef.current) clearTimeout(keyDegreeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (detectedNoteTimerRef.current) clearTimeout(detectedNoteTimerRef.current);
    };
  }, []);

  const activeChordTones = useMemo(() => {
    const numeral = settings.selectedChords[currentChordIndex] as ChordNumeral;
    return new Set(getChordTones(numeral));
  }, [settings.selectedChords, currentChordIndex]);

  // Award XP only when the user actually hits a chord tone on a revealed fret.
  // Diminishes as more nodes are unlocked (rate = max(0.005, 0.1 * 0.7^paidCount) per hit).
  // The 0.1 multiplier is a global ~10x slowdown — earlier rates were tuned
  // before pitch detection started firing on every frame; a session of casual
  // playing was unlocking entire shapes inside a few minutes.
  useEffect(() => {
    if (!isPlaying || !detectedPitch || !scaleDegree) return;
    if (!activeChordTones.has(scaleDegree)) return;
    // Only count if the detected note sits on a currently-revealed fret.
    const onRevealed = fretboardNotes.some(
      (n) => n.isPlaying && revealedFrets.has(`${n.string}-${n.fret}`),
    );
    if (!onRevealed) return;
    const paidCount = [...completed].reduce(
      (n, id) => n + (SKILL_NODE_BY_ID[id]?.kind === 'intro' ? 0 : 1),
      0,
    );
    const rate = Math.max(0.005, 0.1 * Math.pow(0.7, paidCount));
    xpAccRef.current += rate;
    const whole = Math.floor(xpAccRef.current);
    if (whole > 0) {
      addXp(whole);
      xpAccRef.current -= whole;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedPitch]);

  const ChordBadge = ({
    side,
    active,
    numeral,
    rootNote,
  }: {
    side: 'a' | 'b';
    active: boolean;
    numeral: ChordNumeral;
    rootNote: string;
  }) => (
    <div
      className={`relative flex-1 flex justify-center items-center py-1 gap-3 border-gray-800 transition-all ${
        side === 'a' ? 'border-r' : ''
      } ${active ? 'bg-yellow-500/20' : ''}`}
    >
      {active && (
        <div className="absolute top-1 text-[10px] font-black text-yellow-400 animate-pulse tracking-widest hidden md:block">
          ▶ PLAYING
        </div>
      )}
      <div className="flex flex-col items-end text-right">
        <h4 className="text-[10px] md:text-xs font-bold text-gray-400">
          Chord {side === 'a' ? 'A' : 'B'}
        </h4>
        <div className="text-[10px] md:text-xs font-black text-white">{rootNote}</div>
        <div className="text-[9px] md:text-[10px] font-mono text-gray-500">
          {getChordTones(numeral).join(', ')}
        </div>
      </div>
      <div
        className={`text-3xl md:text-4xl font-black ${
          active ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'text-gray-500'
        }`}
      >
        {numeral}
      </div>
    </div>
  );

  return (
    <ForceLandscapeWrapper>
      <div
        ref={stageContainerRef}
        className="flex flex-col h-full w-full overflow-hidden relative bg-[#050505] text-slate-100"
      >
        {/* Cosmic backdrop — mirrors the SkillTree page so the practice
            screen feels like the same world. Sits behind everything; chord
            constellations on the fretboard read as another layer of stars. */}
        <div className="absolute inset-0 z-0 pointer-events-none bg-black">
          <div className="absolute inset-0 bg-[url('/space-bg.jpg')] bg-no-repeat bg-center bg-cover opacity-50 mix-blend-screen" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,#020617_100%)] opacity-40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />
        </div>
        <div className="relative z-10 flex-1 flex flex-row gap-1 p-1 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-black/40 backdrop-blur-sm border border-white/5 rounded relative">
            <div className="flex flex-row shrink-0 border-b border-gray-800">
              <ChordBadge
                side="a"
                active={currentChordIndex === 0 && isPlaying}
                numeral={currentChordA}
                rootNote={chordInfoA.rootNote}
              />

              <div className="w-[140px] shrink-0 border-l border-r border-gray-800 bg-black flex flex-col justify-center items-center px-2 py-1">
                <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary/70">
                  Key of
                </div>
                <div className="text-3xl font-black text-primary drop-shadow-[0_0_8px_hsl(25_95%_53%/0.6)] leading-none">
                  {key}
                </div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black border-2 bg-[#222] mt-1"
                  style={{
                    borderColor: displayedDegree ? degreeColor : '#555',
                    color: displayedDegree ? '#fff' : '#888',
                    boxShadow: displayedDegree ? `0 0 10px ${degreeColor}40` : 'none',
                  }}
                >
                  {displayedDegree || '?'}
                </div>
                <div className="text-[10px] font-bold text-gray-300 mt-0.5 text-center">
                  {displayedNoteLabel}
                </div>
                {focusMode === 'focused' && focusedNode && (
                  <div className="text-[9px] text-primary/80 mt-1 text-center font-semibold uppercase tracking-wider">
                    {SKILL_NODE_BY_ID[focusedNode]?.title}
                  </div>
                )}
              </div>

              <ChordBadge
                side="b"
                active={currentChordIndex === 1 && isPlaying}
                numeral={currentChordB}
                rootNote={chordInfoB.rootNote}
              />
            </div>

            <div className="flex-1 overflow-hidden flex items-center justify-center p-2 min-h-0">
              <div
                ref={fretboardWrapperRef}
                className={`w-full h-full max-w-[1200px] flex items-center justify-center notewalking-fretboard-override ${
                  currentChordIndex === 0 ? 'active-chord-a' : 'active-chord-b'
                }`}
              >
                <Fretboard
                  selectedNotes={fretboardNotes}
                  degreeMap={degreeMap}
                  showDegreeNumbers
                  isEditable={false}
                  cagedKey={key}
                  onShapeLabelClick={triggerCinematic}
                />
              </div>
            </div>
          </div>

          <div className="w-[180px] shrink-0 flex flex-col gap-2 overflow-hidden bg-black/40 backdrop-blur-sm border border-white/5 rounded p-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-1.5 h-7 text-[11px] rounded font-bold bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5" /> Skill Tree
            </Link>

            <BeatVisualizer
              currentBeat={metronome.state.currentBeat}
              isPlaying={metronome.state.isPlaying}
              currentBpm={metronome.state.isPlaying ? metronome.state.currentBpm : bpm}
            />

            <Button
              onClick={handlePlayPause}
              className={`h-10 text-sm font-bold ${isPlaying ? 'bg-red-500 hover:bg-red-600' : ''}`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 mr-1" /> Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" /> Start
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 flex-1"
                onClick={() => setBpm((b) => Math.max(40, b - 5))}
              >
                −
              </Button>
              <div className="text-center text-lg font-bold tabular-nums w-14">{bpm}</div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 flex-1"
                onClick={() => setBpm((b) => Math.min(240, b + 5))}
              >
                +
              </Button>
            </div>
            <div className="text-center text-[10px] text-muted-foreground -mt-1">BPM</div>

            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleRerollKey}>
              <Shuffle className="w-3.5 h-3.5 mr-1" /> New key
            </Button>

            <div className="border-t border-gray-800 pt-2 mt-1 flex flex-col gap-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Fretboard
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  className={`h-7 text-[10px] rounded font-bold ${
                    focusMode === 'focused'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  onClick={() => setFocusMode('focused')}
                  disabled={practiceableNodes.length === 0}
                  title="Show only the node you're practicing"
                >
                  Focus
                </button>
                <button
                  className={`h-7 text-[10px] rounded font-bold ${
                    focusMode === 'unlocked'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  onClick={() => setFocusMode('unlocked')}
                  title="Show everything you've unlocked"
                >
                  Unlocked
                </button>
                <button
                  className={`h-7 text-[10px] rounded font-bold ${
                    focusMode === 'full'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  onClick={() => setFocusMode('full')}
                  title="Show entire fretboard"
                >
                  All
                </button>
              </div>
              {focusMode === 'focused' && (
                <Select
                  value={focusedNode ?? undefined}
                  onValueChange={(v) => setFocusedNode((v || null) as NodeId | null)}
                >
                  <SelectTrigger className="h-9 text-[11px] rounded bg-black border-gray-700 text-white px-2 mt-1">
                    <SelectValue placeholder="— pick a node —" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-gray-700 text-white">
                    {practiceableNodes.map((n) => (
                      <SelectItem key={n.id} value={n.id} className="text-[12px]">
                        {n.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              size="sm"
              variant={micEnabled ? 'default' : 'outline'}
              className={`h-8 text-xs ${micEnabled ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
              onClick={() => setMicEnabled((m) => !m)}
              title="Toggle pitch detection. When off, use the 1–7 keys to highlight scale degrees."
            >
              {micEnabled ? (
                <>
                  <Mic className="w-3.5 h-3.5 mr-1" /> Mic on
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 mr-1" /> Mic off
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant={droneEnabled ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setDroneEnabled((d) => !d)}
            >
              {droneEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 mr-1" /> Chords on
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 mr-1" /> Chords off
                </>
              )}
            </Button>

            <button
              className={`h-7 text-[11px] rounded font-bold ${
                drumBeat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
              onClick={() => setDrumBeat((d) => !d)}
            >
              {drumBeat ? 'Drums on' : 'Drums off'}
            </button>

            <button
              className={`h-7 text-[11px] rounded ${
                muted ? 'bg-yellow-500 text-black' : 'bg-muted'
              }`}
              onClick={() => setMuted((m) => !m)}
            >
              {muted ? 'Unmute click' : 'Mute click'}
            </button>
          </div>
        </div>
        {cinematic && (
          <>
            <div
              className={`cinematic-bg phase-${cinematic.phase}`}
              onClick={cancelCinematic}
              onTouchStart={cancelCinematic}
            />
            <div
              className={`cinematic-stage phase-${cinematic.phase}`}
              style={{
                left: cinematic.rect.left,
                top: cinematic.rect.top,
                width: cinematic.rect.width,
                height: cinematic.rect.height,
              }}
            >
              <CagedConstellationFill
                cagedKey={key}
                fretCount={22}
                showLabels={false}
                showFretNumbers={false}
                soloShape={cinematic.shapes}
              />
            </div>
          </>
        )}
      </div>
    </ForceLandscapeWrapper>
  );
}
