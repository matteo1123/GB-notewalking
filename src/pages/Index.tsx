import { useState } from 'react';
import { BeatVisualizer } from '@/components/BeatVisualizer';
import { MetronomeControls, MetronomeMode } from '@/components/MetronomeControls';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { useMetronome } from '@/hooks/useMetronome';
import { useBpmControls } from '@/hooks/useBpmControls';
import { useAuth } from '@/contexts/AuthContext';
import { Music, Crown, LogIn, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, signOut } = useAuth();
  const [mode, setMode] = useState<MetronomeMode>('regular');
  const [startBpm, setStartBpm] = useState(80);
  const [endBpm, setEndBpm] = useState(120);
  const [measures, setMeasures] = useState(8);
  const [measuresPerBpmChange, setMeasuresPerBpmChange] = useState(4);
  const [currentBpm, setCurrentBpm] = useState(80);

  const metronome = useMetronome({
    mode,
    startBpm: currentBpm,
    endBpm,
    measures,
    measuresPerBpmChange,
  });

  const handleModeChange = (newMode: MetronomeMode) => {
    metronome.stop();
    setMode(newMode);
  };

  const handleCurrentBpmChange = (bpm: number) => {
    if (mode === 'regular') {
      setCurrentBpm(bpm);
    } else {
      // For progressive and speed trainer modes, update the start BPM
      setCurrentBpm(bpm);
      if (metronome.state.isPlaying) {
        metronome.stop();
      }
    }
  };

  // Global BPM adjustment controls - always enabled for all modes
  useBpmControls({
    currentBpm: currentBpm, // Always use the start BPM for controls
    onBpmChange: handleCurrentBpmChange,
    isEnabled: true
  });

  return (
    <div className="min-h-screen bg-background p-4 bpm-control-area">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1"></div>
            <div className="flex items-center gap-3">
              <Music className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Guitar Speed Trainer
              </h1>
            </div>
            <div className="flex-1 flex justify-end gap-2">
              <Link to="/premium">
                <Button variant="outline" className="flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Premium
                </Button>
              </Link>
              {user ? (
                <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              ) : (
                <Link to="/auth">
                  <Button variant="outline" className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Professional metronome with speed training modes for guitar practice. 
            Build your speed progressively with precision timing.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Beat Visualizer - Takes up more space on desktop, full screen on mobile portrait */}
          <div className="lg:col-span-2 portrait:fixed portrait:inset-0 portrait:z-50 portrait:bg-background portrait:flex portrait:items-center portrait:justify-center landscape:relative landscape:z-auto landscape:bg-transparent">
            <div className="h-full flex items-center justify-center p-8 landscape:p-4">
            <BeatVisualizer
              currentBeat={metronome.state.currentBeat}
              isPlaying={metronome.state.isPlaying}
              currentBpm={mode === 'regular' ? currentBpm : metronome.state.currentBpm}
              onBpmChange={handleCurrentBpmChange}
              canEdit={true}
              size="lg"
            />
            </div>
            {/* Mobile portrait instructions */}
            <div className="portrait:absolute portrait:bottom-8 portrait:left-1/2 portrait:transform portrait:-translate-x-1/2 portrait:text-center portrait:text-muted-foreground portrait:text-sm landscape:hidden hidden">
              <p>Swipe up/down to adjust BPM</p>
            </div>
          </div>

          {/* Controls - Hidden on mobile portrait */}
          <div className="space-y-4 portrait:hidden landscape:block">
            <MetronomeControls
              mode={mode}
              isPlaying={metronome.state.isPlaying}
              currentBpm={mode === 'regular' ? currentBpm : metronome.state.currentBpm}
              endBpm={endBpm}
              measures={measures}
              measuresPerBpmChange={measuresPerBpmChange}
              onModeChange={handleModeChange}
              onPlayPause={metronome.togglePlayPause}
              onStop={metronome.stop}
              onEndBpmChange={setEndBpm}
              onMeasuresChange={setMeasures}
              onMeasuresPerBpmChangeChange={setMeasuresPerBpmChange}
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
