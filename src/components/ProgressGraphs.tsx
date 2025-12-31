import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type PracticeLogWithExercise = Tables<'practice_log'> & {
  scales: { name: string } | null;
  scale_shapes: { name: string } | null;
};

const ProgressGraphs = () => {
  const { user } = useAuth();
  const [practiceData, setPracticeData] = useState<PracticeLogWithExercise[]>([]);

  useEffect(() => {
    const fetchPracticeData = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('practice_log')
          .select('*, scales(name), scale_shapes(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (data) {
          setPracticeData(data as PracticeLogWithExercise[]);
        }
      }
    };

    fetchPracticeData();
  }, [user]);

  const exercises = practiceData.reduce((acc, log) => {
    const exerciseName = log.scales?.name || log.scale_shapes?.name;
    if (exerciseName && !acc[exerciseName]) {
      acc[exerciseName] = [];
    }
    if (exerciseName) {
      acc[exerciseName].push(log);
    }
    return acc;
  }, {} as Record<string, PracticeLogWithExercise[]>);

  return (
    <div>
      {/* Only show first 2 graphs as a preview */}
      {Object.entries(exercises).slice(0, 2).map(([exerciseName, data]) => (
        <div key={exerciseName} className="mb-8">
          <h3 className="text-lg font-bold mb-2">{exerciseName}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="created_at" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="max_bpm" stroke="#8884d8" name="Max BPM" />
              <Line type="monotone" dataKey="perfect_bpm" stroke="#82ca9d" name="Perfect BPM" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
      {Object.keys(exercises).length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <p>No exercise data yet. Start practicing to see your progress!</p>
        </div>
      )}
    </div>
  );
};

export default ProgressGraphs;