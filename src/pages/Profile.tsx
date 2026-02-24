import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ProgressGraphs from '@/components/ProgressGraphs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { usePracticeSettings } from '@/contexts/PracticeSettingsContext';

type PracticeLogWithExercise = Tables<'practice_log'> & {
  exercises: { name: string } | null;
  module_type?: string | null;
  module_config?: Record<string, any> | null;
  exercise_category?: string | null;
};

interface ProfileSettings {
  autoRecordEnabled?: boolean;
}

// Updated Stripe Price ID ($29.99/mo)
const STRIPE_PRICE_ID = "price_1T3lcJEOnRZP4MxPepztrhp6";
// Course Purchase Price ID ($179.99)
const STRIPE_COURSE_PRICE_ID = "price_1T3lniEOnRZP4MxPH3uGYgSw";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [practiceLog, setPracticeLog] = useState<PracticeLogWithExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false); // State for sub button
  const [isBuyingCourse, setIsBuyingCourse] = useState(false); // State for course button
  const [isManagingSub, setIsManagingSub] = useState(false); // State for portal button
  const [isClaimingCourse, setIsClaimingCourse] = useState(false);
  const [courseEnrollment, setCourseEnrollment] = useState<any>(null);
  const { settings: practiceSettings, updateSettings: updatePracticeSettings, isLoading: practiceLoading } = usePracticeSettings();

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

    const fetchCourseEnrollment = async () => {
      if (user) {
        const { data } = await supabase
          .from('course_enrollments' as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        setCourseEnrollment(data);
      }
    };

    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchPracticeLog(), fetchCourseEnrollment()]);
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

  const handleBuyCourse = async () => {
    try {
      setIsBuyingCourse(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Please log in to purchase the course", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: STRIPE_COURSE_PRICE_ID,
          mode: 'payment',
          metadata: { type: 'course_purchase' }
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }

    } catch (err: any) {
      console.error("Purchase error:", err);
      toast({ title: "Failed to start checkout: " + err.message, variant: "destructive" });
    } finally {
      setIsBuyingCourse(false);
    }
  }

  const handleManageSubscription = async () => {
    try {
      setIsManagingSub(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Please log in to manage subscription", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-portal-session', {});

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (err: any) {
      console.error("Portal error:", err);
      toast({ title: "Failed to open billing portal: " + err.message, variant: "destructive" });
    } finally {
      setIsManagingSub(false);
    }
  }

  const handleClaimCoursePurchase = async () => {
    if (!user || !profile) return;
    try {
      setIsClaimingCourse(true);

      // 1. Insert course enrollment (pending verification)
      const { error: enrollErr } = await supabase
        .from('course_enrollments' as any)
        .insert({ user_id: user.id, status: 'pending_verification', source: 'guitar_brain_course' });

      if (enrollErr) throw enrollErr;

      // 2. Extend trial by 14 days
      const currentPremium = profile.premium_until ? new Date(profile.premium_until) : new Date();
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 14); // 14 days from now

      // Only bump if they don't already have more than 14 days
      const newDateToSet = currentPremium > targetDate ? currentPremium : targetDate;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ premium_until: newDateToSet.toISOString() } as any)
        .eq('id', user.id);

      if (profileErr) throw profileErr;

      toast({ title: "Course Claimed!", description: "You've been granted 14 days of free Premium while we verify your purchase." });

      // Refresh view natively
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
      setCourseEnrollment({ status: 'pending_verification' });

    } catch (e: any) {
      toast({ title: "Failed to claim course", description: e.message, variant: 'destructive' });
    } finally {
      setIsClaimingCourse(false);
    }
  }

  if (loading || practiceLoading) {
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
          <TabsTrigger value="recitals">Recital History</TabsTrigger>
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
              <Label htmlFor="display_name">Display Name <span className="text-muted-foreground text-xs">(shown in recital chat & queue)</span></Label>
              <Input
                id="display_name"
                type="text"
                value={(profile as any)?.display_name || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, id: user!.id, display_name: e.target.value } as any))}
                placeholder={user?.email?.split('@')[0]}
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

              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                {!isPremium && (
                  <div className="flex-1 border rounded-lg p-4">
                    <p className="mb-4 text-muted-foreground">
                      Upgrade to Guitar Brain Premium for $29.99/mo to unlock all features.
                    </p>
                    <Button
                      onClick={handleSubscribe}
                      disabled={isSubscribing || isBuyingCourse}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white w-full"
                    >
                      {isSubscribing ? 'Processing...' : 'Upgrade Now ($29.99/mo)'}
                    </Button>
                  </div>
                )}

                {(!courseEnrollment || courseEnrollment.status !== 'verified') && (
                  <div className="flex-1 border rounded-lg p-4 border-indigo-500/30">
                    <p className="mb-4 text-muted-foreground">
                      Buy the Video Course + get 90 days of Premium.
                    </p>
                    <Button
                      onClick={handleBuyCourse}
                      disabled={isSubscribing || isBuyingCourse}
                      variant="outline"
                      className="w-full text-indigo-500 border-indigo-500 hover:bg-indigo-500/10"
                    >
                      {isBuyingCourse ? 'Processing...' : 'Buy Course ($179.99)'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Course Integration Sub-section */}
              <div className="pt-6 border-t mt-6">
                <h3 className="font-bold text-lg mb-2">Video Course Access</h3>

                {courseEnrollment ? (
                  <div className="bg-muted p-4 rounded-md">
                    <p className="font-semibold text-primary">Enrollment Status: {
                      courseEnrollment.status === 'verified' ? "🎉 Verified (90-Days Premium Active)" :
                        courseEnrollment.status === 'pending_verification' ? "⏳ Verifying your purchase (14-day grace period active)" : "❌ Rejected"
                    }</p>
                    <Button asChild variant="link" className="px-0 mt-2"><Link to="/course">Go to Course Dashboard &rarr;</Link></Button>
                  </div>
                ) : (
                  <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-md">
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-3">Did you purchase our Guitar Brain course elsewhere? Claim your 90-day premium pass here.</p>
                    <Button
                      variant="outline"
                      onClick={handleClaimCoursePurchase}
                      disabled={isClaimingCourse}
                      className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
                    >
                      {isClaimingCourse ? 'Claiming...' : 'I bought the course!'}
                    </Button>
                  </div>
                )}
              </div>

              {isPremium && (
                <div className="pt-4">
                  <p className="text-muted-foreground mb-4">
                    To manage or cancel your subscription, please use the Stripe Customer Portal.
                  </p>
                  <Button
                    onClick={handleManageSubscription}
                    disabled={isManagingSub}
                    variant="outline"
                  >
                    {isManagingSub ? 'Opening Portal...' : 'Manage Subscription'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="space-y-6">
            {/* Auto-Record Setting */}
            <Card>
              <CardHeader>
                <CardTitle>Recording Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-record" className="text-base font-medium">Auto-Record Practice</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically record snippets during your practice sessions
                    </p>
                  </div>
                  <Switch
                    id="auto-record"
                    checked={(profile?.settings as ProfileSettings)?.autoRecordEnabled !== false}
                    onCheckedChange={(value) =>
                      setProfile((prev) => ({
                        ...prev,
                        id: user!.id,
                        settings: {
                          ...((prev?.settings as ProfileSettings) || {}),
                          autoRecordEnabled: value,
                        },
                      }))
                    }
                  />
                </div>

                {/* Microphone Permission Note */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">🎤 Tip:</span> For auto-recording to work seamlessly,
                    set your browser's microphone permission for this site to "Always Allow".
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Default Metronome Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Default Metronome Settings</CardTitle>
                <CardDescription>Your preferred starting settings when opening any practice module</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Default BPM */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Default BPM</Label>
                    <span className="text-sm font-medium">{practiceSettings.defaultMetronome?.bpm ?? 60} BPM</span>
                  </div>
                  <Slider
                    value={[practiceSettings.defaultMetronome?.bpm ?? 60]}
                    min={40}
                    max={180}
                    step={5}
                    onValueChange={([value]) => updatePracticeSettings({
                      defaultMetronome: { ...practiceSettings.defaultMetronome, bpm: value }
                    })}
                  />
                </div>

                {/* Default Mode */}
                <div className="space-y-2">
                  <div>
                    <Label>Default Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      {practiceSettings.defaultMetronome?.mode === 'speed-trainer'
                        ? 'Speed Trainer: Gradually increases BPM'
                        : practiceSettings.defaultMetronome?.mode === 'progressive'
                          ? 'Progressive: Step up BPM at set intervals'
                          : 'Regular: Constant BPM'}
                    </p>
                  </div>
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <Button
                      size="sm"
                      variant={practiceSettings.defaultMetronome?.mode === 'regular' ? 'default' : 'ghost'}
                      onClick={() => updatePracticeSettings({
                        defaultMetronome: { ...practiceSettings.defaultMetronome, mode: 'regular' }
                      })}
                    >
                      Regular
                    </Button>
                    <Button
                      size="sm"
                      variant={practiceSettings.defaultMetronome?.mode === 'speed-trainer' ? 'default' : 'ghost'}
                      onClick={() => updatePracticeSettings({
                        defaultMetronome: { ...practiceSettings.defaultMetronome, mode: 'speed-trainer' }
                      })}
                    >
                      Speed
                    </Button>
                    <Button
                      size="sm"
                      variant={practiceSettings.defaultMetronome?.mode === 'progressive' ? 'default' : 'ghost'}
                      onClick={() => updatePracticeSettings({
                        defaultMetronome: { ...practiceSettings.defaultMetronome, mode: 'progressive' }
                      })}
                    >
                      Progressive
                    </Button>
                  </div>
                </div>

                {/* Drum Beat */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="drum-beat">Drum Beat</Label>
                    <p className="text-sm text-muted-foreground">
                      Play kick on 1, snare on 3 instead of clicks
                    </p>
                  </div>
                  <Switch
                    id="drum-beat"
                    checked={practiceSettings.defaultMetronome?.drum_beat ?? false}
                    onCheckedChange={(value) => updatePracticeSettings({
                      defaultMetronome: { ...practiceSettings.defaultMetronome, drum_beat: value }
                    })}
                  />
                </div>

                {/* Auto-Record Default */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="metronome-auto-record">Auto-Record by Default</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically enable recording when starting practice
                    </p>
                  </div>
                  <Switch
                    id="metronome-auto-record"
                    checked={practiceSettings.defaultMetronome?.auto_record ?? false}
                    onCheckedChange={(value) => updatePracticeSettings({
                      defaultMetronome: { ...practiceSettings.defaultMetronome, auto_record: value }
                    })}
                  />
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleUpdate}>Save Settings</Button>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className="space-y-8">
            {/* Practice Log Section - First */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Practice Log</h2>
                {/* Module Filter Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="module-filter" className="text-sm text-muted-foreground">
                    Filter by:
                  </label>
                  <select
                    id="module-filter"
                    className="px-3 py-2 border rounded-md bg-background text-sm"
                    onChange={(e) => {
                      const filter = e.target.value;
                      const rows = document.querySelectorAll('[data-module-type]');
                      rows.forEach((row) => {
                        const el = row as HTMLElement;
                        if (filter === 'all' || el.dataset.moduleType === filter) {
                          el.style.display = '';
                        } else {
                          el.style.display = 'none';
                        }
                      });
                    }}
                  >
                    <option value="all">All Modules</option>
                    {/* Get unique module types from practiceLog */}
                    {[...new Set(practiceLog.map(log => log.module_type).filter(Boolean))].map(type => (
                      <option key={type} value={type || ''}>
                        {type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exercise</TableHead>
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

                    return (
                      <TableRow key={log.id} data-module-type={log.module_type || ''}>
                        <TableCell>
                          <span className="font-medium">{displayName}</span>
                        </TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {log.audio ? (
                            <audio controls src={log.audio} className="h-8" />
                          ) : (
                            <span className="text-muted-foreground text-sm">No recording</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Progress Graphs Section - Second (simplified) */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Progress Over Time</h2>
              <p className="text-sm text-muted-foreground mb-4">
                More detailed progress analytics coming soon!
              </p>
              <ProgressGraphs />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="recitals">
          <RecitalHistoryTab userId={user?.id ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Recital History ────────────────────────────────────────────────────────
interface RecitalHistoryTabProps { userId: string }

const RecitalHistoryTab = ({ userId }: RecitalHistoryTabProps) => {
  const [entries, setEntries] = React.useState<any[]>([]);
  const [chatByEntry, setChatByEntry] = React.useState<Record<string, any[]>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: queueData } = await supabase
        .from('recital_queue')
        .select('*, recitals(started_at, status)')
        .eq('user_id', userId)
        .not('performed_at', 'is', null)
        .order('performed_at', { ascending: false });

      setEntries(queueData ?? []);

      // Fetch chat transcripts for each slot (messages in the window [performed_at - slot, performed_at + 2 min])
      // We approximate: performed_at is when the slot ENDED; slot started ~3 min before
      if (queueData && queueData.length > 0) {
        const chatMap: Record<string, any[]> = {};
        await Promise.all(queueData.map(async (entry: any) => {
          const slotEnd = new Date(entry.performed_at);
          const slotStart = new Date(slotEnd.getTime() - 5 * 60 * 1000); // 3 min slot + 2 min buffer
          const windowEnd = new Date(slotEnd.getTime() + 2 * 60 * 1000);

          const { data: messages } = await supabase
            .from('recital_chat')
            .select('*')
            .eq('recital_id', entry.recital_id)
            .gte('created_at', slotStart.toISOString())
            .lte('created_at', windowEnd.toISOString())
            .eq('deleted_by_admin', false)
            .order('created_at', { ascending: true });

          chatMap[entry.id] = messages ?? [];
        }));
        setChatByEntry(chatMap);
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading recital history...</div>;

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>You haven't performed in any recitals yet.</p>
        <p className="text-sm mt-1">Join a recital and mark yourself ready to perform!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {entries.map((entry: any) => {
        const messages = chatByEntry[entry.id] ?? [];
        return (
          <Card key={entry.id}>
            <CardHeader>
              <CardTitle className="text-base">
                Performance on {new Date(entry.performed_at).toLocaleDateString([], {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </CardTitle>
              <CardDescription>
                {new Date(entry.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chat messages during your slot.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {messages.map((msg: any) => (
                    <div key={msg.id} className="text-sm">
                      <span className="font-semibold text-primary">{msg.display_name}: </span>
                      <span>{msg.body}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default Profile;