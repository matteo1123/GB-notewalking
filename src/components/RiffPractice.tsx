import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RepertoireItem } from "@/types/repertoire";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useNotePlayer } from "@/hooks/useNotePlayer";
import { useRecorder } from "@/hooks/useRecorder";
import { useBpmControls } from "@/hooks/useBpmControls";
import NoteDisplay from "./NoteDisplay";
import { BeatVisualizer } from "./BeatVisualizer";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import { normalizeNotesToFretboard } from "@/lib/musicTheory";


import ExerciseHierarchy from "./ExerciseHierarchy";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { PostgrestError } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { usePracticeSettings } from "@/contexts/PracticeSettingsContext";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
// RecordingControls removed - using only auto-record toggle
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useToast } from "./ui/use-toast";
// Defaults to quarter notes (1 step per beat) when subdivision is missing
// Accepts legacy notes with 'duration' in seconds; otherwise duration = 1 step

import { Note } from "@/types/repertoire";
import { applySequenceToScale } from "@/lib/sequenceUtils";
import { Scale } from "@/types/scales";

const MAJOR_KEYS = [
  { value: "C", label: "C" },
  { value: "C#", label: "C♯" },
  { value: "D", label: "D" },
  { value: "D#", label: "D♯" },
  { value: "E", label: "E" },
  { value: "F", label: "F" },
  { value: "F#", label: "F♯" },
  { value: "G", label: "G" },
  { value: "G#", label: "G♯" },
  { value: "A", label: "A" },
  { value: "A#", label: "A♯" },
  { value: "B", label: "B" },
  { value: "Db", label: "D♭" },
  { value: "Eb", label: "E♭" },
  { value: "Gb", label: "G♭" },
  { value: "Ab", label: "A♭" },
  { value: "Bb", label: "B♭" },
];

const MODES = [
  { value: "major", label: "Major (Ionian)" },
  { value: "dorian", label: "Dorian" },
  { value: "phrygian", label: "Phrygian" },
  { value: "lydian", label: "Lydian" },
  { value: "mixolydian", label: "Mixolydian" },
  { value: "minor", label: "Minor (Aeolian)" },
  { value: "locrian", label: "Locrian" },
];

type AnyNote = Note & {
  subdivision?: number;
  highlightEvery?: number;
  highlightOffset?: number;
};

import { ScaleModuleConfig, ArpeggioModuleConfig } from "@/types/practice";

interface RiffPracticeProps {
  repertoireItem: RepertoireItem;
  sequences: Tables<"sequences">[];
  onComplete?: () => void;
  onExerciseSelect?: (exercise: RepertoireItem) => void;
  autoAdvance?: boolean;
  autoStart?: boolean;
  timeLimit?: number; // Time in seconds
  isControlledSession?: boolean; // If true, parent controls the session
  lessonExercise?: Tables<"lesson_exercises"> | null; // For lesson-specific settings
  sessionId?: string; // Optional session ID for grouping logs
  isConfigMode?: boolean; // Config mode: hide metronome, no playback - for session builder
  // Configuration sync
  moduleConfig?: ScaleModuleConfig | ArpeggioModuleConfig;
  onConfigChange?: (config: ScaleModuleConfig | ArpeggioModuleConfig) => void;
}

