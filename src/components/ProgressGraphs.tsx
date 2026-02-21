import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type PracticeLogWithExercise = any;

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

  // Sort by number of practice sessions (most practiced first)
  const topExercises = Object.entries(exercises)
    .sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {topExercises.map(([exerciseName, data]) => (
        <div key={exerciseName} className="border bg-background/50 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-bold mb-4 text-primary">{exerciseName}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data as any[]} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id={`colorMaxBpm-${exerciseName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`colorPerfectBpm-${exerciseName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="created_at"
                tickFormatter={(date) => new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                minTickGap={20}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))'
                }}
                labelFormatter={(date) => new Date(date as string).toLocaleDateString()}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line
                type="monotone"
                dataKey="max_bpm"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                name="Max BPM"
                dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="perfect_bpm"
                stroke="hsl(var(--chart-2))"
                strokeWidth={3}
                name="Perfect BPM"
                dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
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