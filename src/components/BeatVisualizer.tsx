import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
interface BeatVisualizerProps {
  currentBeat: number;
  isPlaying: boolean;
  currentBpm: number;
  onBpmChange?: (bpm: number) => void;
  canEdit?: boolean;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}
export function BeatVisualizer({
  currentBeat,
  isPlaying,
  currentBpm,
  onBpmChange,
  canEdit = false,
  size = "lg",
  children,
}: BeatVisualizerProps) {
  const sizeClasses = {
    sm: {
      bpm: "text-3xl md:text-4xl",
      container: "space-y-3",
      beat: "w-8 h-8",
      pulse: "w-12 h-12",
      pulseInner: "w-4 h-4",
    },
    md: {
      bpm: "text-4xl md:text-6xl",
      container: "space-y-4",
      beat: "w-10 h-10",
      pulse: "w-16 h-16",
      pulseInner: "w-6 h-6",
    },
    lg: {
      bpm: "text-6xl md:text-8xl",
      container: "space-y-6",
      beat: "w-12 h-12",
      pulse: "w-20 h-20",
      pulseInner: "w-8 h-8",
    },
  };
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(
    String(Math.round(currentBpm))
  );

  useEffect(() => {
    setEditValue(String(Math.round(currentBpm)));
  }, [currentBpm]);

  const commitEdit = () => {
    if (!onBpmChange) {
      setIsEditing(false);
      return;
    }
    const num = Number(editValue);
    if (isFinite(num)) {
      const clamped = Math.max(40, Math.min(300, Math.round(num)));
      onBpmChange(clamped);
    }
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full">
      {/* Top Section: BPM Display and Beat Indicators */}
      <div className="w-full">
        <div className="text-center">
          {canEdit && isEditing ? (
            <input
              className={cn(
                `${sizeClasses[size].bpm} font-bold bg-transparent text-center outline-none border-b border-border w-[6ch]`
              )}
              value={editValue}
              onChange={(e) =>
                setEditValue(e.target.value.replace(/[^0-9]/g, ""))
              }
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setIsEditing(false);
              }}
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
            />
          ) : (
            <div
              className={cn(
                `${sizeClasses[size].bpm} font-bold transition-all duration-200 select-none`,
                isPlaying && "animate-tempo-glow",
                canEdit && "cursor-text"
              )}
              onClick={() => canEdit && setIsEditing(true)}
            >
              {Math.round(currentBpm)}
            </div>
          )}
          <div className="text-muted-foreground -mt-2">BPM</div>
        </div>

        <div className="flex justify-center gap-2 mt-2">
          {[1, 2, 3, 4].map((beat) => (
            <div
              key={beat}
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all duration-150",
                currentBeat === beat && isPlaying
                  ? "bg-beat-active border-beat-active"
                  : "bg-beat-inactive/20 border-beat-inactive"
              )}
            />
          ))}
        </div>
      </div>

      {/* Middle Section: Controls */}
      <div className="w-full my-4">{children}</div>

      {/* Bottom Section: Instructions */}
      {canEdit && size === "lg" && (
        <div className="text-xs text-muted-foreground/70 text-center">
          <div>Click & drag anywhere • Swipe • Mouse wheel</div>
          <div>Click anywhere on screen to adjust tempo smoothly</div>
        </div>
      )}
    </div>
  );
}
