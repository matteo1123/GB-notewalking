import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { FRET_COUNT, findAllNoteOccurrences, notes as allNotes, getNote, getNoteWithEnharmonicPreference, determineEnharmonicNotes } from '@/lib/musicTheory';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import Fretboard from '@/components/Fretboard';
import { ScaleShapeForm } from '@/components/ScaleShapeEditor/ScaleShapeForm';
import NoteDisplay from '@/components/NoteDisplay';

const ShapeLibrary = () => {
  const { user } = useAuth();
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [rootNote, setRootNote] = useState(null);
  const [scaleName, setScaleName] = useState('');
  const [intervals, setIntervals] = useState('');
  const [notes, setNotes] = useState('');
  const [highlightedNotes, setHighlightedNotes] = useState([]);
  const [scaleType, setScaleType] = useState('All');
  const [position, setPosition] = useState(1);
  const [mode, setMode] = useState('Ionian');
  const [tonality, setTonality] = useState('Major');
  const [savedShapes, setSavedShapes] = useState<(Tables<'scale_shapes'> & { Type: string, Mode: string, Position: number, tonality: string, root_fret: number, notes: string[], shape_json: { string: number, fret_offset: number }[] })[]>([]);
  const [shapeToGeneralize, setShapeToGeneralize] = useState('');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [previewNotes, setPreviewNotes] = useState([]);
  const { toast } = useToast();

  // Chord-specific state
  const [chordQuality, setChordQuality] = useState('major');
  const [isMovable, setIsMovable] = useState(false);
  const [savedChordShapes, setSavedChordShapes] = useState<any[]>([]);

  const SCALE_TYPES = ['2 notes per string scale', '3 notes per string scale', '4 notes per string scale', 'chord', 'arpeggio'];
  const CHORD_QUALITIES = ['major', 'minor', 'diminished', 'augmented', 'dominant7', 'minor7', 'major7'];

  // Check if we're in chord mode
  const isChordMode = scaleType === 'chord';

  const fetchShapes = async () => {
    const { data, error } = await supabase.from('scale_shapes').select('*').order('name');
    if (error) {
      toast({ title: "Error fetching shapes", description: error.message });
    } else if (data) {
      setSavedShapes(data as (Tables<'scale_shapes'> & { Type: string, Mode: string, Position: number, tonality: string, root_fret: number, notes: string[], shape_json: { string: number, fret_offset: number }[] })[]);
    }
  };

  const fetchChordShapes = async () => {
    const { data, error } = await supabase.from('chord_shapes' as any).select('*').order('name');
    if (error) {
      toast({ title: "Error fetching chord shapes", description: error.message });
    } else if (data) {
      setSavedChordShapes(data || []);
    }
  };

  useEffect(() => {
    fetchShapes();
    fetchChordShapes();
  }, []);

  useEffect(() => {
    if (selectedNotes.length > 0 && rootNote) {
      const rootNoteName = getNote(rootNote.string, rootNote.fret);
      const rootNoteIndex = allNotes.indexOf(rootNoteName);

      const calculatedIntervals = selectedNotes.map(note => {
        const noteName = getNote(note.string, note.fret);
        const noteIndex = allNotes.indexOf(noteName);
        return (noteIndex - rootNoteIndex + 12) % 12;
      });
      const uniqueIntervals = [...new Set(calculatedIntervals)].sort((a, b) => a - b);
      setIntervals(uniqueIntervals.join(','));

      const calculatedNotes = selectedNotes.map(note => getNote(note.string, note.fret));
      const uniqueNotes = [...new Set(calculatedNotes)];
      const enharmonicNotes = determineEnharmonicNotes(uniqueNotes, rootNoteName);
      const rootNoteIndexInScale = enharmonicNotes.indexOf(rootNoteName);
      const sortedNotes = [
        ...enharmonicNotes.slice(rootNoteIndexInScale),
        ...enharmonicNotes.slice(0, rootNoteIndexInScale)
      ];
      setNotes(sortedNotes.join(','));


      const notes = selectedNotes.map((note, index) => ({
        ...note,
        time: index * 0.5,
        duration: 0.5,
      }));
      setPreviewNotes(notes);
    } else {
      setPreviewNotes([]);
      setIntervals('');
      setNotes('');
    }
  }, [selectedNotes, rootNote]);

  const toggleNote = (string, fret) => {
    const note = { string, fret };
    const noteIndex = selectedNotes.findIndex(n => n.string === string && n.fret === fret);

    if (noteIndex > -1) {
      setSelectedNotes(selectedNotes.filter((_, i) => i !== noteIndex));
    } else {
      setSelectedNotes([...selectedNotes, note]);
    }
  };

  const setAsRoot = (string, fret) => {
    const isAlreadyRoot = rootNote && rootNote.string === string && rootNote.fret === fret;

    if (isAlreadyRoot) {
      setRootNote(null);
      setHighlightedNotes([]);
    } else {
      setRootNote({ string, fret });
      if (!selectedNotes.some(n => n.string === string && n.fret === fret)) {
        setSelectedNotes(prev => [...prev, { string, fret }]);
      }

      const rootNoteName = getNote(string, fret);
      setHighlightedNotes(findAllNoteOccurrences(rootNoteName));
    }
  };

  const saveShape = async (isSaveAs = false) => {
    if (!rootNote) {
      toast({ title: "Error", description: "Please select a root note." });
      return;
    }
    if (!scaleName) {
      toast({ title: "Error", description: "Please enter a name for the shape." });
      return;
    }
    if (scaleType === 'All' && !selectedShapeId && !isSaveAs) {
      toast({ title: "Error", description: "Please select a specific type." });
      return;
    }

    const shape_json = selectedNotes
      .map(note => ({
        string: note.string,
        fret_offset: note.fret - rootNote.fret,
      }))
      .sort((a, b) => {
        if (a.string > b.string) return -1;
        if (a.string < b.string) return 1;
        return a.fret_offset - b.fret_offset;
      });

    const root_fret = 0;

    const rootNoteName = getNote(rootNote.string, rootNote.fret);
    const rootNoteIndex = allNotes.indexOf(rootNoteName);

    const calculatedIntervals = selectedNotes.map(note => {
      const noteName = getNote(note.string, note.fret);
      const noteIndex = allNotes.indexOf(noteName);
      return (noteIndex - rootNoteIndex + 12) % 12;
    });

    const calculatedNotes = selectedNotes.map(note => getNote(note.string, note.fret));

    let error;

    if (isChordMode) {
      // Save to chord_shapes table
      const chordShapeData = {
        name: scaleName,
        chord_quality: chordQuality,
        root_fret,
        shape_json,
        intervals: calculatedIntervals,
        notes: calculatedNotes,
        is_movable: isMovable,
      };

      if (selectedShapeId && !isSaveAs) {
        const { error: updateError } = await supabase
          .from('chord_shapes' as any)
          .update(chordShapeData)
          .eq('id', selectedShapeId);
        error = updateError;
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('chord_shapes' as any)
          .insert([chordShapeData])
          .select();
        error = insertError;
        if (!error && insertData) {
          setSelectedShapeId(insertData[0].id);
        }
      }
    } else {
      // Save to scale_shapes table (existing logic)
      const shapeData = {
        name: scaleName,
        shape_json,
        root_fret,
        intervals: calculatedIntervals,
        notes: calculatedNotes,
        Type: scaleType,
        Position: position,
        Mode: mode,
        tonality: tonality
      };

      if (selectedShapeId && !isSaveAs) {
        const { error: updateError } = await supabase
          .from('scale_shapes')
          .update(shapeData)
          .eq('id', selectedShapeId);
        error = updateError;
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('scale_shapes')
          .insert([shapeData])
          .select();
        error = insertError;
        if (!error && insertData) {
          setSelectedShapeId(insertData[0].id);
        }
      }
    }

    if (error) {
      toast({ title: `Error saving ${isChordMode ? 'chord' : 'scale'} shape`, description: error.message });
    } else {
      toast({ title: "Success", description: `${isChordMode ? 'Chord' : 'Scale'} shape saved successfully. ${isSaveAs ? 'You are now editing the new shape.' : ''}` });
      if (isSaveAs) {
        // Don't clear the form, just update the ID
      } else {
        setSelectedNotes([]);
        setRootNote(null);
        setScaleName('');
        setIntervals('');
        setNotes('');
        setHighlightedNotes([]);
        setScaleType('All');
        setPosition(1);
        setMode('Ionian');
        setTonality('Major');
        setSelectedShapeId(null);
      }
      fetchShapes();
    }
  };

  const handleSave = () => saveShape(false);
  const handleSaveAs = () => saveShape(true);

  const modeToMajorKeyInfo = {
    'Ionian': { degree: 1, semitone_offset: 0 },
    'Dorian': { degree: 2, semitone_offset: 2 },
    'Phrygian': { degree: 3, semitone_offset: 4 },
    'Lydian': { degree: 4, semitone_offset: 5 },
    'Mixolydian': { degree: 5, semitone_offset: 7 },
    'Aeolian': { degree: 6, semitone_offset: 9 },
    'Locrian': { degree: 7, semitone_offset: 11 },
  };

  const handleGeneralize = async () => {
    if (!shapeToGeneralize) {
      toast({ title: "Error", description: "Please select a shape to generalize." });
      return;
    }

    const sourceShape = isChordMode
      ? savedChordShapes.find(s => s.id === shapeToGeneralize)
      : savedShapes.find(s => s.id === shapeToGeneralize);

    if (!sourceShape) {
      toast({ title: "Error", description: "Could not find the selected shape." });
      return;
    }

    const rootFret = sourceShape.root_fret;
    // Chords might default to 0 if root_fret is missing
    const effectiveRootFret = rootFret ?? 0;

    const rootNoteInShape = sourceShape.shape_json.find(n => n.fret_offset === effectiveRootFret);
    if (!rootNoteInShape) {
      toast({ title: "Error", description: `Could not find root note in shape "${sourceShape.name}".` });
      return;
    }
    const rootString = rootNoteInShape.string;

    // Logic for Single Non-Movable Chord
    if (isChordMode && !sourceShape.is_movable) {
      // Insert simplified single chord
      const rootNoteName = getNote(rootString, effectiveRootFret); // E.g. "C" for C Open

      const newChord = {
        name: sourceShape.name, // "C Major Open"
        chord_name: rootNoteName, // "C"
        chord_quality: sourceShape.chord_quality,
        root_note: rootNoteName,
        intervals: sourceShape.intervals,
        notes: sourceShape.notes,
        notes_json: sourceShape.shape_json, // Absolute positions already in shape_json for open chords? No, shape_json is offsets.
        // For Open Chords (root_fret=0), offsets ARE absolute frets. 
        // But let's verify format. shape_json has {string, fret_offset}. 
        // If root_fret=0, then fret=fret_offset. Correct.
        chord_shape_id: sourceShape.id,
        is_movable: sourceShape.is_movable || false,
        created_by: user?.id,
      };

      // We need to map notes_json to include time/duration for playback if needed, or just store raw shape
      // The 'chords' table notes_json expects absolute positions.
      const finalNotesJson = sourceShape.shape_json.map((n: any) => ({
        string: n.string,
        fret: n.fret_offset, // Absolute for open chord
        time: 0,
        duration: 1
      }));

      const { error } = await supabase.from('chords' as any).insert([{ ...newChord, notes_json: finalNotesJson }]);

      if (error) {
        toast({ title: "Error generalizing chord", description: error.message, variant: 'destructive' });
      } else {
        toast({ title: "Success", description: `Saved single chord: ${sourceShape.name}` });
      }
      return;
    }

    // Logic for Chromatic Generalization (Movable Chords & Scales)
    const newItems = [];

    for (const rootNoteName of allNotes) {
      let startingFret = -1;
      // Find where this root note exists on the root string
      for (let f = 0; f <= FRET_COUNT; f++) {
        if (getNote(rootString, f) === rootNoteName) {
          startingFret = f;
          break;
        }
      }

      if (startingFret === -1) continue;

      // Calculate notes shifted by (startingFret - effectiveRootFret)
      // Actually simpler: Shape is defined relative to root_fret. 
      // If we put the root at 'startingFret', then all notes shift by 'startingFret' (assuming 0-indexed relative)

      // Wait, shape_json is {fret_offset} relative to root_fret?
      // In saveShape: fret_offset = note.fret - rootNote.fret
      // So yes, fret_offset is relative. 0 = root.

      let newNotesJson = sourceShape.shape_json.map((note: any, index: number) => {
        return {
          string: note.string,
          fret: startingFret + note.fret_offset,
          time: index * 0.5,
          duration: 0.5,
        };
      });

      // Wrap around? No, chords don't wrap. If fret > 24 or < 0, it's invalid.
      // But maybe we want to find the lowest valid position?
      // For now, simple shift. If it goes off board, ignore?
      if (newNotesJson.some(n => n.fret < 0 || n.fret > FRET_COUNT)) {
        // Try octave shift?
        // If too high -> shift down 12. If too low -> shift up 12.
        const shiftedDown = newNotesJson.map(n => ({ ...n, fret: n.fret - 12 }));
        if (!shiftedDown.some(n => n.fret < 0)) {
          newNotesJson = shiftedDown;
        } else {
          // Ignore if cannot fit
          // continue; 
          // Actually we often want to generate it even if high up
        }
      }

      const filteredNotesJson = newNotesJson.filter(note => note.fret >= 0 && note.fret <= FRET_COUNT);
      if (filteredNotesJson.length === 0) continue;

      const enharmonicallyCorrectRoot = getNoteWithEnharmonicPreference(rootString, startingFret, null); // Key?

      // Calculate Note Names
      const newNotes = filteredNotesJson.map(note => getNote(note.string, note.fret));
      const uniqueNotes = [...new Set(newNotes)];
      const enharmonicNotes = determineEnharmonicNotes(uniqueNotes, enharmonicallyCorrectRoot);

      if (isChordMode) {
        const newChord = {
          name: `${enharmonicallyCorrectRoot} ${sourceShape.chord_quality}`, // e.g. "C Major"
          chord_name: enharmonicallyCorrectRoot, // "C"
          chord_quality: sourceShape.chord_quality,
          root_note: rootNoteName,
          intervals: sourceShape.intervals,
          notes: enharmonicNotes,
          notes_json: filteredNotesJson,
          chord_shape_id: sourceShape.id,
          is_movable: true,
          created_by: user?.id,
        };
        newItems.push(newChord);
      } else {
        // Scale Logic (existing)
        const modeInfo = modeToMajorKeyInfo[sourceShape.Mode];
        let majorKey = null;
        if (modeInfo) {
          const rootNoteIndex = allNotes.indexOf(rootNoteName);
          const majorKeyIndex = (rootNoteIndex - modeInfo.semitone_offset + 12) % 12;
          majorKey = allNotes[majorKeyIndex];
        }

        const newScale = {
          name: `${enharmonicallyCorrectRoot} ${sourceShape.name}`,
          intervals: sourceShape.intervals,
          notes: enharmonicNotes,
          notes_json: filteredNotesJson,
          root_note: rootNoteName,
          Type: sourceShape.Type,
          Position: sourceShape.Position,
          mode: sourceShape.Mode,
          tonality: sourceShape.tonality,
          major_key: majorKey,
          created_by: user?.id,
          scale_shape: sourceShape.id,
        };
        newItems.push(newScale);
      }
    }

    const table = isChordMode ? 'chords' : 'scales';
    const { error } = await supabase.from(table as any).insert(newItems);

    if (error) {
      toast({ title: "Error generalizing", description: error.message, variant: 'destructive' });
    } else {
      toast({ title: "Success", description: `Generated ${newItems.length} items for ${sourceShape.name}.` });
    }
  };

  const handleShapeSelect = (e) => {
    const shapeId = e.target.value;
    if (!shapeId) {
      // clear logic ...
      setSelectedNotes([]);
      setRootNote(null);
      setScaleName('');
      setIntervals('');
      setNotes('');
      if (!isChordMode) setScaleType('All'); // Keep in chord mode if that's what we were doing?
      // actually, if we deselect, we might want to stay in the current mode
      setHighlightedNotes([]);
      setSelectedShapeId(null);
      return;
    }

    const selectedShape = isChordMode
      ? savedChordShapes.find(shape => shape.id === shapeId)
      : savedShapes.find(shape => shape.id === shapeId);

    if (selectedShape) {
      setSelectedShapeId(selectedShape.id);
      setScaleName(selectedShape.name);
      setIntervals(selectedShape.intervals ? selectedShape.intervals.join(',') : '');
      setNotes(selectedShape.notes ? selectedShape.notes.join(',') : '');

      if (isChordMode) {
        setChordQuality(selectedShape.chord_quality || 'major');
        setIsMovable(selectedShape.is_movable || false); // Load movable state
      } else {
        setScaleType(selectedShape.Type || '2 notes per string scale');
        setPosition(selectedShape.Position || 1);
        setMode(selectedShape.Mode || 'Ionian');
        setTonality(selectedShape.tonality || 'Major');
      }

      const baseFret = 5; // Arbitrary fret to display the shape
      const rootNoteInShape = selectedShape.shape_json.find(n => n.fret_offset === selectedShape.root_fret);

      if (!rootNoteInShape) {
        toast({ title: "Error", description: "Could not find root note in shape." });
        return;
      }

      const rootString = rootNoteInShape.string;
      const newRootNote = { string: rootString, fret: baseFret };
      setRootNote(newRootNote);

      const newSelectedNotes = selectedShape.shape_json.map(note => ({
        string: note.string,
        fret: baseFret + note.fret_offset - selectedShape.root_fret
      }));
      setSelectedNotes(newSelectedNotes);

      const rootNoteName = getNote(newRootNote.string, newRootNote.fret);
      setHighlightedNotes(findAllNoteOccurrences(rootNoteName));
    }
  };

  const filteredShapes = isChordMode
    ? savedChordShapes
    : savedShapes.filter(shape => scaleType === 'All' || shape.Type === scaleType);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Scale Shape Editor</h1>
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Fretboard
              selectedNotes={selectedNotes}
              rootNote={rootNote}
              highlightedNote={highlightedNotes.find(n => n.string === rootNote?.string && n.fret === rootNote?.fret)}
              onNoteClick={toggleNote}
              onNoteRightClick={setAsRoot}
              isEditable={true}
              showDegreeNumbers={true}
            />
            <ScaleShapeForm
              scaleName={scaleName}
              setScaleName={setScaleName}
              intervals={intervals}
              setIntervals={setIntervals}
              notes={notes}
              setNotes={setNotes}
              position={position}
              setPosition={setPosition}
              mode={mode}
              setMode={setMode}
              tonality={tonality}
              setTonality={setTonality}
              handleSave={handleSave}
              handleSaveAs={handleSaveAs}
              savedShapes={savedShapes}
              filteredShapes={filteredShapes}
              handleShapeSelect={handleShapeSelect}
              shapeToGeneralize={shapeToGeneralize}
              setShapeToGeneralize={setShapeToGeneralize}
              handleGeneralize={handleGeneralize}
              scaleType={scaleType}
              setScaleType={setScaleType}
              SCALE_TYPES={SCALE_TYPES}
              modeToMajorKeyInfo={modeToMajorKeyInfo}
              isChordMode={isChordMode}
              chordQuality={chordQuality}
              setChordQuality={setChordQuality}
              CHORD_QUALITIES={CHORD_QUALITIES}
              isMovable={isMovable}
              setIsMovable={setIsMovable}
            />
          </div>
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Preview</h2>
            <NoteDisplay
              notes={previewNotes}
              major_key={rootNote ? getNote(rootNote.string, rootNote.fret) : null}
              className="mt-64"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShapeLibrary;