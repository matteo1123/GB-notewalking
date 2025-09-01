import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tables } from '@/integrations/supabase/types';

interface ScaleShapeFormProps {
  scaleName: string;
  setScaleName: (name: string) => void;
  intervals: string;
  setIntervals: (intervals: string) => void;
  position: number;
  setPosition: (position: number) => void;
  mode: string;
  setMode: (mode: string) => void;
  tonality: string;
  setTonality: (tonality: string) => void;
  handleSave: () => void;
  savedShapes: (Tables<'scale_shapes'> & { Type: string, Mode: string, Position: number, tonality: string, shape_json: { string: number, fret_offset: number }[] })[];
  filteredShapes: (Tables<'scale_shapes'> & { Type: string, Mode: string, Position: number, tonality: string, shape_json: { string: number, fret_offset: number }[] })[];
  handleShapeSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  shapeToGeneralize: string;
  setShapeToGeneralize: (id: string) => void;
  handleGeneralize: () => void;
  scaleType: string;
  setScaleType: (type: string) => void;
  SCALE_TYPES: string[];
  modeToMajorKeyInfo: { [key: string]: { degree: number; semitone_offset: number; } };
}

const ScaleShapeForm: React.FC<ScaleShapeFormProps> = ({
  scaleName,
  setScaleName,
  intervals,
  setIntervals,
  position,
  setPosition,
  mode,
  setMode,
  tonality,
  setTonality,
  handleSave,
  savedShapes,
  filteredShapes,
  handleShapeSelect,
  shapeToGeneralize,
  setShapeToGeneralize,
  handleGeneralize,
  scaleType,
  setScaleType,
  SCALE_TYPES,
  modeToMajorKeyInfo,
}) => {
  return (
    <>
      <div className="mb-4">
        <Label htmlFor="scale-type">Filter by Type</Label>
        <select
          id="scale-type"
          value={scaleType}
          onChange={(e) => setScaleType(e.target.value)}
          className="w-full p-2 border rounded bg-gray-800 text-white"
        >
          <option value="All">All</option>
          {SCALE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
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
          {filteredShapes.map(shape => (
            <option key={shape.id} value={shape.id}>{shape.name}</option>
          ))}
        </select>
      </div>

      <div className="generalize-container mt-8">
        <h2 className="text-xl font-bold mb-4">Generalize Shape to All Keys</h2>
        <select onChange={(e) => setShapeToGeneralize(e.target.value)} value={shapeToGeneralize} className="w-full p-2 border rounded bg-gray-800 text-white">
          <option value="">Select a shape to generalize...</option>
          {filteredShapes.map(shape => (
            <option key={shape.id} value={shape.id}>{shape.name}</option>
          ))}
        </select>
        <Button onClick={handleGeneralize} className="mt-4">Generalize</Button>
      </div>
    </>
  );
};

export default ScaleShapeForm;