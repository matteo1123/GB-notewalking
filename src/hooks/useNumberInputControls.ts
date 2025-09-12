import { useEffect, RefObject } from "react";

interface UseNumberInputControlsProps {
  inputRef: RefObject<HTMLInputElement>;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  pageStep?: number;
}

export function useNumberInputControls({
  inputRef,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  pageStep = 10,
}: UseNumberInputControlsProps) {
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const changeValue = (delta: number) => {
      const newValue = Math.max(min, Math.min(max, value + delta));
      onChange(newValue);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -step : step;
      changeValue(delta);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          changeValue(step);
          break;
        case "ArrowDown":
          e.preventDefault();
          changeValue(-step);
          break;
        case "PageUp":
          e.preventDefault();
          changeValue(pageStep);
          break;
        case "PageDown":
          e.preventDefault();
          changeValue(-pageStep);
          break;
      }
    };

    input.addEventListener("wheel", handleWheel, { passive: false });
    input.addEventListener("keydown", handleKeyDown);

    return () => {
      input.removeEventListener("wheel", handleWheel);
      input.removeEventListener("keydown", handleKeyDown);
    };
  }, [inputRef, value, onChange, min, max, step, pageStep]);
}