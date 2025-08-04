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
  return (
    <div className="flex flex-col items-center space-y-6">
      {/* BPM Display */}
      <div className="text-center">
        <div 
          className={cn(
            "text-6xl md:text-8xl font-bold transition-all duration-200 select-none",
            isPlaying && "animate-tempo-glow"
          )}
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