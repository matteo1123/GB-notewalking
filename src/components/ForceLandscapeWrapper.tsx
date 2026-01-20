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
                    
                    /* ===== CRITICAL: Fretboard fills 95% of rotated width (use vh since we're rotated) ===== */
                    .force-landscape-container .fretboard-area {
                        max-width: 95vh !important;
                        width: 95vh !important;
                        margin: 0 auto !important;
                        flex-shrink: 0 !important;
                    }
                    
                    .force-landscape-container .fretboard-container {
                        max-width: 100% !important;
                        min-width: 0 !important;
                        width: 100% !important;
                    }
                    
                    .force-landscape-container .fretboard {
                        min-width: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        height: 140px !important;
                        max-height: 140px !important;
                    }
                    
                    .force-landscape-container .open-notes-container {
                        height: 140px !important;
                        grid-template-columns: 25px !important;
                    }
                    
                    /* Smaller dots for compact fretboard */
                    .force-landscape-container .fretboard .dot {
                        width: 18px !important;
                        height: 18px !important;
                    }
                    
                    .force-landscape-container .marker {
                        width: 10px !important;
                        height: 10px !important;
                    }
                    
                    /* ===== ULTRA-COMPACT HEADER ===== */
                    .force-landscape-container .bpm-control-area > .flex-shrink-0 {
                        padding: 2px 4px !important;
                    }
                    
                    /* Hide secondary desktop-only controls */
                    .force-landscape-container .hidden.sm\\:flex,
                    .force-landscape-container .hidden.sm\\:block,
                    .force-landscape-container [class*="Tonal Context"],
                    .force-landscape-container [aria-label*="context"] {
                        display: none !important;
                    }
                    
                    /* Compact the header area */
                    .force-landscape-container .bg-card.border-b {
                        padding: 2px 4px !important;
                    }
                    
                    /* Smaller heading text */
                    .force-landscape-container h2.text-lg,
                    .force-landscape-container h2.text-2xl {
                        font-size: 14px !important;
                        line-height: 1.2 !important;
                    }
                    
                    /* Compact margins/gaps */
                    .force-landscape-container .mb-4,
                    .force-landscape-container .mb-1 {
                        margin-bottom: 2px !important;
                    }
                    
                    .force-landscape-container .space-y-4,
                    .force-landscape-container .space-y-2,
                    .force-landscape-container .space-y-1 {
                        gap: 2px !important;
                    }
                    
                    .force-landscape-container .gap-2,
                    .force-landscape-container .gap-4 {
                        gap: 4px !important;
                    }
                    
                    /* Compact all padding */
                    .force-landscape-container .p-4,
                    .force-landscape-container .p-2 {
                        padding: 2px !important;
                    }
                    
                    .force-landscape-container .px-2,
                    .force-landscape-container .px-4 {
                        padding-left: 4px !important;
                        padding-right: 4px !important;
                    }
                    
                    .force-landscape-container .py-1,
                    .force-landscape-container .py-2 {
                        padding-top: 1px !important;
                        padding-bottom: 1px !important;
                    }
                    
                    /* Compact buttons */
                    .force-landscape-container button {
                        padding: 4px 6px !important;
                        min-height: 28px !important;
                    }
                    
                    .force-landscape-container button svg {
                        width: 14px !important;
                        height: 14px !important;
                    }
                    
                    /* Compact metronome display */
                    .force-landscape-container .text-6xl,
                    .force-landscape-container .text-5xl,
                    .force-landscape-container .text-4xl {
                        font-size: 1.5rem !important;
                        line-height: 1 !important;
                    }
                    
                    .force-landscape-container .text-3xl {
                        font-size: 1.25rem !important;
                    }
                    
                    /* Compact muted text */
                    .force-landscape-container .text-muted-foreground {
                        font-size: 10px !important;
                    }
                    
                    /* Hide legend and non-essential text */
                    .force-landscape-container .text-xs.text-muted-foreground:not(:first-child) {
                        display: none;
                    }
                    
                    /* Ensure main content fills available space */
                    .force-landscape-container main {
                        flex: 1 !important;
                        min-height: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }
                    
                    /* NoteDisplay container - center fretboard */
                    .force-landscape-container .note-display-container {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        height: 100% !important;
                    }
                }
            `}</style>
        </>
    );
}
