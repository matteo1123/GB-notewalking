import { useState } from 'react';
import { useRecital } from '@/contexts/RecitalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CalendarPlus } from 'lucide-react';

export const RecitalScheduleEditor = () => {
  const { scheduleRecital } = useRecital();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !dateTime) return;
    setSaving(true);
    try {
      await scheduleRecital(title.trim(), new Date(dateTime), notes.trim() || undefined);
      setOpen(false);
      setTitle('');
      setDateTime('');
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <CalendarPlus className="h-4 w-4" />
          Schedule Recital
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule a Recital</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="recital-title">Title</Label>
            <Input
              id="recital-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly Recital #1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="recital-datetime">Date & Time</Label>
            <Input
              id="recital-datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="recital-notes">Notes (optional)</Label>
            <Textarea
              id="recital-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Theme, special instructions, etc."
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={!title.trim() || !dateTime || saving} className="w-full">
            {saving ? 'Saving...' : 'Schedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
