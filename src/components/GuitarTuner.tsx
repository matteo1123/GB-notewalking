import { useState, useCallback, useEffect } from "react";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { Mic, MicOff, Settings2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuitarTunerProps {
    isActive: boolean;
    className?: string;
}

export function GuitarTuner({ isActive, className }: GuitarTunerProps) {
    const [pitchData, setPitchData] = useState<{ note: string; cents: number; freq: number } | null>(null);

    const handlePitchUpdate = useCallback((centsOffset: number, note: string, frequency: number) => {
        setPitchData({ note, cents: centsOffset, freq: frequency });
    }, []);

    const { isListening } = usePitchDetection({
        isEnabled: isActive,
        onPitchUpdate: handlePitchUpdate,
        sensitivity: 0.5, // Tuners usually want continuous updates even if signal isn't a hard pluck
    });

    // Decay the reading if no sound for a while (optional, but good for UX)
    useEffect(() => {
        if (!pitchData) return;
        const timer = setTimeout(() => {
            setPitchData(null);
        }, 2000);
        return () => clearTimeout(timer);
    }, [pitchData]);

    if (!isActive) return null;

    const cents = pitchData?.cents || 0;
    // Clamp cents between -50 and +50 for visual display
    const clampedCents = Math.max(-50, Math.min(50, cents));
    const pointerPosition = 50 + clampedCents; // 0 to 100%

    // Determine color based on how in-tune it is (+/- 5 cents is generally considered green/in-tune)
    let tunerColor = "bg-yellow-500 shadow-yellow-500/50";
    let textColor = "text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]";

    if (pitchData) {
        if (Math.abs(cents) <= 5) {
            tunerColor = "bg-green-500 shadow-green-500/50";
            textColor = "text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]";
        } else if (cents < -5) {
            tunerColor = "bg-orange-500 shadow-orange-500/50";
            textColor = "text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]";
        } else if (cents > 5) {
            tunerColor = "bg-red-500 shadow-red-500/50";
            textColor = "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]";
        }
    } else {
        tunerColor = "bg-gray-600 shadow-none";
        textColor = "text-gray-500";
    }

    return (
        <div className={cn("flex flex-col items-center justify-center p-3 bg-black border border-gray-800 rounded-lg shadow-inner w-full overflow-hidden relative", className)}>

            {/* Background glow when active */}
            {pitchData && Math.abs(cents) <= 5 && (
                <div className="absolute inset-0 bg-green-500/10 animate-pulse pointer-events-none" />
            )}

            {/* Header Info */}
            <div className="flex justify-between items-center w-full px-2 mb-2">
                <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                    {isListening ? (
                        <><Activity className="w-3 h-3 text-red-500 animate-pulse" /> LISTENING</>
                    ) : (
                        <><MicOff className="w-3 h-3 text-gray-500" /> STANDBY</>
                    )}
                </div>
                <div className="text-[10px] font-mono text-gray-500">
                    {pitchData ? `${pitchData.freq.toFixed(1)} Hz` : "--- Hz"}
                </div>
            </div>

            {/* Main Note Display */}
            <div className={cn("text-4xl md:text-5xl font-black mb-3 transition-colors duration-200", textColor)}>
                {pitchData ? pitchData.note.replace(/\d/, "") : "-"}
                <span className="text-xl md:text-2xl ml-1 text-gray-500">
                    {pitchData ? pitchData.note.match(/\d/)?.[0] || "" : ""}
                </span>
            </div>

            {/* Tuning Bar UI */}
            <div className="w-full max-w-[300px] px-4">
                {/* Indicator labels */}
                <div className="flex justify-between w-full text-[10px] text-gray-500 font-bold mb-1 px-1">
                    <span>b (FLAT)</span>
                    <span className={pitchData && Math.abs(cents) <= 5 ? "text-green-500" : ""}>IN TUNE</span>
                    <span># (SHARP)</span>
                </div>

                {/* The sliding bar */}
                <div className="w-full h-3 bg-gray-900 rounded-full relative overflow-hidden border border-gray-800">
                    {/* Center target line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gray-500 -translate-x-1/2 z-10" />

                    {/* Target zone +/- 5 cents */}
                    <div className="absolute left-[45%] right-[45%] top-0 bottom-0 bg-green-500/20 z-0" />

                    {/* The Needle/Dot */}
                    <div
                        className={cn(
                            "absolute top-0 bottom-0 w-3 rounded-full shadow-lg transition-all duration-75 ease-out z-20",
                            tunerColor
                        )}
                        style={{
                            left: `calc(${pointerPosition}% - 6px)`,
                            opacity: pitchData ? 1 : 0.3
                        }}
                    />
                </div>

                <div className="text-center text-[10px] text-gray-500 font-mono mt-1 h-3">
                    {pitchData && (
                        cents > 0 ? `+${cents.toFixed(1)} ct` : `${cents.toFixed(1)} ct`
                    )}
                </div>
            </div>
        </div>
    );
}
