import { MetronomeScreen } from "@/components/MetronomeScreen";
import Header from "@/components/Header";
import { RecitalSchedule } from "@/components/RecitalSchedule";
import { GraduationCap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center bpm-control-area relative">
        <MetronomeScreen initialMode="regular" />

        {/* Udemy Course Advertisement */}
        <div className="w-full max-w-2xl px-4 pb-8 z-10">
          <Link to="/profile">
            <Card className="bg-gradient-to-r from-indigo-900/40 to-slate-900 border-indigo-500/30 hover:border-indigo-500/60 transition-colors group cursor-pointer overflow-hidden relative">
              <div className="absolute inset-0 bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors" />
              <CardContent className="p-4 sm:p-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30">
                    <GraduationCap className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-200 transition-colors">Master Your Guitar Brain</h3>
                    <p className="text-sm text-muted-foreground">Unlock the official Udemy course and get 90 days of Premium access free.</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>
        </div>
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
