import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { FRET_COUNT, STRING_COUNT, getNote, findAllNoteOccurrences, notes as allNotes, getNoteWithEnharmonicPreference } from '@/lib/fretboard';
import { useAuth } from '@/contexts/AuthContext';

const ScaleShapeEditor = () => {
  const { user } = useAuth();
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [rootNote, setRootNote] = useState(null);
  const [scaleName, setScaleName] = useState('');
  const [intervals, setIntervals] = useState('');
  const [highlightedNotes, setHighlightedNotes] = useState([]);
  const [scaleType, setScaleType] = useState('2 notes per string scale');
  const [position, setPosition] = useState(1);
  const [mode, setMode] = useState('Ionian');
  const [tonality, setTonality] = useState('Major');
  const [savedShapes, setSavedShapes] = useState([]);
  const [shapeToGeneralize, setShapeToGeneralize] = useState('');
  const { toast } = useToast();

  const fetchShapes = async () => {
    const { data, error } = await supabase.from('scale_shapes').select('*').order('name');
    if (error) {
      toast({ title: "Error fetching shapes", description: error.message });
    } else if (data) {
      setSavedShapes(data);
    }
  };

  useEffect(() => {
    fetchShapes();
  }, []);

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

    const { error } = await supabase
      .from('scale_shapes')
      .insert([
        { name: scaleName, shape_json, intervals: intervals.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)), Type: scaleType, Position: position, Mode: mode, tonality: tonality },
      ]);

    if (error) {
      toast({ title: "Error saving scale shape", description: error.message });
    } else {
      toast({ title: "Success", description: "Scale shape saved successfully." });
      setSelectedNotes([]);
      setRootNote(null);
      setScaleName('');
      setIntervals('');
      setHighlightedNotes([]);
      setPosition(1);
      setMode('Ionian');
      setTonality('Major');
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

    const shapeRoot = sourceShape.shape_json.find(n => n.fret_offset === 0);
    if (!shapeRoot) {
      toast({ title: "Error", description: `Shape "${sourceShape.name}" does not have a root note (fret_offset: 0).` });
      return;
    }
    const rootString = shapeRoot.string;

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

      const newNotesJson = sourceShape.shape_json.map((note, index) => {
        const time = index * 0.5;
        return {
          string: note.string,
          fret: startingFret + note.fret_offset,
          time: time,
          duration: 0.5,
        };
      });

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
        Mode: sourceShape.Mode,
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
      setScaleType('2 notes per string scale');
      setHighlightedNotes([]);
      return;
    }

    const selectedShape = savedShapes.find(shape => shape.id === shapeId);

    if (selectedShape) {
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

  const renderFrets = () => {
    const frets = [];
    for (let i = 1; i <= FRET_COUNT; i++) {
      frets.push(<div key={`fret-${i}`} className="fret" style={{ gridColumn: i }} />);
    }
    return frets;
  };

  const renderStrings = () => {
    const strings = [];
    for (let i = 1; i <= STRING_COUNT; i++) {
      strings.push(<div key={`string-${i}`} className="string" style={{ gridRow: i }} />);
    }
    return strings;
  };

  const renderNotes = (isOpenNotesOnly = false) => {
    const notesToRender = [];
    const fretStart = isOpenNotesOnly ? 0 : 1;
    const fretEnd = isOpenNotesOnly ? 0 : FRET_COUNT;

    for (let s = 1; s <= STRING_COUNT; s++) {
      for (let f = fretStart; f <= fretEnd; f++) {
        const isSelected = selectedNotes.some(n => n.string === s && n.fret === f);
        const isRoot = rootNote && rootNote.string === s && rootNote.fret === f;
        const isHighlighted = highlightedNotes.some(n => n.string === s && n.fret === f);
        
        notesToRender.push(
          <div
            key={`${s}-${f}`}
            className={`note ${isSelected ? 'selected' : ''} ${isRoot ? 'root' : ''} ${isHighlighted ? 'highlighted' : ''}`}
            style={{ 
              gridColumn: isOpenNotesOnly ? 1 : f, 
              gridRow: s 
            }}
            onClick={() => toggleNote(s, f)}
            onContextMenu={(e) => {
              e.preventDefault();
              setAsRoot(s, f);
            }}
          />
        );
      }
    }
    return notesToRender;
  };
  
  const fretMarkers = {
    3: 'single', 5: 'single', 7: 'single', 9: 'single', 12: 'double',
    15: 'single', 17: 'single', 19: 'single', 21: 'single', 24: 'double'
  };

  const renderMarkers = () => {
    return Object.entries(fretMarkers).map(([fret, type]) => (
      <div key={`marker-${fret}`} className={`marker-wrapper ${type}`} style={{ gridColumn: parseInt(fret, 10) }}>
        <div className="marker" />
        {type === 'double' && <div className="marker" />}
      </div>
    ));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Scale Shape Editor</h1>
      <div className="fretboard-area" style={{ display: 'flex', alignItems: 'center' }}>
        <div className="open-notes-container">
          {renderNotes(true)}
        </div>
        <div className="fretboard-container mb-4">
          <div className="fretboard">
            {renderFrets()}
            {renderStrings()}
            {renderMarkers()}
            {renderNotes(false)}
          </div>
        </div>
      </div>
      <div className="form-container grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="scale-name">Scale Name</Label>
          <Input id="scale-name" value={scaleName} onChange={(e) => setScaleName(e.target.value)} className="bg-gray-800 text-white" />
        </div>
        <div>
          <Label htmlFor="intervals">Intervals (comma-separated)</Label>
          <Input id="intervals" value={intervals} onChange={(e) => setIntervals(e.target.value)} placeholder="e.g., 0,2,3,5,7,8,10" className="bg-gray-800 text-white" />
        </div>
        <div>
          <Label htmlFor="scale-type">Scale Type</Label>
          <select
            id="scale-type"
            value={scaleType}
            onChange={(e) => setScaleType(e.target.value)}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          >
            <option>2 notes per string scale</option>
            <option>3 notes per string scale</option>
            <option>4 notes per string scale</option>
            <option>chord</option>
            <option>arpeggio</option>
          </select>
        </div>
        <div>
          <Label htmlFor="position">Position</Label>
          <Input id="position" type="number" value={position} onChange={(e) => setPosition(parseInt(e.target.value, 10) || 1)} className="bg-gray-800 text-white" />
        </div>
        <div>
          <Label htmlFor="mode">Mode</Label>
          <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)} className="w-full p-2 border rounded bg-gray-800 text-white">
            {Object.keys(modeToMajorKeyInfo).map(modeName => (
              <option key={modeName} value={modeName}>{modeName}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="tonality">Tonality</Label>
          <select id="tonality" value={tonality} onChange={(e) => setTonality(e.target.value)} className="w-full p-2 border rounded bg-gray-800 text-white">
            <option>Major</option>
            <option>Minor</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <Button onClick={handleSave}>Save Scale Shape</Button>
        </div>
      </div>

      <div className="saved-shapes-container mt-8">
        <h2 className="text-xl font-bold mb-4">Load Saved Shape</h2>
        <select onChange={handleShapeSelect} className="w-full p-2 border rounded bg-gray-800 text-white">
          <option value="">Select a shape to load...</option>
          {savedShapes.map(shape => (
            <option key={shape.id} value={shape.id}>{shape.name}</option>
          ))}
        </select>
      </div>

      <div className="generalize-container mt-8">
        <h2 className="text-xl font-bold mb-4">Generalize Shape to All Keys</h2>
        <select onChange={(e) => setShapeToGeneralize(e.target.value)} value={shapeToGeneralize} className="w-full p-2 border rounded bg-gray-800 text-white">
          <option value="">Select a shape to generalize...</option>
          {savedShapes.map(shape => (
            <option key={shape.id} value={shape.id}>{shape.name}</option>
          ))}
        </select>
        <Button onClick={handleGeneralize} className="mt-4">Generalize</Button>
      </div>

      <style>{`
        .open-notes-container {
          display: grid;
          grid-template-columns: 50px;
          grid-template-rows: repeat(${STRING_COUNT}, 30px);
          margin-right: 5px;
        }
        .fretboard-container {
          overflow-x: visible;
        }
        .fretboard {
          display: grid;
          grid-template-columns: repeat(${FRET_COUNT}, 50px);
          grid-template-rows: repeat(${STRING_COUNT}, 30px);
          position: relative;
          background-color: #000;
          width: ${FRET_COUNT * 50}px;
          border: 2px solid #fff;
          border-left-width: 5px;
        }
        .fret {
          grid-row: 1 / -1;
          border-right: 1px solid #fff;
          z-index: 1;
        }
        .string {
          height: 1px;
          background-color: #fff;
          align-self: center;
          grid-column: 1 / -1;
          z-index: 2;
        }
        .note {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          justify-self: center;
          align-self: center;
          cursor: pointer;
          z-index: 3;
          box-sizing: border-box;
        }
        .note.selected {
          background-color: #ccc;
        }
        .note.root {
          background-color: #ff0000;
        }
        .note.highlighted:not(.root) {
          box-shadow: 0 0 0 2px #ff0000 inset;
        }
        .note.selected.highlighted:not(.root) {
          background-color: #ccc;
        }
        .marker-wrapper {
          grid-row: 1 / -1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 0;
        }
        .marker-wrapper.double {
          justify-content: space-around;
        }
        .marker {
          width: 15px;
          height: 15px;
          background-color: #fff;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
};

export default ScaleShapeEditor;