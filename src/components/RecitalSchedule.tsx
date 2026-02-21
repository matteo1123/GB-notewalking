import { useEffect, useState } from 'react';
import { useRecital } from '@/contexts/RecitalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Pencil, Trash2 } from 'lucide-react';
import type { RecitalSchedule as RecitalScheduleType } from '@/types/recital';

const formatCountdown = (scheduledFor: string): string => {
  const diff = new Date(scheduledFor).getTime() - Date.now();
  if (diff <= 0) return 'Starting now!';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `In ${days}d ${hours}h`;
  if (hours > 0) return `In ${hours}h ${minutes}m`;
  return `In ${minutes}m`;
};

const generateIcs = (schedule: RecitalScheduleType): void => {
  const start = new Date(schedule.scheduled_for);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Guitar Brain//Recital//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${schedule.title}`,
    schedule.notes ? `DESCRIPTION:${schedule.notes}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([content], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${schedule.title.replace(/\s+/g, '-')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

// Convert an ISO string to the value format expected by <input type="datetime-local">
const toDateTimeLocalValue = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EditScheduleDialog = ({
  schedule,
  onClose,
}: {
  schedule: RecitalScheduleType;
  onClose: () => void;
}) => {
  const { updateSchedule } = useRecital();
  const [title, setTitle] = useState(schedule.title);
  const [dateTime, setDateTime] = useState(toDateTimeLocalValue(schedule.scheduled_for));
  const [notes, setNotes] = useState(schedule.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !dateTime) return;
    setSaving(true);
    try {
      await updateSchedule(schedule.id, title.trim(), new Date(dateTime), notes.trim() || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Recital</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-datetime">Date & Time</Label>
            <Input
              id="edit-datetime"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !dateTime || saving}
            className="w-full"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const RecitalSchedule = () => {
  const { upcomingSchedule, isAdmin, deleteSchedule } = useRecital();
  const [, setTick] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Refresh countdowns every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (upcomingSchedule.length === 0) return null;

  const editingSchedule = editingId ? upcomingSchedule.find(s => s.id === editingId) : null;

  return (
    <>
      {editingSchedule && (
        <EditScheduleDialog
          schedule={editingSchedule}
          onClose={() => setEditingId(null)}
        />
      )}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Upcoming Recitals
        </h3>
        <div className="space-y-2">
          {upcomingSchedule.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{schedule.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(schedule.scheduled_for).toLocaleString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {schedule.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{schedule.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium text-primary">
                    {formatCountdown(schedule.scheduled_for)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generateIcs(schedule)}
                    className="text-xs"
                  >
                    + Calendar
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingId(schedule.id)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteSchedule(schedule.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
};
