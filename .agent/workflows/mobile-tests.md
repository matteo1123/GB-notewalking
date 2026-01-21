---
description: Run the landscape mode test on iPhone SE
---

Run the Playwright tests to verify all modules have correct mobile layouts.

```bash
# Run all mobile layout tests (headless)
npx playwright test tests/mobile-layout.spec.ts --project="Mobile iPhone SE"

# Run with visible browser
npx playwright test tests/mobile-layout.spec.ts --project="Mobile iPhone SE" --headed

# Run a single test by name
npx playwright test tests/mobile-layout.spec.ts --project="Mobile iPhone SE" -g "scale fretboard"
```
