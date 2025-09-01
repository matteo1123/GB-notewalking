import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { FRET_COUNT, findAllNoteOccurrences, notes as allNotes } from '@/lib/fretboard';
import { getNote } from '@/lib/music';
import { getNoteWithEnharmonicPreference } from '@/lib/musicTheory';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import FretboardEditor from '@/components/ScaleShapeEditor/FretboardEditor';
import ScaleShapeForm from '@/components/ScaleShapeEditor/ScaleShapeForm';
import NoteDisplay from '@/components/NoteDisplay';

const ScaleShapeEditor = () => {
  const { user } = useAuth();
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [rootNote, setRootNote] = useState(null);
  const [scaleName, setScaleName] = useState('');
  const [intervals, setIntervals] = useState('');
  const [highlightedNotes, setHighlightedNotes] = useState([]);
  const [scaleType, setScaleType] = useState('All');
  const [position, setPosition] = useState(1);
  const [mode, setMode] = useState('Ionian');
  const [tonality, setTonality] = useState('Major');
  const [savedShapes, setSavedShapes] = useState<(Tables<'scale_shapes'> & { Type: string, Mode: string, Position: number, tonality: string, root_fret: number, shape_json: { string: number, fret_offset: number }[] })[]>([]);
  const [shapeToGeneralize, setShapeToGeneralize] = useState('');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [previewNotes, setPreviewNotes] = useState([]);
  const { toast } = useToast();

  const SCALE_TYPES = ['2 notes per string scale', '3 notes per string scale', '4 notes per string scale', 'chord', 'arpeggio'];

  const fetchShapes = async () => {
    const { data, error } = await supabase.from('scale_shapes').select('*').order('name');
    if (error) {
      toast({ title: "Error fetching shapes", description: error.message });
    } else if (data) {
      setSavedShapes(data as (Tables<'scale_shapes'> & { Type: string, Mode: string, Position: number, tonality: string, root_fret: number, shape_json: { string: number, fret_offset: number }[] })[]);
    }
  };

  useEffect(() => {
    fetchShapes();
  }, []);

  useEffect(() => {
    if (selectedNotes.length > 0) {
      const notes = selectedNotes.map((note, index) => ({
        ...note,
        time: index * 0.5,
        duration: 0.5,
      }));
      setPreviewNotes(notes);
    } else {
      setPreviewNotes([]);
    }
  }, [selectedNotes]);

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

  const handleSave = async () => {
    if (!rootNote) {
      toast({ title: "Error", description: "Please select a root note." });
      return;
    }
    if (!scaleName) {
      toast({ title: "Error", description: "Please enter a name for the scale shape." });
      return;
    }
    if (scaleType === 'All' && !selectedShapeId) {
      toast({ title: "Error", description: "Please select a specific scale type." });
      return;
    }

    const lowestFret = Math.min(...selectedNotes.map(n => n.fret));
    const shape_json = selectedNotes
      .map(note => ({
        string: note.string,
        fret_offset: note.fret - lowestFret,
      }))
      .sort((a, b) => {
        if (a.string > b.string) return -1;
        if (a.string < b.string) return 1;
        return a.fret_offset - b.fret_offset;
      });

    const root_fret = rootNote.fret - lowestFret;

    const shapeData = {
      name: scaleName,
      shape_json,
      root_fret,
      intervals: intervals.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)),
      Type: scaleType,
      Position: position,
      Mode: mode,
      tonality: tonality
    };

    let error;
    if (selectedShapeId) {
      const { error: updateError } = await supabase
        .from('scale_shapes')
        .update(shapeData)
        .eq('id', selectedShapeId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('scale_shapes')
        .insert([shapeData]);
      error = insertError;
    }

    if (error) {
      toast({ title: "Error saving scale shape", description: error.message });
    } else {
      toast({ title: "Success", description: "Scale shape saved successfully." });
      setSelectedNotes([]);
      setRootNote(null);
      setScaleName('');
      setIntervals('');
      setHighlightedNotes([]);
      setScaleType('All');
      setPosition(1);
      setMode('Ionian');
      setTonality('Major');
      setSelectedShapeId(null);
      fetchShapes();
    }
  };

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

    const sourceShape = savedShapes.find(s => s.id === shapeToGeneralize);
    if (!sourceShape) {
      toast({ title: "Error", description: "Could not find the selected shape." });
      return;
    }

    const rootFret = sourceShape.root_fret;
    if (rootFret === undefined || rootFret === null) {
      toast({ title: "Error", description: `Shape "${sourceShape.name}" does not have a root fret defined.` });
      return;
    }
    const rootNoteInShape = sourceShape.shape_json.find(n => n.fret_offset === rootFret);
    if (!rootNoteInShape) {
        toast({ title: "Error", description: `Could not find root note in shape "${sourceShape.name}".` });
        return;
    }
    const rootString = rootNoteInShape.string;

    const newScales = [];

    for (const rootNoteName of allNotes) {
      let startingFret = -1;
      for (let f = 0; f <= FRET_COUNT; f++) {
        if (getNote(rootString, f) === rootNoteName) {
          startingFret = f;
          break;
        }
      }

      if (startingFret === -1) {
        console.warn(`Could not find note ${rootNoteName} on string ${rootString}`);
        continue;
      }

      let newNotesJson = sourceShape.shape_json.map((note, index) => {
        const time = index * 0.5;
        return {
          string: note.string,
          fret: startingFret + note.fret_offset,
          time: time,
          duration: 0.5,
        };
      });

      if (newNotesJson.some(note => note.fret < 0)) {
        newNotesJson = newNotesJson.map(note => ({
          ...note,
          fret: note.fret + 12,
        }));
      }

      const filteredNotesJson = newNotesJson.filter(note => note.fret >= 0 && note.fret <= FRET_COUNT);

      const modeInfo = modeToMajorKeyInfo[sourceShape.Mode];
      let majorKey = null;
      if (modeInfo) {
        const rootNoteIndex = allNotes.indexOf(rootNoteName);
        const majorKeyIndex = (rootNoteIndex - modeInfo.semitone_offset + 12) % 12;
        majorKey = allNotes[majorKeyIndex];
      }

      const enharmonicallyCorrectRoot = getNoteWithEnharmonicPreference(rootString, startingFret, majorKey);

      const newScale = {
        name: `${enharmonicallyCorrectRoot} ${sourceShape.Mode}`,
        intervals: sourceShape.intervals,
        notes_json: filteredNotesJson,
        root_note: rootNoteName,
        Type: sourceShape.Type,
        Position: sourceShape.Position,
        mode: sourceShape.Mode,
        tonality: sourceShape.tonality,
        major_key: majorKey,
        created_by: user?.id,
        scale_shape_id: sourceShape.id,
      };
      newScales.push(newScale);
    }

    const { error } = await supabase.from('scales').insert(newScales);

    if (error) {
      toast({ title: "Error generalizing shape", description: error.message, variant: 'destructive' });
    } else {
      toast({ title: "Success", description: `Successfully generated and saved 12 scales for ${sourceShape.name}.` });
    }
  };

  const handleShapeSelect = (e) => {
    const shapeId = e.target.value;
    if (!shapeId) {
      setSelectedNotes([]);
      setRootNote(null);
      setScaleName('');
      setIntervals('');
      setScaleType('All');
      setHighlightedNotes([]);
      setSelectedShapeId(null);
      return;
    }

    const selectedShape = savedShapes.find(shape => shape.id === shapeId);

    if (selectedShape) {
      setSelectedShapeId(selectedShape.id);
      setScaleName(selectedShape.name);
      setIntervals(selectedShape.intervals ? selectedShape.intervals.join(',') : '');
      setScaleType(selectedShape.Type || '2 notes per string scale');
      setPosition(selectedShape.Position || 1);
      setMode(selectedShape.Mode || 'Ionian');
      setTonality(selectedShape.tonality || 'Major');

      const baseFret = 5;
      const shapeRoot = selectedShape.shape_json.find(n => n.fret_offset === 0);
      const rootString = shapeRoot ? shapeRoot.string : 6;
      
      const newRootNote = { string: rootString, fret: baseFret };
      setRootNote(newRootNote);

      const newSelectedNotes = selectedShape.shape_json.map(note => ({
        string: note.string,
        fret: baseFret + note.fret_offset
      }));
      setSelectedNotes(newSelectedNotes);

      const rootNoteName = getNote(newRootNote.string, newRootNote.fret);
      setHighlightedNotes(findAllNoteOccurrences(rootNoteName));
    }
  };

  const filteredShapes = savedShapes.filter(shape => scaleType === 'All' || shape.Type === scaleType);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Scale Shape Editor</h1>
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <FretboardEditor
              selectedNotes={selectedNotes}
              rootNote={rootNote}
              highlightedNotes={highlightedNotes}
              toggleNote={toggleNote}
              setAsRoot={setAsRoot}
            />
            <ScaleShapeForm
              scaleName={scaleName}
              setScaleName={setScaleName}
              intervals={intervals}
              setIntervals={setIntervals}
              position={position}
              setPosition={setPosition}
              mode={mode}
              setMode={setMode}
              tonality={tonality}
              setTonality={setTonality}
              handleSave={handleSave}
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
            />
          </div>
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Preview</h2>
            <NoteDisplay
              notes={previewNotes}
              major_key={rootNote ? getNote(rootNote.string, rootNote.fret) : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScaleShapeEditor;