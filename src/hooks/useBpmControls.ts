import { useEffect } from "react";

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
  const changeBpm = (delta: number) => {
    const newBpm = Math.max(
      minBpm,
      Math.min(maxBpm, Math.round(currentBpm + delta))
    );
    onBpmChange(newBpm);
  };

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond if no input elements are focused
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
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
      // Check if we're in a bpm-control-area or if it's a general page area
      const target = e.target as HTMLElement;
      const isInControlArea = target.closest(".bpm-control-area");
      if (!isInControlArea) return;

      e.preventDefault();
      // Make wheel more sensitive
      const delta = e.deltaY > 0 ? -2 : 2;
      changeBpm(delta);
    };

    // Mouse/Desktop controls
    let isDragging = false;
    let lastMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      // Check if we're in a bpm-control-area and not clicking on interactive elements
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
      lastMouseY = e.clientY;
      document.body.style.cursor = "ns-resize";
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const deltaY = lastMouseY - e.clientY;
      lastMouseY = e.clientY;

      // Increase sensitivity and keep continuous while dragging
      if (Math.abs(deltaY) >= 1) {
        const bpmChange = deltaY * 0.75; // ~1.33 px per BPM
        changeBpm(bpmChange);
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      document.body.style.cursor = "";
    };

    // Touch/Mobile controls
    let isTouching = false;
    let lastTouchY = 0;

    const handleTouchStart = (e: TouchEvent) => {
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

      isTouching = true;
      lastTouchY = e.touches[0].clientY;
      e.preventDefault();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouching) return;
      e.preventDefault();
      const currentTouchY = e.touches[0].clientY;
      const deltaY = lastTouchY - currentTouchY;
      lastTouchY = currentTouchY;

      // Make swipe much more sensitive: ~0.1 px per BPM -> full-height swipe ~10+ BPM
      if (Math.abs(deltaY) >= 1) {
        const bpmChange = deltaY * 2.0;
        changeBpm(bpmChange);
      }
    };

    const handleTouchEnd = () => {
      isTouching = false;
    };

    // Add all event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("wheel", handleWheel);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.body.style.cursor = "";
    };
  }, [currentBpm, isEnabled, minBpm, maxBpm]);

  return { changeBpm };
}
