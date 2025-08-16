import { useEffect } from 'react';

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
  maxBpm = 300
}: UseBpmControlsProps) {
  const changeBpm = (delta: number) => {
    const newBpm = Math.max(minBpm, Math.min(maxBpm, Math.round(currentBpm + delta)));
    onBpmChange(newBpm);
  };

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond if focused on body or elements with bpm-control class
      if (e.target !== document.body && !(e.target as HTMLElement).classList.contains('bpm-control-area')) return;
      
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

    const handleWheel = (e: WheelEvent) => {
      // Only respond on elements with bpm-control class or body
      const target = e.target as HTMLElement;
      if (!target.classList.contains('bpm-control-area') && e.target !== document.body) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      changeBpm(delta);
    };

    let isDragging = false;
    let lastMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      // Only respond on elements with bpm-control class
      const target = e.target as HTMLElement;
      if (!target.classList.contains('bpm-control-area')) return;
      
      isDragging = true;
      lastMouseY = e.clientY;
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const deltaY = lastMouseY - e.clientY;
      lastMouseY = e.clientY;
      
      // Smooth continuous adjustment: 3 pixels = 1 BPM change
      if (Math.abs(deltaY) >= 1) {
        const bpmChange = deltaY * 0.33;
        changeBpm(bpmChange);
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      document.body.style.cursor = '';
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [currentBpm, isEnabled, minBpm, maxBpm]);

  return { changeBpm };
}