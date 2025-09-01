import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import NoteDisplay from '@/components/NoteDisplay';
import MetronomeScreen from '@/components/MetronomeScreen';
import { applySequenceToScale } from '@/lib/sequenceUtils';

const ScaleSequenceEditor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scales, setScales] = useState([]);
  const [sequences, setSequences] = useState([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [selectedScale, setSelectedScale] = useState(null);
  const [sequence, setSequence] = useState('');
  const [subdivision, setSubdivision] = useState(4);
  const [isTriplet, setIsTriplet] = useState(false);
  const [sequenceName, setSequenceName] = useState('');
  const [generatedNotes, setGeneratedNotes] = useState([]);
  const [scaleType, setScaleType] = useState('');
  const [sequencePosition, setSequencePosition] = useState(0);
  const [bpm, setBpm] = useState(60);
  const [scaleTypeFilter, setScaleTypeFilter] = useState('All');

  const SCALE_TYPES = ['2 notes per string scale', '3 notes per string scale', '4 notes per string scale', 'chord', 'arpeggio'];

  useEffect(() => {
    const fetchData = async () => {
      const { data: scalesData, error: scalesError } = await supabase.from('scales').select('*');
      if (scalesError) {
        toast({ title: "Error fetching scales", description: scalesError.message });
      } else {
        setScales(scalesData);
      }

      const { data: sequencesData, error: sequencesError } = await supabase.from('sequences').select('*');
      if (sequencesError) {
        toast({ title: "Error fetching sequences", description: sequencesError.message });
      } else {
        setSequences(sequencesData);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedScale && sequence) {
      generateSequence();
    }
  }, [selectedScale, sequence, subdivision, isTriplet]);

  useEffect(() => {
    setSequencePosition(0);
  }, [generatedNotes]);


  const generateSequence = () => {
    const scale = scales.find(s => s.id === selectedScale);
    if (scale) {
      const newNotes = applySequenceToScale(
        scale,
        sequence,
        subdivision,
        isTriplet
      );
      setGeneratedNotes(newNotes);
      setScaleType(scale.Type);
    }
  };

  const handleSequenceSelect = (id: string) => {
    const selected = sequences.find(s => s.id === id);
    if (selected) {
      setSelectedSequenceId(selected.id);
      setSequenceName(selected.name);
      setSequence(selected.pattern_string);
      setSubdivision(selected.note_value);
      setIsTriplet(selected.is_triplet);
      setBpm(selected.bpm);
      // Note: We can't reliably set the selectedScale here as we don't store it with the sequence.
      // The user will need to select the scale they wish to use for previewing.
    }
  };

  const handleSave = async () => {
    if (!sequenceName || !sequence || !selectedScale) {
      toast({
        title: "Error",
        description: "Please fill out all fields.",
        variant: "destructive",
      });
      return;
    }

    const scale = scales.find(s => s.id === selectedScale);
    if (!scale) {
      toast({
        title: "Error",
        description: "Selected scale not found.",
        variant: "destructive",
      });
      return;
    }

    const sequenceData = {
      name: sequenceName,
      pattern_string: sequence,
      Type: scale.Type,
      note_value: subdivision,
      is_triplet: isTriplet,
      bpm: bpm,
      repetition_style: 'DIATONIC_SHIFT' // default value
    };

    let error;
    if (selectedSequenceId) {
      // Update existing sequence
      const { error: updateError } = await supabase
        .from('sequences')
        .update(sequenceData)
        .eq('id', selectedSequenceId);
      error = updateError;
    } else {
      // Insert new sequence
      const { error: insertError } = await supabase
        .from('sequences')
        .insert([sequenceData]);
      error = insertError;
    }

    if (error) {
      toast({
        title: "Error saving sequence",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Sequence saved successfully.",
      });
      setSequenceName('');
      setSequence('');
      setSelectedScale(null);
      setSelectedSequenceId(null);
    }
  };

  const selectedScaleObject = scales.find(s => s.id === selectedScale);

  const filteredScales = scales.filter(scale => scaleTypeFilter === 'All' || scale.Type === scaleTypeFilter);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Scale Sequence Editor</h1>
      <div className="form-container grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="sequence-select">Load Sequence</Label>
          <select
            id="sequence-select"
            onChange={(e) => handleSequenceSelect(e.target.value)}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          >
            <option value="">New Sequence</option>
            {sequences.map((seq) => (
              <option key={seq.id} value={seq.id}>
                {seq.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="scale-type-filter">Filter by Type</Label>
          <select
            id="scale-type-filter"
            value={scaleTypeFilter}
            onChange={(e) => setScaleTypeFilter(e.target.value)}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          >
            <option value="All">All</option>
            {SCALE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="scale-select">Select Scale (for preview)</Label>
          <select
            id="scale-select"
            onChange={(e) => setSelectedScale(e.target.value)}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          >
            <option value="">Select a scale</option>
            {filteredScales.map((scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.name}
              </option>
            ))}
          </select>
        </div>
        {selectedScaleObject && (
          <div>
            <Label>Scale Length: {selectedScaleObject.notes_json.length}</Label>
          </div>
        )}
        <div>
          <Label htmlFor="sequence-name">Sequence Name</Label>
          <Input id="sequence-name" value={sequenceName} onChange={(e) => setSequenceName(e.target.value)} className="bg-gray-800 text-white" />
        </div>
        <div>
          <Label htmlFor="sequence">Sequence (space-separated)</Label>
          <Input id="sequence" value={sequence} onChange={(e) => setSequence(e.target.value)} className="bg-gray-800 text-white" />
        </div>
        <div>
          <Label htmlFor="scale-type">Scale Type</Label>
          <Input id="scale-type" value={scaleType} disabled className="bg-gray-700 text-white" />
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setSubdivision(4)} variant={subdivision === 4 ? 'secondary' : 'outline'}>4th</Button>
          <Button onClick={() => setSubdivision(8)} variant={subdivision === 8 ? 'secondary' : 'outline'}>8th</Button>
          <Button onClick={() => setSubdivision(16)} variant={subdivision === 16 ? 'secondary' : 'outline'}>16th</Button>
          <Button onClick={() => setIsTriplet(!isTriplet)} variant={isTriplet ? 'secondary' : 'outline'}>Triplet</Button>
        </div>
        <div>
          <Label htmlFor="bpm">BPM</Label>
          <Input id="bpm" type="number" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value, 10))} className="bg-gray-800 text-white" />
        </div>
        <div className="md:col-span-3">
          <Button onClick={handleSave}>Save Sequence</Button>
        </div>
      </div>
      <div className="mt-8">
        <MetronomeScreen
          initialStartBpm={bpm}
          onTick={() => {
            const step = (subdivision / 4) * (isTriplet ? 3 : 1);
            setSequencePosition((prev) => (prev + step) % (generatedNotes.length || 1));
          }}
          onStop={() => setSequencePosition(0)}
        />
      </div>
      <div className="mt-8">
        <NoteDisplay
          notes={generatedNotes}
          major_key={selectedScaleObject?.major_key}
          currentPosition={generatedNotes[sequencePosition]?.time}
        />
      </div>
    </div>
  );
};

export default ScaleSequenceEditor;