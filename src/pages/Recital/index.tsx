import { useRecital } from '@/contexts/RecitalContext';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecitalVideoPanel } from './RecitalVideoPanel';
import { RecitalQueuePanel } from './RecitalQueuePanel';
import { RecitalChatPanel } from './RecitalChatPanel';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const RecitalPage = () => {
  const { activeRecital, loading } = useRecital();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <h2 className="text-2xl font-bold">Sign In Required</h2>
        <p className="text-muted-foreground">You need to be signed in to join the recital.</p>
        <Link to="/auth">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Loading recital...</p>
      </div>
    );
  }

  if (!activeRecital) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center">
        <h2 className="text-2xl font-bold">No Active Recital</h2>
        <p className="text-muted-foreground">There's no recital happening right now. Check the schedule on the home page.</p>
        <Link to="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-[calc(100vh-8rem)] pb-16">
        <Tabs defaultValue="video" className="h-full flex flex-col">
          <TabsList className="shrink-0 w-full">
            <TabsTrigger value="video" className="flex-1">Video</TabsTrigger>
            <TabsTrigger value="queue" className="flex-1">Queue</TabsTrigger>
            <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
          </TabsList>
          <TabsContent value="video" className="flex-1 min-h-0 mt-0">
            <RecitalVideoPanel />
          </TabsContent>
          <TabsContent value="queue" className="flex-1 min-h-0 mt-0 overflow-hidden">
            <RecitalQueuePanel />
          </TabsContent>
          <TabsContent value="chat" className="flex-1 min-h-0 mt-0 overflow-hidden">
            <RecitalChatPanel />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop: three-column layout
  return (
    <div className="h-[calc(100vh-8rem)] pb-16 grid grid-cols-[1fr_280px_280px] gap-3">
      <div className="min-h-0 overflow-hidden border rounded-lg">
        <RecitalVideoPanel />
      </div>
      <div className="min-h-0 overflow-hidden border rounded-lg flex flex-col">
        <RecitalQueuePanel />
      </div>
      <div className="min-h-0 overflow-hidden border rounded-lg flex flex-col">
        <RecitalChatPanel />
      </div>
    </div>
  );
};

export default RecitalPage;
