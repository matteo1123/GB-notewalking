import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const LessonBuilder = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scales, setScales] = useState([]);
  const [scaleShapes, setScaleShapes] = useState([]);
  const [lessonName, setLessonName] = useState('');
  const [lessonExercises, setLessonExercises] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: scalesData, error: scalesError } = await supabase.from('scales').select('*');
      if (scalesError) {
        toast({ title: "Error fetching scales", description: scalesError.message });
      } else {
        setScales(scalesData);
      }

      const { data: scaleShapesData, error: scaleShapesError } = await supabase.from('scale_shapes').select('*');
      if (scaleShapesError) {
        toast({ title: "Error fetching scale shapes", description: scaleShapesError.message });
      } else {
        setScaleShapes(scaleShapesData);
      }
    };
    fetchData();
  }, []);

  const addExerciseToLesson = (exercise, type) => {
    setLessonExercises([...lessonExercises, {
      ...exercise,
      type,
      target_bpm: 120,
      metronome_mode: 'standard',
      starting_bpm: 60,
      increments: 4,
      measures_per_bpm: 4,
      display_view: 'tab',
      target_type: 'max'
    }]);
  };

  const updateExercise = (index, field, value) => {
    const updated = [...lessonExercises];
    updated[index][field] = value;
    setLessonExercises(updated);
  };

  const handleSaveLesson = async () => {
    if (!lessonName) {
      toast({ title: "Error", description: "Please enter a name for the lesson." });
      return;
    }
    if (lessonExercises.length === 0) {
      toast({ title: "Error", description: "Please add at least one exercise to the lesson." });
      return;
    }

    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .insert([{ name: lessonName, created_by: user.id }])
      .select();

    if (lessonError) {
      toast({ title: "Error saving lesson", description: lessonError.message });
      return;
    }

    const lessonId = lessonData[0].id;

    const lessonExercisesData = lessonExercises.map((exercise, index) => ({
      lesson_id: lessonId,
      scale_id: exercise.type === 'scale' ? exercise.id : null,
      scale_shape_id: exercise.type === 'scale_shape' ? exercise.id : null,
      target_bpm: exercise.target_bpm,
      metronome_mode: exercise.metronome_mode,
      starting_bpm: exercise.starting_bpm,
      increments: exercise.increments,
      measures_per_bpm: exercise.measures_per_bpm,
      display_view: exercise.display_view,
      target_type: exercise.target_type,
      order: index,
    }));

    const { error: lessonExercisesError } = await supabase
      .from('lesson_exercises')
      .insert(lessonExercisesData);

    if (lessonExercisesError) {
      toast({ title: "Error saving lesson exercises", description: lessonExercisesError.message });
    } else {
      toast({ title: "Success", description: "Lesson saved successfully." });
      setLessonName('');
      setLessonExercises([]);
    }
  };

  return (
    <div className="p-4 grid grid-cols-3 gap-4">
      <div>
        <h2 className="text-xl font-bold mb-4">Available Exercises</h2>
        <div className="max-h-96 overflow-y-auto">
          <h3 className="text-lg font-bold">Scales</h3>
          <ul>
            {scales.map(scale => (
              <li key={scale.id} className="flex justify-between items-center">
                {scale.name}
                <Button onClick={() => addExerciseToLesson(scale, 'scale')}>Add</Button>
              </li>
            ))}
          </ul>
          <h3 className="text-lg font-bold mt-4">Scale Shapes</h3>
          <ul>
            {scaleShapes.map(shape => (
              <li key={shape.id} className="flex justify-between items-center">
                {shape.name}
                <Button onClick={() => addExerciseToLesson(shape, 'scale_shape')}>Add</Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold mb-4">Lesson Details</h2>
        <div>
          <Label htmlFor="lesson-name">Lesson Name</Label>
          <Input id="lesson-name" value={lessonName} onChange={(e) => setLessonName(e.target.value)} />
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-bold">Exercises in this Lesson</h3>
          <div className="space-y-4">
            {lessonExercises.map((exercise, index) => (
              <div key={index} className="border p-4 rounded">
                <h4 className="font-semibold">{exercise.name}</h4>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label>Metronome Mode</Label>
                    <Select value={exercise.metronome_mode} onValueChange={(value) => updateExercise(index, 'metronome_mode', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="speed_builder">Speed Builder</SelectItem>
                        <SelectItem value="progressive">Progressive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Starting BPM</Label>
                    <Input type="number" value={exercise.starting_bpm} onChange={(e) => updateExercise(index, 'starting_bpm', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label>Target BPM</Label>
                    <Input type="number" value={exercise.target_bpm} onChange={(e) => updateExercise(index, 'target_bpm', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label>Increments</Label>
                    <Input type="number" value={exercise.increments} onChange={(e) => updateExercise(index, 'increments', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label>Measures per BPM</Label>
                    <Input type="number" value={exercise.measures_per_bpm} onChange={(e) => updateExercise(index, 'measures_per_bpm', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label>Display View</Label>
                    <Select value={exercise.display_view} onValueChange={(value) => updateExercise(index, 'display_view', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tab">Tab</SelectItem>
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="fretboard">Fretboard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Target Type</Label>
                    <Select value={exercise.target_type} onValueChange={(value) => updateExercise(index, 'target_type', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="max">Max BPM</SelectItem>
                        <SelectItem value="perfect">Perfect BPM</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Button className="mt-4" onClick={handleSaveLesson}>Save Lesson</Button>
      </div>
    </div>
  );
};

export default LessonBuilder;