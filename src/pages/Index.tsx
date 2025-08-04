import { useState, useEffect } from 'react';
import { BeatVisualizer } from '@/components/BeatVisualizer';
import { MetronomeControls, MetronomeMode } from '@/components/MetronomeControls';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { useMetronome } from '@/hooks/useMetronome';
import { Music } from 'lucide-react';

const Index = () => {
  const [mode, setMode] = useState<MetronomeMode>('regular');
  const [startBpm, setStartBpm] = useState(80);
  const [endBpm, setEndBpm] = useState(120);
  const [measures, setMeasures] = useState(8);
  const [currentBpm, setCurrentBpm] = useState(80);

  const metronome = useMetronome({
    mode,
    startBpm: mode === 'regular' ? currentBpm : startBpm,
    endBpm,
    measures,
  });

  const handleModeChange = (newMode: MetronomeMode) => {
    metronome.stop();
    setMode(newMode);
  };

  const handleCurrentBpmChange = (bpm: number) => {
    setCurrentBpm(bpm);
    // Don't stop the metronome when BPM changes
  };

  const changeBpm = (delta: number) => {
    if (mode !== 'regular') return;
    const newBpm = Math.max(40, Math.min(300, Math.round(currentBpm + delta)));
    handleCurrentBpmChange(newBpm);
  };

  // Global BPM adjustment controls
  useEffect(() => {
    if (mode !== 'regular') return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      changeBpm(delta);
    };

    let isDragging = false;
    let lastMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastMouseY = e.clientY;
      document.body.style.cursor = 'ns-resize';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = lastMouseY - e.clientY;
      lastMouseY = e.clientY;
      
      if (Math.abs(deltaY) > 2) { // Only update if movement is significant enough
        const direction = deltaY > 0 ? 1 : -1;
        changeBpm(direction);
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
    };
  }, [mode, currentBpm]);

  return (
    <div className="min-h-screen bg-background p-4 bpm-control-area">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Music className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Guitar Speed Trainer
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Professional metronome with speed training modes for guitar practice. 
            Build your speed progressively with precision timing.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Beat Visualizer - Takes up more space */}
          <div className="lg:col-span-2">
            <div className="h-full flex items-center justify-center p-8">
            <BeatVisualizer
              currentBeat={metronome.state.currentBeat}
              isPlaying={metronome.state.isPlaying}
              currentBpm={mode === 'regular' ? currentBpm : metronome.state.currentBpm}
              onBpmChange={mode === 'regular' ? handleCurrentBpmChange : undefined}
              canEdit={mode === 'regular'}
            />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <MetronomeControls
              mode={mode}
              isPlaying={metronome.state.isPlaying}
              currentBpm={mode === 'regular' ? currentBpm : metronome.state.currentBpm}
              startBpm={startBpm}
              endBpm={endBpm}
              measures={measures}
              onModeChange={handleModeChange}
              onPlayPause={metronome.togglePlayPause}
              onStop={metronome.stop}
              onStartBpmChange={setStartBpm}
              onEndBpmChange={setEndBpm}
              onMeasuresChange={setMeasures}
              onCurrentBpmChange={handleCurrentBpmChange}
            />

            {/* Progress Indicator */}
            <ProgressIndicator
              mode={mode}
              currentMeasure={metronome.state.currentMeasure}
              totalMeasures={measures}
              progressiveRound={metronome.state.progressiveRound}
              currentBpm={metronome.state.currentBpm}
              targetBpm={mode === 'progressive' 
                ? endBpm + (metronome.state.progressiveRound - 1) * 5 
                : endBpm}
              isPlaying={metronome.state.isPlaying}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
            <div className="font-semibold text-primary mb-2">Regular Mode</div>
            <p className="text-muted-foreground">
              Constant tempo metronome for practicing at a steady BPM
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
            <div className="font-semibold text-primary mb-2">Speed Trainer</div>
            <p className="text-muted-foreground">
              Gradually increases tempo from start to end BPM over specified measures
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
            <div className="font-semibold text-primary mb-2">Progressive</div>
            <p className="text-muted-foreground">
              Like speed trainer, but restarts 5 BPM higher each cycle for continuous improvement
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
