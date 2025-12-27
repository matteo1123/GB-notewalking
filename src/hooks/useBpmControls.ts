import { useEffect, useRef } from "react";

interface UseBpmControlsProps {
  currentBpm: number;
  onBpmChange: (bpm: number) => void;
  isEnabled?: boolean;
  minBpm?: number;
  maxBpm?: number;
}

export function useBpmControls({
  currentBpm,
  onBpmChange,
  isEnabled = true,
  minBpm = 40,
  maxBpm = 300,
}: UseBpmControlsProps) {
  // Use refs to avoid effect re-runs when BPM changes
  const currentBpmRef = useRef(currentBpm);
  const onBpmChangeRef = useRef(onBpmChange);
  const minBpmRef = useRef(minBpm);
  const maxBpmRef = useRef(maxBpm);

  // Keep refs in sync
  useEffect(() => {
    currentBpmRef.current = currentBpm;
    onBpmChangeRef.current = onBpmChange;
    minBpmRef.current = minBpm;
    maxBpmRef.current = maxBpm;
  }, [currentBpm, onBpmChange, minBpm, maxBpm]);

  useEffect(() => {
    if (!isEnabled) return;

    const changeBpm = (delta: number) => {
      const newBpm = Math.max(
        minBpmRef.current,
        Math.min(maxBpmRef.current, Math.round(currentBpmRef.current + delta))
      );
      onBpmChangeRef.current(newBpm);
    };

    const setBpmAbsolute = (bpm: number) => {
      const newBpm = Math.max(minBpmRef.current, Math.min(maxBpmRef.current, Math.round(bpm)));
      onBpmChangeRef.current(newBpm);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond if no input elements are focused
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).isContentEditable)
      )
        return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          changeBpm(1);
          break;
        case "ArrowDown":
          e.preventDefault();
          changeBpm(-1);
          break;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Check if we're in a bpm-control-area
      const target = e.target as HTMLElement;
      const isInControlArea = target.closest(".bpm-control-area");
      if (!isInControlArea) return;

      // Don't handle wheel if an input is focused
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).isContentEditable)
      ) return;

      e.preventDefault();
      // Make wheel more sensitive
      const delta = e.deltaY > 0 ? -2 : 2;
      changeBpm(delta);
    };

    // Mouse/Desktop and Touch/Mobile controls
    // Use relative positioning: track start Y and start BPM
    let isDragging = false;
    let startY = 0;
    let startBpm = 0;

    const handleDragStart = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      const isInControlArea = target.closest(".bpm-control-area");
      const isInteractive =
        target.tagName === "BUTTON" ||
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea");

      if (!isInControlArea || isInteractive) return;

      isDragging = true;

      // Get Y position from either mouse or touch event
      if (e instanceof MouseEvent) {
        startY = e.clientY;
      } else {
        startY = e.touches[0].clientY;
      }

      startBpm = currentBpmRef.current;
      document.body.style.cursor = "ns-resize";
      e.preventDefault();
    };

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      // Get current Y position from either mouse or touch event
      let currentY: number;
      if (e instanceof MouseEvent) {
        currentY = e.clientY;
      } else {
        currentY = e.touches[0].clientY;
      }

      // Calculate delta from START position (not last position)
      const deltaY = startY - currentY;

      // Scale: ~1/4 screen height (~200-250px on most devices) = 5 BPM
      // So full screen (~800-1000px) would be ~20 BPM
      // This gives us: deltaY * (5 / 250) = deltaY * 0.02
      const pixelsPerBpm = 50; // 50 pixels = 1 BPM, so 250px = 5 BPM
      const bpmChange = deltaY / pixelsPerBpm;

      // Set BPM relative to starting BPM
      setBpmAbsolute(startBpm + bpmChange);
    };

    const handleDragEnd = () => {
      isDragging = false;
      document.body.style.cursor = "";
    };

    // Add all event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("mousedown", handleDragStart);
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchstart", handleDragStart as EventListener, {
      passive: false,
    });
    document.addEventListener("touchmove", handleDragMove as EventListener, {
      passive: false
    });
    document.addEventListener("touchend", handleDragEnd);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("wheel", handleWheel);
      document.removeEventListener("mousedown", handleDragStart);
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("touchstart", handleDragStart as EventListener);
      document.removeEventListener("touchmove", handleDragMove as EventListener);
      document.removeEventListener("touchend", handleDragEnd);
      document.body.style.cursor = "";
    };
  }, [isEnabled]); // Only re-run when isEnabled changes

  return {
    changeBpm: (delta: number) => {
      const newBpm = Math.max(
        minBpm,
        Math.min(maxBpm, Math.round(currentBpm + delta))
      );
      onBpmChange(newBpm);
    }
  };
}
