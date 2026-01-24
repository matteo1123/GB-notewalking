import { test, expect, Page } from '@playwright/test';

/**
 * Metronome Controls Visibility Tests
 * 
 * Verifies that all metronome controls display correctly across all practice modules.
 * Tests 3 modes: Regular, Speed Trainer, and Progressive
 * 
 * Common controls (visible in ALL modes):
 * - Mode selector (Regular, Speed Trainer, Progressive)
 * - Start/Pause button
 * - Restart button
 * - Loop button
 * - Drum button
 * - Record button (premium only - may not be visible)
 * - BPM display
 * 
 * Speed Trainer additional fields:
 * - End BPM
 * - # Increments
 * - Measures/Inc
 * 
 * Progressive additional fields:
 * - End BPM
 * - # Increments
 * - Measures/Inc
 * - Step BPM
 */

// Module configurations for testing
const MODULES = [
    {
        name: 'Scale Practice',
        index: 2, // 0=Rhythm, 1=Notewalking, 2=Scale
        exerciseFilter: 'Ionian',
    },
    {
        name: 'Arpeggio Practice',
        index: 4,
        exerciseFilter: 'arpeggio',
    },
    {
        name: 'Rhythm Training',
        index: 0,
        exerciseFilter: null, // No exercise selection needed
    },
];

// Helper to navigate to a specific module from the library
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

// Helper to click first table row (for selecting a scale/arpeggio)
async function clickFirstExerciseRow(page: Page, textFilter: string | null) {
    if (!textFilter) return true; // No selection needed

    const row = page.getByRole('row').filter({ hasText: textFilter }).first();

    if (await row.isVisible({ timeout: 5000 })) {
        await row.click();
        await page.waitForTimeout(2000);
        return true;
    }
    return false;
}

// Helper to select a metronome mode
async function selectMode(page: Page, modeName: 'Regular' | 'Speed Trainer' | 'Progressive') {
    const modeSelector = page.locator('[data-testid="metronome-mode-select"]');
    await expect(modeSelector).toBeVisible({ timeout: 10000 });
    await modeSelector.click();
    await page.waitForTimeout(300);

    // Click the mode option
    await page.getByRole('option', { name: modeName }).click();
    await page.waitForTimeout(500);
}

// ============================================================================
// METRONOME CONTROLS TESTS FOR ALL MODULES
// ============================================================================

for (const module of MODULES) {
    test.describe(`${module.name} - Metronome Controls`, () => {
        test.beforeEach(async ({ page }) => {
            await navigateToModule(page, module.index);
            await clickFirstExerciseRow(page, module.exerciseFilter);
        });

        // -----------------------------------------------------------------
        // REGULAR MODE TESTS
        // -----------------------------------------------------------------
        test('Regular mode shows correct controls', async ({ page }) => {
            // Ensure we're in Regular mode
            await selectMode(page, 'Regular');

            // Verify common controls are visible
            await expect(page.locator('[data-testid="metronome-mode-select"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-start-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-restart-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-loop-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-drum-button"]')).toBeVisible();
            // Record button is premium-only, may not be visible
            // await expect(page.locator('[data-testid="metronome-record-button"]')).toBeVisible();

            // Verify BPM display is visible
            await expect(page.locator('[data-testid="metronome-bpm-display"]')).toBeVisible();

            // Verify advanced fields are NOT visible in Regular mode
            await expect(page.locator('[data-testid="metronome-advanced-fields"]')).not.toBeVisible();
            await expect(page.locator('[data-testid="metronome-end-bpm"]')).not.toBeVisible();
            await expect(page.locator('[data-testid="metronome-increments"]')).not.toBeVisible();
            await expect(page.locator('[data-testid="metronome-measures-per-inc"]')).not.toBeVisible();
            await expect(page.locator('[data-testid="metronome-step-bpm"]')).not.toBeVisible();

            console.log(`${module.name}: Regular mode controls verified`);
        });

        // -----------------------------------------------------------------
        // SPEED TRAINER MODE TESTS
        // -----------------------------------------------------------------
        test('Speed Trainer mode shows correct controls', async ({ page }) => {
            // Switch to Speed Trainer mode
            await selectMode(page, 'Speed Trainer');

            // Verify common controls are visible
            await expect(page.locator('[data-testid="metronome-mode-select"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-start-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-restart-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-loop-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-drum-button"]')).toBeVisible();

            // Verify BPM display is visible
            await expect(page.locator('[data-testid="metronome-bpm-display"]')).toBeVisible();

            // Verify Speed Trainer fields ARE visible
            await expect(page.locator('[data-testid="metronome-advanced-fields"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-end-bpm"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-increments"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-measures-per-inc"]')).toBeVisible();

            // Verify Step BPM is NOT visible (Progressive mode only)
            await expect(page.locator('[data-testid="metronome-step-bpm"]')).not.toBeVisible();

            console.log(`${module.name}: Speed Trainer mode controls verified`);
        });

        // -----------------------------------------------------------------
        // PROGRESSIVE MODE TESTS
        // -----------------------------------------------------------------
        test('Progressive mode shows correct controls', async ({ page }) => {
            // Switch to Progressive mode
            await selectMode(page, 'Progressive');

            // Verify common controls are visible
            await expect(page.locator('[data-testid="metronome-mode-select"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-start-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-restart-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-loop-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-drum-button"]')).toBeVisible();

            // Verify BPM display is visible
            await expect(page.locator('[data-testid="metronome-bpm-display"]')).toBeVisible();

            // Verify ALL advanced fields ARE visible (including Step BPM)
            await expect(page.locator('[data-testid="metronome-advanced-fields"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-end-bpm"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-increments"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-measures-per-inc"]')).toBeVisible();
            await expect(page.locator('[data-testid="metronome-step-bpm"]')).toBeVisible();

            console.log(`${module.name}: Progressive mode controls verified`);
        });
    });
}
