import { test, expect, Page } from '@playwright/test';

/**
 * Mobile Layout Regression Tests
 * 
 * Verifies that all practice modules display correctly on mobile devices.
 * These tests are regression locks - they catch layout breakage from code changes.
 * 
 * Test route: /test/scale-module (bypasses authentication)
 * 
 * IMPORTANT: The forced landscape CSS rotates content 90 degrees.
 * We use offsetWidth/offsetHeight to measure LAYOUT dimensions (pre-rotation).
 */

// Helper to get fretboard layout dimensions (pre-rotation)
async function getFretboardDimensions(page: Page) {
    return await page.evaluate(() => {
        const el = document.querySelector('.fretboard') as HTMLElement;
        if (!el) return null;
        return {
            offsetWidth: el.offsetWidth,
            offsetHeight: el.offsetHeight
        };
    });
}

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
async function clickFirstExerciseRow(page: Page, textFilter: string) {
    // Use getByRole('row') which targets tr elements - the rows are clickable
    const row = page.getByRole('row').filter({ hasText: textFilter }).first();

    if (await row.isVisible({ timeout: 5000 })) {
        await row.click();
        await page.waitForTimeout(2000);
        return true;
    }
    return false;
}

// ============================================================================
// SCALE MODULE TEST
// ============================================================================

test('scale fretboard is landscape', async ({ page }) => {
    // Scale Practice is at index 2 (0=Rhythm, 1=Notewalking, 2=Scale)
    await navigateToModule(page, 2);

    // Click first exercise row containing "Ionian" or any scale name
    await clickFirstExerciseRow(page, 'Ionian');

    // Verify fretboard is visible
    const fretboard = page.locator('.fretboard').first();
    await expect(fretboard).toBeVisible({ timeout: 15000 });

    // Check dimensions
    const dims = await getFretboardDimensions(page);
    expect(dims, 'Fretboard not found').not.toBeNull();

    console.log(`Scale fretboard: ${dims!.offsetWidth}x${dims!.offsetHeight}`);

    // Must be landscape (width > height)
    expect(dims!.offsetWidth, `Scale fretboard is portrait (${dims!.offsetWidth}x${dims!.offsetHeight})`).toBeGreaterThan(dims!.offsetHeight);

    // Aspect ratio at least 2:1
    const ratio = dims!.offsetWidth / dims!.offsetHeight;
    expect(ratio, `Aspect ratio ${ratio.toFixed(2)} too narrow`).toBeGreaterThanOrEqual(2);
});

// ============================================================================
// ARPEGGIO MODULE TEST
// ============================================================================

test('arpeggio fretboard is landscape', async ({ page }) => {
    // Arpeggio Practice is at index 4
    await navigateToModule(page, 4);

    // Click first exercise row - use "arpeggio" which appears in the Type column
    await clickFirstExerciseRow(page, 'arpeggio');

    // Verify fretboard is visible
    const fretboard = page.locator('.fretboard').first();
    await expect(fretboard).toBeVisible({ timeout: 15000 });

    // Check dimensions
    const dims = await getFretboardDimensions(page);
    expect(dims, 'Fretboard not found').not.toBeNull();

    console.log(`Arpeggio fretboard: ${dims!.offsetWidth}x${dims!.offsetHeight}`);

    // Must be landscape
    expect(dims!.offsetWidth, `Arpeggio fretboard is portrait`).toBeGreaterThan(dims!.offsetHeight);

    // Aspect ratio at least 2:1
    const ratio = dims!.offsetWidth / dims!.offsetHeight;
    expect(ratio, `Aspect ratio ${ratio.toFixed(2)} too narrow`).toBeGreaterThanOrEqual(2);
});

// ============================================================================
// RHYTHM TRAINING TEST
// ============================================================================

test('rhythm training layout is visible', async ({ page }) => {
    // Rhythm Training is at index 0
    await navigateToModule(page, 0);

    // Wait for rhythm module to load
    await page.waitForTimeout(2000);

    // Rhythm training should show the pattern visualization
    const rhythmArea = page.locator('.force-landscape-container').first();

    // Should be visible
    await expect(rhythmArea).toBeVisible({ timeout: 15000 });

    console.log('Rhythm training layout verified');
});

// ============================================================================
// CHORD CHANGES TEST - SKIPPED (Not implemented yet)
// ============================================================================

test.skip('chord changes layout is visible', async ({ page }) => {
    // Chord Changes module shows "Coming soon!" - skip until implemented
    await navigateToModule(page, 3);

    await page.waitForTimeout(2000);

    const chordArea = page.locator('.force-landscape-container, .fretboard').first();
    await expect(chordArea).toBeVisible({ timeout: 15000 });

    console.log('Chord changes layout verified');
});
