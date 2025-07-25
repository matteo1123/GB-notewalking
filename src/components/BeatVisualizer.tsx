import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface BeatVisualizerProps {
  currentBeat: number;
  isPlaying: boolean;
  currentBpm: number;
  onBpmChange?: (bpm: number) => void;
  canEdit?: boolean;
}

export function BeatVisualizer({ currentBeat, isPlaying, currentBpm, onBpmChange, canEdit = false }: BeatVisualizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartBpm, setDragStartBpm] = useState(0);
  const bpmRef = useRef<HTMLDivElement>(null);

  const changeBpm = (delta: number) => {
    if (!onBpmChange || !canEdit) return;
    const newBpm = Math.max(40, Math.min(300, Math.round(currentBpm + delta)));
    onBpmChange(newBpm);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canEdit || !onBpmChange) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartBpm(currentBpm);
    document.body.style.cursor = 'ns-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onBpmChange || !canEdit) return;
    const deltaY = dragStartY - e.clientY; // Invert so up increases BPM
    const deltaBpm = Math.round(deltaY / 2); // 2 pixels per BPM
    const newBpm = Math.max(40, Math.min(300, dragStartBpm + deltaBpm));
    onBpmChange(newBpm);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = '';
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!canEdit || !onBpmChange) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1; // Invert scroll direction
    changeBpm(delta);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStartY, dragStartBpm, onBpmChange, canEdit]);

  // Keyboard controls
  useEffect(() => {
    if (!canEdit || !onBpmChange) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body) return; // Only when no input is focused
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          changeBpm(1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeBpm(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentBpm, onBpmChange, canEdit]);
  return (
    <div className="flex flex-col items-center space-y-6">
      {/* BPM Display */}
      <div className="text-center">
        <div 
          ref={bpmRef}
          className={cn(
            "text-6xl md:text-8xl font-bold transition-all duration-200 select-none",
            isPlaying && "animate-tempo-glow",
            canEdit && "cursor-ns-resize hover:scale-105",
            isDragging && "scale-105"
          )}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
        >
          {Math.round(currentBpm)}
        </div>
        <div className="text-lg text-muted-foreground mt-2">
          BPM {canEdit && "(↑↓ arrows, click & drag, or scroll)"}
        </div>
      </div>

      {/* Beat Indicators */}
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((beat) => (
          <div
            key={beat}
            className={cn(
              "w-12 h-12 rounded-full border-2 transition-all duration-150",
              "flex items-center justify-center font-bold",
              currentBeat === beat && isPlaying
                ? "bg-beat-active border-beat-active text-background animate-beat-pulse"
                : "bg-beat-inactive/20 border-beat-inactive text-muted-foreground"
            )}
          >
            {beat}
          </div>
        ))}
      </div>

      {/* Pulse Indicator */}
      <div className={cn(
        "w-20 h-20 rounded-full border-4 transition-all duration-100",
        "flex items-center justify-center",
        isPlaying
          ? "border-tempo-glow bg-tempo-glow/10"
          : "border-muted bg-muted/10"
      )}>
        <div className={cn(
          "w-8 h-8 rounded-full transition-all duration-100",
          currentBeat === 1 && isPlaying
            ? "bg-tempo-glow scale-125"
            : isPlaying
            ? "bg-tempo-glow/70 scale-110"
            : "bg-muted scale-100"
        )} />
      </div>
    </div>
  );
}