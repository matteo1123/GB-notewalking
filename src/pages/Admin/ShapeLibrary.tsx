import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { FRET_COUNT, findAllNoteOccurrences, notes as allNotes, getNote, getNoteWithEnharmonicPreference, determineEnharmonicNotes, normalizeNotesToFretboard } from '@/lib/musicTheory';
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
  const [savedShapes, setSavedShapes] = useState<(Tables<'scale_shapes'> & { Type: string, Mode: string, Position: number, tonality: string, root_fret: number, root_string: number, notes: string[], shape_json: { string: number, fret_offset: number }[] })[]>([]);
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
      setSavedShapes(data as (Tables<'scale_shapes'> & { Type: string, Mode: string, Position: number, tonality: string, root_fret: number, root_string: number, notes: string[], shape_json: { string: number, fret_offset: number }[] })[]);
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
    const root_string = rootNote.string;

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
        root_string,
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
        root_string,
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

    const table = isChordMode ? 'chords' : 'scales';
    const fkColumn = isChordMode ? 'chord_shape_id' : 'scale_shape';

    // 1. Fetch existing items to allow for safe upserting (overwrite without breaking FKs)
    const { data: existingItems, error: fetchError } = await supabase
      .from(table as any)
      .select('id, name')
      .eq(fkColumn, sourceShape.id);

    if (fetchError) {
      toast({ title: "Error fetching existing items", description: fetchError.message, variant: 'destructive' });
      return;
    }

    const existingItemsMap = new Map((existingItems || []).map(item => [item.name, item.id]));

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

      const finalNotesJson = sourceShape.shape_json.map((n: any) => ({
        string: n.string,
        fret: n.fret_offset, // Absolute for open chord
        time: 0,
        duration: 1
      }));

      const payload: any = { ...newChord, notes_json: finalNotesJson };
      if (existingItemsMap.has(payload.name)) payload.id = existingItemsMap.get(payload.name);

      const { error } = await supabase.from('chords' as any).upsert([payload]);

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
      // 1. Determine target anchoring note
      // For chords, we anchor on the exact root Note.
      // For modes (e.g., E Dorian), the shape was built relative to the *Major Root* (D Major).
      // So we must anchor the shape at D Major on the fretboard, but name it E Dorian.
      let targetAnchorNote = rootNoteName;
      let majorKeyName: string | null = null;
      let modeInfo = !isChordMode ? modeToMajorKeyInfo[sourceShape.Mode] : null;

      if (!isChordMode && modeInfo) {
        const targetRootIndex = allNotes.indexOf(rootNoteName);
        const majorKeyIndex = (targetRootIndex - modeInfo.semitone_offset + 12) % 12;
        majorKeyName = allNotes[majorKeyIndex];

        // Use the underlying Major Key as the true geometric anchor for the shape
        targetAnchorNote = majorKeyName;
      }

      let startingFret = -1;
      // Find where this anchor note exists on the root string
      for (let f = 0; f <= FRET_COUNT; f++) {
        if (getNote(rootString, f) === targetAnchorNote) {
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

      // Safety Octave Shifting to prevent shapes from falling off the fretboard
      let filteredNotesJson = normalizeNotesToFretboard<{ string: number, fret: number, time: number, duration: number }>(newNotesJson, FRET_COUNT);
      if (filteredNotesJson.length === 0) continue;

      const enharmonicallyCorrectRoot = getNoteWithEnharmonicPreference(rootString, startingFret, null); // Key?

      // Calculate Note Names
      const newNotes = filteredNotesJson.map(note => getNote(note.string, note.fret));
      const uniqueNotes = [...new Set(newNotes)] as string[];
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
        } as any;
        if (existingItemsMap.has(newChord.name)) newChord.id = existingItemsMap.get(newChord.name);
        newItems.push(newChord);
      } else {
        // Scale Logic
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
          major_key: majorKeyName,
          created_by: user?.id,
          scale_shape: sourceShape.id,
        } as any;
        if (existingItemsMap.has(newScale.name)) newScale.id = existingItemsMap.get(newScale.name);
        newItems.push(newScale);
      }
    }

    const { error } = await supabase.from(table as any).upsert(newItems);

    if (error) {
      toast({ title: "Error generalizing", description: error.message, variant: 'destructive' });
    } else {
      toast({ title: "Success", description: `Generated ${newItems.length} items for ${sourceShape.name}.` });
    }
  };

  // Regenerate: Safely execute logic to overwrite existing properties without breaking foreign keys
  const handleRegenerate = async () => {
    if (!shapeToGeneralize) {
      toast({ title: "Error", description: "Please select a shape to regenerate." });
      return;
    }

    toast({ title: "Regenerating", description: `Safely overwriting existing items...` });

    // The generalize function now uses UPSERT logic by default, which maps UUIDs matching the exact name. 
    // This safely overwrites the geometric fixes directly onto the active scales in the database.
    await handleGeneralize();
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
      // Find root by fret_offset AND string (if available) to handle shapes with multiple notes at same fret
      const rootNoteInShape = selectedShape.root_string != null
        ? selectedShape.shape_json.find(n => n.fret_offset === selectedShape.root_fret && n.string === selectedShape.root_string)
        : selectedShape.shape_json.find(n => n.fret_offset === selectedShape.root_fret);

      if (!rootNoteInShape) {
        toast({ title: "Error", description: "Could not find root note in shape." });
        return;
      }

      const rootString = rootNoteInShape.string;
      const newRootNote = { string: rootString, fret: baseFret };
      setRootNote(newRootNote);

      const rawNotes = selectedShape.shape_json.map(note => ({
        string: note.string,
        fret: baseFret + note.fret_offset - selectedShape.root_fret
      }));
      // Normalize to keep within fretboard bounds (shift octave if any fret < 0 or > 22)
      const newSelectedNotes = normalizeNotesToFretboard(rawNotes);
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
              handleRegenerate={handleRegenerate}
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