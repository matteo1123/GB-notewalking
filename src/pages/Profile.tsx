import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ProgressGraphs from '@/components/ProgressGraphs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';

type PracticeLogWithExercise = Tables<'practice_log'> & {
  exercises: { name: string } | null;
  module_type?: string | null;
  module_config?: Record<string, any> | null;
  exercise_category?: string | null;
};

interface ProfileSettings {
  autoRecord?: boolean;
}

// Updated Stripe Price ID
const STRIPE_PRICE_ID = "price_1SjudUEOnRZP4MxPsBbk5KIS";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [practiceLog, setPracticeLog] = useState<PracticeLogWithExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false); // State for sub button

  // Helper to check if premium based on date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isPremium = (profile as any)?.premium_until && new Date((profile as any).premium_until) > new Date();

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

  const handleSubscribe = async () => {
    try {
      setIsSubscribing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Please log in to subscribe", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: STRIPE_PRICE_ID,
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }

    } catch (err: any) {
      console.error("Subscription error:", err);
      toast({ title: "Failed to start subscription: " + err.message, variant: "destructive" });
    } finally {
      setIsSubscribing(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">Practice History</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
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
        </TabsContent>

        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-lg">Status:</Label>
                <span className={`text-lg font-bold ${isPremium ? 'text-green-500' : 'text-gray-500'}`}>
                  {isPremium ? 'Active Premium' : 'Free / Expired'}
                </span>
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(profile as any)?.premium_until && (
                <div>
                  <Label>Valid Until:</Label>
                  <div className="text-muted-foreground">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {new Date((profile as any).premium_until).toLocaleDateString()}
                  </div>
                </div>
              )}

              {!isPremium && (
                <div className="pt-4">
                  <p className="mb-4 text-muted-foreground">
                    Upgrade to Guitar Brain Premium for $9.99/mo to unlock all features.
                  </p>
                  <Button
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                  >
                    {isSubscribing ? 'Processing...' : 'Upgrade Now ($9.99/mo)'}
                  </Button>
                </div>
              )}

              {isPremium && (
                <div className="pt-4">
                  <p className="text-muted-foreground">
                    To manage or cancel your subscription, please use the Stripe Customer Portal (link coming soon, or contact support).
                  </p>
                  {/* Future: Add button to call create-portal-session */}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-record">Default to Auto Record</Label>
                <Switch
                  id="auto-record"
                  checked={(profile?.settings as ProfileSettings)?.autoRecord || false}
                  onCheckedChange={(value) =>
                    setProfile((prev) => ({
                      ...prev,
                      id: user!.id,
                      settings: {
                        ...((prev?.settings as ProfileSettings) || {}),
                        autoRecord: value,
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
          <Button onClick={handleUpdate} className="mt-4">Update Settings</Button>
        </TabsContent>
        <TabsContent value="history">
          <div className="space-y-8">
            <ProgressGraphs />
            <div>
              <h2 className="text-2xl font-bold mb-4">Practice Log</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exercise</TableHead>
                    <TableHead>Duration (minutes)</TableHead>
                    <TableHead>Max BPM</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Recording</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {practiceLog.map((log) => {
                    // Handle polymorphic practice log - prefer module_type over legacy exercise_category
                    const displayName = log.module_type
                      ? `${log.module_type.charAt(0).toUpperCase() + log.module_type.slice(1)} Practice`
                      : log.exercise_category || 'Unknown';

                    // For module-based entries, show module config details
                    const moduleDetails = log.module_config
                      ? ` (${Object.entries(log.module_config).map(([k, v]) => `${k}: ${v}`).join(', ')})`
                      : '';

                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Link to={`/premium?exerciseId=${log.scale_id}`} className="hover:underline">
                            {displayName}{moduleDetails}
                          </Link>
                        </TableCell>
                        <TableCell>{Math.round(log.duration / 60)}</TableCell>
                        <TableCell>{log.max_bpm || '-'}</TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {log.audio && (
                            <audio controls src={log.audio} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;