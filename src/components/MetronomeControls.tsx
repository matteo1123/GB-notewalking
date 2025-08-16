import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Play, Pause, Square } from "lucide-react";
export type MetronomeMode = 'regular' | 'speed-trainer' | 'progressive';
interface MetronomeControlsProps {
  compact?: boolean;
  mode: MetronomeMode;
  isPlaying: boolean;
  currentBpm: number;
  endBpm: number;
  measures: number;
  measuresPerBpmChange: number;
  onModeChange: (mode: MetronomeMode) => void;
  onPlayPause: () => void;
  onStop: () => void;
  onEndBpmChange: (bpm: number) => void;
  onMeasuresChange: (measures: number) => void;
  onMeasuresPerBpmChangeChange: (measures: number) => void;
  onCurrentBpmChange: (bpm: number) => void;
}
export function MetronomeControls({
  compact = false,
  mode,
  isPlaying,
  currentBpm,
  endBpm,
  measures,
  measuresPerBpmChange,
  onModeChange,
  onPlayPause,
  onStop,
  onEndBpmChange,
  onMeasuresChange,
  onMeasuresPerBpmChangeChange,
  onCurrentBpmChange
}: MetronomeControlsProps) {
  return <Card className={`${compact ? 'p-3' : 'p-6'} bg-gradient-to-br from-card to-card/50 border-border/50`}>
      <div className={compact ? 'space-y-3' : 'space-y-6'}>
        {/* Mode Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Mode</Label>
          <Select value={mode} onValueChange={onModeChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="speed-trainer">Speed Trainer</SelectItem>
              <SelectItem value="progressive">Progressive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* BPM Controls */}
        {mode !== 'regular' && <div className="space-y-2">
            <Label className="text-sm font-medium">End BPM</Label>
            <Input type="number" value={endBpm} onChange={e => onEndBpmChange(Number(e.target.value))} min={40} max={300} className="text-center" />
          </div>}

        {/* Measures Control (for speed trainer and progressive modes) */}
        {mode !== 'regular' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 mx-0 my-0 py-[18px]">
              <Label className="text-sm font-medium"># of increments
          </Label>
              <Input type="number" value={measures} onChange={e => onMeasuresChange(Number(e.target.value))} min={1} max={100} className="text-center" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Measures per BPM Change</Label>
              <Input type="number" value={measuresPerBpmChange} onChange={e => onMeasuresPerBpmChangeChange(Number(e.target.value))} min={1} max={20} className="text-center" />
            </div>
          </div>}

        {/* Control Buttons */}
        <div className="flex gap-3 justify-center">
          <Button variant={isPlaying ? "secondary" : "default"} onClick={onPlayPause} className="flex items-center gap-2">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button variant="outline" onClick={onStop} className="flex items-center gap-2">
            <Square className="h-3 w-3" />
            Stop
          </Button>
        </div>

        {/* Mode Description */}
        <div className="text-xs text-muted-foreground text-center">
          {mode === 'regular' && "Constant tempo metronome"}
          {mode === 'speed-trainer' && "Gradually increases from start to end BPM over the specified measures"}
          {mode === 'progressive' && "Like speed trainer, but restarts 5 BPM higher each cycle"}
        </div>
      </div>
    </Card>;
}