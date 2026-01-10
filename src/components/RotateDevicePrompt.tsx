import { RotateCw } from 'lucide-react';

interface RotateDevicePromptProps {
    onDismiss?: () => void;
}

/**
 * Full-screen overlay prompting the user to rotate their device to landscape.
 * Shows when practice module detects portrait orientation on mobile.
 */
export function RotateDevicePrompt({ onDismiss }: RotateDevicePromptProps) {
    return (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
            <div className="animate-bounce mb-6">
                <RotateCw className="w-20 h-20 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Rotate Your Device</h2>
            <p className="text-muted-foreground max-w-xs mb-6">
                For the best practice experience, please rotate your phone to landscape mode.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <div className="w-8 h-14 border-2 border-muted-foreground rounded-lg flex items-center justify-center">
                    <div className="w-4 h-6 bg-muted-foreground/30 rounded" />
                </div>
                <span className="text-xl">→</span>
                <div className="w-14 h-8 border-2 border-primary rounded-lg flex items-center justify-center">
                    <div className="w-6 h-4 bg-primary/30 rounded" />
                </div>
            </div>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="mt-8 text-sm text-muted-foreground underline"
                >
                    Continue in portrait anyway
                </button>
            )}
        </div>
    );
}
