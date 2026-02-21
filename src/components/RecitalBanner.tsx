import { Link } from 'react-router-dom';
import { useRecital } from '@/contexts/RecitalContext';
import { Button } from '@/components/ui/button';
import { Radio } from 'lucide-react';

export const RecitalBanner = () => {
  const { activeRecital, isAdmin, endRecital } = useRecital();

  if (!activeRecital) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 animate-pulse" />
        <span className="text-sm font-medium">Live Recital in progress</span>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/recital">
          <Button size="sm" variant="secondary">
            Join Now
          </Button>
        </Link>
        {isAdmin && (
          <Button
            size="sm"
            variant="destructive"
            onClick={endRecital}
          >
            End Recital
          </Button>
        )}
      </div>
    </div>
  );
};
