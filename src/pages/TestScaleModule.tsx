/**
 * Test page for Playwright E2E tests
 * Renders the ModuleLibrary directly without auth
 * 
 * Access at: /test/scale-module
 * Only available in development mode
 */
import { ModuleLibrary } from '@/components/ModuleLibrary';

export default function TestScaleModule() {
    return (
        <div className="h-screen w-screen overflow-hidden bg-background">
            <ModuleLibrary />
        </div>
    );
}
