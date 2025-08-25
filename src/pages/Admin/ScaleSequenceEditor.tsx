import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import GuitarTablature from '@/components/GuitarTablature';
import MetronomeScreen from '@/components/MetronomeScreen';

const ScaleSequenceEditor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scales, setScales] = useState([]);
  const [selectedScale, setSelectedScale] = useState(null);
  const [sequence, setSequence] = useState('');
  const [subdivision, setSubdivision] = useState(4);
  const [isTriplet, setIsTriplet] = useState(false);
  const [sequenceName, setSequenceName] = useState('');
  const [generatedNotes, setGeneratedNotes] = useState([]);
  const [scaleType, setScaleType] = useState('');
  const [sequencePosition, setSequencePosition] = useState(0);
  const [bpm, setBpm] = useState(60);

  useEffect(() => {
    const fetchScales = async () => {
      const { data, error } = await supabase.from('scales').select('*');
      if (error) {
        toast({ title: "Error fetching scales", description: error.message });
      } else {
        setScales(data);
      }
    };
    fetchScales();
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
    if (!scale || !scale.notes_json) {
      return;
    }
    setScaleType(scale.Type);

    const sequenceNumbers = sequence.split(' ').map(s => s.trim()).filter(s => s !== '');
    const newNotes = [];
    for (let i = 0; i < sequenceNumbers.length; i++) {
      const numStr = sequenceNumbers[i];
      if (numStr.toLowerCase() === 'r') {
        // For rests, we could add a placeholder or skip it.
        // Skipping for now as it simplifies highlighting logic.
        continue;
      }

      const noteIndex = parseInt(numStr, 10) - 1;
      if (noteIndex >= 0 && noteIndex < scale.notes_json.length) {
        const originalNote = scale.notes_json[noteIndex];
        newNotes.push({
          ...originalNote,
          time: i, // Use index as time for even spacing
          duration: 1, // Duration is 1 unit of time
        });
      }
    }
    setGeneratedNotes(newNotes);
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

    const { error } = await supabase.from('sequences').insert([
      {
        name: sequenceName,
        pattern_string: sequence,
        notes_per_beat: subdivision,
        subdivision: isTriplet ? 3 : 1,
        Type: scale.Type,
        repetition_style: 'DIATONIC_SHIFT' // default value
      },
    ]);

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
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Scale Sequence Editor</h1>
      <div className="form-container grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="scale-select">Select Scale</Label>
          <select
            id="scale-select"
            onChange={(e) => setSelectedScale(e.target.value)}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          >
            <option value="">Select a scale</option>
            {scales.map((scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.name}
              </option>
            ))}
          </select>
        </div>
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
          initialStartBpm={bpm * (subdivision / 4) * (isTriplet ? 3 : 1)}
          onTick={() => {
            setSequencePosition((prev) => (prev + 1) % (generatedNotes.length || 1));
          }}
        />
      </div>
      <div className="mt-8">
        <GuitarTablature
          notes={generatedNotes}
          currentPosition={generatedNotes[sequencePosition]?.time}
        />
      </div>
    </div>
  );
};

export default ScaleSequenceEditor;