import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Paywall } from '@/components/Paywall';
import { ChordProgressionExercise } from '@/components/ChordProgressionExercise';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setHasAccess(false);
      return;
    }
    supabase
      .from('profiles')
      .select('has_notewalking_access')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setHasAccess((data as any)?.has_notewalking_access ?? false);
      });
  }, [user, authLoading]);

  if (authLoading || hasAccess === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user || !hasAccess) {
    return <Paywall />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      <ChordProgressionExercise autoStart={false} />
    </div>
  );
};

export default Index;
