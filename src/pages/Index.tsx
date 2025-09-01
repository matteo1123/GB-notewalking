import { useState } from "react";
import { MetronomeMode } from "@/components/MetronomeControls";
import { MetronomeScreen } from "@/components/MetronomeScreen";

const Index = () => {
  const [mode] = useState<MetronomeMode>("regular");

  return (
    <div className="max-w-4xl mx-auto space-y-8 bpm-control-area">
      {/* Main Content */}
      <MetronomeScreen initialMode={mode} />

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
            Gradually increases tempo from start to end BPM over specified
            measures
          </p>
        </div>
        <div className="text-center p-4 rounded-lg bg-card/50 border border-border/50">
          <div className="font-semibold text-primary mb-2">Progressive</div>
          <p className="text-muted-foreground">
            Like speed trainer, but restarts 5 BPM higher each cycle for
            continuous improvement
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
