import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    setLessonExercises([...lessonExercises, { ...exercise, type, target_bpm: 120 }]);
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
          <ul>
            {lessonExercises.map((exercise, index) => (
              <li key={index}>{exercise.name}</li>
            ))}
          </ul>
        </div>
        <Button className="mt-4" onClick={handleSaveLesson}>Save Lesson</Button>
      </div>
    </div>
  );
};

export default LessonBuilder;