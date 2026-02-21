import { useState, useEffect, useCallback } from 'react';

export default function useTimer(initialSeconds: number = 0, countdown: boolean = false) {
    const [seconds, setSeconds] = useState(initialSeconds);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRunning) {
            interval = setInterval(() => {
                setSeconds((prev) => {
                    if (countdown && prev <= 1) {
                        clearInterval(interval);
                        setIsRunning(false);
                        return 0;
                    }
                    return countdown ? prev - 1 : prev + 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, countdown]);

    const toggleTimer = useCallback(() => setIsRunning((prev) => !prev), []);
    const resetTimer = useCallback(() => {
        setIsRunning(false);
        setSeconds(initialSeconds);
    }, [initialSeconds]);

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} `;

    return {
        seconds,
        isRunning,
        toggleTimer,
        resetTimer,
        formattedTime,
    };
}
