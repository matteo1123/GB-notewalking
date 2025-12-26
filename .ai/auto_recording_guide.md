# Auto-Recording Hook - Usage Guide

## Overview
The `useAutoRecording` hook provides automatic recording functionality for all practice modules. It supports:
- **Random scheduling** (records ~30s from 5-min session)
- **Countdown display** (shows when recording approaching)
- **Mic cloning** (works alongside pitch detection in notewalking)
- **Automatic storage** (saves to Supabase + links to practice_log)

## Basic Usage

### Simple Modules (Rhythm, Scales, Chord Progressions)
```tsx
import { useAutoRecording } from '@/hooks/useAutoRecording';

function RhythmTraining() {
  const [autoRecordEnabled, setAutoRecordEnabled] = useState(false);
  
  const recording = useAutoRecording({
    enabled: autoRecordEnabled,
    moduleType: 'rhythm',
    moduleConfig: { rhythm_level: 5 },
  });

  // In your metronome tick handler:
  const handleTick = (state) => {
    recording.handleTick(state.currentBeat); // or tickCount
  };

  return (
    <div>
      {/* Show countdown */}
      {recording.countdown && (
        <div>Recording in {recording.countdown} clicks...</div>
      )}

      {/* Show recording indicator */}
      {recording.isRecording && (
        <div className="recording-indicator">● REC</div>
      )}
      
      {/* Toggle auto-record */}
      <Switch
        checked={autoRecordEnabled}
        onCheckedChange={setAutoRecordEnabled}
      />
    </div>
  );
}
```

### Advanced: Notewalking (Dual Mic Use)

The notewalking module already uses the mic for pitch detection. The hook supports cloning the mic stream:

```tsx
function ChordProgressionExercise() {
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [autoRecordEnabled, setAutoRecordEnabled] = useState(false);

  // Existing pitch detection setup
  usePitchDetection({
    isEnabled: isPlaying,
    onNoteDetected: handlePitchDetected,
    onStreamReady: setMicStream, // ← Pass stream to hook
  });

  // Auto-recording shares the mic stream
  const recording = useAutoRecording({
    enabled: autoRecordEnabled,
    moduleType: 'notewalking',
    moduleConfig: {
      key: settings.key,
      chords: settings.selectedChords,
      measures_per_chord: settings.measuresPerChord,
    },
    existingMicStream: micStream, // ← Clone existing stream!
  });

  // Rest is the same as basic usage
}
```

## API Reference

### Options
```typescript
interface AutoRecordingOptions {
  enabled: boolean;                       // Toggle auto-recording
  moduleType: ModuleType;                 // 'scale', 'rhythm', 'notewalking', etc.
  moduleConfig?: ModuleConfig;            // Module-specific config (saved to practice_log)
  minClicksBeforeRecord?: number;         // Default: 30
  maxClicksBeforeRecord?: number;         // Default: 90
  recordingDurationSeconds?: number;      // Default: 30
  existingMicStream?: MediaStream;        // For dual-use scenarios
}
```

### Returned State
```typescript
{
  isRecording: boolean;                   // Currently recording
  countdown: number | null;               // Clicks until recording (or null)
  scheduledClickCount: number | null;     // When recording will start
  hasRecorded: boolean;                   // Already recorded this session
  
  handleTick: (tickCount: number) => void;      // Call on each metronome tick
  startManualRecording: () => void;             // Manual recording trigger
  stopRecording: () => void;                    // Stop early
  reset: () => void;                            // Reset for new session
}
```

## How It Works

### Scheduling
1. When `enabled` is true, hook schedules random recording time (30-90 clicks)
2. Shows countdown when 10 clicks away
3. Starts recording at scheduled time
4. Records for 30 seconds (configurable)
5. Auto-saves to Supabase

### Mic Stream Cloning
```typescript
// Original stream (for pitch detection)
const stream = await getUserMedia({ audio: true });

// Cloned stream (for recording) - same mic!
const audioTrack = stream.getAudioTracks()[0];
const recordingStream = new MediaStream([audioTrack.clone()]);
```

This allows **simultaneous**:
- Pitch detection (real-time note display)
- Audio recording (for teacher review)

### Storage
Recordings saved to:
- **Bucket**: `practice`
- **Path**: `{user_id}/{timestamp}-{moduleType}.webm`
- **Linked in**: `practice_log` table with module info

## UI Examples

### Countdown Display
```tsx
{recording.countdown && (
  <div className="absolute top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-full animate-pulse">
    Recording in {recording.countdown}...
  </div>
)}
```

### Recording Indicator
```tsx
{recording.isRecording && (
  <div className="fixed top-20 right-4 flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full">
    <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
    <span className="font-semibold">REC {remainingTime}s</span>
  </div>
)}
```

### Toggle Switch
```tsx
<div className="flex items-center gap-2">
  <Label htmlFor="auto-record">Auto-Record</Label>
  <Switch
    id="auto-record"
    checked={autoRecordEnabled}
    onCheckedChange={setAutoRecordEnabled}
  />
  {recording.hasRecorded && (
    <Check className="w-4 h-4 text-green-500" />
  )}
</div>
```

## Integration Checklist

To add auto-recording to a module:

- [ ] Import `useAutoRecording` hook
- [ ] Get `autoRecord` setting from user profile
- [ ] Call `recording.handleTick()` in metronome tick handler
- [ ] Display countdown UI when `recording.countdown !== null`
- [ ] Display recording indicator when `recording.isRecording`
- [ ] For mic-using modules, pass `existingMicStream`
- [ ] Call `recording.reset()` when starting new session

## Troubleshooting

### Recording not saving
- Check Supabase storage bucket 'practice' exists
- Check RLS policies allow user to upload
- Check user is authenticated

### Mic access denied (Notewalking)
- Browser may block simultaneous mic access
- Use `existingMicStream` to clone instead of requesting new access

### Countdown not showing
- Ensure `handleTick` is called with incrementing tick count
- Check `enabled` is true
- Verify scheduling happened (check `scheduledClickCount`)

## Next Steps

1. Add to **RhythmTraining** ✅ (ready to implement)
2. Add to **ChordProgressionExercise** (notewalking) ✅ (with mic cloning)
3. Add to **Chord Progressions module** (when built)
4. Update **RiffPractice** to use this hook (refactor existing code)
