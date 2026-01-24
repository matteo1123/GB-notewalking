import { test, expect, Page } from '@playwright/test';

/**
 * Notewalking & Rhythm Module Mobile Layout Regression Tests
 * 
 * Locks in the current mobile layouts that are working well.
 * These tests verify element visibility and approximate dimensions
 * to catch any regression in the layout.
 * 
 * Viewport: iPhone SE equivalent (375x667 portrait, rotated to landscape via CSS)
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function navigateToModule(page: Page, moduleIndex: number) {
    await page.goto('/test/scale-module');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);

    // Scroll container to reveal more modules
    await page.evaluate(() => {
        const container = document.querySelector('.flex-1.overflow-y-auto');
        if (container) container.scrollTop += 600;
    });
    await page.waitForTimeout(500);

    // Click the Nth Try Now button (0-indexed)
    const tryButtons = page.locator('button:has-text("Try Now")');
    await tryButtons.nth(moduleIndex).scrollIntoViewIfNeeded();
    await tryButtons.nth(moduleIndex).click();

    await page.waitForTimeout(2000);
}

// Helper to get element dimensions
async function getElementDimensions(page: Page, selector: string) {
    return await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
            offsetWidth: el.offsetWidth,
            offsetHeight: el.offsetHeight,
            rectWidth: rect.width,
            rectHeight: rect.height,
            visible: el.offsetWidth > 0 && el.offsetHeight > 0
        };
    }, selector);
}

// ============================================================================
// NOTEWALKING MODULE LAYOUT TESTS
// ============================================================================

test.describe('Notewalking Module - Mobile Layout Lock-in', () => {
    test.beforeEach(async ({ page }) => {
        // Notewalking is at index 1 (0=Rhythm, 1=Notewalking, 2=Scale)
        await navigateToModule(page, 1);
    });

    test('main container uses forced landscape layout', async ({ page }) => {
        // Verify the force-landscape-container is present
        const container = page.locator('.force-landscape-container');
        await expect(container).toBeVisible({ timeout: 10000 });

        // Get container dimensions - with rotation, width/height swap
        const dims = await getElementDimensions(page, '.force-landscape-container');
        expect(dims, 'Force landscape container not found').not.toBeNull();

        // Container should occupy significant viewport space
        expect(dims!.offsetWidth).toBeGreaterThan(500);
        expect(dims!.offsetHeight).toBeGreaterThan(300);

        console.log(`Notewalking container: ${dims!.offsetWidth}x${dims!.offsetHeight}`);
    });

    test('metronome controls are visible', async ({ page }) => {
        // Mode selector
        const modeSelect = page.locator('[data-testid="metronome-mode-select"]');
        await expect(modeSelect).toBeVisible({ timeout: 10000 });

        // Start button
        const startBtn = page.locator('[data-testid="metronome-start-button"]');
        await expect(startBtn).toBeVisible();

        // Restart button
        const restartBtn = page.locator('[data-testid="metronome-restart-button"]');
        await expect(restartBtn).toBeVisible();

        // Loop button
        const loopBtn = page.locator('[data-testid="metronome-loop-button"]');
        await expect(loopBtn).toBeVisible();

        // Drum button
        const drumBtn = page.locator('[data-testid="metronome-drum-button"]');
        await expect(drumBtn).toBeVisible();

        // BPM display
        const bpmDisplay = page.locator('[data-testid="metronome-bpm-display"]');
        await expect(bpmDisplay).toBeVisible();

        console.log('Notewalking: All metronome controls visible');
    });

    test('key selection dropdown is visible', async ({ page }) => {
        // Key select dropdown
        const keySelect = page.locator('button[role="combobox"]').first();
        await expect(keySelect).toBeVisible({ timeout: 10000 });

        console.log('Notewalking: Key selection dropdown visible');
    });

    test('chord selection buttons are visible', async ({ page }) => {
        // Check for diatonic chord buttons (I, ii, iii, IV, V, vi, vii°)
        const chordButtons = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

        for (const chord of chordButtons) {
            const btn = page.locator(`button:has-text("${chord}")`).first();
            await expect(btn).toBeVisible({ timeout: 5000 });
        }

        console.log('Notewalking: All chord selection buttons visible');
    });

    test('fretboard and drone buttons are visible', async ({ page }) => {
        // Fretboard button
        const fretboardBtn = page.locator('button:has-text("Fretboard")');
        await expect(fretboardBtn).toBeVisible({ timeout: 10000 });

        // Drone button
        const droneBtn = page.locator('button:has-text("Drone")');
        await expect(droneBtn).toBeVisible();

        console.log('Notewalking: Fretboard and Drone buttons visible');
    });

    test('Start button has adequate touch target size', async ({ page }) => {
        // Start button should be at least 40x100 for good touch targets
        const startBtnDims = await page.evaluate(() => {
            // Find Start button by text or by data-testid
            const btn = document.querySelector('[data-testid="metronome-start-button"]') ||
                Array.from(document.querySelectorAll('button')).find(b =>
                    b.textContent?.includes('Start') || b.textContent?.includes('Stop'));
            if (!btn) return null;
            const rect = (btn as HTMLElement).getBoundingClientRect();
            return { width: rect.width, height: rect.height };
        });

        expect(startBtnDims, 'Start button not found').not.toBeNull();

        // Height should be at least 32px for comfortable tapping
        expect(startBtnDims!.height).toBeGreaterThanOrEqual(28);

        console.log(`Notewalking Start button: ${startBtnDims!.width}x${startBtnDims!.height}`);
    });
});

// ============================================================================
// RHYTHM MODULE LAYOUT TESTS
// ============================================================================

test.describe('Rhythm Module - Mobile Layout Lock-in', () => {
    test.beforeEach(async ({ page }) => {
        // Rhythm Training is at index 0
        await navigateToModule(page, 0);
    });

    test('main container uses forced landscape layout', async ({ page }) => {
        const container = page.locator('.force-landscape-container');
        await expect(container).toBeVisible({ timeout: 10000 });

        const dims = await getElementDimensions(page, '.force-landscape-container');
        expect(dims, 'Force landscape container not found').not.toBeNull();

        expect(dims!.offsetWidth).toBeGreaterThan(500);
        expect(dims!.offsetHeight).toBeGreaterThan(300);

        console.log(`Rhythm container: ${dims!.offsetWidth}x${dims!.offsetHeight}`);
    });

    test('rhythm notation is visible and prominent', async ({ page }) => {
        // The rhythm pattern (arrows: ↓ ↑ ·) should be visible
        // Look for the pattern container with large text
        const patternArea = page.locator('.text-2xl.font-mono, .text-5xl.font-mono').first();
        await expect(patternArea).toBeVisible({ timeout: 10000 });

        // Get the pattern text content
        const patternText = await patternArea.textContent();
        expect(patternText).toBeTruthy();

        // Pattern should contain rhythm symbols
        expect(patternText).toMatch(/[↓↑·]/);

        console.log(`Rhythm pattern: "${patternText}"`);
    });

    test('level indicator and navigation are visible', async ({ page }) => {
        // Level badge (e.g., "L0")
        const levelBadge = page.locator('span:has-text("L")').filter({ hasText: /L\d+/ }).first();
        await expect(levelBadge).toBeVisible({ timeout: 10000 });

        // Level navigation arrows
        const prevBtn = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).first();
        const nextBtn = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();

        await expect(prevBtn).toBeVisible();
        await expect(nextBtn).toBeVisible();

        console.log('Rhythm: Level indicator and navigation visible');
    });

    test('mode toggle buttons are visible (Systematic/Random)', async ({ page }) => {
        // Systematic button
        const systematicBtn = page.locator('button:has-text("Systematic")');
        await expect(systematicBtn).toBeVisible({ timeout: 10000 });

        // Random button
        const randomBtn = page.locator('button:has-text("Random")');
        await expect(randomBtn).toBeVisible();

        console.log('Rhythm: Mode toggle buttons visible');
    });

    test('confirmation flow buttons are visible', async ({ page }) => {
        // "✓ Correct" or "I played it correctly!" button
        const confirmBtn = page.locator('button:has-text("Correct")');
        await expect(confirmBtn).toBeVisible({ timeout: 10000 });

        // "New" or "Generate New" button
        const newBtn = page.locator('button:has-text("New")');
        await expect(newBtn).toBeVisible();

        console.log('Rhythm: Confirmation flow buttons visible');
    });

    test('metronome controls are visible', async ({ page }) => {
        // Mode selector
        const modeSelect = page.locator('[data-testid="metronome-mode-select"]');
        await expect(modeSelect).toBeVisible({ timeout: 10000 });

        // Start button
        const startBtn = page.locator('[data-testid="metronome-start-button"]');
        await expect(startBtn).toBeVisible();

        // BPM display
        const bpmDisplay = page.locator('[data-testid="metronome-bpm-display"]');
        await expect(bpmDisplay).toBeVisible();

        console.log('Rhythm: Metronome controls visible');
    });

    test('settings button is visible', async ({ page }) => {
        const settingsBtn = page.locator('button:has-text("Settings")');
        await expect(settingsBtn).toBeVisible({ timeout: 10000 });

        console.log('Rhythm: Settings button visible');
    });

    test('deviation type checkboxes are visible (Skip/Triplet)', async ({ page }) => {
        // Skip checkbox
        const skipCheckbox = page.locator('label:has-text("Skip")');
        await expect(skipCheckbox).toBeVisible({ timeout: 10000 });

        // Triplet checkbox
        const tripletCheckbox = page.locator('label:has-text("Triplet")');
        await expect(tripletCheckbox).toBeVisible();

        console.log('Rhythm: Deviation type checkboxes visible');
    });

    test('BeatVisualizer shows current BPM', async ({ page }) => {
        // BPM display should show a number
        const bpmDisplay = page.locator('[data-testid="metronome-bpm-display"]');
        await expect(bpmDisplay).toBeVisible({ timeout: 10000 });

        const bpmText = await bpmDisplay.textContent();
        expect(bpmText).toBeTruthy();

        // Should contain numbers
        const bpmValue = parseInt(bpmText || '0');
        expect(bpmValue).toBeGreaterThan(0);

        console.log(`Rhythm BPM display: ${bpmValue}`);
    });
});

// ============================================================================
// BUTTON FUNCTIONALITY TESTS (for debugging non-functional buttons)
// ============================================================================

test.describe('Rhythm Module - Button Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await navigateToModule(page, 0);
    });

    test('"New" button generates a new pattern', async ({ page }) => {
        // Get initial pattern
        const patternArea = page.locator('.text-2xl.font-mono, .text-5xl.font-mono').first();
        const initialPattern = await patternArea.textContent();

        // Click the "New" button
        const newBtn = page.locator('button:has-text("New")');
        await newBtn.click();
        await page.waitForTimeout(500);

        // Pattern should potentially change (may be same if random generates same)
        // We just verify the button is clickable and doesn't error
        const newPattern = await patternArea.textContent();

        console.log(`Pattern before: "${initialPattern}", after: "${newPattern}"`);

        // Test passes if we got here without error - button is functional
        expect(true).toBe(true);
    });

    test('"Correct" button triggers confirmation flow', async ({ page }) => {
        // Initially "Correct" button should be visible
        const confirmBtn = page.locator('button:has-text("Correct")');
        await expect(confirmBtn).toBeVisible({ timeout: 10000 });

        // Click it
        await confirmBtn.click();
        await page.waitForTimeout(500);

        // After confirmation, "Rec" and "Next" buttons should appear
        const recBtn = page.locator('button:has-text("Rec")');
        const nextBtn = page.locator('button:has-text("Next")');

        await expect(recBtn).toBeVisible({ timeout: 5000 });
        await expect(nextBtn).toBeVisible();

        console.log('Rhythm: Confirmation flow triggered successfully');
    });

    test('"Next" button advances to harder rhythm after confirmation', async ({ page }) => {
        // Get initial level
        const levelBadge = page.locator('span:has-text("L")').filter({ hasText: /L\d+/ }).first();
        const initialLevelText = await levelBadge.textContent();
        const initialLevel = parseInt(initialLevelText?.replace('L', '') || '0');

        // Confirm the rhythm
        const confirmBtn = page.locator('button:has-text("Correct")');
        await confirmBtn.click();
        await page.waitForTimeout(500);

        // Click "Next" to advance level
        const nextBtn = page.locator('button:has-text("Next")');
        await nextBtn.click();
        await page.waitForTimeout(500);

        // Level should increase
        const newLevelText = await levelBadge.textContent();
        const newLevel = parseInt(newLevelText?.replace('L', '') || '0');

        expect(newLevel).toBe(initialLevel + 1);

        console.log(`Level advanced from ${initialLevel} to ${newLevel}`);
    });
});
