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
      <h2 className="text-xl font-bold mb-4">Progress</h2>
      {Object.entries(exercises).map(([exerciseName, data]) => (
        <div key={exerciseName} className="mb-8">
          <h3 className="text-lg font-bold mb-2">{exerciseName}</h3>
          <ResponsiveContainer width="100%" height={300}>
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
    </div>
  );
};

export default ProgressGraphs;