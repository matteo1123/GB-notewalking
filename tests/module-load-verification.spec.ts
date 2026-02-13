import { test, expect, Page } from '@playwright/test';

/**
 * Module Load Verification Test
 * 
 * Verifies that all 6 practice modules load without errors.
 * This is a smoke test to catch major breakage.
 */

// Navigate to a module by clicking its "Try Now" button
async function navigateToModule(page: Page, moduleIndex: number) {
    await page.goto('/test/scale-module');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);

    // Scroll to reveal all modules
    await page.evaluate(() => {
        const container = document.querySelector('.flex-1.overflow-y-auto');
        if (container) container.scrollTop += 600;
    });
    await page.waitForTimeout(500);

    // Get all Try Now buttons
    const tryButtons = page.locator('button:has-text("Try Now")');
    const count = await tryButtons.count();

    if (moduleIndex >= count) {
        throw new Error(`Module index ${moduleIndex} out of range. Only ${count} modules found.`);
    }

    await tryButtons.nth(moduleIndex).scrollIntoViewIfNeeded();
    await tryButtons.nth(moduleIndex).click();

    await page.waitForTimeout(2000);
}

test.describe('All Modules Load Test', () => {

    test('Module Library loads', async ({ page }) => {
        await page.goto('/test/scale-module');
        await page.waitForLoadState('load');
        await page.waitForTimeout(2000);

        // Check that we see some modules
        const moduleCards = page.locator('button:has-text("Try Now")');
        const count = await moduleCards.count();

        console.log(`Found ${count} modules in library`);
        expect(count).toBeGreaterThanOrEqual(5);
    });

    test('Rhythm module loads', async ({ page }) => {
        await navigateToModule(page, 0); // Index 0 = Rhythm

        // Should see landscape container or rhythm-specific UI
        const container = page.locator('.force-landscape-container, [class*="rhythm"]').first();
        await expect(container).toBeVisible({ timeout: 10000 });

        // Check no error toasts
        const errorToast = page.locator('[role="alert"]:has-text("error")');
        await expect(errorToast).toHaveCount(0);

        console.log('✓ Rhythm module loaded');
    });

    test('Notewalking module loads', async ({ page }) => {
        await navigateToModule(page, 1); // Index 1 = Notewalking

        // Should see fretboard
        const fretboard = page.locator('.fretboard').first();
        await expect(fretboard).toBeVisible({ timeout: 10000 });

        console.log('✓ Notewalking module loaded');
    });

    test('Scale module loads', async ({ page }) => {
        await navigateToModule(page, 2); // Index 2 = Scale

        // Should see exercise list or fretboard after selecting
        const scaleUI = page.locator('.fretboard, table, [class*="scale"]').first();
        await expect(scaleUI).toBeVisible({ timeout: 10000 });

        console.log('✓ Scale module loaded');
    });

    test('Chord Progressions module loads', async ({ page }) => {
        await navigateToModule(page, 3); // Index 3 = Chord Progressions

        // Should see chord progression UI
        const chordUI = page.locator('.force-landscape-container, .fretboard, [class*="chord"]').first();
        await expect(chordUI).toBeVisible({ timeout: 10000 });

        console.log('✓ Chord Progressions module loaded');
    });

    test('Arpeggio module loads', async ({ page }) => {
        await navigateToModule(page, 4); // Index 4 = Arpeggio

        // Should see exercise list or fretboard
        const arpUI = page.locator('.fretboard, table, [class*="arpeggio"]').first();
        await expect(arpUI).toBeVisible({ timeout: 10000 });

        console.log('✓ Arpeggio module loaded');
    });

    test('Riff module loads', async ({ page }) => {
        // Riff may be at index 5 or may not exist yet
        await page.goto('/test/scale-module');
        await page.waitForLoadState('load');
        await page.waitForTimeout(1500);

        // Check if Riff module exists
        const riffButton = page.locator('button:has-text("Try Now")').nth(5);
        const exists = await riffButton.isVisible().catch(() => false);

        if (!exists) {
            console.log('⚠ Riff module not found in library (may not be implemented)');
            test.skip();
            return;
        }

        await riffButton.click();
        await page.waitForTimeout(2000);

        const riffUI = page.locator('.force-landscape-container, .fretboard').first();
        await expect(riffUI).toBeVisible({ timeout: 10000 });

        console.log('✓ Riff module loaded');
    });
});
