import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePracticeSettings } from "@/contexts/PracticeSettingsContext";

const Settings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ autoRecord: false });
  const [loading, setLoading] = useState(true);
  const { settings: practiceSettings, updateSettings: updatePracticeSettings, isLoading: practiceLoading } = usePracticeSettings();

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching settings:", error);
      } else if (data && data.settings) {
        setSettings(data.settings as { autoRecord: boolean });
      }
      setLoading(false);
    };

    fetchSettings();
  }, [user]);

  const handleSettingChange = async (key: string, value: boolean) => {
    if (!user) return;
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    const { error } = await supabase
      .from("profiles")
      .update({ settings: newSettings })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating settings:", error);
    }
  };

  if (loading || practiceLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-record">Default to Auto Record</Label>
            <Switch
              id="auto-record"
              checked={settings.autoRecord}
              onCheckedChange={(value) => handleSettingChange("autoRecord", value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Practice Session Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Practice Session Settings</CardTitle>
          <CardDescription>Configure how exercises behave during practice sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Practice Mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Practice Mode</Label>
                <p className="text-sm text-muted-foreground">
                  {practiceSettings.practiceMode === 'progressive'
                    ? 'Progressive: BPM increases until target, then advances'
                    : 'Static: Fixed BPM for a set duration'}
                </p>
              </div>
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                <Button
                  size="sm"
                  variant={practiceSettings.practiceMode === 'static' ? 'default' : 'ghost'}
                  onClick={() => updatePracticeSettings({ practiceMode: 'static' })}
                >
                  Static
                </Button>
                <Button
                  size="sm"
                  variant={practiceSettings.practiceMode === 'progressive' ? 'default' : 'ghost'}
                  onClick={() => updatePracticeSettings({ practiceMode: 'progressive' })}
                >
                  Progressive
                </Button>
              </div>
            </div>
          </div>

          {/* Exercise Duration (for static mode) */}
          {practiceSettings.practiceMode === 'static' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Exercise Duration</Label>
                <span className="text-sm font-medium">{practiceSettings.exerciseDurationMinutes} min</span>
              </div>
              <Slider
                value={[practiceSettings.exerciseDurationMinutes]}
                min={1}
                max={10}
                step={1}
                onValueChange={([value]) => updatePracticeSettings({ exerciseDurationMinutes: value })}
              />
            </div>
          )}

          {/* BPM Increment (for progressive mode) */}
          {practiceSettings.practiceMode === 'progressive' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>BPM Increment</Label>
                <span className="text-sm font-medium">+{practiceSettings.bpmIncrement} BPM</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Start this many BPM higher than your last practice
              </p>
              <Slider
                value={[practiceSettings.bpmIncrement]}
                min={1}
                max={15}
                step={1}
                onValueChange={([value]) => updatePracticeSettings({ bpmIncrement: value })}
              />
            </div>
          )}

          {/* Auto-Advance */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-advance">Auto-Advance</Label>
              <p className="text-sm text-muted-foreground">
                Automatically move to next exercise after completion
              </p>
            </div>
            <Switch
              id="auto-advance"
              checked={practiceSettings.autoAdvance}
              onCheckedChange={(value) => updatePracticeSettings({ autoAdvance: value })}
            />
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
            <div className="flex items-center justify-between">
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
    </div>
  );
};

export default Settings;