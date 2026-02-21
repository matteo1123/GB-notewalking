import { useRef, useEffect, useState } from 'react';
import { useRecital } from '@/contexts/RecitalContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Send } from 'lucide-react';

export const RecitalChatPanel = () => {
  const { chatMessages, sendMessage, deleteMessage, isAdmin, myQueueEntry, activeRecital } = useRecital();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const isBanned = myQueueEntry?.chat_banned_this_session ?? false;

  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending || isBanned) return;
    setSending(true);
    try {
      await sendMessage(body);
      setInput('');
    } catch {
      // rate limit or other error — silently ignore for now
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeRecital) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">Chat</h3>
        <p className="text-xs text-muted-foreground">Constructive feedback only</p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {chatMessages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No messages yet. Be the first to cheer someone on!
            </p>
          )}
          {chatMessages.map((msg) => {
            if (msg.deleted_by_admin) {
              if (!isAdmin) return null;
              return (
                <div key={msg.id} className="text-xs text-muted-foreground italic">
                  [message deleted]
                </div>
              );
            }
            return (
              <div key={msg.id} className="group flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-primary">
                    {msg.user_id === user?.id ? 'You' : msg.display_name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="text-sm break-words">{msg.body}</p>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                    onClick={() => deleteMessage(msg.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        {isBanned ? (
          <p className="text-xs text-destructive text-center">
            You have been muted from this recital's chat.
          </p>
        ) : !user ? (
          <p className="text-xs text-muted-foreground text-center">Sign in to chat</p>
        ) : (
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something encouraging..."
              maxLength={500}
              className="flex-1 text-sm"
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
