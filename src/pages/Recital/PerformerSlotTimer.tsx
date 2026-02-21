import { useEffect, useState, useRef } from 'react';
import { useRecital } from '@/contexts/RecitalContext';
import { PERFORMER_SLOT_SECONDS } from '@/types/recital';

export const PerformerSlotTimer = () => {
  const { activeRecital, advancePerformer, isPerformer } = useRecital();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const autoAdvancedRef = useRef(false);

  useEffect(() => {
    if (!activeRecital?.performer_slot_started_at || !activeRecital.current_performer_id) {
      setSecondsLeft(null);
      autoAdvancedRef.current = false;
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - new Date(activeRecital.performer_slot_started_at!).getTime()) / 1000;
      const remaining = Math.max(0, PERFORMER_SLOT_SECONDS - elapsed);
      setSecondsLeft(Math.ceil(remaining));

      // Auto-advance when time is up and this client is the performer
      if (remaining <= 0 && isPerformer && !autoAdvancedRef.current) {
        autoAdvancedRef.current = true;
        advancePerformer();
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [activeRecital?.performer_slot_started_at, activeRecital?.current_performer_id, isPerformer]);

  if (secondsLeft === null) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isWarning = secondsLeft <= 30;
  const isExpired = secondsLeft === 0;

  return (
    <div className={`text-center font-mono text-2xl font-bold ${
      isExpired ? 'text-destructive' :
      isWarning ? 'text-yellow-500' :
      'text-foreground'
    }`}>
      {isExpired ? 'Time Up' : `${minutes}:${String(seconds).padStart(2, '0')}`}
    </div>
  );
};
