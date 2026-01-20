---
description: Run Playwright mobile layout regression tests
---

# Mobile Layout Testing Workflow

This workflow runs automated tests to catch mobile layout regressions.

## Prerequisites

The Playwright browsers need to be installed first (one-time setup):

```bash
npx playwright install chromium
```

## Running Tests

// turbo
1. Run mobile layout tests:
```bash
npm run test:mobile
```

This runs tests against iPhone SE and iPhone 14 viewports.

## Other Commands

// turbo
2. Run tests for all devices (including iPad):
```bash
npm run test:mobile:all
```

// turbo
3. Update baseline screenshots after intentional changes:
```bash
npm run test:mobile:update
```

// turbo
4. Open interactive test UI for debugging:
```bash
npm run test:mobile:ui
```

## What the Tests Check

- **No horizontal overflow**: Pages shouldn't scroll horizontally on mobile
- **Touch-friendly targets**: Buttons should be at least 32px (ideally 44px)
- **Visible elements**: Key components visible within viewport
- **Responsive layouts**: Cards stack vertically, controls are compact
- **Visual regression**: Screenshots compared against baselines

## When Tests Fail

1. Check the HTML report: `npx playwright show-report`
2. Look at failing screenshots in `test-results/` folder
3. If changes are intentional, update baselines with `npm run test:mobile:update`
4. If changes are bugs, fix the layout and re-run tests
