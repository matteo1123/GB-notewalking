import { Button } from "@/components/ui/button";
import { useRecorder } from "@/hooks/useRecorder";
import { Circle, Mic, Play, Save, Square } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState } from "react";

interface RecordingControlsProps {
  onSave: (audioBlob: Blob, duration: number, maxBpm: number, perfectBpm: number) => void;
}

export function RecordingControls({ onSave }: RecordingControlsProps) {
  const { recorderState, startRecording, stopRecording, playRecording, resetRecording } = useRecorder();
  const [maxBpm, setMaxBpm] = useState(120);
  const [perfectBpm, setPerfectBpm] = useState(100);

  const handleSave = () => {
    if (recorderState.audioBlob) {
      onSave(recorderState.audioBlob, recorderState.duration, maxBpm, perfectBpm);
      resetRecording();
    }
  };

  return (
    <div className="flex items-center gap-4">
      {recorderState.status === 'idle' && (
        <Button onClick={startRecording} variant="outline" size="icon">
          <Mic className="h-4 w-4" />
        </Button>
      )}
      {recorderState.status === 'recording' && (
        <Button onClick={stopRecording} variant="destructive" size="icon">
          <Square className="h-4 w-4" />
        </Button>
      )}
      {recorderState.status === 'stopped' && (
        <>
          <Button onClick={playRecording} variant="outline" size="icon">
            <Play className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Save className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Recording</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="max-bpm">Max BPM</Label>
                  <Input id="max-bpm" type="number" value={maxBpm} onChange={(e) => setMaxBpm(parseInt(e.target.value, 10))} />
                </div>
                <div>
                  <Label htmlFor="perfect-bpm">Perfect BPM</Label>
                  <Input id="perfect-bpm" type="number" value={perfectBpm} onChange={(e) => setPerfectBpm(parseInt(e.target.value, 10))} />
                </div>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      {recorderState.status === 'playing' && (
        <Button variant="outline" size="icon" disabled>
          <Play className="h-4 w-4 animate-pulse" />
        </Button>
      )}
    </div>
  );
}