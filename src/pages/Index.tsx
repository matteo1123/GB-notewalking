import { MetronomeScreen } from "@/components/MetronomeScreen";
import Header from "@/components/Header";
import { RecitalSchedule } from "@/components/RecitalSchedule";

const Index = () => {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center bpm-control-area relative">
        <h1 className="text-xl sm:text-3xl font-bold text-center px-4 mb-2 text-primary absolute top-4 w-full opacity-90">
          The Latency-Free Online Metronome That Actually Stays on Time
        </h1>
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
        <div className="mt-8 text-xs text-muted-foreground max-w-2xl mx-auto">
          <p>
            Guitar Brain is the ultimate free online metronome and guitar practice platform.
            Whether you want to learn guitar, master scales, or improve your timing,
            our tools are designed to help you become a better musician.
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
