import { useState } from "react";
import { MetronomeMode } from "@/components/MetronomeControls";
import { MetronomeScreen } from "@/components/MetronomeScreen";

const Index = () => {
  const [mode] = useState<MetronomeMode>("regular");

  return (
    <div className="h-screen w-screen flex flex-col bpm-control-area overflow-hidden">
      <main className="flex-grow p-4">
        <MetronomeScreen initialMode={mode} />
      </main>
      <footer className="flex-shrink-0 p-4 bg-card/50 border-t border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-primary mb-1">Regular Mode</div>
            <p className="text-muted-foreground text-xs">
              Constant tempo metronome for practicing at a steady BPM
            </p>
          </div>
          <div className="text-center">
            <div className="font-semibold text-primary mb-1">Speed Trainer</div>
            <p className="text-muted-foreground text-xs">
              Gradually increases tempo from start to end BPM over specified
              measures
            </p>
          </div>
          <div className="text-center">
            <div className="font-semibold text-primary mb-1">Progressive</div>
            <p className="text-muted-foreground text-xs">
              Like speed trainer, but restarts 5 BPM higher each cycle for
              continuous improvement
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
