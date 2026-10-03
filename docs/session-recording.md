# Session Recording + Share

Code: `src/components/recording/`. It's mounted in the practice sidebar (`NotewalkingExercise.tsx`), which passes it the mic stream from `usePitchDetection`, the stage element ref and the key/focused node. It doesn't modify the practice engine, pitch detection or chord playback.

| File | Role |
| --- | --- |
| `RecordingEngine.ts` | Streams, 30fps canvas compositor, audio mix, MediaRecorder, full cleanup |
| `appAudioTap.ts` | Captures chord/metronome/drum output (see below) |
| `useSessionRecording.ts` | State machine, countdown, timer, leave-page guards |
| `SessionRecorder.tsx` | Record/Stop control, setup dialog, 3-2-1 overlay |
| `RecordingPreviewDialog.tsx` | Preview, Share, Download, upload links, Discard |
| `recordingUtils.ts` | MIME choice, filename, capability checks, share URLs |
| `sessionEventLog.ts` | Timestamped event log saved as a sidecar `.json` |

## How it works

- **Screen:** `getDisplayMedia({ preferCurrentTab: true })`. The practice view is DOM/SVG, not a canvas, so tab capture is the only option. On Chromium, Region Capture (`cropTo`) crops the video to the practice stage, so the app header isn't in it.
- **App audio:** every player connects per-chord/per-beat nodes straight to `ctx.destination`, and no Web Audio API can read a destination. While recording, `AudioNode.prototype.connect` is wrapped so any connection to a destination is also mirrored into a `MediaStreamDestination`. Playback itself is untouched, and the wrapper is removed on stop. This works in every browser and doesn't depend on the "share tab audio" checkbox.
- **Mic:** reuses pitch detection's stream through a separate mixing `AudioContext`. It's never stopped here. If the user turns the mic off and on during a recording, the new stream is picked up.
- **Performance:** if drawing frames gets slow, the compositor steps down from 30 to 24, 20, then 15fps. Resolution stays at 1080p.
- **Filename:** `guitarbrain_key-E_shape-C-top_2026-09-29.mp4`. The app has no day counter, so `day-NNN` is omitted. `shape` is included only in Focus mode. `#` becomes `sharp` (e.g. `key-Fsharp`).
- **Facebook group button:** set `VITE_FACEBOOK_GROUP_URL`. The button is hidden when it's unset.

## Companion files

Each recording also saves:
- `<name>.camera.mp4`: the raw camera at full resolution (up to 1080p, ~3 Mbps), video only. It keeps recording even when the camera overlay is hidden. If the camera is first switched on mid-recording, the file starts then.
- `<name>.mic.m4a`: the mic on its own (no chords or metronome), from the same stream pitch detection uses. It's one continuous file; while the mic is toggled off it's silent.

Both start in the same tick as the main video. The JSON header's `companions` block records `{ file, offsetMs }` for each, where `offsetMs` is how long after the main video's first frame the companion's first frame was captured (main time = companion time + offsetMs). WebM is used in browsers that can't write MP4.

## Session data (.json)

Every recording also produces a JSON file with the same name as the video (`guitarbrain_key-E_..._2026-09-30.json`). `t` is milliseconds from the video's first frame, accurate to about 0.1s. The events, in order:

- `recording-start` (t=0): key, bpm, whether playback is running, current chord, progression, focus mode/node, scale view, mic on/off.
- `chord`: `{ chord: "IV", root: "A", key: "E", bpm, cause: "playback-start" | "change" }`, logged when Start is pressed and on every chord change.
- `playback-stop`: Stop was pressed.
- `layout` (t=0, and again whenever the camera is toggled or moved): `{ layout, width, height, screen: {x,y,w,h}, camera: {x,y,w,h} | null }`, the exact pixel rectangles of each source in the video, for cropping.
- `note`: `{ note: "A2", freq, semi, degree, chord, chordTone, confidence }`. `semi` is semitones above the key root (0–11), which also covers chromatic notes; `degree` is the major-scale degree (1–7) or `null`, logged for every note pitch detection reports. `chord`/`chordTone` are `null` while playback is stopped. Notes highlighted with the keyboard (1–7) aren't logged.

Events are held in memory during the recording and written when it stops.

Getting it to Drive with the video:
- **Share:** sends the video, its companions and the JSON together. Chrome's share sheet won't accept `.json`, so there it's sent as `<name>.json.txt` (same content). If a share target only takes the video, the JSON is downloaded at the same moment.
- **Download / YouTube / Google Drive buttons:** save all the files. Chrome may ask once to "allow multiple downloads". For Drive, drag both files in.
- **".json only"** in the preview re-downloads just the data file.

## Browser limitations

- **Mobile (iOS Safari, Android Chrome):** no `getDisplayMedia`, so the screen can't be recorded. The feature falls back to a camera-only recording with guitar and app audio. Because the screen goes landscape on phones, recording is realistically a desktop feature. The share sheet is most useful on phones for files moved there later.
- **Safari (macOS):** MediaRecorder writes MP4 (H.264/AAC) only. `preferCurrentTab` is ignored, so users pick a window. There's no Region Capture, so the full window is recorded. Web Share with files works on macOS 13 and later.
- **Firefox:** MediaRecorder can't write MP4, so it falls back to WebM (VP8/VP9 + Opus). YouTube and Drive accept it; Facebook usually does but is less reliable. `preferCurrentTab` is ignored and there's no Region Capture. `navigator.share` isn't available on desktop, so only Download and the upload links show.
- **Chrome/Edge 126 and later:** MP4 (H.264 + AAC) output, tab pre-selected, cropped to the stage. Older versions fall back to WebM. Edge/Chrome on Windows show the Share button because they have a native share sheet.
- **WebM duration:** WebM from MediaRecorder has no duration in its header, so the preview works around it by seeking to find the length. Uploaded files are fine because platforms re-encode.
- **Long sessions:** 1-second chunks keep the encoder from holding one giant buffer, but the finished video is still a Blob in the browser (about 38 MB per minute at 1080p/5 Mbps, plus ~22 MB/min for the camera file). Chromium pages large Blobs to disk; Safari holds more in RAM. For multi-hour sessions, streaming chunks to OPFS/IndexedDB would be the next step.
- **What's in the video:** the recording indicator in the sidebar is part of the captured page, so it appears in the video. The 3-2-1 countdown and the dialogs don't.
- **Leaving the page:** closing or reloading the tab shows the browser's native warning. In-app links show a confirm while recording, but the browser Back button can't be intercepted (BrowserRouter has no blocker). In that case the recording is cleaned up (camera light off) and discarded.
- **Verified:** headless Chromium with fake devices produced a 1920×1080 and a 1080×1920 H.264/AAC MP4 with mixed mic and app audio, restored `connect`, and left the mic live. Not tested by hand yet in Safari, Firefox or on a phone.
