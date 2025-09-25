import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const Settings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ autoRecord: false });
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>User Settings</CardTitle>
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
    </div>
  );
};

export default Settings;