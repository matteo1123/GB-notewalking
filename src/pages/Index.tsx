import { MetronomeScreen } from "@/components/MetronomeScreen";
import Header from "@/components/Header";
import { RecitalSchedule } from "@/components/RecitalSchedule";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center bpm-control-area relative">
        <MetronomeScreen initialMode="regular" />


      </main>
      <footer className="flex-shrink-0 p-4 bg-card/50 border-t border-border/50 text-center">
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
        <div className="mt-8 text-xs text-muted-foreground max-w-2xl mx-auto opacity-70">
          <p>
            Guitar Brain: The ultimate free online metronome and guitar practice platform.
          </p>
        </div>
        <div className="mt-6 max-w-2xl mx-auto w-full pb-16">
          <RecitalSchedule />
        </div>
      </footer>
    </div>
  );
};

export default Index;
