import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ProgressGraphs from '@/components/ProgressGraphs';

type PracticeLogWithExercise = Tables<'practice_log'> & {
  exercises: { name: string } | null;
};

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [practiceLog, setPracticeLog] = useState<PracticeLogWithExercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          toast({
            title: 'Error fetching profile',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          setProfile(data);
        }
      }
    };

    const fetchPracticeLog = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('practice_log')
          .select('*, exercises(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          toast({
            title: 'Error fetching practice log',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          setPracticeLog(data as PracticeLogWithExercise[]);
        }
      }
    };

    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchPracticeLog()]);
      setLoading(false);
    };

    fetchData();
  }, [user, toast]);

  const handleUpdate = async () => {
    if (user && profile) {
      const { error } = await supabase
        .from('profiles')
        .update(profile)
        .eq('id', user.id);

      if (error) {
        toast({
          title: 'Error updating profile',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Profile updated',
          description: 'Your profile has been updated successfully.',
        });
      }
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h1 className="text-2xl font-bold mb-4">Your Profile</h1>
          <div className="space-y-4">
            <div>
              <label htmlFor="website">Website</label>
              <Input
                id="website"
                type="text"
                value={profile?.website || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, id: user!.id, website: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="youtube">YouTube</label>
              <Input
                id="youtube"
                type="text"
                value={profile?.youtube || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, id: user!.id, youtube: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="band">Band</label>
              <Input
                id="band"
                type="text"
                value={profile?.band || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, id: user!.id, band: e.target.value }))}
              />
            </div>
            <Button onClick={handleUpdate}>Update Profile</Button>
          </div>
        </div>
        <div className="md:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Practice History</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercise</TableHead>
                <TableHead>Duration (minutes)</TableHead>
                <TableHead>Max BPM</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {practiceLog.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.exercises?.name}</TableCell>
                  <TableCell>{Math.round(log.duration / 60)}</TableCell>
                  <TableCell>{log.max_bpm}</TableCell>
                  <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <ProgressGraphs />
        </div>
      </div>
    </div>
  );
};

export default Profile;