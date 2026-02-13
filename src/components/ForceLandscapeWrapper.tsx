/**
 * ============================================================================
 * ForceLandscapeWrapper — CSS-based forced landscape display for mobile
 * ============================================================================
 *
 * ⚠️  DO NOT REMOVE THE LANDSCAPE BEHAVIOR FROM THIS COMPONENT  ⚠️
 *
 * This component wraps practice modules to force landscape orientation on
 * mobile devices. Guitar fretboards are horizontal instruments — they MUST
 * display in landscape on phones. The app uses scroll gestures to control
 * the metronome, so content cannot overflow off-screen.
 *
 * HOW IT WORKS:
 * - All CSS is in `/src/styles/force-landscape.css` (NOT inline)
 * - The CSS uses a media query for portrait phones (max-width: 900px, portrait)
 * - In portrait mode: rotates content 90°, swaps width/height
 * - In landscape mode: displays normally (no transform)
 *
 * RULES FOR AI TOOLS / MODIFICATIONS:
 * 1. DO NOT remove the `force-landscape-container` className
 * 2. DO NOT remove the CSS import
 * 3. DO NOT convert back to inline styles
 * 4. DO NOT modify `/src/styles/force-landscape.css` without good reason
 * 5. If you need to edit this component, ONLY edit the TypeScript/JSX logic
 *
 * @LANDSCAPE-LOCK — Do not break landscape behavior
 * ============================================================================
 */

import { ReactNode } from 'react';
import '@/styles/force-landscape.css';

interface ForceLandscapeWrapperProps {
    children: ReactNode;
    className?: string;
}

/**
 * ForceLandscapeWrapper — Wraps children in a container that forces
 * landscape orientation on mobile via CSS transforms.
 *
 * The CSS in force-landscape.css handles:
 * - Portrait phones: rotate 90deg, swap dimensions, center on screen
 * - Landscape/desktop: display normally, no transform
 *
 * @LANDSCAPE-LOCK — Do not remove this wrapper or its CSS import
 */
export function ForceLandscapeWrapper({ children, className = '' }: ForceLandscapeWrapperProps) {
    return (
        /* @LANDSCAPE-LOCK: This className is targeted by force-landscape.css — do not rename */
        <div className={`force-landscape-container ${className}`}>
            {children}
        </div>
    );
}
