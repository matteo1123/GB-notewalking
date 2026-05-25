import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
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
import {
  addXpAtom,
  completedSetAtom,
  totalXpAtom,
  xpSpeedMultiplierAtom,
} from '@/state/skillTreeAtoms';
import { useAuth } from '@clerk/clerk-react';
import { SKILL_NODE_BY_ID, type NodeId } from '@/data/skillTree';
import { computeRevealedFrets } from '@/lib/fretboardReveal';

const MAJOR_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'D#', 'F#', 'G#', 'A#'];

// Temporary screenshot helper: when ON, clicking a shape label runs the
// cinematic in that shape's HOME KEY (so it lands at the open position with
// open strings included), with a longer hold to give time to grab a still.
// Flip back to false to restore normal cinematic behavior.
const SCREENSHOT_MODE = false;
const SCREENSHOT_HOLD_MS = 3000; // how long the shape stays at full brightness
const SCREENSHOT_FRET_COUNT = 6; // narrow window so the shape reads big
const SHAPE_HOME_KEY: Record<CagedShape, string> = {
  C: 'C',
  A: 'A',
  G: 'G',
  E: 'E',
  D: 'D',
};

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

type FocusMode = 'focused' | 'unlocked' | 'full' | 'none';

// Scale-view filter. Determines WHICH degrees of the key get rendered as dots
// on the fretboard (independent of which frets are revealed by the focus mode).
//
// Arpeggio is intentionally NOT chord-aware — it always shows the I chord's
// {1,3,5,7}. The pedagogical point is that during the IV chord, the user can
// see clearly which of the I-arpeggio notes are also tones of the IV (those
// land in the existing yellow active-note highlight) — building intuition for
// shared tones across the progression.
type ScaleView = 'major' | 'pentatonic' | 'arpeggio' | 'none';
const SCALE_VIEW_ORDER: ScaleView[] = ['arpeggio', 'pentatonic', 'major', 'none'];
const SCALE_VIEW_DEGREES: Record<ScaleView, Set<number>> = {
  major: new Set([1, 2, 3, 4, 5, 6, 7]),
  pentatonic: new Set([1, 2, 3, 5, 6]),
  arpeggio: new Set([1, 3, 5, 7]),
  none: new Set(),
};
const SCALE_VIEW_LABEL: Record<ScaleView, string> = {
  major: 'Major',
  pentatonic: 'Penta',
  arpeggio: 'Arp',
  none: 'None',
};

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

  // Which scale views participate in the rotation. All four enabled = full
  // cycle (Major → Penta → Arp → None). One enabled = view stays fixed.
  // Empty set is disallowed by toggleScaleView so currentScaleView always
  // resolves to something.
  const [enabledScaleViews, setEnabledScaleViews] = useState<Set<ScaleView>>(
    () => new Set(SCALE_VIEW_ORDER),
  );
  const [cycleIndex, setCycleIndex] = useState(0);

  // Cinematic shape spotlight: clicking a shape label fades the screen black,
  // floats just that shape's constellation in slowly, then fades back to the
  // normal fretboard. Any pointer/key cancels.
  type CinematicPhase = 'init' | 'solo' | 'reveal';
  const [cinematic, setCinematic] = useState<{
    shapes: CagedShape[];
    phase: CinematicPhase;
    rect: { left: number; top: number; width: number; height: number };
    // Optional overrides — populated by SCREENSHOT_MODE so the constellation
    // renders in the shape's home key with a narrower fret window.
    cagedKey?: string;
    fretCount?: number;
  } | null>(null);
  const fretboardWrapperRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const cinematicTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Which c/a/g/e/d key is currently being held, if any. Populated on
  // keydown so the cinematic can stay in `solo` phase until keyup.
  const heldCagedShapeRef = useRef<CagedShape | null>(null);

  const cancelCinematic = useCallback(() => {
    cinematicTimersRef.current.forEach((t) => clearTimeout(t));
    cinematicTimersRef.current = [];
    setCinematic(null);
  }, []);

  const triggerCinematic = useCallback((input: CagedShape | CagedShape[], opts?: { hold?: boolean }) => {
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
    // Screenshot mode: re-anchor the cinematic to the shape's home key with a
    // narrower fret window, and shrink the stage width so each fret in the
    // overlay matches the density of the live fretboard. The shape lands on
    // the left edge of the fretboard — same place it would in its home key.
    // Also force the live fretboard's key to match so the underlying
    // constellation/dots align with the highlighted overlay.
    const useScreenshot = SCREENSHOT_MODE && shapes.length === 1;
    const stageWidth = useScreenshot
      ? (SCREENSHOT_FRET_COUNT / 22) * el.offsetWidth
      : el.offsetWidth;
    const cinematicCagedKey = useScreenshot ? SHAPE_HOME_KEY[shapes[0]] : undefined;
    const cinematicFretCount = useScreenshot ? SCREENSHOT_FRET_COUNT : undefined;
    const soloHoldMs = useScreenshot ? SCREENSHOT_HOLD_MS : 1840;
    if (useScreenshot) setKey(SHAPE_HOME_KEY[shapes[0]]);
    setCinematic({
      shapes,
      phase: 'init',
      rect: { left, top, width: stageWidth, height: el.offsetHeight },
      cagedKey: cinematicCagedKey,
      fretCount: cinematicFretCount,
    });
    // Phase progression: init (paint black + start fading shape in) → solo
    // (shape at full brightness) → reveal (fade overlay + shape out together).
    // In `hold` mode the init→solo transition runs as normal, but the
    // auto-advance to `reveal` is skipped — the caller controls release
    // via releaseCinematic() (e.g. on keyup) so the shape stays solo for
    // as long as the key is held.
    cinematicTimersRef.current.push(
      setTimeout(() => {
        setCinematic((c) => (c ? { ...c, phase: 'solo' } : c));
      }, 60),
    );
    if (!opts?.hold) {
      cinematicTimersRef.current.push(
        setTimeout(() => {
          setCinematic((c) => (c ? { ...c, phase: 'reveal' } : c));
        }, 60 + soloHoldMs),
      );
      cinematicTimersRef.current.push(
        setTimeout(() => setCinematic(null), 60 + soloHoldMs + 1000),
      );
    }
  }, []);

  // Called on keyup for a held c/a/g/e/d shortcut. Advances a still-active
  // `solo`-phase cinematic into its fade-out, and schedules the final clear.
  const releaseCinematic = useCallback(() => {
    cinematicTimersRef.current.forEach((t) => clearTimeout(t));
    cinematicTimersRef.current = [];
    setCinematic((c) => (c ? { ...c, phase: 'reveal' } : c));
    cinematicTimersRef.current.push(
      setTimeout(() => setCinematic(null), 1000),
    );
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
  const xpSpeedMultiplier = useAtomValue(xpSpeedMultiplierAtom);
  const { isSignedIn } = useAuth();

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

  // Advance the scale-view rotation each time the chord progression wraps from
  // the LAST chord back to the FIRST (one full A→B traversal). Using a ref
  // sidesteps double-firing on Strict Mode mounts; the comparison only triggers
  // on a real index change anyway.
  const prevChordIndexRef = useRef(currentChordIndex);
  useEffect(() => {
    const wrapsToZero =
      prevChordIndexRef.current === settings.selectedChords.length - 1 &&
      currentChordIndex === 0;
    if (wrapsToZero) setCycleIndex((i) => i + 1);
    prevChordIndexRef.current = currentChordIndex;
  }, [currentChordIndex, settings.selectedChords.length]);

  const currentScaleView = useMemo<ScaleView>(() => {
    const enabled = SCALE_VIEW_ORDER.filter((v) => enabledScaleViews.has(v));
    if (enabled.length === 0) return 'major';
    return enabled[cycleIndex % enabled.length];
  }, [enabledScaleViews, cycleIndex]);

  const allowedDegrees = SCALE_VIEW_DEGREES[currentScaleView];

  const toggleScaleView = useCallback((view: ScaleView) => {
    setEnabledScaleViews((prev) => {
      const next = new Set(prev);
      if (next.has(view)) {
        // Refuse to disable the last one — empty set has no meaningful render
        // and cycleIndex math would have nothing to land on.
        if (next.size === 1) return prev;
        next.delete(view);
      } else {
        next.add(view);
      }
      return next;
    });
    // Reset rotation so the user immediately sees a deterministic state after
    // toggling (otherwise they'd see whatever the modulo lands on next).
    setCycleIndex(0);
  }, []);

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
    if (focusMode === 'none') {
      // Hides all dots so only the constellation remains. The constellation
      // doesn't read revealedFrets in the live fretboard render, so its stars
      // stay fully visible underneath the (now empty) dot layer.
      return new Set<string>();
    }
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

  // Sparkle particle feedback — while `highlightedNoteName` is non-null (mic
  // hit OR keyboard 1–7 held), we keep firing bursts on a jittery cadence so
  // a sustained note looks like it's continuously sparking rather than
  // flashing once. Each burst freezes the cells it paints at trigger time
  // so overlapping bursts can co-exist without the CSS animation restarting
  // when React's key changes.
  const [sparkleBursts, setSparkleBursts] = useState<
    Array<{ id: number; points: Array<{ string: number; fret: number }> }>
  >([]);
  const burstIdRef = useRef(0);
  const sparkleBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Scale-view filter: drop notes whose degree isn't in the currently-
      // displayed view (e.g., during arpeggio mode, only 1/3/5/7 survive).
      const deg = degreeMap.get(noteName);
      if (!deg || !allowedDegrees.has(deg)) return;
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
  }, [degreeMap, settings.selectedChords, currentChordIndex, highlightedNoteName, revealedFrets, allowedDegrees]);

  // While a note is being heard/typed, keep emitting sparkle bursts on a
  // jittery interval. Each burst is independent and expires itself so
  // overlapping sparkles stack up — the user sees continuous crazy-random
  // sparks instead of a single flash. Fret 0 (open strings) is excluded
  // because those sit in a sibling container, not the main fretboard grid.
  useEffect(() => {
    if (!highlightedNoteName) return;
    const BURST_LIFETIME_MS = 1200; // slightly longer than the longest particle
    const points = findAllNoteOccurrences(highlightedNoteName).filter(
      (p) => p.fret >= 1 && revealedFrets.has(`${p.string}-${p.fret}`),
    );
    if (points.length === 0) return;
    const fireBurst = () => {
      burstIdRef.current += 1;
      const id = burstIdRef.current;
      setSparkleBursts((arr) => [...arr, { id, points }]);
      setTimeout(() => {
        setSparkleBursts((arr) => arr.filter((b) => b.id !== id));
      }, BURST_LIFETIME_MS);
    };
    // First burst fires immediately so the sparkle appears the instant the
    // note is detected.
    fireBurst();
    const schedule = () => {
      const delay = 90 + Math.random() * 180; // 90–270ms between bursts
      sparkleBurstTimerRef.current = setTimeout(() => {
        fireBurst();
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      if (sparkleBurstTimerRef.current) {
        clearTimeout(sparkleBurstTimerRef.current);
        sparkleBurstTimerRef.current = null;
      }
    };
  }, [highlightedNoteName, revealedFrets]);

  const scaleDegree = detectedNote ? calculateDegreeFromRoot(detectedNote, key) : null;
  // Show keyboard-pressed degree in the readout when there's no live mic
  // detection — same number, same colour, same fretboard highlight.
  const displayedDegree = scaleDegree ?? keyDegree;
  const displayedNoteLabel = detectedPitch ?? (highlightedNoteName ?? '---');
  const degreeColor = displayedDegree ? DEGREE_COLORS[displayedDegree] || '#666' : '#666';

  // Keyboard shortcuts while the exercise is open:
  //   1–7  → pulse the matching scale degree on every revealed occurrence
  //          (feeds highlightedNoteName, which now drives the sparkle burst)
  //   c/a/g/e/d → hold-to-spotlight that shape. Pressing starts the
  //               cinematic and pins it in its `solo` phase; releasing
  //               fades back to the normal view. OS-level key-repeat is
  //               suppressed so holding doesn't restart the animation.
  useEffect(() => {
    const isCagedKey = (k: string) =>
      k === 'C' || k === 'A' || k === 'G' || k === 'E' || k === 'D';

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 7) {
        setKeyDegree(n);
        if (keyDegreeTimerRef.current) clearTimeout(keyDegreeTimerRef.current);
        keyDegreeTimerRef.current = setTimeout(() => setKeyDegree(null), 700);
        return;
      }
      const k = e.key.toUpperCase();
      if (isCagedKey(k)) {
        // OS key-repeat fires keydown over and over while the key is held;
        // suppress it so the cinematic stays settled in `solo` instead of
        // re-initing and strobing. heldCagedShapeRef is the authoritative
        // source — if it already matches, we've already handled this press.
        if (e.repeat) return;
        if (heldCagedShapeRef.current === k) return;
        heldCagedShapeRef.current = k as CagedShape;
        triggerCinematic(k as CagedShape, { hold: true });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (isCagedKey(k) && heldCagedShapeRef.current === k) {
        heldCagedShapeRef.current = null;
        releaseCinematic();
      }
    };

    // Window-blur safety net: if the user alt-tabs while holding a shape
    // key, keyup never fires and the cinematic sticks in solo forever.
    const onBlur = () => {
      if (heldCagedShapeRef.current) {
        heldCagedShapeRef.current = null;
        releaseCinematic();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      if (keyDegreeTimerRef.current) clearTimeout(keyDegreeTimerRef.current);
    };
  }, [triggerCinematic, releaseCinematic]);

  useEffect(() => {
    return () => {
      if (detectedNoteTimerRef.current) clearTimeout(detectedNoteTimerRef.current);
    };
  }, []);

  const activeChordTones = useMemo(() => {
    const numeral = settings.selectedChords[currentChordIndex] as ChordNumeral;
    return new Set(getChordTones(numeral));
  }, [settings.selectedChords, currentChordIndex]);

  // Set of "string-fret" cells whose note belongs to the chord that is
  // currently sounding. Drives the chord-aware constellation throb so only
  // the active chord's tones twinkle, not every CAGED tone on the board.
  const activeChordPositions = useMemo(() => {
    const set = new Set<string>();
    const degreeToNotes = new Map<number, string[]>();
    degreeMap.forEach((deg, note) => {
      if (!degreeToNotes.has(deg)) degreeToNotes.set(deg, []);
      degreeToNotes.get(deg)!.push(note);
    });
    const numeral = settings.selectedChords[currentChordIndex] as ChordNumeral;
    getChordTones(numeral).forEach((t) => {
      degreeToNotes.get(t)?.forEach((noteName) => {
        findAllNoteOccurrences(noteName).forEach((p) => {
          set.add(`${p.string}-${p.fret}`);
        });
      });
    });
    return set;
  }, [degreeMap, settings.selectedChords, currentChordIndex]);



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
    // `xpSpeedMultiplier` is user-controlled (slow/medium/fast → 1.0/1.3/1.6)
    // and scales the base rate so players who've already hit the diminishing
    // floor can still make meaningful progress toward bigger unlocks.
    const rate =
      Math.max(0.005, 0.1 * Math.pow(0.7, paidCount)) * xpSpeedMultiplier;
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
                // --throb-duration drives the constellation's chord-tone pulse.
                // Set to 4 beats (one 4/4 measure) at the current bpm — slow
                // enough to feel like a breath rather than a metronome flicker,
                // fast enough to read as "in time with the music."
                style={{ ['--throb-duration' as string]: `${(60000 / bpm) * 4}ms` }}
                className={`w-full h-full max-w-[1200px] flex items-center justify-center notewalking-fretboard-override ${
                  currentChordIndex === 0 ? 'active-chord-a' : 'active-chord-b'
                } ${cinematic && SCREENSHOT_MODE ? 'screenshot-cinematic' : ''} ${
                  focusMode === 'none' ? 'mode-none' : ''
                }`}
              >
                <Fretboard
                  selectedNotes={fretboardNotes}
                  degreeMap={degreeMap}
                  showDegreeNumbers
                  isEditable={false}
                  cagedKey={key}
                  activeTones={activeChordPositions}
                  onShapeLabelClick={triggerCinematic}
                  sparkleBursts={sparkleBursts}
                />
              </div>
            </div>
          </div>

          <div className="w-[180px] shrink-0 flex flex-col gap-2 overflow-y-auto bg-black/40 backdrop-blur-sm border border-white/5 rounded p-2">
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
              <div className="grid grid-cols-4 gap-1">
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
                <button
                  className={`h-7 text-[10px] rounded font-bold ${
                    focusMode === 'none'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  onClick={() => setFocusMode('none')}
                  title="Hide the dots — just the breathing constellations"
                >
                  None
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

            <div className="border-t border-gray-800 pt-2 mt-1 flex flex-col gap-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                <span>Scale</span>
                {enabledScaleViews.size > 1 && (
                  <span className="text-primary normal-case font-semibold tracking-wider">
                    ▶ {SCALE_VIEW_LABEL[currentScaleView]}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {SCALE_VIEW_ORDER.map((view) => {
                  const enabled = enabledScaleViews.has(view);
                  const isCurrent =
                    currentScaleView === view && enabledScaleViews.size > 1;
                  return (
                    <button
                      key={view}
                      className={`h-7 text-[10px] rounded font-bold transition-all ${
                        enabled
                          ? isCurrent
                            ? 'bg-primary text-primary-foreground ring-2 ring-yellow-400'
                            : 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      onClick={() => toggleScaleView(view)}
                      title={
                        enabled
                          ? `Remove ${SCALE_VIEW_LABEL[view]} from cycle`
                          : `Add ${SCALE_VIEW_LABEL[view]} to cycle`
                      }
                    >
                      {SCALE_VIEW_LABEL[view]}
                    </button>
                  );
                })}
              </div>
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
            {/* Black backdrop is suppressed in screenshot mode so the live
                fretboard stays visible behind the highlighted shape. */}
            {!SCREENSHOT_MODE && (
              <div
                className={`cinematic-bg phase-${cinematic.phase}`}
                onClick={cancelCinematic}
                onTouchStart={cancelCinematic}
              />
            )}
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
                cagedKey={cinematic.cagedKey ?? key}
                fretCount={cinematic.fretCount ?? 22}
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
