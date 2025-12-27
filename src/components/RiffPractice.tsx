import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RepertoireItem } from "@/types/repertoire";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useNotePlayer } from "@/hooks/useNotePlayer";
import { useRecorder } from "@/hooks/useRecorder";
import { useBpmControls } from "@/hooks/useBpmControls";
import NoteDisplay from "./NoteDisplay";
import { BeatVisualizer } from "./BeatVisualizer";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { RecordingControls } from "./RecordingControls";
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

interface RiffPracticeProps {
  repertoireItem: RepertoireItem;
  sequences: Tables<"sequences">[];
  onComplete?: () => void;
  onExerciseSelect?: (exercise: RepertoireItem) => void;
  autoAdvance?: boolean;
  timeLimit?: number; // Time in seconds
  isControlledSession?: boolean; // If true, parent controls the session
  lessonExercise?: Tables<"lesson_exercises"> | null; // For lesson-specific settings
}

const RiffPractice = ({
  repertoireItem,
  sequences,
  onComplete,
  onExerciseSelect,
  autoAdvance = false,
  timeLimit,
  isControlledSession = false,
  lessonExercise,
}: RiffPracticeProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [noteIndex, setNoteIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<MetronomeMode>(
    (lessonExercise?.metronome_mode as MetronomeMode) || "regular"
  );
  const [loop, setLoop] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [metronomeBpm, setMetronomeBpm] = useState(lessonExercise?.starting_bpm || 80);
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
  const [isRecordingArmed, setIsRecordingArmed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const autoRecordStartClickRef = useRef<number | null>(null);
  const recorder = useRecorder();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [autoRecordCountdown, setAutoRecordCountdown] = useState<number | null>(null);
  const [hasRecorded, setHasRecorded] = useState(false);

  useEffect(() => {
    setHarmonicContext(repertoireItem.major_key);
  }, [repertoireItem.major_key]);

  const availableSequences = useMemo(() => {
    const itemType = repertoireItem.Type;
    return sequences.filter((s) => s.Type === itemType);
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
        setMaxBpm(data.max_bpm || '');
        setPerfectBpm(data.perfect_bpm || '');
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

  const metronomeSettings: MetronomeSettings = {
    mode,
    startBpm: lessonExercise?.starting_bpm || metronomeBpm,
    endBpm: lessonExercise?.target_bpm || metronomeBpm,
    measures: lessonExercise ? (lessonExercise.increments || 1) * (lessonExercise.measures_per_bpm || 4) : 8,
    measuresPerBpmChange: lessonExercise?.measures_per_bpm || 4,
  };

  const metronome = useMetronome({
    ...metronomeSettings,
    onTick: () => {
      if (isPlaying) {
        tickCountRef.current += 1;
        setNoteIndex((prevIndex) => prevIndex + 1);

        if (isRecordingArmed) {
          if (tickCountRef.current >= 4) {
            recorder.startRecording();
            setIsRecording(true);
            setIsRecordingArmed(false);
            tickCountRef.current = 0; // Reset for recording duration
          }
        } else if (isRecording) {
          const recordDuration = activeSequence?.num_clicks || 16;
          setAutoRecordCountdown(recordDuration - tickCountRef.current);
          if (tickCountRef.current >= recordDuration) {
            recorder.stopRecording();
            setIsRecording(false);
            setAutoRecordCountdown(null);
            setHasRecorded(true);
            toast({
              title: "Recording complete!",
            });
          }
        } else if (autoRecord && !hasRecorded && autoRecordStartClickRef.current) {
          const countdown = autoRecordStartClickRef.current - tickCountRef.current;
          setAutoRecordCountdown(countdown);
          if (countdown <= 0) {
            recorder.startRecording();
            setIsRecording(true);
            setAutoRecordCountdown(null);
            tickCountRef.current = 0;
          }
        }

        if (playContextNote) {
          if (tickCountRef.current % 4 === 0) {
            const note = harmonicContext.replace("#", "s").replace("♭", "b");
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
      if (mode !== "regular" && wasPlaying) {
        metronome.stop();
        setTimeout(() => metronome.start(), 100);
      }
    },
    [metronome, mode]
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
      if (autoRecord && !hasRecorded) {
        autoRecordStartClickRef.current = Math.floor(Math.random() * (90 - 30 + 1)) + 30;
      }
      metronome.start();
    } else {
      metronome.pause();
      if (isRecording) {
        recorder.stopRecording();
        setIsRecording(false);
        setHasRecorded(true);
        toast({
          title: "Recording complete!",
        });
      }
      if (tickCountRef.current > 40) {
        setShowSaveDialog(true);
      }
    }
    setIsPlaying(!metronome.state.isPlaying);
  }, [metronome, autoRecord, isRecording, recorder, hasRecorded, toast]);

  const baseExerciseNotes = useMemo(() => {
    if (!activeSequence) {
      return repertoireItem.notes.map((note, index) => ({
        ...note,
        time: index,
        duration: 1,
      }));
    }

    const scale: Scale = {
      id: repertoireItem.id,
      name: repertoireItem.name,
      notes_json: repertoireItem.notes,
      Type: repertoireItem.Type || '',
    };

    return applySequenceToScale(
      scale,
      activeSequence.pattern_string,
      activeSequence.note_value,
      activeSequence.is_triplet
    );
  }, [activeSequence, repertoireItem]);

  // Ear training should use the original scale shape (repertoireItem.notes)
  // NOT the sequence-applied notes which have duplicates
  // This is more efficient and architecturally cleaner
  const scaleShapeNotes = useMemo(() => {
    return repertoireItem.notes.map(n => ({ string: n.string, fret: n.fret }));
  }, [repertoireItem.notes]);

  const generateLearnSequence = useCallback(() => {
    const baseNotes = baseExerciseNotes;
    const chunks = [];
    for (let i = 0; i < baseNotes.length; i += 5) {
      chunks.push(baseNotes.slice(i, i + 5));
    }

    const newNotes: Note[] = [];
    const timeline: { label: string | number, startIndex: number, endIndex: number }[] = [];
    let time = 0;

    for (let i = 1; i < chunks.length; i++) {
      // A: previous chunk
      const prevChunkStartIndex = newNotes.length;
      for (let r = 0; r < learnRepetitions; r++) {
        chunks[i - 1].forEach(note => {
          newNotes.push({ ...note, time: time++, duration: 1 });
        });
      }
      timeline.push({ label: "|", startIndex: prevChunkStartIndex, endIndex: newNotes.length - 1 });

      // B: current chunk
      const currentChunkStartIndex = newNotes.length;
      for (let r = 0; r < learnRepetitions; r++) {
        chunks[i].forEach(note => {
          newNotes.push({ ...note, time: time++, duration: 1 });
        });
      }
      timeline.push({ label: "", startIndex: currentChunkStartIndex, endIndex: newNotes.length - 1 });

      // C: combined
      const combined = [...chunks[i - 1], ...chunks[i]];
      const combinedStartIndex = newNotes.length;
      for (let r = 0; r < learnRepetitions; r++) {
        combined.forEach(note => {
          newNotes.push({ ...note, time: time++, duration: 1 });
        });
      }
      timeline.push({ label: "", startIndex: combinedStartIndex, endIndex: newNotes.length - 1 });
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
    if (loop && noteIndex >= displayNotes.length - 1) {
      setNoteIndex(0);
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
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden bpm-control-area">
        <div className="flex-shrink-0 bg-card border-b border-border p-4">
          <div className="flex justify-between items-start">
            {/* Left side: Exercise Info and Controls */}
            <div className="flex flex-col space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold">{repertoireItem.name}</h2>
                <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-4">
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
              <div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <span className="px-2 py-0.5 bg-secondary rounded-full text-secondary-foreground">
                    {repertoireItem.category}
                  </span>
                  <span className="px-2 py-0.5 bg-secondary rounded-full text-secondary-foreground">
                    {repertoireItem.difficulty}/10
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
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
              <div>
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

            {/* Right side: Metronome */}
            <div className="flex items-start space-x-4">
              <RecordingControls
                onSave={async (audioBlob, duration, maxBpm, perfectBpm) => {
                  if (!user || !repertoireItem || !activeSequence) return;
                  const { data, error } = await supabase.storage
                    .from('practice')
                    .upload(`${user.id}/${new Date().toISOString()}.webm`, audioBlob);

                  if (error) {
                    console.error('Error uploading recording:', error);
                    return;
                  }

                  await supabase.from('practice_log').insert({
                    user_id: user.id,
                    exercise_id: activeSequence.id,
                    scale_id: repertoireItem.id,
                    scale_shape_id: 'scale_shape' in repertoireItem ? repertoireItem.scale_shape as string : null,
                    max_bpm: maxBpm,
                    perfect_bpm: perfectBpm,
                    audio: data.path,
                    exercise_category: `${repertoireItem.name} - ${activeSequence.name}`,
                    duration: Math.round(duration),
                  });
                }}
              />
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
                  }}
                  initialState={{
                    mode,
                    startBpm: metronomeBpm,
                    endBpm: lessonExercise?.target_bpm || (metronomeBpm + 40),
                    increments: lessonExercise?.increments || 8,
                    measuresPerIncrement: lessonExercise?.measures_per_bpm || 4,
                    loop,
                    progressiveStepBpm:
                      lessonExercise?.progressive_step_bpm || 5,
                  }}
                  compact
                />
              </div>
            </div>
          </div>
        </div>
        <main className="flex-grow h-[calc(100vh-10rem)]">
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
            learnTimeline={learnTimeline}
            currentLearnIndex={currentLearnIndex}
            setNoteIndex={setNoteIndex}
            setCurrentLearnIndex={setCurrentLearnIndex}
            scaleShapeNotes={scaleShapeNotes}
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
