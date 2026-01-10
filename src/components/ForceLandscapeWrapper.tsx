import { ReactNode } from 'react';

interface ForceLandscapeWrapperProps {
    children: ReactNode;
    className?: string;
}

/**
 * ForceLandscapeWrapper - CSS-based forced landscape display
 * 
 * When the viewport is in portrait mode (height > width), this component
 * rotates its children 90 degrees and swaps dimensions so the content
 * always displays in landscape orientation, regardless of how the device is held.
 * 
 * This is a CSS-only solution that works on all devices without requiring
 * the Screen Orientation API or user interaction.
 */
export function ForceLandscapeWrapper({ children, className = '' }: ForceLandscapeWrapperProps) {
    return (
        <>
            {/* 
                CSS handles the rotation:
                - In landscape (width >= height): display normally
                - In portrait (width < height): rotate 90deg and swap dimensions
            */}
            <div className={`force-landscape-container ${className}`}>
                {children}
            </div>

            <style>{`
                .force-landscape-container {
                    width: 100%;
                    height: 100%;
                }
                
                /* Portrait mode on mobile: force landscape via CSS transform */
                @media screen and (max-width: 900px) and (orientation: portrait) {
                    .force-landscape-container {
                        /* Rotate 90 degrees */
                        transform: rotate(90deg);
                        transform-origin: center center;
                        
                        /* Swap width and height */
                        width: 100vh;
                        height: 100vw;
                        
                        /* Center the rotated container */
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        margin-left: -50vh;
                        margin-top: -50vw;
                        
                        /* Ensure it's above everything */
                        z-index: 9999;
                        
                        /* Background to cover any gaps */
                        background: hsl(var(--background));
                        overflow: hidden;
                    }
                    
                    /* Ultra-compact header in rotated mode */
                    .force-landscape-container .bpm-control-area > .flex-shrink-0 {
                        padding: 2px 4px !important;
                    }
                    
                    /* Hide secondary controls in rotated mode */
                    .force-landscape-container .bpm-control-area .hidden,
                    .force-landscape-container [class*="Tonal Context"],
                    .force-landscape-container [aria-label*="context"] {
                        display: none !important;
                    }
                    
                    /* Compact the fretboard area header */
                    .force-landscape-container .mb-4,
                    .force-landscape-container .mb-1 {
                        margin-bottom: 2px !important;
                    }
                    
                    .force-landscape-container .space-y-4,
                    .force-landscape-container .space-y-1 {
                        gap: 2px !important;
                    }
                    
                    /* Maximize fretboard - remove extra padding */
                    .force-landscape-container .p-4,
                    .force-landscape-container .p-2 {
                        padding: 2px !important;
                    }
                    
                    /* Fretboard takes priority */
                    .force-landscape-container .fretboard-area {
                        margin: 0 !important;
                        flex: 1;
                    }
                    
                    /* Smaller fretboard dots for compact display */
                    .force-landscape-container .fretboard .dot {
                        width: 16px !important;
                        height: 16px !important;
                    }
                    
                    /* Hide ear training toggle and controls in rotated mode */
                    .force-landscape-container button:has(.w-4.h-4) {
                        padding: 4px !important;
                    }
                    
                    /* Compact metronome display */
                    .force-landscape-container .text-6xl,
                    .force-landscape-container .text-5xl {
                        font-size: 2rem !important;
                        line-height: 1 !important;
                    }
                    
                    /* Hide non-essential text */
                    .force-landscape-container .text-muted-foreground {
                        font-size: 10px !important;
                    }
                }
            `}</style>
        </>
    );
}