const RiffPractice = ({
  repertoireItem,
  sequences,
  onComplete,
  onExerciseSelect,
  autoAdvance = false,
  autoStart = false,
  timeLimit,
  isControlledSession = false,
  lessonExercise,
  sessionId,
  isConfigMode = false,
  moduleConfig,
  onConfigChange,
}: RiffPracticeProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: practiceSettings } = usePracticeSettings();
  const [noteIndex, setNoteIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!isConfigMode && autoStart);

  // Determine mode: Use progressive when in controlled session + settings say so
  // Priority: moduleConfig (from troubleshoot) > controlled session > lesson > regular
  const effectiveMode: MetronomeMode = moduleConfig?.metronome?.mode
    ? (moduleConfig.metronome.mode as MetronomeMode)
    : (isControlledSession && practiceSettings.practiceMode === 'progressive'
      ? 'progressive'
      : (lessonExercise?.metronome_mode as MetronomeMode) || 'regular');

  const [mode, setMode] = useState<MetronomeMode>(effectiveMode);
  const [loop, setLoop] = useState(moduleConfig?.metronome?.loop ?? (!isControlledSession || !practiceSettings.autoAdvance));
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [metronomeBpm, setMetronomeBpm] = useState(moduleConfig?.metronome?.bpm ?? (lessonExercise?.starting_bpm || 80));

  // Sync prop changes to state
  useEffect(() => {
    if (moduleConfig?.metronome) {
      if (moduleConfig.metronome.bpm !== undefined && moduleConfig.metronome.bpm !== metronomeBpm) setMetronomeBpm(moduleConfig.metronome.bpm);
      if (moduleConfig.metronome.mode && moduleConfig.metronome.mode !== mode) setMode(moduleConfig.metronome.mode as MetronomeMode);
      if (moduleConfig.metronome.loop !== undefined && moduleConfig.metronome.loop !== loop) setLoop(moduleConfig.metronome.loop);
    }
  }, [moduleConfig?.metronome]); // Deep check via memoized object or specific fields

  const [pitchDetectionEnabled, setPitchDetectionEnabled] = useState(true);
  const [activeSequence, setActiveSequence] = useState<Tables<"sequences"> | null>(null);
  const [practiceLog, setPracticeLog] = useState<Tables<'practice_log'> | null>(null);
  const [maxBpm, setMaxBpm] = useState<number | ''>('');
  const [perfectBpm, setPerfectBpm] = useState<number | ''>('');
  const [isLearning, setIsLearning] = useState(false);
  const [learnRepetitions, setLearnRepetitions] = useState(5);
  const [learnTimeline, setLearnTimeline] = useState<{ label: string | number, startIndex: number, endIndex: number }[]>([]);
  const [learnNotes, setLearnNotes] = useState<Note[]>([]);
  const [currentLearnIndex, setCurrentLearnIndex] = useState(0);
  const [harmonicContext, setHarmonicContext] = useState(repertoireItem.major_key);
  const [tonalContext, setTonalContext] = useState("major");
  const [playContextNote, setPlayContextNote] = useState(false);
  const tickCountRef = useRef(0);
  const [tickCountState, setTickCountState] = useState(0); // For triggering re-renders in EarTraining
  const [isRecordingArmed, setIsRecordingArmed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const autoRecordStartClickRef = useRef<number | null>(null);
  const recorder = useRecorder();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [autoRecordCountdown, setAutoRecordCountdown] = useState<number | null>(null);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [hasReachedTargetBpm, setHasReachedTargetBpm] = useState(false);
  const [trackedMaxBpm, setTrackedMaxBpm] = useState(0);

  useEffect(() => {
    setHarmonicContext(repertoireItem.major_key);
  }, [repertoireItem.major_key]);

  // Handle auto-start (skip in config mode)
  useEffect(() => {
    if (autoStart && !isConfigMode) {
      // Small delay to ensure audio context is ready/user interaction context is satisfied
      // Note: Modern browsers block audio without user interaction.
      // Since the user CLICKED "Start Practice Session" to get here,
      // the audio context should be allowed to resume/start.
      const timer = setTimeout(() => {
        if (metronome.audioContext.state === 'suspended') {
          metronome.audioContext.resume();
        }
        metronome.start();
        setIsPlaying(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isConfigMode]);

  const availableSequences = useMemo(() => {
    const itemType = repertoireItem.Type?.toLowerCase();

    // Debug logging for sequences drop down
    console.log('Filtering sequences:', {
      itemType,
      totalSequences: sequences.length,
      sampleSequenceType: sequences[0]?.Type,
      sampleSequenceTypeLower: sequences[0]?.Type?.toLowerCase()
    });

    // Filter by matching Type
    const filtered = sequences.filter((s) => s.Type?.toLowerCase() === itemType);
    console.log('Filtered sequences count:', filtered.length);

    // FALLBACK: If no sequences match the type, show all sequences
    // This ensures the module is always usable even if sequences data is incomplete
    if (filtered.length === 0 && sequences.length > 0) {
      console.log('No type-specific sequences found, using all sequences as fallback');
      return sequences;
    }

    return filtered;
  }, [sequences, repertoireItem]);

  useEffect(() => {
    if (availableSequences.length > 0) {
      setActiveSequence(availableSequences[0]);
    } else {
      setActiveSequence(null);
    }
  }, [availableSequences]);

  useEffect(() => {
    const fetchPracticeLog = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('practice_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('scale_id', repertoireItem.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setPracticeLog(data);
        setMaxBpm((data as any).max_bpm || '');
        setPerfectBpm((data as any).perfect_bpm || '');
      }
    };

    fetchPracticeLog();
  }, [repertoireItem.id, user]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching settings:", error);
      } else if (data && data.settings) {
        const settings = data.settings as { autoRecord: boolean };
        setAutoRecord(settings.autoRecord);
      }
    };

    fetchSettings();
  }, [user]);

  const handleSavePractice = async (audioBlob: Blob | null, duration: number) => {
    if (!user || !activeSequence) return;

    let audioUrl: string | null = null;
    if (audioBlob) {
      const { data, error } = await supabase.storage
        .from('practice')
        .upload(`${user.id}/${new Date().toISOString()}.webm`, audioBlob);

      if (error) {
        console.error('Error uploading recording:', error);
      } else {
        audioUrl = data.path;
      }
    }

    const { data: exerciseData, error: exerciseError } = await supabase
      .from('exercises')
      .insert({
        user_id: user.id,
        scale_id: repertoireItem.id,
        sequence_id: activeSequence.id,
        name: `${repertoireItem.name} - ${activeSequence.name}`,
      })
      .select()
      .single();

    if (exerciseError) {
      console.error("Error creating exercise:", exerciseError);
      return;
    }

    const { error } = await supabase.from('practice_log').insert({
      user_id: user.id,
      exercise_id: exerciseData.id,
      scale_id: repertoireItem.id,
      scale_shape_id: 'scale_shape' in repertoireItem ? repertoireItem.scale_shape as string : null,
      max_bpm: Number(maxBpm) || null,
      perfect_bpm: Number(perfectBpm) || null,
      audio: audioUrl,
      exercise_category: `${repertoireItem.name} - ${activeSequence.name}`,
      duration: Math.round(duration),
      session_id: sessionId,
    });

    if (error) {
      console.error("Error saving practice log:", error);
    } else {
      toast({
        title: "Practice session saved!",
      });
    }
    setShowSaveDialog(false);
  };

  const [drumBeat, setDrumBeat] = useState(false);

  // Calculate starting BPM
  // 1. If we found a previous session log, initialize metronomeBpm with progression (last + increment)
  useEffect(() => {
    if (practiceLog) {
      const lastBpm = (practiceLog as any).perfect_bpm || (practiceLog as any).max_bpm;
      if (lastBpm) {
        // Apply session increment setting
        const increment = practiceSettings.bpmIncrement || 0;
        const nextBpm = Math.min(lastBpm + increment, 200);

        // Only update if we haven't manually changed it significantly? 
        // For now, assume loading history takes precedence on mount/switch.
        setMetronomeBpm(nextBpm);

        console.log(`[Session Progression] Applied +${increment} increment. Last: ${lastBpm} -> Next: ${nextBpm}`);
      }
    }
  }, [practiceLog, practiceSettings.bpmIncrement]);

  const startingBpm = useMemo(() => {
    // If we are in a controlled session AND progressive mode, we might want to force logic
    // But generally, we want to respect the metronomeBpm state which is now seeded from history
    return lessonExercise?.starting_bpm || metronomeBpm;
  }, [lessonExercise?.starting_bpm, metronomeBpm]);

  const targetBpm = useMemo(() => {
    if (isControlledSession && practiceSettings.practiceMode === 'progressive') {
      return Math.min(startingBpm + 40, 200); // Target is 40 BPM higher
    }
    return lessonExercise?.target_bpm || metronomeBpm;
  }, [isControlledSession, practiceSettings.practiceMode, startingBpm, lessonExercise?.target_bpm, metronomeBpm]);

  const metronomeSettings = {
    mode: mode,
    loop: loop,
    startBpm: startingBpm,
    endBpm: targetBpm,
    measures: lessonExercise ? (lessonExercise.increments || 1) * (lessonExercise.measures_per_bpm || 4) : 8,
    measuresPerBpmChange: lessonExercise?.measures_per_bpm || 4,
    drumBeat,
    onComplete: isControlledSession && practiceSettings.autoAdvance ? onComplete : undefined,
  };

  const metronome = useMetronome({
    ...metronomeSettings,
    onTick: () => {
      if (isPlaying) {
        tickCountRef.current += 1;
        setTickCountState(tickCountRef.current); // Trigger re-render for ear training
        setNoteIndex((prevIndex) => prevIndex + 1);

        // Track max BPM during practice
        const currentBpm = metronome.state.currentBpm;
        if (currentBpm > trackedMaxBpm) {
          setTrackedMaxBpm(currentBpm);
        }

        // Auto-recording logic - depends on mode
        if (autoRecord && !hasRecorded && !isRecording) {
          if (mode === 'regular') {
            // Regular mode: Wait 4 beats, then record for 16 beats
            if (tickCountRef.current <= 4) {
              setAutoRecordCountdown(4 - tickCountRef.current);
            } else if (tickCountRef.current === 5) {
              // Start recording after 4 beats
              recorder.startRecording();
              setIsRecording(true);
              setAutoRecordCountdown(16);
            }
          } else {
            // Progressive/Speed-trainer: Wait for target BPM to be reached
            const targetBpm = metronomeSettings.endBpm;
            if (!hasReachedTargetBpm && currentBpm >= targetBpm) {
              // Just reached target BPM - mark it and reset counter for recording
              setHasReachedTargetBpm(true);
              tickCountRef.current = 0;
              setAutoRecordCountdown(16);
            } else if (hasReachedTargetBpm && tickCountRef.current === 1) {
              // First beat at target BPM - start recording
              recorder.startRecording();
              setIsRecording(true);
            }
          }
        }

        // Handle active recording - count down and stop after 16 beats
        if (isRecording) {
          const beatsRemaining = 16 - tickCountRef.current;
          setAutoRecordCountdown(beatsRemaining > 0 ? beatsRemaining : 0);

          if (tickCountRef.current >= 16) {
            recorder.stopRecording();
            setIsRecording(false);
            setAutoRecordCountdown(null);
            setHasRecorded(true);
            // Auto-disable auto-record after successful recording
            setAutoRecord(false);
            toast({
              title: "Recording complete!",
              description: "Auto-record has been disabled.",
            });
          }
        }

        if (playContextNote) {
          if (tickCountRef.current % 4 === 0) {
            const note = harmonicContext.replace("#", "s").replace("♭", "b");
            // Determine octave for context drone - usually lower? Let's stick to 3
            playNote(`${note}3`);
          }
        }
      }
    },
  });

  const { playNote } = useNotePlayer(metronome.audioContext);

  useEffect(() => {
    if (playContextNote && isPlaying) {
      const note = harmonicContext.replace("#", "s").replace("♭", "b");
      playNote(`${note}3`);
    }
  }, [playContextNote, isPlaying, harmonicContext, playNote]);

  // BPM control functionality
  const handleMetronomeBpmChange = useCallback(
    (bpm: number) => {
      const wasPlaying = metronome.state.isPlaying;
      setMetronomeBpm(bpm);

      // Sync changes back to moduleConfig if provided
      if (onConfigChange && moduleConfig) {
        // We need to determine if we are in Scale or Arpeggio mode to structure the config correctly?
        // Actually moduleConfig is already typed. We just update the metronome part.
        // However, TypeScript might complain if we don't know which specific type it is (Scale vs Arpeggio).
        // But both have `metronome` optional field.
        onConfigChange({
          ...moduleConfig,
          metronome: {
            ...(moduleConfig.metronome || { mode: 'regular', bpm: bpm, drum_beat: false, auto_record: false }),
            bpm: bpm
          }
        });
      }

      if (mode !== "regular" && wasPlaying) {
        metronome.stop();
        setTimeout(() => metronome.start(), 100);
      }
    },
    [metronome, mode, onConfigChange, moduleConfig]
  );

  // Global BPM adjustment controls (anywhere on page)
  useBpmControls({
    currentBpm: metronomeBpm,
    onBpmChange: handleMetronomeBpmChange,
    isEnabled: true,
  });


  const handleStop = useCallback(() => {
    metronome.stop();
    setIsPlaying(false);
    tickCountRef.current = 0;
    setNoteIndex(0);
    setElapsedTime(0);
    setStartTime(null);
  }, [metronome]);

  const handleRestart = useCallback(() => {
    setNoteIndex(0);
    tickCountRef.current = 0;
  }, []);

  const handleComplete = useCallback(() => {
    handleStop();
    onComplete?.();
  }, [handleStop, onComplete]);


  const handlePlay = useCallback(() => {
    if (!metronome.state.isPlaying) {
      // Reset tracking for new practice session
      setHasReachedTargetBpm(false);
      tickCountRef.current = 0;
      metronome.start();
    } else {
      metronome.pause();
      if (isRecording) {
        recorder.stopRecording();
        setIsRecording(false);
        setHasRecorded(true);
        setAutoRecord(false); // Auto-disable after recording
        toast({
          title: "Recording complete!",
        });
      }
      // Auto-fill max BPM from tracked value and show save dialog after meaningful practice
      if (tickCountRef.current > 40) {
        setMaxBpm(trackedMaxBpm || metronomeBpm);
        setShowSaveDialog(true);
      }
    }
    setIsPlaying(!metronome.state.isPlaying);
  }, [metronome, isRecording, recorder, toast, trackedMaxBpm, metronomeBpm]);

  const baseExerciseNotes = useMemo(() => {
    if (!activeSequence) {
      const rawNotes = repertoireItem.notes.map((note, index) => ({
        ...note,
        time: index,
        duration: 1,
      }));
      // Normalize to keep within fretboard bounds
      return normalizeNotesToFretboard(rawNotes);
    }

    const scale: Scale = {
      id: repertoireItem.id,
      name: repertoireItem.name,
      notes_json: repertoireItem.notes,
      Type: repertoireItem.Type || '',
    };

    const rawNotes = applySequenceToScale(
      scale,
      activeSequence.pattern_string,
      activeSequence.note_value,
      activeSequence.is_triplet
    );
    // Normalize to keep within fretboard bounds (shift octave if any fret < 0 or > 22)
    return normalizeNotesToFretboard(rawNotes);
  }, [activeSequence, repertoireItem]);

  // Ear training should use the original scale shape (repertoireItem.notes)
  // NOT the sequence-applied notes which have duplicates
  // This is more efficient and architecturally cleaner
  const scaleShapeNotes = useMemo(() => {
    const rawNotes = repertoireItem.notes.map(n => ({ string: n.string, fret: n.fret }));
    // Normalize to keep within fretboard bounds
    return normalizeNotesToFretboard(rawNotes);
  }, [repertoireItem.notes]);

  const generateLearnSequence = useCallback(() => {
    const baseNotes = baseExerciseNotes;
    const chunkSize = 3;
    const chunks = [];
    for (let i = 0; i < baseNotes.length; i += chunkSize) {
      chunks.push(baseNotes.slice(i, i + chunkSize));
    }

    const newNotes: Note[] = [];
    const timeline: { label: string | number, startIndex: number, endIndex: number }[] = [];
    let time = 0;

    // Handle single chunk case
    if (chunks.length === 1) {
      const chunk = chunks[0];
      const startIndex = newNotes.length;
      for (let r = 0; r < learnRepetitions; r++) {
        chunk.forEach(note => {
          newNotes.push({ ...note, time: time++, duration: 1 });
        });
      }
      timeline.push({ label: "1", startIndex, endIndex: newNotes.length - 1 });
    } else {
      // Standard linking behavior for multiple chunks
      for (let i = 1; i < chunks.length; i++) {
        // A: previous chunk
        const prevChunkStartIndex = newNotes.length;
        for (let r = 0; r < learnRepetitions; r++) {
          chunks[i - 1].forEach(note => {
            newNotes.push({ ...note, time: time++, duration: 1 });
          });
        }
        timeline.push({ label: `${i}`, startIndex: prevChunkStartIndex, endIndex: newNotes.length - 1 });

        // B: current chunk
        const currentChunkStartIndex = newNotes.length;
        for (let r = 0; r < learnRepetitions; r++) {
          chunks[i].forEach(note => {
            newNotes.push({ ...note, time: time++, duration: 1 });
          });
        }
        timeline.push({ label: `${i + 1}`, startIndex: currentChunkStartIndex, endIndex: newNotes.length - 1 });

        // C: combined
        const combined = [...chunks[i - 1], ...chunks[i]];
        const combinedStartIndex = newNotes.length;
        for (let r = 0; r < learnRepetitions; r++) {
          combined.forEach(note => {
            newNotes.push({ ...note, time: time++, duration: 1 });
          });
        }
        timeline.push({ label: `${i}-${i + 1}`, startIndex: combinedStartIndex, endIndex: newNotes.length - 1 });
      }
    }

    setLearnNotes(newNotes);
    setLearnTimeline(timeline);
  }, [baseExerciseNotes, learnRepetitions]);

  useEffect(() => {
    if (isLearning) {
      generateLearnSequence();
    } else {
      setLearnNotes([]);
      setLearnTimeline([]);
    }
  }, [isLearning, generateLearnSequence]);

  const displayNotes = useMemo(() => {
    if (isLearning) {
      return learnNotes;
    }
    return baseExerciseNotes;
  }, [isLearning, learnNotes, baseExerciseNotes]);

  useEffect(() => {
    if (loop) {
      if (isLearning) {
        const currentSection = learnTimeline[currentLearnIndex];
        if (currentSection && noteIndex >= currentSection.endIndex) {
          setNoteIndex(currentSection.startIndex);
        }
      } else if (noteIndex >= displayNotes.length - 1) {
        setNoteIndex(0);
      }
    }
    if (isLearning) {
      const currentSection = learnTimeline.findIndex(
        (section) => noteIndex >= section.startIndex && noteIndex <= section.endIndex
      );
      if (currentSection !== -1 && currentSection !== currentLearnIndex) {
        setCurrentLearnIndex(currentSection);
      }
    }
  }, [noteIndex, displayNotes.length, loop, isLearning, learnTimeline, currentLearnIndex]);

  const currentTime = useMemo(() => {
    if (noteIndex >= displayNotes.length) {
      return 0;
    }
    return displayNotes[noteIndex].time;
  }, [noteIndex, displayNotes]);
  const highlightDirectives = useMemo(() => {
    let highlightEvery: number | undefined;
    let highlightOffset: number | undefined;
    for (const n of repertoireItem.notes as unknown as AnyNote[]) {
      const he = n.highlightEvery;
      const ho = n.highlightOffset;
      if (typeof he === "number" && he > 0) highlightEvery = he;
      if (typeof ho === "number") highlightOffset = ho;
      if (highlightEvery !== undefined && highlightOffset !== undefined) break;
    }
    return { highlightEvery, highlightOffset };
  }, [repertoireItem.notes]);
  const maxNoteTime =
    displayNotes.length > 0
      ? Math.max(...displayNotes.map((note) => note.time + note.duration))
      : 0;
  const progress =
    displayNotes.length > 0 ? (noteIndex / displayNotes.length) * 100 : 0;

  return (
    <>
      <div className="flex flex-col h-full bg-background text-foreground overflow-hidden bpm-control-area">
        <div className="flex-shrink-0 bg-card border-b border-border p-2 sm:p-4">
          <div className="flex justify-between items-start">
            {/* Left side: Exercise Info and Controls */}
            <div className="flex flex-col space-y-1 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-bold">{repertoireItem.name}</h2>
                <div className="hidden sm:flex items-center gap-2">
                  <Label htmlFor="harmonic-context" className="text-sm">Harmonic Context</Label>
                  <Select
                    value={harmonicContext}
                    onValueChange={setHarmonicContext}
                  >
                    <SelectTrigger className="w-[180px]" id="harmonic-context">
                      <SelectValue placeholder="Select a key" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAJOR_KEYS.map((key) => (
                        <SelectItem key={key.value} value={key.value}>
                          {key.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2 ml-4">
                    <Checkbox
                      id="play-context-note"
                      checked={playContextNote}
                      onCheckedChange={(checked) => setPlayContextNote(Boolean(checked))}
                    />
                    <Label htmlFor="play-context-note">Play Context Note</Label>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tonal-context" className="text-sm">Tonal Context</Label>
                  <Select value={tonalContext} onValueChange={setTonalContext}>
                    <SelectTrigger className="w-[180px]" id="tonal-context">
                      <SelectValue placeholder="Select a mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2 text-sm mt-1">
                  <span className="px-2 py-0.5 bg-secondary rounded-full text-secondary-foreground">
                    {repertoireItem.category}
                  </span>
                  <span className="px-2 py-0.5 bg-secondary rounded-full text-secondary-foreground">
                    {repertoireItem.difficulty}/10
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-record"
                    checked={autoRecord}
                    onCheckedChange={(checked) => setAutoRecord(Boolean(checked))}
                  />
                  <Label htmlFor="auto-record">Auto Record</Label>
                  {autoRecordCountdown !== null && (
                    <span className="text-xs text-muted-foreground">
                      ({autoRecordCountdown})
                    </span>
                  )}
                </div>
              </div>
              <div className="hidden sm:block">
                <Select
                  value={activeSequence?.id.toString()}
                  onValueChange={(value) => {
                    const selectedSequence = availableSequences.find(
                      (s) => s.id.toString() === value
                    );
                    if (selectedSequence) {
                      setActiveSequence(selectedSequence);
                    }
                  }}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select an exercise" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSequences.map((sequence) => (
                      <SelectItem key={sequence.id} value={sequence.id.toString()}>
                        {sequence.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right side: Metronome - hidden in config mode */}
            {!isConfigMode && (
              <div className="flex items-start space-x-4">
                <div className="flex flex-col items-center space-y-2">
                  <BeatVisualizer
                    currentBeat={metronome.state.currentBeat}
                    isPlaying={metronome.state.isPlaying}
                    currentBpm={
                      metronome.state.isPlaying
                        ? metronome.state.currentBpm
                        : metronomeBpm
                    }
                  />
                  <MetronomeControls
                    isPlaying={isPlaying}
                    onPlayPause={handlePlay}
                    onRestart={handleRestart}
                    onStateChange={(newState) => {
                      setMode(newState.mode);
                      setMetronomeBpm(newState.startBpm);
                      setLoop(newState.loop);
                      setDrumBeat(!!newState.drumBeat);

                      // Sync changes back to moduleConfig if provided
                      if (onConfigChange && moduleConfig) {
                        onConfigChange({
                          ...moduleConfig,
                          metronome: {
                            ...(moduleConfig.metronome || { mode: 'regular', bpm: 60, drum_beat: false, auto_record: false }),
                            mode: newState.mode,
                            bpm: newState.startBpm,
                            loop: newState.loop,
                            drum_beat: newState.drumBeat,
                            // Preserve or sync other fields
                            increments: newState.increments,
                            measures_per_increment: newState.measuresPerIncrement,
                            step_bpm: newState.progressiveStepBpm
                          }
                        });
                      }
                    }}
                    initialState={{
                      mode,
                      startBpm: metronomeBpm,
                      endBpm: lessonExercise?.target_bpm || (metronomeBpm + 40),
                      increments: lessonExercise?.increments || 8,
                      measuresPerIncrement: lessonExercise?.measures_per_bpm || 4,
                      loop,
                      drumBeat,
                      progressiveStepBpm:
                        lessonExercise?.progressive_step_bpm || 5,
                    }}
                    compact
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Ear Training Layout Slot - Full Width Bar (Responsive) */}
        <div id="ear-training-ui-slot" className="w-full flex justify-start md:justify-center border-b border-border bg-card/30 empty:hidden min-h-0 overflow-x-auto" />
        <main className="flex-1 min-h-0 overflow-hidden">
          <NoteDisplay
            notes={displayNotes}
            major_key={harmonicContext}
            tonalContext={tonalContext}
            currentPosition={currentTime}
            isLearning={isLearning}
            setIsLearning={setIsLearning}
            learnRepetitions={learnRepetitions}
            setLearnRepetitions={setLearnRepetitions}
            setMetronomeBpm={setMetronomeBpm}
            handlePlay={handlePlay}
            handleStart={() => {
              if (!metronome.state.isPlaying) {
                handlePlay();
              }
            }}
            learnTimeline={learnTimeline}
            currentLearnIndex={currentLearnIndex}
            setNoteIndex={setNoteIndex}
            setCurrentLearnIndex={setCurrentLearnIndex}
            scaleShapeNotes={scaleShapeNotes}
            tickCount={tickCountState}
          />
        </main>
      </div>
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Practice Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="max-bpm">Max BPM</Label>
              <Input id="max-bpm" type="number" value={maxBpm} onChange={(e) => setMaxBpm(parseInt(e.target.value, 10))} />
            </div>
            <div>
              <Label htmlFor="perfect-bpm">Perfect BPM</Label>
              <Input id="perfect-bpm" type="number" value={perfectBpm} onChange={(e) => setPerfectBpm(parseInt(e.target.value, 10))} />
            </div>
            <Button onClick={() => handleSavePractice(recorder.recorderState.audioBlob, recorder.recorderState.duration)}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RiffPractice;
