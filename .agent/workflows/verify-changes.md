---
description: Auto-run mobile layout tests after code changes
---

# Verify Layout Changes

After making any changes to mobile layout, CSS, or components that affect visual presentation on mobile devices, run the layout regression tests.

## When to Run

Run these tests after modifying:
- `ForceLandscapeWrapper.tsx`
- `Fretboard.tsx` or `Fretboard.css`
- Any component CSS that affects mobile layout
- `ExercisePracticeModule.tsx`
- `RhythmTraining.tsx`
- `ChordProgressionExercise.tsx`
- `NoteDisplay.tsx`

## Commands

// turbo-all
```bash
# Run all mobile layout tests
npx playwright test tests/mobile-layout.spec.ts --project="Mobile iPhone SE"
```

## Expected Results

All 4 tests should pass:
- ✓ scale fretboard is landscape
- ✓ arpeggio fretboard is landscape  
- ✓ rhythm training layout is visible
- ✓ chord changes layout is visible

## If Tests Fail

1. Check the error message for which module failed
2. Look at the screenshot in `test-results/` folder
3. Fix the layout issue
4. Re-run the test
