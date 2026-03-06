import React from 'react';
import { Trophy, Zap, Star } from 'lucide-react';
import { Button } from './ui/button';
import { useGamification } from '@/hooks/useGamification';

export const LevelUpCelebration = () => {
    const { hasLeveledUp, level, acknowledgeLevelUp } = useGamification();

    if (!hasLeveledUp) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative flex flex-col items-center bg-gradient-to-b from-amber-900 to-black border border-amber-500/50 p-8 rounded-2xl shadow-[0_0_100px_rgba(245,158,11,0.5)] animate-in zoom-in-50 duration-500 max-w-sm w-full mx-4 overflow-hidden">

                {/* Decorative sparks/stars */}
                <Star className="absolute top-4 left-4 w-6 h-6 text-amber-300 animate-pulse" />
                <Star className="absolute bottom-12 right-6 w-8 h-8 text-amber-500 animate-pulse delay-100" />
                <Star className="absolute top-10 right-8 w-4 h-4 text-yellow-200 animate-bounce delay-300" />

                <div className="bg-amber-500/20 p-4 rounded-full mb-6">
                    <Trophy className="w-16 h-16 text-amber-400" />
                </div>

                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 mb-2">
                    LEVEL UP!
                </h2>

                <p className="text-amber-100 text-lg mb-8 text-center">
                    You've reached <span className="font-bold text-amber-400 text-2xl mx-1">Level {level}</span>
                </p>

                <div className="flex items-center gap-2 mb-8 bg-amber-950/50 px-4 py-2 rounded-lg border border-amber-500/30">
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span className="text-amber-200 font-medium text-sm">Keep practicing for more XP!</span>
                </div>

                <Button
                    onClick={acknowledgeLevelUp}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-6 text-lg shadow-lg shadow-amber-900/50 transition-all active:scale-95"
                >
                    Awesome
                </Button>
            </div>
        </div>
    );
};
