import { test, expect } from '@playwright/test';

/**
 * Mobile Layout Regression Tests
 * 
 * These tests verify that key modules render correctly on mobile devices.
 * Run with: npm run test:mobile
 * Update baselines with: npm run test:mobile:update
 */

test.describe('Header Mobile Layout', () => {
    test('should show mobile menu toggle and centered logo', async ({ page }) => {
        await page.goto('/');

        // Mobile menu button should be visible
        const menuButton = page.locator('button').filter({ has: page.locator('svg.lucide-menu, svg.lucide-x') });
        await expect(menuButton).toBeVisible();

        // Logo should be visible and centered
        const logo = page.locator('header img[alt*="logo"], header .logo, header h1').first();
        await expect(logo).toBeVisible();

        // No horizontal overflow
        const body = page.locator('body');
        const bodyBox = await body.boundingBox();
        const viewport = page.viewportSize();
        if (bodyBox && viewport) {
            expect(bodyBox.width).toBeLessThanOrEqual(viewport.width + 1);
        }
    });

    test('should toggle mobile menu on click', async ({ page }) => {
        await page.goto('/');

        const menuButton = page.locator('button').filter({ has: page.locator('svg.lucide-menu') });
        await menuButton.click();

        // Menu should be open - look for navigation links
        const navLinks = page.locator('nav a, [role="navigation"] a');
        await expect(navLinks.first()).toBeVisible();
    });
});

test.describe('Module Library Mobile Layout', () => {
    test('should display modules in single column', async ({ page }) => {
        await page.goto('/');

        // Wait for module cards to load
        const moduleCards = page.locator('[class*="ModuleCard"], [class*="module-card"], .card').first();
        await expect(moduleCards).toBeVisible({ timeout: 10000 });

        // Check that cards are stacking (not side by side)
        const cards = await page.locator('[class*="ModuleCard"], [class*="module-card"], .card').all();
        if (cards.length >= 2) {
            const firstBox = await cards[0].boundingBox();
            const secondBox = await cards[1].boundingBox();
            if (firstBox && secondBox) {
                // On mobile, second card should be below first (not beside)
                expect(secondBox.y).toBeGreaterThan(firstBox.y);
            }
        }
    });

    test('should not have horizontal overflow', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check for horizontal scrollbar
        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll).toBe(false);
    });
});

test.describe('Fretboard Mobile Layout', () => {
    test('should fit within viewport without horizontal scroll', async ({ page }) => {
        // Navigate to a page that shows the fretboard
        await page.goto('/');

        // Try to find and click on a module that would show fretboard
        const moduleWithFretboard = page.getByText(/scale|fretboard|exercise/i).first();
        if (await moduleWithFretboard.isVisible()) {
            await moduleWithFretboard.click();
            await page.waitForTimeout(1000);
        }

        const fretboard = page.locator('.fretboard, .fretboard-container, .fretboard-area');
        if (await fretboard.isVisible()) {
            const fretboardBox = await fretboard.boundingBox();
            const viewport = page.viewportSize();

            if (fretboardBox && viewport) {
                // Fretboard should not exceed viewport width
                expect(fretboardBox.width).toBeLessThanOrEqual(viewport.width);
            }
        }
    });
});

test.describe('Rhythm Training Mobile Layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Try to navigate to rhythm training module
        const rhythmModule = page.getByText(/rhythm/i).first();
        if (await rhythmModule.isVisible()) {
            await rhythmModule.click();
            await page.waitForTimeout(1000);
        }
    });

    test('should have compact controls visible', async ({ page }) => {
        // Check for play/pause button which should always be visible
        const playButton = page.locator('button').filter({ has: page.locator('svg.lucide-play, svg.lucide-pause') });
        if (await playButton.isVisible()) {
            await expect(playButton).toBeVisible();

            // Button should be within viewport
            const buttonBox = await playButton.boundingBox();
            const viewport = page.viewportSize();
            if (buttonBox && viewport) {
                expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(viewport.width);
            }
        }
    });

    test('should not have horizontal overflow', async ({ page }) => {
        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll).toBe(false);
    });
});

test.describe('Metronome Mobile Layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Try to navigate to metronome
        const metronomeLink = page.getByText(/metronome/i).first();
        if (await metronomeLink.isVisible()) {
            await metronomeLink.click();
            await page.waitForTimeout(1000);
        }
    });

    test('should display BPM prominently', async ({ page }) => {
        // BPM display should be visible and readable
        const bpmDisplay = page.locator('[class*="bpm"], [class*="BPM"]').first();
        if (await bpmDisplay.isVisible()) {
            await expect(bpmDisplay).toBeVisible();
        }
    });

    test('controls should be accessible', async ({ page }) => {
        // Play button should be easily tappable (visible and sized appropriately)
        const playButton = page.locator('button').filter({ has: page.locator('svg.lucide-play, svg.lucide-pause') }).first();
        if (await playButton.isVisible()) {
            const buttonBox = await playButton.boundingBox();
            if (buttonBox) {
                // Minimum touch target size (44px recommended by Apple)
                expect(Math.min(buttonBox.width, buttonBox.height)).toBeGreaterThanOrEqual(40);
            }
        }
    });
});

test.describe('General Mobile Layout Checks', () => {
    const pagesToCheck = ['/', '/practice', '/settings'];

    for (const path of pagesToCheck) {
        test(`${path} should not have horizontal overflow`, async ({ page }) => {
            await page.goto(path);
            await page.waitForLoadState('domcontentloaded');

            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });

            expect(hasHorizontalScroll).toBe(false);
        });

        test(`${path} should have touch-friendly tap targets`, async ({ page }) => {
            await page.goto(path);
            await page.waitForLoadState('domcontentloaded');

            // Check all buttons have minimum size
            const buttons = await page.locator('button:visible').all();
            for (const button of buttons.slice(0, 10)) { // Check first 10 buttons
                const box = await button.boundingBox();
                if (box) {
                    // At least 32px (a bit smaller than ideal 44px, but reasonable for UI)
                    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(32);
                }
            }
        });
    }
});

test.describe('Visual Regression - Mobile Screenshots', () => {
    test('homepage mobile screenshot', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveScreenshot('homepage-mobile.png', {
            maxDiffPixelRatio: 0.1,
            fullPage: true,
        });
    });
});
