import { useEffect, useState } from 'react';

/**
 * Hook to detect and optionally lock screen orientation to landscape
 * for mobile practice modules where the horizontal fretboard display is critical.
 * 
 * Uses the Screen Orientation API where available, with CSS fallback.
 */
export function useLandscapeMode(enforce: boolean = true) {
    const [isPortrait, setIsPortrait] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [orientationSupported, setOrientationSupported] = useState(false);

    useEffect(() => {
        // Detect if this is a mobile device
        const checkMobile = () => {
            const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobile(mobile);
            return mobile;
        };

        // Check current orientation
        const checkOrientation = () => {
            const portrait = window.innerHeight > window.innerWidth;
            setIsPortrait(portrait);
            return portrait;
        };

        // Try to lock orientation to landscape
        const lockLandscape = async () => {
            if (!enforce) return;

            try {
                // Check if Screen Orientation API is available
                // Using type assertion as the lock method is experimental
                const orientation = screen.orientation as ScreenOrientation & {
                    lock?: (orientation: string) => Promise<void>;
                };

                if (orientation && typeof orientation.lock === 'function') {
                    setOrientationSupported(true);
                    await orientation.lock('landscape');
                    console.log('Screen orientation locked to landscape');
                }
            } catch (err) {
                // Orientation lock failed (common on iOS, or when not in fullscreen)
                console.log('Could not lock orientation:', err);
                setOrientationSupported(false);
            }
        };

        checkMobile();
        checkOrientation();

        if (checkMobile() && enforce) {
            lockLandscape();
        }

        // Listen for orientation changes
        const handleResize = () => {
            checkOrientation();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);

            // Unlock orientation on unmount
            if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                try {
                    screen.orientation.unlock();
                } catch (e) {
                    // Ignore unlock errors
                }
            }
        };
    }, [enforce]);

    return {
        isPortrait,
        isMobile,
        orientationSupported,
        // Show rotate prompt when on mobile in portrait and we can't auto-lock
        showRotatePrompt: isMobile && isPortrait && enforce,
    };
}
